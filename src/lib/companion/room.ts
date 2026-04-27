import type { SupabaseClient } from '@supabase/supabase-js'
import type Anthropic from '@anthropic-ai/sdk'
import {
  getAnthropic,
  COMPANION_MODEL,
  COMPANION_ROOM_SYSTEM_PROMPT,
} from '@/lib/anthropic'
import { buildImageBlocks, getOrFetchTranscript } from '@/lib/companion/media'

// src/lib/companion/room.ts
//
// Everything Companion does inside a room funnels through here. Three
// entry points today:
//
// - generateCompanionRoomResponse: called after a practitioner post
//   that should get a Companion reply. Two modes via triggerKind:
//     * 'session' (default): the triggering row is a session-marked
//       post; envelope frames it as "marked session for today".
//     * 'followup': the triggering row is a non-session practitioner
//       message answering a question the Companion asked earlier;
//       envelope frames it as continuing the conversation. Added in
//       B/C/D arc Session 4 (2026-04-21). See
//       docs/chat-room-plan.md §6.6.
//   Reads the room's recent history, the triggering message (text +
//   media + video transcripts), and the roster of members with their
//   pledges. Produces a companion_response row.
//
// - generateCompanionRoomWelcome: called after a commitment is
//   declared. Produces a companion_welcome row — the first message in
//   the room from the Companion, naming the commitment and the moment.
//
// - generateCompanionRoomMilestone: called when a commitment crosses
//   day 30, 60, or 90 (manual admin trigger today; cron in B/C/D arc
//   Session 2). Produces a companion_milestone row marking the day.
//   Envelope design and dry-run rationale in
//   docs/chat-room-plan.md §6.5.
//
// All three use COMPANION_ROOM_SYSTEM_PROMPT and claude-sonnet-4-6.
// Context assembly is shared. The library is deliberately small: it
// writes rows with message_type set appropriately so existing
// room-scoped reads pick them up without schema changes.
//
// The functions do not throw; callers treat a returned null as "no
// message produced, move on." This keeps the session-post write path
// resilient: if the Companion is unavailable, the post still lands.

// How many recent room messages to include in the context. The room
// prompt is anchored on specific events (new member, session marked,
// commitment declared), not arbitrarily long history — 50 is a
// generous ceiling that covers a few weeks of typical activity.
const MAX_ROOM_HISTORY = 50

// How many prior-commitment completion summaries to inject ahead of
// the recent-message window. Phase 10A cross-commitment memory: when
// a commitment transitions to completed, the Memory Curator agent
// writes a `commitments.completion_summary` row; we lift the most
// recent N of those into the Companion's working memory so a new
// commitment in the same room can be discussed against the prior arc.
// Five is generous for any room that's actually accumulated this much
// history; revisit when a real room exceeds it. Plan: §3.2.
const MAX_COMPLETION_SUMMARIES = 5

// Cap bodies pulled into context. A 2000-char body in the transcript
// does not earn its place; long messages get truncated and flagged.
const MAX_BODY_CHARS = 1200

// ---------------------------------------------------------------------------
// Shared context assembly
// ---------------------------------------------------------------------------

type RoomContextRow = {
  id: string
  user_id: string
  commitment_id: string | null
  message_type: string
  body: string | null
  media_urls: string[] | null
  transcript: string | null
  is_session: boolean
  posted_at: string
}

type MemberRow = {
  user_id: string
  joined_at: string
  profiles: { display_name: string | null } | { display_name: string | null }[] | null
}

type CommitmentRow = {
  id: string
  user_id: string
  status: string
  started_at: string
  practices: { name: string } | { name: string }[] | null
}

type SponsorshipRow = {
  commitment_id: string
  sponsor_user_id: string | null
  sponsor_name: string | null
  pledge_amount: string | number
  status: string
}

function pickSingle<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

