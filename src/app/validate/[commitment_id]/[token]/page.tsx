import { createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ValidatorClient from './client'

export default async function ValidatorPage({
  params,
}: {
  params: Promise<{ commitment_id: string; token: string }>
}) {
  const { commitment_id, token } = await params

  if (!token || !commitment_id) redirect('/validate/invalid')

  const db = createServiceClient()

  // Look up validator by token
  const { data: validator } = await db
    .from('validators')
    .select('id, status, commitment_id')
    .eq('invite_token', token)
    .eq('commitment_id', commitment_id)
    .single()

  if (!validator) redirect('/validate/invalid')

  // Track first visit before marking active
  const isFirstVisit = validator.status === 'invited'

  // Mark as active immediately (clicking the link = acceptance)
  if (isFirstVisit) {
    await db
      .from('validators')
      .update({ status: 'active', accepted_at: new Date().toISOString() })
      .eq('id', validator.id)
  }

  // Fetch commitment
  const { data: commitment } = await db
    .from('commitments')
    .select('id, title, status, sessions_logged, user_id')
    .eq('id', commitment_id)
    .single()

  if (!commitment) redirect('/validate/invalid')

  // Fetch practitioner name
  const { data: profile } = await db
    .from('profiles')
    .select('display_name')
    .eq('user_id', commitment.user_id)
    .single()

  // Fetch recent posts
  const { data: posts } = await db
    .from('commitment_posts')
    .select('id, body, session_number, posted_at')
    .eq('commitment_id', commitment_id)
    .order('posted_at', { ascending: false })

  // Fetch confirmed post IDs for this validator
  const { data: confirmations } = await db
    .from('post_confirmations')
    .select('post_id')
    .eq('validator_id', validator.id)

  return (
    <ValidatorClient
      isFirstVisit={isFirstVisit}
      validatorId={validator.id}
      token={token}
      commitmentId={commitment_id}
      commitmentTitle={commitment.title}
      commitmentStatus={commitment.status}
      sessionsLogged={commitment.sessions_logged}
      practitionerName={profile?.display_name ?? 'the practitioner'}
      posts={posts ?? []}
      confirmedPostIds={(confirmations ?? []).map(c => c.post_id)}
    />
  )
}
