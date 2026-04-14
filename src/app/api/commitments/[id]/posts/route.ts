import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const db = createServiceClient()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify the commitment belongs to the authenticated user
  const { data: commitment, error: commitmentError } = await supabase
    .from('commitments')
    .select('id, status, sessions_logged, streak_starts_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (commitmentError || !commitment) {
    return NextResponse.json({ error: 'Commitment not found.' }, { status: 404 })
  }

  const body = await request.json()
  const { body: postBody } = body

  const newSessionsLogged = (commitment.sessions_logged ?? 0) + 1

  // Insert the post
  const { data: post, error: postError } = await supabase
    .from('commitment_posts')
    .insert({
      commitment_id: id,
      user_id: user.id,
      body: postBody?.trim() || null,
      session_number: newSessionsLogged,
      posted_at: new Date().toISOString(),
    })
    .select('id, session_number')
    .single()

  if (postError) {
    console.error('Error creating post:', postError)
    return NextResponse.json({ error: 'Failed to log session.' }, { status: 500 })
  }

  // Determine whether to advance status from launch → active
  const now = new Date()
  const streakStartsAt = commitment.streak_starts_at ? new Date(commitment.streak_starts_at) : null
  const newStatus = (commitment.status === 'launch' && streakStartsAt && now >= streakStartsAt)
    ? 'active'
    : commitment.status

  // Update sessions_logged (and possibly status)
  await supabase
    .from('commitments')
    .update({
      sessions_logged: newSessionsLogged,
      ...(newStatus !== commitment.status ? { status: newStatus } : {}),
    })
    .eq('id', id)

  return NextResponse.json({ id: post.id, session_number: post.session_number })
}
