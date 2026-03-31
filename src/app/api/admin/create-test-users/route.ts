import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

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

const TEST_USERS = [
  { email: 'testuser.alice@test.searchstar.dev', password: 'TestPass123!', name: 'Alice Testworth', handle: 'alice.testworth', profile_number: 'SS-TEST01', price_marketing: 5.00 },
  { email: 'testuser.bob@test.searchstar.dev', password: 'TestPass123!', name: 'Bob Fakeman', handle: 'bob.fakeman', profile_number: 'SS-TEST02', price_marketing: 10.00 },
  { email: 'testuser.carol@test.searchstar.dev', password: 'TestPass123!', name: 'Carol Placeholder', handle: 'carol.placeholder', profile_number: 'SS-TEST03', price_marketing: 3.00 },
]

export async function POST() {
  try {
    const results = []

    for (const user of TEST_USERS) {
      // Create user via Supabase Auth Admin API (the proper way)
      const { data, error } = await admin().auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { display_name: user.name },
      })

      if (error) {
        results.push({ email: user.email, error: error.message })
        continue
      }

      // Update their profile with handle, profile number, pricing
      const { error: profErr } = await admin()
        .from('profiles')
        .update({
          handle: user.handle,
          profile_number: user.profile_number,
          price_marketing: user.price_marketing,
          price_private: 0.50,
          price_public: 0.02,
          status: 'active',
        })
        .eq('user_id', data.user.id)

      results.push({
        email: user.email,
        user_id: data.user.id,
        profile_updated: !profErr,
      })
    }

    // Get Alice's profile ID for seeding messages
    const alice = results.find(r => r.email === TEST_USERS[0].email)
    const bob = results.find(r => r.email === TEST_USERS[1].email)
    const carol = results.find(r => r.email === TEST_USERS[2].email)

    if (alice?.user_id && bob?.user_id && carol?.user_id) {
      // Get profile IDs
      const { data: profiles } = await admin()
        .from('profiles')
        .select('id, user_id')
        .in('user_id', [alice.user_id, bob.user_id, carol.user_id])

      const profileMap: Record<string, string> = {}
      profiles?.forEach(p => { profileMap[p.user_id] = p.id })

      const alicePid = profileMap[alice.user_id]
      const bobPid = profileMap[bob.user_id]
      const carolPid = profileMap[carol.user_id]

      if (alicePid && bobPid && carolPid) {
        const now = new Date()

        // Seed messages
        await admin().from('messages').insert([
          // Marketing from Bob
          { recipient_id: alicePid, sender_id: bobPid, type: 'marketing', subject: 'Recruiting Opportunity — TechCorp', body: 'Hi Alice! We\'re building something big in AI infrastructure and your profile caught our eye. Looking for a technical co-founder with your exact skill set. $300K+ equity package. 15 min call?', price_paid: 5.00, read: false, blocked: false, created_at: new Date(now.getTime() - 25 * 60000).toISOString() },
          // Marketing from Carol
          { recipient_id: alicePid, sender_id: carolPid, type: 'marketing', subject: 'Investment Opportunity — Series A', body: 'Alice, we\'re raising our Series A ($8M round) and looking for strategic angels with operator experience. Your profile score and financial standing match our ideal investor profile.', price_paid: 5.00, read: false, blocked: false, created_at: new Date(now.getTime() - 3 * 3600000).toISOString() },
          // Marketing from Bob (read)
          { recipient_id: alicePid, sender_id: bobPid, type: 'marketing', subject: 'Open Source Collaboration Request', body: 'Hey! Saw your skills profile. We\'re launching an open-source data sovereignty toolkit and could use a contributor with your background. No cost, just smart people. Interested?', price_paid: 5.00, read: true, blocked: false, created_at: new Date(now.getTime() - 48 * 3600000).toISOString() },
          // Feed items
          { recipient_id: alicePid, sender_id: null, type: 'feed_item', subject: 'New Analysis', feed_item_id: 'feed-201', feed_source_profile_id: bobPid, feed_item_title: 'Why Per-Query Pricing Beats Subscription Models', feed_item_summary: 'A deep dive into the economics of per-query data monetization vs traditional SaaS. Real marketplace data shows per-query models generate 3.2x more revenue for data owners.', feed_item_type: 'analysis', read: false, blocked: false, created_at: new Date(now.getTime() - 90 * 60000).toISOString() },
          { recipient_id: alicePid, sender_id: null, type: 'feed_item', subject: 'Weekly Digest', feed_item_id: 'feed-202', feed_source_profile_id: carolPid, feed_item_title: 'Week 13: Sovereign Identity Adoption Tracker', feed_item_summary: 'DID adoption hit 2.4M active identifiers this week, up 18% MoM. Major integrations: Shopify merchant verification, Airbnb host profiles, three new dating apps.', feed_item_type: 'market-update', read: false, blocked: false, created_at: new Date(now.getTime() - 6 * 3600000).toISOString() },
          { recipient_id: alicePid, sender_id: null, type: 'feed_item', subject: 'New Post', feed_item_id: 'feed-203', feed_source_profile_id: bobPid, feed_item_title: 'The Validator Economy: Staking Real Money on Real People', feed_item_summary: 'How Search Star\'s validation staking model creates a prediction market for personal truthfulness. Early data shows validators earn 12% APY on well-chosen stakes.', feed_item_type: 'essay', read: true, blocked: false, created_at: new Date(now.getTime() - 72 * 3600000).toISOString() },
          // System messages
          { recipient_id: alicePid, sender_id: null, type: 'system', subject: 'Welcome to Search Star', body: 'Your profile SS-TEST01 is now live. Set your tier pricing in the Profile Builder to start earning from platform queries.', read: true, blocked: false, created_at: new Date(now.getTime() - 120 * 3600000).toISOString() },
          { recipient_id: alicePid, sender_id: null, type: 'system', subject: 'Earnings Milestone: First $10', body: 'You\'ve crossed $10 in lifetime earnings! Current breakdown: 142 Public queries ($2.84), 12 Private queries ($6.00), 1 Marketing message ($5.00). Total: $13.84.', read: false, blocked: false, created_at: new Date(now.getTime() - 4 * 3600000).toISOString() },
          { recipient_id: alicePid, sender_id: null, type: 'system', subject: 'Weekly Settlement Processed — $47.32', body: 'Your weekly settlement has been processed. $47.32 sent to your linked bank account via Stripe Connect. Settlement batch: WK-2026-13.', read: false, blocked: false, created_at: new Date(now.getTime() - 35 * 60000).toISOString() },
        ])

        // Demo platform account
        await admin().from('platform_accounts').insert({
          name: 'Demo Test Platform', api_key: 'test-api-key-2026', credit_balance: 500.00,
          auto_refill: true, auto_refill_threshold: 100, auto_refill_target: 500, status: 'active',
        })
      }
    }

    return NextResponse.json({ success: true, users: results })
  } catch (err) {
    console.error('Create test users error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
