import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getAnthropic,
  COMPANION_MODEL,
  MEMORY_CURATOR_SYSTEM_PROMPT,
} from '@/lib/anthropic'
import { getOrFetchTranscript } from '@/lib/companion/media'
import { isVideoUrl } from '@/lib/media'

// Phase 10A.3 — Memory Curator agent.
//
// Fires when a commitment transitions 'active' → 'completed' (today: from
// the sponsorship release route, after the last pledged sponsorship flips
// to released and the commitment.status update lands). Reads the full
// message history scoped to this commitment_id, builds the user-turn
// envelope per docs/chat-room-plan.md §6.7.2, calls Sonnet with the
// chosen prompt, writes the result to commitments.completion_summary.
//
// Plan: docs/companion-v2-plan.md §3.3. Prompt design: chat-room-plan.md
// §6.7.4 (chosen prompt is Candidate D).
//
// This function does not throw. Errors are logged and surfaced via the
// discriminated-union return type. The release route invokes it inside an
// after() block so a Curator failure cannot affect the sponsor-facing
// release response. The admin endpoint invokes it synchronously so the
// operator sees the result.

const MAX_RECORD_CHARS = 400_000
const MAX_OUTPUT_TOKENS = 1200
const DAY_MS = 86_400_000

type CuratorMessageRow = {
  id: string
  user_id: string
  message_type: string
  body: string | null
  media_urls: string[] | null
  transcript: string | null
  is_session: boolean
  posted_at: string
}

export type CuratorResult =
  | {
      ok: true
      summary: string
      messageCount: number
      truncated: boolean
      inputTokens: number
      outputTokens: number
    }
  | { ok: false; error: string }

export async function generateCommitmentCompletionSummary(args: {
  db: SupabaseClient
  commitmentId: string
}): Promise<CuratorResult> {
  const { db, commitmentId } = args

  try {
    type CommitmentRow = {
      id: string
      user_id: string
      room_id: string
      started_at: string
      completed_at: string | null
      practices: { name: string } | { name: string }[] | null
    }
    const { data: commitment, error: commErr } = await db
      .from('commitments')
      .select('id, user_id, room_id, started_at, completed_at, practices(name)')
      .eq('id', commitmentId)
      .maybeSingle<CommitmentRow>()

    if (commErr || !commitment) {
      return { ok: false, error: 'Commitment not found.' }
    }

    const rawPractice = commitment.practices
    const practice = Array.isArray(rawPractice) ? rawPractice[0] : rawPractice
    const practiceName = practice?.name ?? 'their practice'

    const { data: practitionerProfile } = await db
      .from('profiles')
      .select('display_name')
      .eq('user_id', commitment.user_id)
      .maybeSingle()
    const practitionerName = practitionerProfile?.display_name ?? 'The practitioner'

    // Pull EVERY message scoped to this commitment_id, chronological.
    // Per plan §3.3 the Curator's input is "all room_messages rows where
    // commitment_id matches, plus their video transcripts" — including
    // companion_welcome, companion_response, companion_milestone,
    // sponsor_message, and practitioner_post (session and non-session).
    const { data: messageRows, error: msgErr } = await db
      .from('room_messages')
      .select('id, user_id, message_type, body, media_urls, transcript, is_session, posted_at')
      .eq('commitment_id', commitmentId)
      .order('posted_at', { ascending: true })
      .returns<CuratorMessageRow[]>()

    if (msgErr) {
      console.error('[companion/curator] messages query failed:', {
        commitmentId,
        error: msgErr,
      })
      return { ok: false, error: 'Failed to load commitment messages.' }
    }

    const messages = messageRows ?? []
    if (messages.length === 0) {
      return {
        ok: false,
        error: 'No messages found for this commitment — nothing to summarize.',
      }
    }

    // Resolve display names for every distinct human user_id appearing
    // in the message stream (Companion rows reuse the practitioner's
    // user_id but render as "Companion" — the message_type is what
    // disambiguates author).
    const userIds = Array.from(new Set(messages.map((m) => m.user_id)))
    const { data: profiles } = await db
      .from('profiles')
      .select('user_id, display_name')
      .in('user_id', userIds)
    const nameFor = (uid: string) =>
      profiles?.find((p) => p.user_id === uid)?.display_name ?? 'A member'

    // For any message with a video, resolve a transcript (cached or
    // fresh). Voice-annotated video is the default pattern for visual
    // practices (v4-decisions §7), so transcripts carry real signal the
    // Curator should attend to.
    const messagesWithTranscripts = await Promise.all(
      messages.map(async (m) => {
        const hasVideo = (m.media_urls ?? []).some(
          (u) => typeof u === 'string' && isVideoUrl(u)
        )
        if (!hasVideo) return m
        const transcript = await getOrFetchTranscript(m.id, m.media_urls, m.transcript)
        if (!transcript) return m
        return { ...m, transcript }
      })
    )

    const startedAt = commitment.started_at
    const { record, truncated } = formatRecord({
      messages: messagesWithTranscripts,
      startedAt,
      nameFor,
    })

    const envelope = buildEnvelope({
      practitionerName,
      practiceName,
      startedAt,
      completedAt: commitment.completed_at,
      record,
    })

    const anthropic = getAnthropic()
    const response = await anthropic.messages.create({
      model: COMPANION_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: MEMORY_CURATOR_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: envelope }],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      console.error('[companion/curator] unexpected response shape:', {
        commitmentId,
        types: response.content.map((b) => b.type),
      })
      return { ok: false, error: 'Curator response had no text content.' }
    }

    const summary = textBlock.text.trim()
    if (!summary) {
      return { ok: false, error: 'Curator returned empty summary text.' }
    }

    const { error: writeErr } = await db
      .from('commitments')
      .update({ completion_summary: summary })
      .eq('id', commitmentId)

    if (writeErr) {
      console.error('[companion/curator] completion_summary write failed:', {
        commitmentId,
        error: writeErr,
      })
      return { ok: false, error: 'Failed to persist completion_summary.' }
    }

    return {
      ok: true,
      summary,
      messageCount: messages.length,
      truncated,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    }
  } catch (err) {
    console.error('[companion/curator] unhandled error:', {
      commitmentId,
      error: err instanceof Error ? err.message : String(err),
    })
    return { ok: false, error: 'Curator failed (see server logs).' }
  }
}

