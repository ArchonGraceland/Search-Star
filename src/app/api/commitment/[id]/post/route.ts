import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { body: postBody, media_urls = [] } = body

  if (!postBody?.trim() && !media_urls.length) {
    return NextResponse.json({ error: 'Post must have content' }, { status: 400 })
  }

  const { data: commitment, error: fetchError } = await supabase
    .from('commitments')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !commitment) {
    return NextResponse.json({ error: 'Commitment not found' }, { status: 404 })
  }

  if (commitment.status === 'restart_eligible') {
    return NextResponse.json({ error: 'Restart this commitment before posting' }, { status: 400 })
  }

  const newLoggedDays = (commitment.logged_days || 0) + 1
  const newStreak = (commitment.current_streak || 0) + 1
  const newLongest = Math.max(commitment.longest_streak || 0, newStreak)
  const isMilestone = [10, 20, 30, 40].includes(newLoggedDays)

  let newStatus = commitment.status
  if (newLoggedDays >= 40 && commitment.status === 'active') newStatus = 'ongoing'

  const { data: post, error: postError } = await supabase
    .from('commitment_posts')
    .insert({
      commitment_id: id,
      user_id: user.id,
      body: postBody?.trim() || null,
      media_urls,
      day_number: newLoggedDays,
      is_milestone: isMilestone,
    })
    .select()
    .single()

  if (postError) return NextResponse.json({ error: postError.message }, { status: 500 })

  await supabase
    .from('commitments')
    .update({ logged_days: newLoggedDays, current_streak: newStreak, longest_streak: newLongest, status: newStatus })
    .eq('id', id)

  // ── Sponsorship hooks ────────────────────────────────────────
  const milestoneBounties: { day: number; amount: number }[] = []
  let gatedOffersDelivered = 0

  const { data: sponsorships } = await supabase
    .from('practice_sponsorships')
    .select('*')
    .eq('commitment_id', id)
    .eq('status', 'active')

  if (sponsorships?.length) {
    // Get user's profile id once
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    for (const sponsorship of sponsorships) {
      // Milestone bounty
      if (isMilestone) {
        const bountyMap: Record<number, number> = {
          10: Number(sponsorship.bounty_day10 || 0),
          20: Number(sponsorship.bounty_day20 || 0),
          30: Number(sponsorship.bounty_day30 || 0),
          40: Number(sponsorship.bounty_day40 || 0),
        }
        const bountyAmount = bountyMap[newLoggedDays] || 0

        if (bountyAmount > 0 && Number(sponsorship.escrow_remaining) >= bountyAmount) {
          const ssFee = +(bountyAmount * 0.1).toFixed(2)
          const netAmount = +(bountyAmount * 0.9).toFixed(2)

          await supabase.from('sponsorship_milestone_payments').insert({
            sponsorship_id: sponsorship.id,
            commitment_id: id,
            user_id: user.id,
            day_number: newLoggedDays,
            gross_amount: bountyAmount,
            ss_fee: ssFee,
            net_amount: netAmount,
          })

          await supabase
            .from('practice_sponsorships')
            .update({ escrow_remaining: +(Number(sponsorship.escrow_remaining) - bountyAmount).toFixed(2) })
            .eq('id', sponsorship.id)

          milestoneBounties.push({ day: newLoggedDays, amount: netAmount })
        }
      }

      // Gated offer delivery
      if (
        !sponsorship.gated_offer_delivered &&
        sponsorship.gated_offer_body &&
        newLoggedDays >= Number(sponsorship.gated_offer_threshold) &&
        userProfile?.id
      ) {
        await supabase.from('messages').insert({
          recipient_id: userProfile.id,
          sender_id: null,
          type: 'marketing',
          subject: 'Offer from your sponsor',
          body: sponsorship.gated_offer_body,
          price_paid: Number(sponsorship.gated_offer_price),
          read: false,
          blocked: false,
        }).maybeSingle()

        const newSponsorshipStatus = newLoggedDays >= 40 ? 'completed' : 'active'
        await supabase
          .from('practice_sponsorships')
          .update({ gated_offer_delivered: true, status: newSponsorshipStatus })
          .eq('id', sponsorship.id)

        gatedOffersDelivered++
      }
    }
  }

  return NextResponse.json({
    post,
    logged_days: newLoggedDays,
    status: newStatus,
    is_milestone: isMilestone,
    sponsorship: { milestone_bounties: milestoneBounties, gated_offers_delivered: gatedOffersDelivered },
  })
}
