import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST — record a voluntary contribution after completion
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { commitment_id, gross_amount } = body

  if (!commitment_id || typeof gross_amount !== 'number' || gross_amount <= 0) {
    return NextResponse.json({ error: 'commitment_id and a positive gross_amount are required.' }, { status: 400 })
  }

  // Verify commitment is completed and belongs to user
  const { data: commitment, error: commError } = await supabase
    .from('commitments')
    .select('id, status, user_id')
    .eq('id', commitment_id)
    .eq('user_id', user.id)
    .single()

  if (commError || !commitment) {
    return NextResponse.json({ error: 'Commitment not found.' }, { status: 404 })
  }

  if (commitment.status !== 'completed') {
    return NextResponse.json({ error: 'Contributions can only be made for completed commitments.' }, { status: 409 })
  }

  // Check no contribution already exists
  const { data: existing } = await supabase
    .from('contributions')
    .select('id')
    .eq('commitment_id', commitment_id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'A contribution has already been recorded for this commitment.' }, { status: 409 })
  }

  // Calculate splits
  const ss_share = gross_amount * 0.05
  const mentor_share = gross_amount * 0.2375
  const coach_share = gross_amount * 0.2375
  const cb_share = gross_amount * 0.2375
  const pl_share = gross_amount * 0.2375

  // Insert contribution
  const { data: contribution, error: insertError } = await supabase
    .from('contributions')
    .insert({
      commitment_id,
      sponsor_id: null,
      gross_amount,
      ss_share,
      mentor_share,
      coach_share,
      cb_share,
      pl_share,
      contribution_rate: 0.95,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (insertError || !contribution) {
    console.error('Error inserting contribution:', insertError)
    return NextResponse.json({ error: 'Failed to record contribution.' }, { status: 500 })
  }

  // Mark all sponsorships for this commitment as paid
  await supabase
    .from('sponsorships')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('commitment_id', commitment_id)
    .eq('status', 'pledged')

  return NextResponse.json({
    id: contribution.id,
    splits: { ss_share, mentor_share, coach_share, cb_share, pl_share },
  })
}