function daysSince(isoStart: string, isoNow: string = new Date().toISOString()): number {
  const start = new Date(isoStart).getTime()
  const now = new Date(isoNow).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(now) || now <= start) return 1
  // Day 1 is the day the streak began; we round up so "started today"
  // reads as day 1 in copy, not day 0.
  const ms = now - start
  return Math.max(1, Math.floor(ms / (1000 * 60 * 60 * 24)) + 1)
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s
  return s.slice(0, n).trimEnd() + ' …'
}

/**
 * Parse the addressee out of a Companion response by looking for a
 * leading "{display_name}, ..." pattern, where display_name matches a
 * known room member. The system prompt instructs the Companion to name
 * its addressee when asking a question (see the addressing-discipline
 * paragraph in COMPANION_ROOM_SYSTEM_PROMPT). When that lands cleanly,
 * we lift the addressee out of the prose and store it on the row so
 * the followup trigger can gate on it explicitly.
 *
 * Returns null when the leading token doesn't match any room member,
 * or when the response doesn't begin with a name-and-comma at all
 * (room-wide statement, milestone marker, etc.). Callers should treat
 * null as "no explicit addressee" and fall back to the implicit
 * trigger-user gate.
 */
function parseAddresseeUserId(
  responseText: string,
  roomMembers: Array<{ user_id: string; display_name: string | null }>
): string | null {
  const trimmed = responseText.trimStart()
  // Greedy on the comma so multi-word names ("Sarah Jane,") still work.
  const commaIdx = trimmed.indexOf(',')
  if (commaIdx <= 0 || commaIdx > 40) return null
  const candidate = trimmed.slice(0, commaIdx).trim()
  if (!candidate) return null

  const lower = candidate.toLowerCase()
  const matches = roomMembers.filter(
    (m) => m.display_name && m.display_name.toLowerCase() === lower
  )
  // Exactly one match required — ambiguous matches (two members with
  // the same display_name) fall back to null rather than guessing.
  if (matches.length !== 1) return null
  return matches[0].user_id
}

/**
 * Pull the members of a room with display names, their active
 * commitments (if any), and the sponsorships that tie specific
 * sponsors to specific commitments. Used to render the roster header
 * the Companion sees.
 */
