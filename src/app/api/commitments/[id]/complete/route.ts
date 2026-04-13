import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST — mark a commitment as complete
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch commitment and verify ownership + status
  const { data: commitment, error: commError } = await supabase
    .from('commitments')
    .select('id, status, user_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (commError || !commitment) {
    return NextResponse.json({ error: 'Commitment not found.' }, { status: 404 })
  }

  if (commitment.status !== 'active') {
    return NextResponse.json({ error: 'Only active commitments can be marked as complete.' }, { status: 409 })
  }

  // Mark as complete
  const { error: updateError } = await supabase
    .from('commitments')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updateError) {
    console.error('Error completing commitment:', updateError)
    return NextResponse.json({ error: 'Failed to complete commitment.' }, { status: 500 })
  }

  // Calculate total pledged
  const { data: pledges } = await supabase
    .from('sponsorships')
    .select('pledge_amount')
    .eq('commitment_id', id)
    .in('status', ['pledged', 'paid'])

  const total_pledged = (pledges ?? []).reduce((sum, p) => sum + (p.pledge_amount ?? 0), 0)

  return NextResponse.json({ commitment_id: id, total_pledged })
}
