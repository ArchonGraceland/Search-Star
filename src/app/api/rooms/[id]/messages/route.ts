import { NextResponse, after } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { generateCompanionRoomResponse } from '@/lib/companion/room'

// POST /api/rooms/[id]/messages
//
// Inserts a single message into a room. The caller must be a member of
// the room (state='active'). Two message types are accepted here:
//
// - practitioner_post: the user is the active practitioner of this
//   commitment (or any commitment in this room). Body is required.
//   is_session=true marks the message as "today's session" — the thing
//   that becomes part of the record sponsors read. At most one
//   session-marked message per practitioner per UTC calendar day (DB
//   constraint uq_room_messages_one_session_per_day enforces this).
//
// - sponsor_message: any other member of the room posting chat. Not
//   eligible to be session-marked. commitment_id may be supplied to
//   indicate which practitioner the sponsor is addressing; null is
//   also valid for room-level chat.
//
// message_type is inferred from whether the caller is the practitioner
// of the supplied commitment_id — callers don't declare it. For rooms
// with multiple practitioners this does the right thing: a user is a
// practitioner iff they own some active commitment in this room, AND
// the specific commitment_id they're posting against belongs to them.
//
// When is_session=true, the Companion is invoked via Next.js after()
// — i.e. after the HTTP response has been sent. The POST returns the
// inserted message row in <200ms; the Companion's response is written
// into the same room as a separate companion_response row, which the
// client picks up via the Supabase Realtime subscription on
// room_messages (C-1, shipped 2026-04-21). Failures in the Companion
// path are logged to Vercel runtime logs; the practitioner's session
// is still recorded, and the sponsor's completion-page view is a
// separate code path that recomputes independently.

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: roomId } = await params

  const ssr = await createClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceClient()

  // Gate 1: caller is an active member of this room.
  const { data: membership } = await db
    .from('room_memberships')
    .select('id, state')
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership || membership.state !== 'active') {
    return NextResponse.json({ error: 'Not a member of this room.' }, { status: 403 })
  }

  // Parse and validate input.
  const body = await request.json().catch(() => ({}))
  const {
    body: textBody,
    media_urls,
    transcript,
    commitment_id,
    is_session,
  } = body as {
    body?: string
    media_urls?: string[]
    transcript?: string
    commitment_id?: string | null
    is_session?: boolean
  }

  const cleanText = typeof textBody === 'string' ? textBody.trim() : ''
  const cleanMedia = Array.isArray(media_urls)
    ? media_urls.filter((u): u is string => typeof u === 'string' && u.length > 0)
    : []
  const cleanTranscript = typeof transcript === 'string' && transcript.trim().length > 0
    ? transcript.trim()
    : null

  if (!cleanText && cleanMedia.length === 0) {
    return NextResponse.json({ error: 'Message must have text or media.' }, { status: 400 })
  }

  // Determine message_type. If commitment_id is supplied and owned by
  // the caller, this is a practitioner_post. Otherwise (no
  // commitment_id, or commitment belongs to someone else) it is a
  // sponsor_message. Reject cross-room references — commitment must
  // belong to this specific room.
  let messageType: 'practitioner_post' | 'sponsor_message' = 'sponsor_message'
  let resolvedCommitmentId: string | null = null

  if (commitment_id) {
    const { data: commitment } = await db
      .from('commitments')
      .select('id, user_id, room_id, status')
      .eq('id', commitment_id)
      .maybeSingle()

    if (!commitment || commitment.room_id !== roomId) {
      return NextResponse.json(
        { error: 'Commitment not found in this room.' },
        { status: 404 }
      )
    }
    resolvedCommitmentId = commitment.id

    if (commitment.user_id === user.id) {
      messageType = 'practitioner_post'
    }
  }

  // is_session is only meaningful on practitioner_post. Silently drop
  // it on anything else rather than erroring; the client shouldn't
  // send it but we shouldn't fail the whole post if it does.
  const sessionFlag =
    messageType === 'practitioner_post' && is_session === true

  // Insert the primary message.
  const { data: inserted, error: insertErr } = await db
    .from('room_messages')
    .insert({
      room_id: roomId,
      user_id: user.id,
      commitment_id: resolvedCommitmentId,
      message_type: messageType,
      body: cleanText || null,
      media_urls: cleanMedia,
      transcript: cleanTranscript,
      is_session: sessionFlag,
    })
    .select('id, posted_at, message_type, is_session')
    .single()

  if (insertErr || !inserted) {
    // Unique violation on one-session-per-day.
    if (insertErr?.code === '23505') {
      return NextResponse.json(
        {
          error:
            'You already have a session marked for today. Tap the earlier message to re-mark it instead.',
        },
        { status: 409 }
      )
    }
    console.error('[rooms/messages POST] insert error:', insertErr)
    return NextResponse.json({ error: 'Failed to post message.' }, { status: 500 })
  }

  // If this was a session-marked practitioner post, queue the
  // Companion call to run AFTER the HTTP response is sent. This keeps
  // the POST response latency under 200ms — the Anthropic call plus
  // context assembly typically runs 3–5s and was previously blocking
  // the practitioner seeing their own message appear. The Companion
  // writes its response into the same room as a separate row, which
  // reaches connected clients via the Supabase Realtime subscription
  // on room_messages.
  //
  // generateCompanionRoomResponse is already null-safe on every
  // failure path (see src/lib/companion/room.ts) so the try/catch
  // here exists only to guarantee nothing escapes into the serverless
  // runtime's uncaught-exception path. Observability: the logs below
  // are queryable in Vercel runtime logs by room_id / user_id /
  // message_id if a Companion invocation silently fails to produce a
  // row. The Session 2 cron handler uses the same log prefix shape.
  //
  // Two trigger paths, checked in order:
  //
  //   (a) session: is_session=true on a practitioner_post. Original
  //       v1 behavior. Envelope frames the Companion's reply as
  //       reflection on today's session.
  //   (b) followup: is_session=false on a practitioner_post, BUT the
  //       most recent companion_* message in the room ended with a
  //       '?' in its final 200 characters. The practitioner appears
  //       to be answering a pending Companion question. The envelope
  //       tells the Companion so, and the response is a conversational
  //       continuation. Added in B/C/D arc Session 4 (2026-04-21) to
  //       fix the "talks at, not with" problem. See
  //       docs/chat-room-plan.md §6.6.
  //
  // Self-limiting on path (b): once the Companion replies, its own
  // message becomes "the most recent companion_* message". A second
  // follow-up from the practitioner only fires another reply if THAT
  // message also ended with '?' — i.e. genuine back-and-forth. A
  // chatty practitioner cannot hammer Anthropic because the Companion
  // stops asking questions when the conversation closes. No wall-clock
  // rate limit needed.
  if (sessionFlag && resolvedCommitmentId) {
    const roomIdSnapshot = roomId
    const triggerMessageId = inserted.id
    const triggerUserId = user.id
    after(async () => {
      try {
        const companionMessageId = await generateCompanionRoomResponse({
          db,
          roomId: roomIdSnapshot,
          triggerMessageId,
          triggerKind: 'session',
        })
        if (!companionMessageId) {
          console.error('[rooms/messages after] Companion returned null', {
            room_id: roomIdSnapshot,
            user_id: triggerUserId,
            trigger_message_id: triggerMessageId,
          })
        }
      } catch (err) {
        console.error('[rooms/messages after] Companion invocation threw', {
          room_id: roomIdSnapshot,
          user_id: triggerUserId,
          trigger_message_id: triggerMessageId,
          err,
        })
      }
    })
  } else if (messageType === 'practitioner_post') {
    // Path (b) — non-session practitioner message. We might answer
    // it if it looks like a reply to a pending Companion question.
    // The DB lookup + heuristic check is inside after() so it never
    // affects POST latency. If the check fails, we just don't invoke.
    const roomIdSnapshot = roomId
    const triggerMessageId = inserted.id
    const triggerUserId = user.id
    const triggerPostedAt = inserted.posted_at
    after(async () => {
      try {
        // Find the most recent companion_* message in this room
        // strictly before the just-inserted row. Any of the four
        // companion message_types qualifies — all are produced by
        // the same prompt and can legitimately end with a question.
        const { data: lastCompanion } = await db
          .from('room_messages')
          .select('id, body, posted_at')
          .eq('room_id', roomIdSnapshot)
          .in('message_type', [
            'companion_response',
            'companion_welcome',
            'companion_milestone',
            'companion_moderation',
          ])
          .lt('posted_at', triggerPostedAt)
          .order('posted_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!lastCompanion || !lastCompanion.body) return

        // Heuristic: '?' present in the last 200 characters of the
        // Companion's most recent message. The Companion's prompt
        // produces short messages often ending in a question, so a
        // trailing-window check is sufficient. A '?' mid-body followed
        // by a declarative sentence is rare in this voice and not
        // worth a more sophisticated parse at v1.
        const body = lastCompanion.body
        const tail = body.slice(Math.max(0, body.length - 200))
        if (!tail.includes('?')) return

        const companionMessageId = await generateCompanionRoomResponse({
          db,
          roomId: roomIdSnapshot,
          triggerMessageId,
          triggerKind: 'followup',
        })
        if (!companionMessageId) {
          console.error('[rooms/messages after] Companion followup returned null', {
            room_id: roomIdSnapshot,
            user_id: triggerUserId,
            trigger_message_id: triggerMessageId,
            last_companion_id: lastCompanion.id,
          })
        }
      } catch (err) {
        console.error('[rooms/messages after] Companion followup invocation threw', {
          room_id: roomIdSnapshot,
          user_id: triggerUserId,
          trigger_message_id: triggerMessageId,
          err,
        })
      }
    })
  }

  // companion_queued is a best-effort signal for the caller. We know
  // for certain it's queued on the session path. On the followup path
  // we can't know without repeating the heuristic synchronously, which
  // would defeat the purpose of after(). companion_maybe_queued
  // captures that honestly — the client doesn't branch on this today,
  // but a future UI showing a thinking-indicator can distinguish the
  // two.
  return NextResponse.json({
    message: inserted,
    companion_queued: sessionFlag && !!resolvedCommitmentId,
    companion_maybe_queued:
      !(sessionFlag && !!resolvedCommitmentId) &&
      messageType === 'practitioner_post',
  })
}
