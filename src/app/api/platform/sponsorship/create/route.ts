import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('user_id', user.id)
    .single()

  if (!profile || profile.role !== 'platform') {
    return NextResponse.json({ error: 'Platform account required' }, { status: 403 })
  }

  const body = await request.json()
  const {
    commitment_id,
    bounty_day10 = 0,
    bounty_day20 = 0,
    bounty_day30 = 0,
    bounty_day40 = 0,
    weekly_rate = 0,
    gated_offer_body = null,
    gated_offer_threshold = 40,
    gated_offer_price = 0,
    sponsor_label,
  } = body

  if (!commitment_id) {
    return NextResponse.json({ error: 'commitment_id is required' }, { status: 400 })
  }

  // Verify commitment is public and active
  const { data: commitment } = await supabase
    .from('commitments')
    .select('id, status, visibility, user_id')
    .eq('id', commitment_id)
    .single()

  if (!commitment) return NextResponse.json({ error: 'Commitment not found' }, { status: 404 })
  if (commitment.visibility !== 'public') return NextResponse.json({ error: 'Commitment is not public' }, { status: 400 })
  if (!['active', 'ongoing'].includes(commitment.status)) return NextResponse.json({ error: 'Commitment is not active' }, { status: 400 })
  if (commitment.user_id === user.id) return NextResponse.json({ error: 'Cannot sponsor your own commitment' }, { status: 400 })

  // Check not already sponsoring this commitment
  const { data: existing } = await supabase
    .from('practice_sponsorships')
    .select('id')
    .eq('commitment_id', commitment_id)
    .eq('platform_id', profile.id)
    .eq('status', 'active')
    .single()

  if (existing) return NextResponse.json({ error: 'Already sponsoring this commitment' }, { status: 400 })

  const escrow_total = Number(bounty_day10) + Number(bounty_day20) + Number(bounty_day30) + Number(bounty_day40)
  const total_required = escrow_total + Number(gated_offer_price)

  if (escrow_total === 0 && Number(weekly_rate) === 0 && !gated_offer_body) {
    return NextResponse.json({ error: 'Sponsorship must include at least one instrument' }, { status: 400 })
  }

  // Check platform credit balance
  const { data: platformProfile } = await supabase
    .from('profiles')
    .select('credit_balance')
    .eq('id', profile.id)
    .single()

  const creditBalance = platformProfile?.credit_balance || 0
  if (creditBalance < total_required) {
    return NextResponse.json({
      error: `Insufficient credits. Need $${total_required.toFixed(2)}, have $${creditBalance.toFixed(2)}`,
    }, { status: 402 })
  }

  // Deduct escrow from platform credits
  if (escrow_total > 0) {
    const { error: deductError } = await supabase
      .from('profiles')
      .update({ credit_balance: creditBalance - escrow_total })
      .eq('id', profile.id)

    if (deductError) return NextResponse.json({ error: deductError.message }, { status: 500 })
  }

  // Create sponsorship
  const { data: sponsorship, error } = await supabase
    .from('practice_sponsorships')
    .insert({
      commitment_id,
      platform_id: profile.id,
      bounty_day10: Number(bounty_day10),
      bounty_day20: Number(bounty_day20),
      bounty_day30: Number(bounty_day30),
      bounty_day40: Number(bounty_day40),
      escrow_total,
      escrow_remaining: escrow_total,
      weekly_rate: Number(weekly_rate),
      gated_offer_body: gated_offer_body || null,
      gated_offer_threshold: Number(gated_offer_threshold),
      gated_offer_price: Number(gated_offer_price),
      sponsor_label: sponsor_label || null,
      status: 'active',
    })
    .select()
    .single()

  if (error) {
    // Refund escrow if insert failed
    if (escrow_total > 0) {
      await supabase.from('profiles').update({ credit_balance: creditBalance }).eq('id', profile.id)
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ sponsorship, escrow_total, message: `$${escrow_total.toFixed(2)} held in escrow` })
}
