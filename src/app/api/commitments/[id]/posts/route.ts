import { createClient, createServiceClient } from '@/lib/supabase/server'
// getResend import removed with the validator notification block; Phase 2 adds it back for sponsor emails.
import { NextResponse } from 'next/server'

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

  // getUser() via SSR, data ops via service client — see 0710ce4 writeup.
  // Writes below are scoped to the authenticated user.id.
  const db = createServiceClient()

  // Verify the commitment belongs to the authenticated user
  const { data: commitment, error: commitmentError } = await db
    .from('commitments')
    .select('id, status, sessions_logged, streak_starts_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (commitmentError || !commitment) {
    return NextResponse.json({ error: 'Commitment not found.' }, { status: 404 })
  }

  const body = await request.json()
  const { body: postBody, media_urls: rawMediaUrls } = body

  // Sanitize media_urls: accept only an array of non-empty strings.
  // The /log client and /commit/[id] form both send `media_urls: [url]`
  // after a Cloudinary upload. Prior to this commit the field was silently
  // dropped here, so every post in production has an empty `media_urls`
  // even when a photo or video was uploaded — visible in David's
  // "Where did my camera links go?" session on 2026-04-18.
  const mediaUrls: string[] = Array.isArray(rawMediaUrls)
    ? rawMediaUrls.filter((u): u is string => typeof u === 'string' && u.length > 0)
    : []

  const newSessionsLogged = (commitment.sessions_logged ?? 0) + 1

  // Insert the post
  const { data: post, error: postError } = await db
    .from('commitment_posts')
    .insert({
      commitment_id: id,
      user_id: user.id,
      body: postBody?.trim() || null,
      media_urls: mediaUrls,
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
  await db
    .from('commitments')
    .update({
      sessions_logged: newSessionsLogged,
      ...(newStatus !== commitment.status ? { status: newStatus } : {}),
    })
    .eq('id', id)
    .eq('user_id', user.id)

  // Sponsor notification emails are added in Phase 2 (with the invitation flow).
  // v3's validator-notification path is retired along with the validator role.

  return NextResponse.json({ id: post.id, session_number: post.session_number })
}
