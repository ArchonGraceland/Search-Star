import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

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
    const body = await request.json()
    const { user_id } = body

    if (!user_id) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })
    }

    // Get user's profile
    const { data: profile, error: profErr } = await admin()
      .from('profiles')
      .select('id')
      .eq('user_id', user_id)
      .single()

    if (profErr || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const now = new Date()

    // ─── Seed Marketing Messages ───
    const marketingMessages = [
      {
        recipient_id: profile.id,
        sender_id: null,
        type: 'marketing',
        subject: 'Message from Raya (Dating)',
        body: 'Hi! We noticed your profile has a high Presence score and verified financials. We\'d love to feature you in our curated matches for Q2. Our premium members are looking for profiles like yours. Interested in a partnership?',
        price_paid: 5.00,
        read: false,
        blocked: false,
        created_at: new Date(now.getTime() - 1000 * 60 * 30).toISOString(),
      },
      {
        recipient_id: profile.id,
        sender_id: null,
        type: 'marketing',
        subject: 'Message from Toptal (Recruiting)',
        body: 'We have a client looking for a senior technical leader for a 6-month engagement. $250/hr, fully remote. Your skills profile matches perfectly. Would you be open to a 15-minute intro call?',
        price_paid: 5.00,
        read: false,
        blocked: false,
        created_at: new Date(now.getTime() - 1000 * 60 * 60 * 3).toISOString(),
      },
      {
        recipient_id: profile.id,
        sender_id: null,
        type: 'marketing',
        subject: 'Message from AngelList (Investing)',
        body: 'New deal flow alert: Pre-seed AI infrastructure company raising $2M. Strong technical team, 3 LOIs from enterprise customers. Matches your investment thesis. Check details in your AngelList inbox.',
        price_paid: 5.00,
        read: true,
        blocked: false,
        created_at: new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString(),
      },
    ]

    // ─── Seed Feed Messages ───
    const feedMessages = [
      {
        recipient_id: profile.id,
        sender_id: null,
        type: 'feed',
        subject: 'New Analysis Published',
        body: null,
        price_paid: null,
        feed_item_id: 'feed-001',
        feed_source_profile_id: profile.id,
        feed_item_title: 'The Case for Sovereign Data in Dating Apps',
        feed_item_summary: 'Why the next generation of dating platforms will query your profile instead of owning it. An analysis of the $4.2B dating market through the lens of data sovereignty and per-query economics.',
        feed_item_type: 'analysis',
        read: false,
        blocked: false,
        created_at: new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString(),
      },
      {
        recipient_id: profile.id,
        sender_id: null,
        type: 'feed',
        subject: 'Weekly Market Update',
        body: null,
        price_paid: null,
        feed_item_id: 'feed-002',
        feed_source_profile_id: profile.id,
        feed_item_title: 'Week 13 Market Recap: AI Infrastructure Deals',
        feed_item_summary: 'Three notable deals closed this week in the AI infrastructure space. Combined valuation: $890M. Key trend: vertical-specific foundation models replacing horizontal plays.',
        feed_item_type: 'market-update',
        read: true,
        blocked: false,
        created_at: new Date(now.getTime() - 1000 * 60 * 60 * 48).toISOString(),
      },
    ]

    // ─── Seed System Messages ───
    const systemMessages = [
      {
        recipient_id: profile.id,
        sender_id: null,
        type: 'system',
        subject: 'Profile Created Successfully',
        body: 'Welcome to Search Star! Your profile has been created and is now live. Set your access tier pricing to start earning from platform queries.',
        price_paid: null,
        read: true,
        blocked: false,
        created_at: new Date(now.getTime() - 1000 * 60 * 60 * 72).toISOString(),
      },
      {
        recipient_id: profile.id,
        sender_id: null,
        type: 'system',
        subject: 'Earnings Milestone: First Query',
        body: 'Congratulations! Your profile received its first paid query. You earned $0.02 from a Public tier query by Toptal. Your earnings will settle on the next Monday payout cycle.',
        price_paid: null,
        read: false,
        blocked: false,
        created_at: new Date(now.getTime() - 1000 * 60 * 60 * 6).toISOString(),
      },
      {
        recipient_id: profile.id,
        sender_id: null,
        type: 'system',
        subject: 'Weekly Settlement Processed',
        body: 'Your weekly settlement has been processed. $47.32 has been sent to your linked bank account via Stripe Connect. Settlement batch: WK-2026-13. Next settlement: Monday, April 7.',
        price_paid: null,
        read: false,
        blocked: false,
        created_at: new Date(now.getTime() - 1000 * 60 * 45).toISOString(),
      },
    ]

    const allMessages = [...marketingMessages, ...feedMessages, ...systemMessages]

    const { data: inserted, error: insertErr } = await admin()
      .from('messages')
      .insert(allMessages)
      .select('id, type')

    if (insertErr) {
      console.error('Seed error:', insertErr)
      return NextResponse.json({ error: 'Failed to seed messages', detail: insertErr.message }, { status: 500 })
    }

    // ─── Also seed a demo platform account if none exists ───
    const { data: existingPlat } = await admin()
      .from('platform_accounts')
      .select('id')
      .eq('api_key', 'demo-api-key-searchstar-2026')
      .maybeSingle()

    if (!existingPlat) {
      const { error: platErr } = await admin()
        .from('platform_accounts')
        .insert({
          name: 'Demo Platform',
          api_key: 'demo-api-key-searchstar-2026',
          credit_balance: 500.00,
          auto_refill: true,
          auto_refill_threshold: 100,
          auto_refill_target: 500,
          status: 'active',
        })

      if (platErr) {
        console.error('Platform seed error:', platErr)
      }
    }

    return NextResponse.json({
      success: true,
      seeded: inserted?.length || 0,
      types: {
        marketing: marketingMessages.length,
        feed: feedMessages.length,
        system: systemMessages.length,
      },
    })
  } catch (err) {
    console.error('Seed API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
