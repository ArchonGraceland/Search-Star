import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET — fetch sponsorship details for a commitment (practitioner only, auth required)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify commitment belongs to user
  const { data: commitment, error: commError } = await supabase
    .from('commitments')
    .select('id, title, status, user_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (commError || !commitment) {
    return NextResponse.json({ error: 'Commitment not found.' }, { status: 404 })
  }

  const { data: sponsorships } = await supabase
    .from('sponsorships')
    .select('id, sponsor_name, sponsor_email, pledge_amount, status, pledged_at, paid_at')
    .eq('commitment_id', id)
    .order('pledged_at', { ascending: true })

  const list = sponsorships ?? []
  const total_pledged = list.reduce((sum, s) => sum + (s.pledge_amount ?? 0), 0)

  return NextResponse.json({
    commitment_id: id,
    commitment_title: commitment.title,
    sponsorships: list,
    total_pledged,
  })
}