async function loadRoomContext(
  db: SupabaseClient,
  roomId: string
): Promise<{
  memberLines: string[]
  roomMembers: Array<{ user_id: string; display_name: string | null }>
  activeCommitments: Array<{
    commitmentId: string
    userId: string
    practitionerName: string
    practiceName: string
    dayNumber: number
  }>
}> {
  const [
    { data: memberships },
    { data: commitments },
  ] = await Promise.all([
    db
      .from('room_memberships')
      .select('user_id, joined_at, profiles(display_name)')
      .eq('room_id', roomId)
      .eq('state', 'active')
      .returns<MemberRow[]>(),
    db
      .from('commitments')
      .select('id, user_id, status, started_at, practices(name)')
      .eq('room_id', roomId)
      .eq('status', 'active')
      .returns<CommitmentRow[]>(),
  ])

  // Build the quick lookup for practitioner user_ids
  const activeCommitments = (commitments ?? []).map((c) => {
    const member = (memberships ?? []).find((m) => m.user_id === c.user_id)
    const memberProfile = pickSingle(member?.profiles ?? null)
    const practiceJoin = pickSingle(c.practices)
    return {
      commitmentId: c.id,
      userId: c.user_id,
      practitionerName: memberProfile?.display_name ?? 'A practitioner',
      practiceName: practiceJoin?.name ?? 'their practice',
      dayNumber: daysSince(c.started_at),
    }
  })

  // Pull sponsorships for any active commitment so we can annotate
  // roster lines with the pledges they represent.
  const commitmentIds = activeCommitments.map((ac) => ac.commitmentId)
  let sponsorships: SponsorshipRow[] = []
  if (commitmentIds.length > 0) {
    const { data } = await db
      .from('sponsorships')
      .select('commitment_id, sponsor_user_id, sponsor_name, pledge_amount, status')
      .in('commitment_id', commitmentIds)
      .in('status', ['pledged', 'released', 'paid'])
      .returns<SponsorshipRow[]>()
    sponsorships = data ?? []
  }

  const memberLines = (memberships ?? []).map((m) => {
    const profile = pickSingle(m.profiles)
    const name = profile?.display_name ?? 'A member'

    // Is this member a practitioner of an active commitment?
    const ownCommitment = activeCommitments.find((ac) => ac.userId === m.user_id)
    if (ownCommitment) {
      return `- ${name} — practitioner, committing to "${ownCommitment.practiceName}", day ${ownCommitment.dayNumber} of 90`
    }

    // Sponsorships tying this member to specific practitioners.
    const theirSponsorships = sponsorships.filter((s) => s.sponsor_user_id === m.user_id)
    if (theirSponsorships.length > 0) {
      const parts = theirSponsorships.map((s) => {
        const target = activeCommitments.find((ac) => ac.commitmentId === s.commitment_id)
        const amount = Number(s.pledge_amount)
        const amountStr = Number.isFinite(amount) ? `$${amount.toFixed(0)}` : `pledged`
        return target
          ? `${amountStr} backing ${target.practitionerName}'s "${target.practiceName}"`
          : `${amountStr}`
      })
      return `- ${name} — sponsor (${parts.join('; ')})`
    }

    return `- ${name} — member`
  })

  const roomMembers = (memberships ?? []).map((m) => {
    const profile = pickSingle(m.profiles)
    return { user_id: m.user_id, display_name: profile?.display_name ?? null }
  })

  return { memberLines, roomMembers, activeCommitments }
}

/**
 * Pull completion summaries for prior commitments in this room (Phase
 * 10A cross-commitment memory). Returns a single block of envelope-
 * formatted lines, oldest first, capped at MAX_COMPLETION_SUMMARIES.
 * Empty string when the room has no completed commitments with a
 * Curator-written summary — which is every room today, so the
 * injection is a no-op until the Curator agent ships in 10A.3.
 *
 * Skips silently when `completion_summary` is null on a completed
 * commitment (legacy data or a Curator failure). Per plan §3.2:
 * "don't fall back to 'this commitment completed but I have no record
 * of it' because that adds noise the model will reach for."
 */
async function loadCompletionSummariesText(
  db: SupabaseClient,
  roomId: string
): Promise<string> {
  type CompletedRow = {
    completion_summary: string | null
    completed_at: string | null
    user_id: string
    practices: { name: string } | { name: string }[] | null
  }
  const { data: rows } = await db
    .from('commitments')
    .select('completion_summary, completed_at, user_id, practices(name)')
    .eq('room_id', roomId)
    .eq('status', 'completed')
    .not('completion_summary', 'is', null)
    .order('completed_at', { ascending: false, nullsFirst: false })
    .limit(MAX_COMPLETION_SUMMARIES)
    .returns<CompletedRow[]>()

  if (!rows || rows.length === 0) return ''

  const userIds = Array.from(new Set(rows.map((r) => r.user_id)))
  const { data: profiles } = await db
    .from('profiles')
    .select('user_id, display_name')
    .in('user_id', userIds)
  const nameFor = (uid: string) =>
    profiles?.find((p) => p.user_id === uid)?.display_name ?? 'A practitioner'

  // Reverse to oldest first — the model sees prior arcs in time order.
  return [...rows]
    .reverse()
    .map((r) => {
      const practice = pickSingle(r.practices)?.name ?? 'their practice'
      const summary = (r.completion_summary ?? '').trim()
      return `Earlier in this room, ${nameFor(r.user_id)} completed "${practice}": ${summary}`
    })
    .join('\n\n')
}

