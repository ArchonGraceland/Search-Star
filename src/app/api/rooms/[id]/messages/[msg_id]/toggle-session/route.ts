import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// PATCH /api/rooms/[id]/messages/[msg_id]/toggle-session
//
// Flip the is_session flag on a practitioner's own message. This is
// the "mark this earlier message as today's session instead" escape
// hatch — useful when the first post of the day was chatter and a
// later post is the actual session.
//
// Rules:
// - Caller must own the message (user_id matches).
// - Message must be a practitioner_post (session-marking only applies
//   to practitioner posts, not sponsor chat).
// - Message must live in the specified room (guard against ID
//   substitution across rooms).
// - Turning is_session=true is gated by the same one-session-per-day
//   unique constraint; a 23505 is surfaced to the caller with a
//   readable error.
//
// Body is ignored; this is a pure toggle based on the current state.

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string; msg_id: string }> }
) {
  const { id: roomId, msg_id: messageId } = await params

  const ssr = await createClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceClient()

  const { data: msg, error: fetchErr } = await db
    .from('room_messages')
    .select('id, user_id, room_id, message_type, is_session')
    .eq('id', messageId)
    .maybeSingle()

  if (fetchErr || !msg) {
    return NextResponse.json({ error: 'Message not found.' }, { status: 404 })
  }

  if (msg.room_id !== roomId) {
    return NextResponse.json({ error: 'Message does not belong to this room.' }, { status: 404 })
  }
  if (msg.user_id !== user.id) {
    return NextResponse.json({ error: 'You can only re-mark your own messages.' }, { status: 403 })
  }
  if (msg.message_type !== 'practitioner_post') {
    return NextResponse.json(
      { error: 'Only practitioner posts can be session-marked.' },
      { status: 400 }
    )
  }

  const next = !msg.is_session

  const { data: updated, error: updateErr } = await db
    .from('room_messages')
    .update({ is_session: next })
    .eq('id', messageId)
    .select('id, is_session')
    .single()

  if (updateErr || !updated) {
    if (updateErr?.code === '23505') {
      return NextResponse.json(
        {
          error:
            'You already have a session marked for today. Un-mark the other message first.',
        },
        { status: 409 }
      )
    }
    console.error('[rooms/messages toggle-session] update error:', updateErr)
    return NextResponse.json({ error: 'Failed to toggle session mark.' }, { status: 500 })
  }

  return NextResponse.json({ message: updated })
}
