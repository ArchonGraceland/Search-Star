import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// v4 Decision #8: sessions are marked on messages in the room, not logged
// as a separate row type. A session post is just a room_messages row with
// message_type='practitioner_post' and is_session=true. The unique index
// on (user_id, commitment_id, posted_at::date) where is_session=true
// enforces the one-session-per-calendar-day rule.
//
// This endpoint remains backward-compat for the /log and /commit/[id]
// surfaces that still POST here. The new room composer will eventually
// post directly to /api/rooms/[id]/messages — but for this cleanup pass
// we're preserving this route so existing call sites keep working.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ssr = await createClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceClient()

  // Verify the commitment belongs to the authenticated user, load room_id
  const { data: commitment, error: commErr } = await db
    .from('commitments')
    .select('id, status, room_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (commErr || !commitment) {
    return NextResponse.json({ error: 'Commitment not found.' }, { status: 404 })
  }

  const body = await request.json()
  const { body: postBody, media_urls: rawMediaUrls } = body

  const mediaUrls: string[] = Array.isArray(rawMediaUrls)
    ? rawMediaUrls.filter((u): u is string => typeof u === 'string' && u.length > 0)
    : []

  // Insert as a session-marked practitioner_post in the room.
  // Note: is_session=true is enforced as unique per user per commitment per
  // calendar day via the index uq_room_messages_one_session_per_day. If the
  // practitioner has already logged today, this insert fails with code 23505
  // (unique violation) and we return a clear error.
  const { data: post, error: postError } = await db
    .from('room_messages')
    .insert({
      commitment_id: id,
      room_id: commitment.room_id,
      user_id: user.id,
      body: postBody?.trim() || null,
      media_urls: mediaUrls,
      message_type: 'practitioner_post',
      is_session: true,
      posted_at: new Date().toISOString(),
    })
    .select('id, posted_at')
    .single()

  if (postError) {
    if (postError.code === '23505') {
      return NextResponse.json({
        error: 'You have already logged a session today.',
      }, { status: 409 })
    }
    console.error('Error creating post:', postError)
    return NextResponse.json({ error: 'Failed to log session.' }, { status: 500 })
  }

  // session_number is no longer stored; compute on read (count of
  // is_session=true rows for this commitment, ordered by posted_at).
  const { count } = await db
    .from('room_messages')
    .select('id', { count: 'exact', head: true })
    .eq('commitment_id', id)
    .eq('is_session', true)

  return NextResponse.json({ id: post.id, session_number: count ?? 1 })
}