/**
 * Pull the most-recent room messages (chronological ascending) to
 * include as the conversational history the Companion is listening
 * to. Each message is formatted by author and type.
 *
 * Phase 10A: prepends any completion summaries from prior commitments
 * in this room ahead of the recent-message window, so the Companion
 * has cross-commitment memory of arcs that fell out of the 50-message
 * ceiling. See plan §3.2 for the read-path shape.
 */
async function loadRoomHistory(
  db: SupabaseClient,
  roomId: string,
  excludeMessageId?: string
): Promise<{ historyText: string; triggerRow: RoomContextRow | null }> {
  // Fetch the recent-message window and the completion summaries in
  // parallel. The summaries are typically empty in production today
  // (zero rooms have a completed commitment with a Curator summary
  // yet); the call is bounded and safe regardless.
  const [{ data: rows }, summariesText] = await Promise.all([
    db
      .from('room_messages')
      .select(
        'id, user_id, commitment_id, message_type, body, media_urls, transcript, is_session, posted_at'
      )
      .eq('room_id', roomId)
      .order('posted_at', { ascending: false })
      .limit(MAX_ROOM_HISTORY)
      .returns<RoomContextRow[]>(),
    loadCompletionSummariesText(db, roomId),
  ])

  if (!rows || rows.length === 0) {
    const empty = '(the room has no prior messages)'
    return {
      historyText: summariesText ? `${summariesText}\n\n${empty}` : empty,
      triggerRow: null,
    }
  }

  // Look up display names in one shot.
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)))
  const { data: profiles } = await db
    .from('profiles')
    .select('user_id, display_name')
    .in('user_id', userIds)
  const nameFor = (uid: string) =>
    profiles?.find((p) => p.user_id === uid)?.display_name ?? 'A member'

  // Reverse to chronological ascending for the model.
  const ascending = [...rows].reverse()
  const lines: string[] = []
  let triggerRow: RoomContextRow | null = null

  for (const r of ascending) {
    if (excludeMessageId && r.id === excludeMessageId) {
      triggerRow = r
      continue // hold back — the triggering message is shown separately
    }
    const when = new Date(r.posted_at).toISOString().slice(0, 10)
    const who =
      r.message_type === 'companion_response' ||
      r.message_type === 'companion_welcome' ||
      r.message_type === 'companion_milestone' ||
      r.message_type === 'companion_moderation'
        ? 'Companion'
        : nameFor(r.user_id)
    const marker = r.is_session ? ' [marked as session]' : ''
    const bodyText = r.body ? truncate(r.body, MAX_BODY_CHARS) : '(no text)'
    const transcriptNote =
      r.transcript && r.transcript.trim().length > 0
        ? ` [video transcript: "${truncate(r.transcript, 400)}"]`
        : ''
    const mediaNote =
      r.media_urls && r.media_urls.length > 0
        ? ` [${r.media_urls.length} attachment${r.media_urls.length > 1 ? 's' : ''}]`
        : ''
    lines.push(`${when} ${who}${marker}: ${bodyText}${mediaNote}${transcriptNote}`)
  }

  const messagesText = lines.length > 0 ? lines.join('\n') : '(the room has no prior messages)'
  return {
    historyText: summariesText ? `${summariesText}\n\n${messagesText}` : messagesText,
    triggerRow,
  }
}

/**
 * Build the user-turn content array for the Anthropic call. Image
 * blocks for any image attachments on the triggering message come
 * first (the model reads images better at the top), then the text
 * context, then the triggering message itself.
 */
