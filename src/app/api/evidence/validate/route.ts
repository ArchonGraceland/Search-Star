import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { evidence_id, confirmed = true, note = null } = body

  if (!evidence_id) return NextResponse.json({ error: 'evidence_id required' }, { status: 400 })

  // Fetch evidence
  const { data: evidence } = await supabase
    .from('evidence_submissions')
    .select('*')
    .eq('id', evidence_id)
    .single()

  if (!evidence) return NextResponse.json({ error: 'Evidence not found' }, { status: 404 })
  if (evidence.status !== 'pending') return NextResponse.json({ error: `Evidence is already ${evidence.status}` }, { status: 400 })
  if (evidence.user_id === user.id) return NextResponse.json({ error: 'Cannot validate your own evidence' }, { status: 400 })

  // Check 72h expiry
  if (new Date(evidence.expires_at) < new Date()) {
    await supabase.from('evidence_submissions').update({ status: 'expired' }).eq('id', evidence_id)
    return NextResponse.json({ error: 'Evidence validation window has expired' }, { status: 400 })
  }

  // Verify validator eligibility: must be a supporter (witness or co-practitioner) of this commitment
  const { data: supporterRelation } = await supabase
    .from('commitment_supporters')
    .select('role')
    .eq('commitment_id', evidence.commitment_id)
    .eq('supporter_id', user.id)
    .single()

  // Also check if they're an explicitly listed validator on a fundraise
  const { data: fundraise } = await supabase
    .from('commitment_fundraises')
    .select('id')
    .eq('commitment_id', evidence.commitment_id)
    .single()

  if (!supporterRelation && !fundraise) {
    return NextResponse.json({ error: 'You must be a supporter of this commitment to validate evidence' }, { status: 403 })
  }

  // Record validation
  const { error: validationError } = await supabase
    .from('milestone_validations')
    .insert({
      evidence_id,
      validator_id: user.id,
      confirmed,
      note: note || null,
    })

  if (validationError) {
    if (validationError.code === '23505') return NextResponse.json({ error: 'Already validated this evidence' }, { status: 400 })
    return NextResponse.json({ error: validationError.message }, { status: 500 })
  }

  // Count confirmations
  const { count: confirmCount } = await supabase
    .from('milestone_validations')
    .select('*', { count: 'exact', head: true })
    .eq('evidence_id', evidence_id)
    .eq('confirmed', true)

  const newValidatorCount = (evidence.validator_count || 0) + (confirmed ? 1 : 0)

  await supabase
    .from('evidence_submissions')
    .update({ validator_count: newValidatorCount })
    .eq('id', evidence_id)

  // Check if threshold reached
  const totalConfirmed = confirmCount || 0
  const threshold = evidence.required_validators || 3

  if (totalConfirmed >= threshold) {
    // ── TRIGGER ALL PAYMENTS ──────────────────────────────

    await supabase
      .from('evidence_submissions')
      .update({ status: 'validated', validated_at: new Date().toISOString() })
      .eq('id', evidence_id)

    const dayNumber = evidence.day_number
    const userId = evidence.user_id
    const commitmentId = evidence.commitment_id
    const paymentLog: { source: string; gross: number; net: number }[] = []

    // 1. Release fundraise pledges for this milestone
    const { data: fundraises } = await supabase
      .from('commitment_fundraises')
      .select('id')
      .eq('commitment_id', commitmentId)
      .in('status', ['open', 'active'])

    if (fundraises?.length) {
      const fundraiseIds = fundraises.map(f => f.id)

      // day-specific pledges + completion pledges (milestone_day null = completion bonus, released at day 40)
      const pledgeQuery = supabase
        .from('fundraise_pledges')
        .select('*')
        .in('fundraise_id', fundraiseIds)
        .eq('status', 'pending')

      const { data: pledges } = dayNumber === 40
        ? await pledgeQuery.or(`milestone_day.eq.${dayNumber},milestone_day.is.null`)
        : await pledgeQuery.eq('milestone_day', dayNumber)

      for (const pledge of pledges || []) {
        const gross = Number(pledge.amount)
        const fee = +(gross * 0.1).toFixed(2)
        const net = +(gross * 0.9).toFixed(2)

        await supabase.from('fundraise_pledges').update({ status: 'charged', charged_at: new Date().toISOString() }).eq('id', pledge.id)
        await supabase.from('validated_payments').insert({
          evidence_id, user_id: userId, source: 'fundraise_pledge',
          source_id: pledge.id, gross_amount: gross, ss_fee: fee, net_amount: net,
        })
        paymentLog.push({ source: 'pledge', gross, net })
      }

      // Mark fundraise completed if day 40
      if (dayNumber === 40) {
        await supabase.from('commitment_fundraises')
          .update({ status: 'completed' })
          .in('id', fundraiseIds)
      }
    }

    // 2. Release pool payouts for enrolled users
    const { data: enrollments } = await supabase
      .from('pool_enrollments')
      .select('*, pool:community_pools(*)')
      .eq('commitment_id', commitmentId)
      .eq('user_id', userId)
      .eq('status', 'active')

    for (const enrollment of enrollments || []) {
      const pool = enrollment.pool
      const payoutKey = `payout_day${dayNumber}` as keyof typeof pool
      const gross = Number(pool[payoutKey] || 0)
      if (!gross || Number(pool.budget_remaining) < gross) continue

      const fee = +(gross * 0.1).toFixed(2)
      const net = +(gross * 0.9).toFixed(2)

      await supabase.from('community_pools')
        .update({ budget_remaining: Number(pool.budget_remaining) - gross })
        .eq('id', pool.id)
      await supabase.from('pool_enrollments')
        .update({ total_paid: Number(enrollment.total_paid) + net })
        .eq('id', enrollment.id)
      await supabase.from('validated_payments').insert({
        evidence_id, user_id: userId, source: 'pool_payout',
        source_id: enrollment.id, gross_amount: gross, ss_fee: fee, net_amount: net,
      })
      paymentLog.push({ source: 'pool', gross, net })

      if (dayNumber === 40) {
        await supabase.from('pool_enrollments').update({ status: 'completed' }).eq('id', enrollment.id)
      }
    }

    // 3. Release sponsorship bounties (moved here from post route)
    const { data: sponsorships } = await supabase
      .from('practice_sponsorships')
      .select('*')
      .eq('commitment_id', commitmentId)
      .eq('status', 'active')

    for (const sponsorship of sponsorships || []) {
      const bountyMap: Record<number, number> = {
        10: Number(sponsorship.bounty_day10 || 0),
        20: Number(sponsorship.bounty_day20 || 0),
        30: Number(sponsorship.bounty_day30 || 0),
        40: Number(sponsorship.bounty_day40 || 0),
      }
      const bountyAmount = bountyMap[dayNumber] || 0
      if (!bountyAmount || Number(sponsorship.escrow_remaining) < bountyAmount) continue

      const fee = +(bountyAmount * 0.1).toFixed(2)
      const net = +(bountyAmount * 0.9).toFixed(2)

      await supabase.from('sponsorship_milestone_payments').insert({
        sponsorship_id: sponsorship.id, commitment_id: commitmentId, user_id: userId,
        day_number: dayNumber, gross_amount: bountyAmount, ss_fee: fee, net_amount: net,
      })
      await supabase.from('practice_sponsorships')
        .update({ escrow_remaining: +(Number(sponsorship.escrow_remaining) - bountyAmount).toFixed(2) })
        .eq('id', sponsorship.id)
      await supabase.from('validated_payments').insert({
        evidence_id, user_id: userId, source: 'sponsorship_bounty',
        source_id: sponsorship.id, gross_amount: bountyAmount, ss_fee: fee, net_amount: net,
      })
      paymentLog.push({ source: 'sponsorship', gross: bountyAmount, net })
    }

    const totalNet = paymentLog.reduce((sum, p) => sum + p.net, 0)
    return NextResponse.json({
      validated: true,
      payments_released: paymentLog.length,
      total_earned: totalNet,
      message: `Validated. ${paymentLog.length} payment${paymentLog.length !== 1 ? 's' : ''} released — $${totalNet.toFixed(2)} earned.`,
    })
  }

  return NextResponse.json({
    validated: false,
    confirmations: totalConfirmed,
    required: threshold,
    remaining: Math.max(0, threshold - totalConfirmed),
    message: `${totalConfirmed} of ${threshold} confirmations received.`,
  })
}