// ---------------------------------------------------------------------------

function dayNumber(messageIso: string, startedAtIso: string): number {
  try {
    const start = new Date(startedAtIso).getTime()
    const ts = new Date(messageIso).getTime()
    return Math.max(1, Math.floor((ts - start) / DAY_MS) + 1)
  } catch {
    return 1
  }
}

function formatAuthor(messageType: string, userName: string): string {
  switch (messageType) {
    case 'companion_response':
      return 'Companion'
    case 'companion_welcome':
      return 'Companion (welcome)'
    case 'companion_milestone':
      return 'Companion (milestone)'
    case 'companion_moderation':
      return 'Companion (moderation)'
    case 'sponsor_message':
      return `${userName} (sponsor)`
    case 'system':
      return 'System'
    default:
      // practitioner_post and any future practitioner-authored types
      return userName
  }
}

function formatRecord(args: {
  messages: CuratorMessageRow[]
  startedAt: string
  nameFor: (uid: string) => string
}): { record: string; truncated: boolean } {
  const { messages, startedAt, nameFor } = args

  const lines = messages.map((m) => {
    const day = dayNumber(m.posted_at, startedAt)
    const date = m.posted_at.slice(0, 10)
    const author = formatAuthor(m.message_type, nameFor(m.user_id))
    const sessionMarker = m.is_session ? ', session' : ''
    const bodyText = (m.body ?? '').trim() || '(no text)'
    const transcriptNote =
      m.transcript && m.transcript.trim().length > 0
        ? ` [video transcript: "${m.transcript.trim()}"]`
        : ''
    return `[Day ${day}, ${date}${sessionMarker}] ${author}: "${bodyText}"${transcriptNote}`
  })

  const full = lines.join('\n')
  if (full.length <= MAX_RECORD_CHARS) return { record: full, truncated: false }

  // Overflow: drop oldest messages first. Same precedent as day90.ts —
  // the tail of the arc is more load-bearing for the summary than the
  // head, and an overflow at this scale (>400k chars in a 90-day
  // commitment) is itself a signal worth surfacing in the response.
  const trimmed = lines.slice()
  while (trimmed.length > 0) {
    const candidate = trimmed.join('\n')
    if (candidate.length <= MAX_RECORD_CHARS) {
      return {
        record: '(Earlier messages omitted for length.)\n' + candidate,
        truncated: true,
      }
    }
    trimmed.shift()
  }
  return { record: '(Record omitted — single message exceeded length budget.)', truncated: true }
}

function buildEnvelope(args: {
  practitionerName: string
  practiceName: string
  startedAt: string
  completedAt: string | null
  record: string
}): string {
  const startedDate = args.startedAt.slice(0, 10)
  const completedDate = args.completedAt
    ? args.completedAt.slice(0, 10)
    : '(not recorded)'
  return [
    'A 90-day commitment has just completed in this room. Write the retrospective summary per your guidelines.',
    '',
    `Practitioner: ${args.practitionerName}`,
    `Practice: "${args.practiceName}"`,
    `Started: ${startedDate}`,
    `Completed: ${completedDate}`,
    '',
    'The full message history of this commitment, chronological:',
    '',
    args.record,
  ].join('\n')
}
