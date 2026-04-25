import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET — fetch sponsorship details for a commitment (practitioner only, auth required)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ssr = await createClient()
  const { data: { user } } = await ssr.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // getUser() via SSR, data reads via service client — see 0710ce4 writeup.
  const db = createServiceClient()

  // Verify commitment belongs to user
  type CommitmentRow = {
    id: string
    status: string
    user_id: string
    practices: { name: string } | { name: string }[] | null
  }
  const { data: commitment, error: commError } = await db
    .from('commitments')
    .select('id, status, user_id, practices(name)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single<CommitmentRow>()

  if (commError || !commitment) {
    return NextResponse.json({ error: 'Commitment not found.' }, { status: 404 })
  }

  const practice = commitment.practices
  const practiceName = practice
    ? (Array.isArray(practice) ? practice[0]?.name : practice.name) ?? null
    : null

  const { data: sponsorships } = await db
    .from('sponsorships')
    .select('id, sponsor_name, sponsor_email, pledge_amount, status, pledged_at, released_at, vetoed_at')
    .eq('commitment_id', id)
    .order('pledged_at', { ascending: true })

  const list = sponsorships ?? []
  const total_pledged = list.reduce((sum, s) => sum + (s.pledge_amount ?? 0), 0)

  return NextResponse.json({
    commitment_id: id,
    commitment_title: practiceName, // practice name IS the commitment statement in v4
    sponsorships: list,
    total_pledged,
  })
}
