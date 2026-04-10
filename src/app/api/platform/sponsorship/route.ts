import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
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

  // Fetch all sponsorships with commitment data
  const { data: sponsorships, error } = await supabase
    .from('practice_sponsorships')
    .select('*')
    .eq('platform_id', profile.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!sponsorships?.length) return NextResponse.json({ sponsorships: [], summary: { total_escrowed: 0, total_paid: 0, active_count: 0 } })

  const commitmentIds = sponsorships.map(s => s.commitment_id)

  // Fetch commitment progress
  const { data: commitments } = await supabase
    .from('commitments')
    .select('id, habit, status, logged_days, current_streak')
    .in('id', commitmentIds)

  const commitmentMap = Object.fromEntries((commitments || []).map(c => [c.id, c]))

  // Fetch milestone payments
  const sponsorshipIds = sponsorships.map(s => s.id)
  const { data: milestonePayments } = await supabase
    .from('sponsorship_milestone_payments')
    .select('sponsorship_id, gross_amount, day_number, paid_at')
    .in('sponsorship_id', sponsorshipIds)

  const { data: streakPayments } = await supabase
    .from('sponsorship_streak_payments')
    .select('sponsorship_id, gross_amount, paid_at')
    .in('sponsorship_id', sponsorshipIds)

  const milestoneBySponsorship = (milestonePayments || []).reduce<Record<string, typeof milestonePayments>>((acc, p) => {
    if (!acc[p.sponsorship_id]) acc[p.sponsorship_id] = []
    acc[p.sponsorship_id]!.push(p)
    return acc
  }, {})

  const streakBySponsorship = (streakPayments || []).reduce<Record<string, typeof streakPayments>>((acc, p) => {
    if (!acc[p.sponsorship_id]) acc[p.sponsorship_id] = []
    acc[p.sponsorship_id]!.push(p)
    return acc
  }, {})

  const enriched = sponsorships.map(s => ({
    ...s,
    commitment: commitmentMap[s.commitment_id] || null,
    milestone_payments: milestoneBySponsorship[s.id] || [],
    streak_payments: streakBySponsorship[s.id] || [],
    total_paid: [
      ...(milestoneBySponsorship[s.id] || []),
      ...(streakBySponsorship[s.id] || []),
    ].reduce((sum, p) => sum + Number(p.gross_amount), 0),
  }))

  const summary = {
    total_escrowed: sponsorships.filter(s => s.status === 'active').reduce((sum, s) => sum + Number(s.escrow_remaining), 0),
    total_paid: enriched.reduce((sum, s) => sum + s.total_paid, 0),
    active_count: sponsorships.filter(s => s.status === 'active').length,
  }

  return NextResponse.json({ sponsorships: enriched, summary })
}
