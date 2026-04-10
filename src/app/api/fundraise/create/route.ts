import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { commitment_id } = await request.json()
  if (!commitment_id) return NextResponse.json({ error: 'commitment_id required' }, { status: 400 })

  // Verify ownership and that commitment is active
  const { data: commitment } = await supabase
    .from('commitments')
    .select('id, status, user_id')
    .eq('id', commitment_id)
    .eq('user_id', user.id)
    .single()

  if (!commitment) return NextResponse.json({ error: 'Commitment not found' }, { status: 404 })
  if (!['active', 'ongoing'].includes(commitment.status)) {
    return NextResponse.json({ error: 'Commitment must be active to fundraise' }, { status: 400 })
  }

  // One fundraise per commitment
  const { data: existing } = await supabase
    .from('commitment_fundraises')
    .select('id')
    .eq('commitment_id', commitment_id)
    .single()

  if (existing) return NextResponse.json({ error: 'Fundraise already exists for this commitment' }, { status: 400 })

  const { data: fundraise, error } = await supabase
    .from('commitment_fundraises')
    .insert({ commitment_id, user_id: user.id, status: 'open' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ fundraise })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const commitment_id = url.searchParams.get('commitment_id')

  let query = supabase
    .from('commitment_fundraises')
    .select('*, commitment:commitments(habit, status, logged_days, visibility)')

  if (commitment_id) {
    query = query.eq('commitment_id', commitment_id)
  } else {
    query = query.eq('user_id', user.id)
  }

  const { data: fundraises, error } = await query.order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!fundraises?.length) return NextResponse.json({ fundraises: [] })

  // Fetch pledges for each fundraise
  const ids = fundraises.map(f => f.id)
  const { data: pledges } = await supabase
    .from('fundraise_pledges')
    .select('id, fundraise_id, milestone_day, amount, status, message, created_at')
    .in('fundraise_id', ids)

  const enriched = fundraises.map(f => ({
    ...f,
    pledges: (pledges || []).filter(p => p.fundraise_id === f.id),
    total_pledged: (pledges || [])
      .filter(p => p.fundraise_id === f.id && p.status === 'pending')
      .reduce((sum, p) => sum + Number(p.amount), 0),
  }))

  return NextResponse.json({ fundraises: enriched })
}
