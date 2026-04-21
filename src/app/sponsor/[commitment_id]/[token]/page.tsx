import { createServiceClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'

// Grace-period redirect for the retired anonymous sponsor-feed surface.
//
// v4 Decision #8 retired the model where a sponsor with an access_token
// could browse a commitment's session posts without an account. The token
// has been mailed to real sponsors in the past (via the
// payment_intent.amount_capturable_updated webhook's sponsor confirmation
// email), so links to this path still exist in inboxes.
//
// This page resolves the token to a commitment → room and redirects to
// the room. The room itself is auth-gated; the sponsor may land on /login
// and then bounce back after signing in. That's the honest v4 surface:
// you need an account to witness the practice.
//
// A future commit can delete this route entirely once the email grace
// period has passed and all old links are expected dead.

export const dynamic = 'force-dynamic'

export default async function SponsorRedirect({
  params,
}: {
  params: Promise<{ commitment_id: string; token: string }>
}) {
  const { commitment_id, token } = await params

  const db = createServiceClient()
  const { data: sponsorship } = await db
    .from('sponsorships')
    .select('commitment_id')
    .eq('access_token', token)
    .eq('commitment_id', commitment_id)
    .maybeSingle()

  if (!sponsorship) notFound()

  const { data: commitment } = await db
    .from('commitments')
    .select('room_id')
    .eq('id', sponsorship.commitment_id)
    .maybeSingle()

  if (!commitment?.room_id) notFound()

  redirect(`/room/${commitment.room_id}`)
}
