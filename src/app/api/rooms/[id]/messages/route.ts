import { NextResponse } from 'next/server'
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
// When is_session=true, the Companion is invoked synchronously after
// the insert. The Companion's response is written as a second message
// (message_type='companion_response') and both IDs are returned. The
// synchronous call is a deliberate simplification while we build; a
// future revision can move it off the request path.

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

  // If this was a session-marked practitioner post, invoke the Companion
  // inline. Failures here are logged but do not roll back the post.
  let companionMessageId: string | null = null
  if (sessionFlag && resolvedCommitmentId) {
    try {
      companionMessageId = await generateCompanionRoomResponse({
        db,
        roomId,
        triggerMessageId: inserted.id,
      })
    } catch (err) {
      console.error('[rooms/messages POST] Companion invocation failed:', err)
    }
  }

  return NextResponse.json({
    message: inserted,
    companion_message_id: companionMessageId,
  })
}
