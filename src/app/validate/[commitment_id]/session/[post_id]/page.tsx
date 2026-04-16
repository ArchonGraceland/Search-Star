import { createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import WitnessClient from './client'

export default async function WitnessSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ commitment_id: string; post_id: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { commitment_id, post_id } = await params
  const { token } = await searchParams

  if (!token || !commitment_id || !post_id) redirect('/validate/invalid')

  const db = createServiceClient()

  // Look up validator by token
  const { data: validator } = await db
    .from('validators')
    .select('id, status, commitment_id, invite_token')
    .eq('invite_token', token)
    .eq('commitment_id', commitment_id)
    .single()

  if (!validator) redirect('/validate/invalid')

  // Mark as active if first visit
  if (validator.status === 'invited') {
    await db
      .from('validators')
      .update({ status: 'active', accepted_at: new Date().toISOString() })
      .eq('id', validator.id)
  }

  // Fetch the post
  const { data: post } = await db
    .from('commitment_posts')
    .select('id, body, session_number, posted_at, media_urls, commitment_id')
    .eq('id', post_id)
    .eq('commitment_id', commitment_id)
    .single()

  if (!post) redirect('/validate/invalid')

  // Fetch commitment + practitioner
  const { data: commitment } = await db
    .from('commitments')
    .select('id, title, status, user_id')
    .eq('id', commitment_id)
    .single()

  if (!commitment) redirect('/validate/invalid')

  const { data: profile } = await db
    .from('profiles')
    .select('display_name')
    .eq('user_id', commitment.user_id)
    .single()

  // Check if already confirmed by this validator
  const { data: existingConfirmation } = await db
    .from('post_confirmations')
    .select('id, quality_choice, witness_note, confirmed_at')
    .eq('post_id', post_id)
    .eq('validator_id', validator.id)
    .maybeSingle()

  const practitionerName = profile?.display_name ?? 'the practitioner'

  return (
    <WitnessClient
      validatorId={validator.id}
      token={token}
      commitmentId={commitment_id}
      postId={post_id}
      commitmentTitle={commitment.title ?? 'this commitment'}
      practitionerName={practitionerName}
      sessionNumber={post.session_number}
      postBody={post.body}
      mediaUrls={post.media_urls ?? []}
      postedAt={post.posted_at ?? new Date().toISOString()}
      existingConfirmation={existingConfirmation ?? null}
    />
  )
}
