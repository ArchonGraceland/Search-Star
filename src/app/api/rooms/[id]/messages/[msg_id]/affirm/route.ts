import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST/DELETE /api/rooms/[id]/messages/[msg_id]/affirm
//
// Sponsors can affirm session-marked practitioner posts. This is the
// "small gesture visible to the room" described in the spec — the
// lightest possible signal from a sponsor to a practitioner that says
// "I saw this and it counts to me." It has no effect on the Trust
// Record. It is not a vote, a rating, or a release. The Companion
// does not comment on affirmations.
//
// Eligibility: the caller must be a sponsor (active sponsorship) on
// the specific commitment this message is attached to. A sponsor of
// one practitioner in a room cannot affirm another practitioner's
// messages even though they are room members; affirmation is scoped
// to their sponsorship.
//
// One affirmation per (message, sponsor) — enforced by the table's
// unique constraint. POST is idempotent via ON CONFLICT DO NOTHING
// equivalence (we swallow the 23505). DELETE removes the row.
//
// The practitioner themselves cannot affirm their own message.

async function canAffirm(
  db: ReturnType<typeof createServiceClient>,
  userId: string,
  messageId: string,
  roomId: string
): Promise<
  | { ok: true; commitmentId: string }
  | { ok: false; status: number; error: string }
> {
  const { data: msg } = await db
    .from('room_messages')
    .select('id, user_id, room_id, commitment_id, message_type, is_session')
    .eq('id', messageId)
    .maybeSingle()

  if (!msg) return { ok: false, status: 404, error: 'Message not found.' }
  if (msg.room_id !== roomId) {
    return { ok: false, status: 404, error: 'Message does not belong to this room.' }
  }
  if (msg.message_type !== 'practitioner_post' || !msg.is_session) {
    return {
      ok: false,
      status: 400,
      error: 'Only session-marked practitioner posts can be affirmed.',
    }
  }
  if (!msg.commitment_id) {
    return {
      ok: false,
      status: 400,
      error: 'This message is not attached to a commitment.',
    }
  }
  if (msg.user_id === userId) {
    return {
      ok: false,
      status: 403,
      error: 'You cannot affirm your own messages.',
    }
  }

  // Sponsor check: caller must have an active sponsorship on the
  // commitment this message belongs to. "Active" here means status
  // pledged/released/paid — anything not vetoed or refunded.
  const { data: sponsorship } = await db
    .from('sponsorships')
    .select('id, status')
    .eq('commitment_id', msg.commitment_id)
    .eq('sponsor_user_id', userId)
    .in('status', ['pledged', 'released', 'paid'])
    .maybeSingle()

  if (!sponsorship) {
    return {
      ok: false,
      status: 403,
      error: 'Only sponsors of this commitment can affirm this message.',
    }
  }

  return { ok: true, commitmentId: msg.commitment_id }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; msg_id: string }> }
) {
  const { id: roomId, msg_id: messageId } = await params

  const ssr = await createClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()
  const check = await canAffirm(db, user.id, messageId, roomId)
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { error: insertErr } = await db
    .from('message_affirmations')
    .insert({
      message_id: messageId,
      sponsor_user_id: user.id,
    })

  // 23505 = already affirmed. Treat as success for idempotency.
  if (insertErr && insertErr.code !== '23505') {
    console.error('[rooms/messages affirm POST] insert error:', insertErr)
    return NextResponse.json({ error: 'Failed to affirm message.' }, { status: 500 })
  }

  return NextResponse.json({ affirmed: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; msg_id: string }> }
) {
  const { id: roomId, msg_id: messageId } = await params

  const ssr = await createClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()
  // We still want the membership / eligibility check to run before
  // deleting, so callers can't probe for other people's affirmations.
  const check = await canAffirm(db, user.id, messageId, roomId)
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const { error: deleteErr } = await db
    .from('message_affirmations')
    .delete()
    .eq('message_id', messageId)
    .eq('sponsor_user_id', user.id)

  if (deleteErr) {
    console.error('[rooms/messages affirm DELETE] delete error:', deleteErr)
    return NextResponse.json({ error: 'Failed to remove affirmation.' }, { status: 500 })
  }

  return NextResponse.json({ affirmed: false })
}
