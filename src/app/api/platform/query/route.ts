import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

let _admin: SupabaseClient | null = null
function admin() {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _admin
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { profile_id } = body

    if (!profile_id) {
      return NextResponse.json({ error: 'Missing profile_id' }, { status: 400 })
    }

    // Get platform account
    const { data: platform } = await admin()
      .from('platform_accounts')
      .select('id, credit_balance')
      .eq('user_id', user.id)
      .single()

    if (!platform) {
      return NextResponse.json({ error: 'Platform account not found' }, { status: 404 })
    }

    // Get target profile
    const { data: profile } = await admin()
      .from('profiles')
      .select('*')
      .eq('id', profile_id)
      .eq('status', 'active')
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found or inactive' }, { status: 404 })
    }

    // ═══ Unclaimed profile guard ═══
    // Spec Section 3.9: "Unclaimed stubs are never monetized.
    // Platforms cannot query their data until the profile is claimed."
    if (profile.seeding_status === 'unclaimed') {
      return NextResponse.json({
        error: 'This profile is unclaimed and not queryable',
        profile_number: profile.profile_number,
        seeding_status: 'unclaimed',
      }, { status: 403 })
    }

    const price = Number(profile.price_public)
    const balance = Number(platform.credit_balance)

    if (balance < price) {
      return NextResponse.json({
        error: 'Insufficient credit balance',
        balance,
        price,
        shortfall: price - balance,
      }, { status: 402 })
    }

    // Revenue split: 90% to owner, 10% to Search Star
    const grossAmount = price
    const marketplaceFee = Math.round(price * 0.10 * 100) / 100
    const netEarnings = Math.round(price * 0.90 * 100) / 100
    const newBalance = Math.round((balance - price) * 100) / 100

    // 1. Debit platform balance (optimistic lock)
    const { error: debitErr } = await admin()
      .from('platform_accounts')
      .update({ credit_balance: newBalance })
      .eq('id', platform.id)
      .eq('credit_balance', balance)

    if (debitErr) {
      return NextResponse.json({ error: 'Failed to process payment — please retry' }, { status: 500 })
    }

    // 2. Create earnings ledger entry
    const { data: earning } = await admin()
      .from('earnings_ledger')
      .insert({
        profile_id: profile.id,
        platform_id: platform.id,
        tier: 'public',
        gross_amount: grossAmount,
        marketplace_fee: marketplaceFee,
        net_earnings: netEarnings,
        referral_share: 0,
        settled: false,
      })
      .select('id')
      .single()

    // 3. Log transaction
    await admin()
      .from('platform_transactions')
      .insert({
        platform_id: platform.id,
        type: 'query_debit',
        amount: -price,
        balance_after: newBalance,
        description: `Public query — ${profile.profile_number || profile.display_name}`,
        reference_id: earning?.id || null,
      })

    // 4. Return public profile data
    const publicData = {
      profile_number: profile.profile_number,
      handle: profile.handle,
      display_name: profile.display_name,
      location: profile.location,
      age_cohort: profile.age_cohort,
      presence_score: profile.presence_score,
      trust_score: profile.trust_score,
      skills_count: profile.skills_count,
      interests_tags: profile.interests_tags,
      has_financial: profile.has_financial,
      has_dating: profile.has_dating,
      tagline: profile.tagline,
      feed_topics: profile.feed_topics,
      feed_item_count: profile.feed_item_count,
    }

    return NextResponse.json({
      success: true,
      query_cost: price,
      balance_remaining: newBalance,
      profile: publicData,
    })
  } catch (err) {
    console.error('Platform query error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
