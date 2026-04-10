import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { fundraise_id, amount, milestone_day = null, message = null } = body

  if (!fundraise_id || !amount || Number(amount) <= 0) {
    return NextResponse.json({ error: 'fundraise_id and amount > 0 required' }, { status: 400 })
  }

  if (milestone_day !== null && ![10, 20, 30, 40].includes(Number(milestone_day))) {
    return NextResponse.json({ error: 'milestone_day must be 10, 20, 30, or 40 (or null for completion)' }, { status: 400 })
  }

  // Fetch fundraise and verify it's open
  const { data: fundraise } = await supabase
    .from('commitment_fundraises')
    .select('id, user_id, status, commitment_id')
    .eq('id', fundraise_id)
    .single()

  if (!fundraise) return NextResponse.json({ error: 'Fundraise not found' }, { status: 404 })
  if (!['open', 'active'].includes(fundraise.status)) {
    return NextResponse.json({ error: 'This fundraise is no longer accepting pledges' }, { status: 400 })
  }
  if (fundraise.user_id === user.id) {
    return NextResponse.json({ error: 'Cannot pledge to your own fundraise' }, { status: 400 })
  }

  const { data: pledge, error } = await supabase
    .from('fundraise_pledges')
    .insert({
      fundraise_id,
      pledger_user_id: user.id,
      milestone_day: milestone_day ? Number(milestone_day) : null,
      amount: Number(amount),
      status: 'pending',
      message: message || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Activate fundraise if still open
  if (fundraise.status === 'open') {
    await supabase
      .from('commitment_fundraises')
      .update({ status: 'active' })
      .eq('id', fundraise_id)
  }

  return NextResponse.json({ pledge, message: 'Pledge recorded. Payment will be charged when the milestone is validated.' })
}
