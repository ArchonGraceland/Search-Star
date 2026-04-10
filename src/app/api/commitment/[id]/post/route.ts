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

  // Milestone posts require media evidence if there are any fundraises or sponsorships
  if (isMilestone) {
    const { data: hasFundraise } = await supabase
      .from('commitment_fundraises')
      .select('id')
      .eq('commitment_id', id)
      .in('status', ['open', 'active'])
      .single()

    const { data: hasSponsorship } = await supabase
      .from('practice_sponsorships')
      .select('id')
      .eq('commitment_id', id)
      .eq('status', 'active')
      .single()

    if ((hasFundraise || hasSponsorship) && !media_urls.length) {
      return NextResponse.json({
        error: 'Milestone day with active funding requires photo or video evidence',
        requires_evidence: true,
        day: newLoggedDays,
      }, { status: 422 })
    }
  }

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

  // ── Evidence submission on milestone days ─────────────────
  let evidenceId: string | null = null
  let evidenceStatus: string | null = null

  if (isMilestone && media_urls.length > 0) {
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
    const { data: evidence } = await supabase
      .from('evidence_submissions')
      .insert({
        commitment_id: id,
        post_id: post.id,
        user_id: user.id,
        day_number: newLoggedDays,
        media_urls,
        status: 'pending',
        required_validators: 3,
        expires_at: expiresAt,
      })
      .select('id, status')
      .single()
    evidenceId = evidence?.id || null
    evidenceStatus = 'pending'
  }

  // ── Gated offer delivery (not payment-gated) ──────────────
  let gatedOffersDelivered = 0
  if (isMilestone) {
    const { data: userProfile } = await supabase
      .from('profiles').select('id').eq('user_id', user.id).single()

    const { data: sponsorships } = await supabase
      .from('practice_sponsorships')
      .select('id, gated_offer_body, gated_offer_threshold, gated_offer_delivered, gated_offer_price')
      .eq('commitment_id', id)
      .eq('status', 'active')

    for (const s of sponsorships || []) {
      if (!s.gated_offer_delivered && s.gated_offer_body && newLoggedDays >= Number(s.gated_offer_threshold) && userProfile?.id) {
        await supabase.from('messages').insert({
          recipient_id: userProfile.id, sender_id: null, type: 'marketing',
          subject: 'Offer from your sponsor', body: s.gated_offer_body,
          price_paid: Number(s.gated_offer_price), read: false, blocked: false,
        }).maybeSingle()
        await supabase.from('practice_sponsorships')
          .update({ gated_offer_delivered: true })
          .eq('id', s.id)
        gatedOffersDelivered++
      }
    }
  }

  return NextResponse.json({
    post,
    logged_days: newLoggedDays,
    status: newStatus,
    is_milestone: isMilestone,
    evidence_id: evidenceId,
    evidence_status: evidenceStatus,
    validation_required: isMilestone && media_urls.length > 0,
    gated_offers_delivered: gatedOffersDelivered,
    message: isMilestone && evidenceId
      ? 'Milestone posted. 3 validators must confirm your evidence to release payments.'
      : null,
  })
}