async function buildUserContent(args: {
  db: SupabaseClient
  triggerRow: RoomContextRow
  historyText: string
  memberLines: string[]
  activeCommitments: Array<{
    commitmentId: string
    userId: string
    practitionerName: string
    practiceName: string
    dayNumber: number
  }>
  triggerUserName: string
  // 'session'  — the trigger row is a session-marked practitioner post.
  //              Envelope frames the Companion as reflecting on today's
  //              session, the original v1 behavior.
  // 'followup' — the trigger row is a non-session practitioner message
  //              that appears to be answering a question the Companion
  //              asked in a prior message in the room. Envelope frames
  //              the Companion as continuing that conversation rather
  //              than marking a fresh session. Added 2026-04-21 in the
  //              B/C/D arc Session 4 (C-2) to fix the "talks at, not
  //              with" problem — see docs/chat-room-plan.md §6.6.
  triggerKind: 'session' | 'followup'
}): Promise<Array<Anthropic.Messages.ContentBlockParam>> {
  const { db, triggerRow, historyText, memberLines, activeCommitments, triggerUserName, triggerKind } = args

  const imageBlocks = buildImageBlocks(triggerRow.media_urls)
  const transcript = await getOrFetchTranscript(
    triggerRow.id,
    triggerRow.media_urls,
    triggerRow.transcript
  )

  // Persist transcript for future calls so we don't re-transcribe.
  if (transcript && (!triggerRow.transcript || triggerRow.transcript.trim().length === 0)) {
    try {
      await db
        .from('room_messages')
        .update({ transcript })
        .eq('id', triggerRow.id)
    } catch (err) {
      console.error('[companion/room] transcript cache write failed:', err)
    }
  }

  // The triggering message for the Companion to respond to. Which
  // commitment it belongs to, what day it is.
  const triggerCommitment = activeCommitments.find(
    (ac) => ac.commitmentId === triggerRow.commitment_id
  )

  const triggerHeader = triggerCommitment
    ? `${triggerUserName} (day ${triggerCommitment.dayNumber} of 90, "${triggerCommitment.practiceName}")`
    : triggerUserName

  const triggerBody = triggerRow.body?.trim() || '(no text body)'
  const triggerTranscriptLine =
    transcript && transcript.trim().length > 0
      ? `\nVideo transcript: "${transcript.trim()}"`
      : ''
  const triggerMediaLine =
    triggerRow.media_urls && triggerRow.media_urls.length > 0
      ? `\n(Attached: ${triggerRow.media_urls.length} file${triggerRow.media_urls.length > 1 ? 's' : ''})`
      : ''

  const textBlock: Anthropic.Messages.TextBlockParam = {
    type: 'text',
    text: (triggerKind === 'session'
      ? [
          `Room members:`,
          memberLines.length > 0 ? memberLines.join('\n') : '(no active members)',
          '',
          `Recent room activity (oldest first):`,
          historyText,
          '',
          `A practitioner just marked this message as their session for today. Respond per your guidelines.`,
          '',
          `${triggerHeader} marked this session:`,
          `"${triggerBody}"${triggerMediaLine}${triggerTranscriptLine}`,
        ]
      : [
          `Room members:`,
          memberLines.length > 0 ? memberLines.join('\n') : '(no active members)',
          '',
          `Recent room activity (oldest first):`,
          historyText,
          '',
          `You asked a question in your most recent message to this room. The practitioner is replying to that question now — not marking a session, just continuing the conversation. Respond per your guidelines.`,
          '',
          `${triggerHeader} replied:`,
          `"${triggerBody}"${triggerMediaLine}${triggerTranscriptLine}`,
        ]
    ).join('\n'),
  }

  return [...imageBlocks, textBlock]
}

// ---------------------------------------------------------------------------
// Public: respond to a session-marked message
// ---------------------------------------------------------------------------

/**
 * Called from /api/rooms/[id]/messages after a session-marked
 * practitioner post. Generates a companion_response row and returns
 * its ID. Returns null on any failure — callers should treat null as
 * "no response written, move on."
 */
export async function generateCompanionRoomResponse(args: {
  db: SupabaseClient
  roomId: string
  triggerMessageId: string
  // Defaults to 'session' to preserve the v1 call shape from
  // /api/rooms/[id]/messages when is_session=true. 'followup' is passed
  // when the route detects the practitioner is answering a pending
  // Companion question in a non-session message. See route comments
  // and docs/chat-room-plan.md §6.6.
  triggerKind?: 'session' | 'followup'
}): Promise<string | null> {
  const { db, roomId, triggerMessageId, triggerKind = 'session' } = args

  try {
    const [{ memberLines, roomMembers, activeCommitments }, { historyText, triggerRow }] =
      await Promise.all([
        loadRoomContext(db, roomId),
        loadRoomHistory(db, roomId, triggerMessageId),
      ])

    if (!triggerRow) {
      console.error('[companion/room] trigger message not found in history', {
        roomId,
        triggerMessageId,
      })
      return null
    }

    // Resolve the triggering user's display name.
    const { data: triggerProfile } = await db
      .from('profiles')
      .select('display_name')
      .eq('user_id', triggerRow.user_id)
      .maybeSingle()
    const triggerUserName = triggerProfile?.display_name ?? 'A practitioner'

    const content = await buildUserContent({
      db,
      triggerRow,
      historyText,
      memberLines,
      activeCommitments,
      triggerUserName,
      triggerKind,
    })

    const anthropic = getAnthropic()
    const response = await anthropic.messages.create({
      model: COMPANION_MODEL,
      max_tokens: 400,
      system: COMPANION_ROOM_SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      console.error('[companion/room] unexpected response shape', {
        roomId,
        triggerMessageId,
        types: response.content.map((b) => b.type),
      })
      return null
    }

    const responseText = textBlock.text.trim()
    if (!responseText) return null

    // Lift the addressee out of the response prose. The system prompt
    // tells the Companion to begin a question with the addressee's
    // name and a comma; when it does, this resolves to a user_id and
    // we store it. Null when the response doesn't begin with a known
    // member name — the followup gate then falls back to the
    // implicit-addressee check on user_id.
    const addresseeUserId = parseAddresseeUserId(responseText, roomMembers)

    // Need a user_id for the row — the Companion has no user account.
    // We write these rows as the practitioner whose message triggered
    // them, which keeps the user_id non-null (schema requires it) and
    // makes the Companion's messages easy to query alongside the
    // triggering message. message_type='companion_response' is what
    // the UI branches on for styling.
    const { data: inserted, error: insertErr } = await db
      .from('room_messages')
      .insert({
        room_id: roomId,
        user_id: triggerRow.user_id,
        commitment_id: triggerRow.commitment_id,
        message_type: 'companion_response',
        body: responseText,
        media_urls: [],
        transcript: null,
        is_session: false,
        addressee_user_id: addresseeUserId,
      })
      .select('id')
      .single()

    if (insertErr || !inserted) {
      console.error('[companion/room] insert failed:', insertErr)
      return null
    }

    return inserted.id
  } catch (err) {
    console.error('[companion/room] generateCompanionRoomResponse error:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Public: welcome a new commitment / first member
// ---------------------------------------------------------------------------

/**
 * Called from /api/commitments after a commitment is declared (and
 * the room is fresh, or nearly so — in v4 the first commitment IS the
 * room's creation). Writes a companion_welcome row naming the
 * commitment and the moment. Returns the new row's ID or null on
 * failure.
 */
export async function generateCompanionRoomWelcome(args: {
  db: SupabaseClient
  roomId: string
  commitmentId: string
}): Promise<string | null> {
  const { db, roomId, commitmentId } = args

  try {
    type WelcomeCommitment = {
      id: string
      user_id: string
      started_at: string
      practices: { name: string } | { name: string }[] | null
    }
    const { data: commitment } = await db
      .from('commitments')
      .select('id, user_id, started_at, practices(name)')
      .eq('id', commitmentId)
      .maybeSingle<WelcomeCommitment>()

    if (!commitment) return null

    const practiceJoin = pickSingle(commitment.practices)
    const practiceName = practiceJoin?.name ?? 'their practice'

    const { data: profile } = await db
      .from('profiles')
      .select('display_name')
      .eq('user_id', commitment.user_id)
      .maybeSingle()
    const practitionerName = profile?.display_name ?? 'the practitioner'

    // Pull display_name alongside user_id so we can resolve the
    // addressee out of the welcome prose without a second roundtrip.
    type WelcomeMember = {
      user_id: string
      profiles: { display_name: string | null } | { display_name: string | null }[] | null
    }
    const { data: memberships } = await db
      .from('room_memberships')
      .select('user_id, profiles(display_name)')
      .eq('room_id', roomId)
      .eq('state', 'active')
      .returns<WelcomeMember[]>()
    const otherMemberCount = (memberships ?? []).filter(
      (m) => m.user_id !== commitment.user_id
    ).length
    const roomMembers = (memberships ?? []).map((m) => {
      const p = pickSingle(m.profiles)
      return { user_id: m.user_id, display_name: p?.display_name ?? null }
    })

    // The welcome fires at room creation time; there are typically
    // zero other members. The prompt handles both cases — we pass the
    // count so the Companion can name "alone in the room" when true.
    const contextText = [
      `A practitioner has just declared a commitment inside a newly-created room. The streak starts today. Generate the welcome per your guidelines for this event.`,
      '',
      `Practitioner: ${practitionerName}`,
      `Commitment: "${practiceName}"`,
      `Room population besides the practitioner: ${otherMemberCount}`,
    ].join('\n')

    const anthropic = getAnthropic()
    const response = await anthropic.messages.create({
      model: COMPANION_MODEL,
      max_tokens: 300,
      system: COMPANION_ROOM_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: contextText }],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') return null
    const responseText = textBlock.text.trim()
    if (!responseText) return null

    const addresseeUserId = parseAddresseeUserId(responseText, roomMembers)

    const { data: inserted, error: insertErr } = await db
      .from('room_messages')
      .insert({
        room_id: roomId,
        user_id: commitment.user_id,
        commitment_id: commitment.id,
        message_type: 'companion_welcome',
        body: responseText,
        media_urls: [],
        transcript: null,
        is_session: false,
        addressee_user_id: addresseeUserId,
      })
      .select('id')
      .single()

    if (insertErr || !inserted) {
      console.error('[companion/room] welcome insert failed:', insertErr)
      return null
    }
    return inserted.id
  } catch (err) {
    console.error('[companion/room] generateCompanionRoomWelcome error:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Public: mark a day-30 / day-60 / day-90 milestone
// ---------------------------------------------------------------------------

/**
 * Called when a commitment's started_at is exactly 30, 60, or 90
 * calendar days ago. Writes a companion_milestone row whose copy is
 * "Day thirty." / "Day sixty." / "Day ninety." — the room prompt's
 * own contract for milestone markers.
 *
 * The envelope this sends to the model is deliberate: roster + recent
 * history + a single trailing line naming the event. For day 90, that
 * line explicitly disambiguates that this is the milestone-day marker,
 * not the completion marker — otherwise the model reaches for the
 * "return the room to the sponsors" completion template, which belongs
 * to the distinct final-session-marked-on-day-90 event. Full rationale
 * and dry-run results in docs/chat-room-plan.md §6.5.
 *
 * Non-idempotent by design. The admin endpoint that calls this does
 * not check for an existing milestone row at this day — double-inserts
 * are visible in the room and deletable. Session 2's cron will add the
 * idempotency guard.
 *
 * Returns the new row's ID or null on failure.
 */
export async function generateCompanionRoomMilestone(args: {
  db: SupabaseClient
  roomId: string
  commitmentId: string
  dayNumber: 30 | 60 | 90
}): Promise<string | null> {
  const { db, roomId, commitmentId, dayNumber } = args

  try {
    type MilestoneCommitment = {
      id: string
      user_id: string
      room_id: string
      status: string
      started_at: string
      practices: { name: string } | { name: string }[] | null
    }
    const { data: commitment } = await db
      .from('commitments')
      .select('id, user_id, room_id, status, started_at, practices(name)')
      .eq('id', commitmentId)
      .maybeSingle<MilestoneCommitment>()

    if (!commitment) {
      console.error('[companion/room] milestone: commitment not found', {
        commitmentId,
      })
      return null
    }

    // Guard against a caller passing a mismatched (roomId, commitmentId)
    // pair. The admin endpoint derives roomId from the commitment, so
    // this is defense-in-depth for future callers (Session 2 cron in
    // particular will query both and we want a hard failure if they
    // diverge).
    if (commitment.room_id !== roomId) {
      console.error('[companion/room] milestone: commitment/room mismatch', {
        commitmentId,
        expectedRoomId: commitment.room_id,
        providedRoomId: roomId,
      })
      return null
    }

    const practiceJoin = pickSingle(commitment.practices)
    const practiceName = practiceJoin?.name ?? 'their practice'

    const { data: profile } = await db
      .from('profiles')
      .select('display_name')
      .eq('user_id', commitment.user_id)
      .maybeSingle()
    const practitionerName = profile?.display_name ?? 'the practitioner'

    // Roster + history, same shape as the session-response envelope.
    // The milestone copy doesn't reference these, but carrying them
    // keeps the envelope consistent across all three Companion entry
    // points and gives the model a moment of self-orientation before
    // the trailing event line.
    const [{ memberLines }, { historyText }] = await Promise.all([
      loadRoomContext(db, roomId),
      loadRoomHistory(db, roomId),
    ])

    const eventLine =
      dayNumber === 90
        ? `Day 90 has been reached for ${practitionerName}'s commitment to "${practiceName}". The practitioner has not yet marked a final session today; this is the milestone-day marker, not the completion marker. Mark the milestone per your guidelines.`
        : `Day ${dayNumber} has been reached for ${practitionerName}'s commitment to "${practiceName}". Mark the milestone per your guidelines.`

    const contextText = [
      `Room members:`,
      memberLines.length > 0 ? memberLines.join('\n') : '(no active members)',
      '',
      `Recent room activity (oldest first):`,
      historyText,
      '',
      eventLine,
    ].join('\n')

    const anthropic = getAnthropic()
    const response = await anthropic.messages.create({
      model: COMPANION_MODEL,
      // Milestone copy is measured in words, not paragraphs. 200 is
      // more than enough headroom for "Day ninety." plus a stray
      // sentence; anything longer would be a prompt failure worth
      // seeing rather than silently truncating.
      max_tokens: 200,
      system: COMPANION_ROOM_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: contextText }],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      console.error('[companion/room] milestone: unexpected response shape', {
        roomId,
        commitmentId,
        dayNumber,
        types: response.content.map((b) => b.type),
      })
      return null
    }

    const responseText = textBlock.text.trim()
    if (!responseText) return null

    // Same row-authoring pattern as generateCompanionRoomWelcome: the
    // Companion has no user account, so we use the practitioner's
    // user_id as the row's user_id. message_type='companion_milestone'
    // is what the UI and the future cron idempotency check branch on.
    const { data: inserted, error: insertErr } = await db
      .from('room_messages')
      .insert({
        room_id: roomId,
        user_id: commitment.user_id,
        commitment_id: commitment.id,
        message_type: 'companion_milestone',
        body: responseText,
        media_urls: [],
        transcript: null,
        is_session: false,
      })
      .select('id')
      .single()

    if (insertErr || !inserted) {
      console.error('[companion/room] milestone insert failed:', insertErr)
      return null
    }
    return inserted.id
  } catch (err) {
    console.error('[companion/room] generateCompanionRoomMilestone error:', err)
    return null
  }
}
