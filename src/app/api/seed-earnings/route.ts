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
      .select('id, price_public, price_private, price_marketing')
      .eq('user_id', user_id)
      .single()

    if (profErr || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const now = new Date()
    const profileId = profile.id

    // ─── Generate earnings across tiers, platforms, and time ───
    // Simulate ~3 weeks of activity with realistic patterns

    const platforms = [
      'Raya (Dating)',
      'Toptal (Recruiting)',
      'AngelList (Investing)',
      'Hinge (Dating)',
      'LinkedIn Recruiter',
    ]

    const entries: {
      profile_id: string
      platform_id: string
      tier: string
      gross_amount: number
      marketplace_fee: number
      referral_share: number
      net_earnings: number
      settled: boolean
      settled_at: string | null
      settlement_batch: string | null
      created_at: string
    }[] = []

    // Helper: create an earnings entry
    function addEntry(
      platform: string,
      tier: string,
      grossPrice: number,
      daysAgo: number,
      hoursOffset: number,
      settled: boolean,
      batch: string | null
    ) {
      const fee = Math.round(grossPrice * 0.10 * 100) / 100 // 10% marketplace fee
      const net = Math.round((grossPrice - fee) * 100) / 100 // 90% to owner
      const ts = new Date(now.getTime() - (daysAgo * 24 + hoursOffset) * 60 * 60 * 1000)
      entries.push({
        profile_id: profileId,
        platform_id: platform,
        tier,
        gross_amount: grossPrice,
        marketplace_fee: fee,
        referral_share: 0,
        net_earnings: net,
        settled,
        settled_at: settled ? new Date(now.getTime() - (daysAgo - 1) * 24 * 60 * 60 * 1000).toISOString() : null,
        settlement_batch: batch,
        created_at: ts.toISOString(),
      })
    }

    // ── Week 1 (settled) — WK-2026-12 ──
    // Public tier queries from Toptal
    for (let i = 0; i < 42; i++) {
      addEntry('Toptal (Recruiting)', 'public', 0.02, 20, Math.random() * 168, true, 'WK-2026-12')
    }
    // Private tier queries from Raya
    for (let i = 0; i < 18; i++) {
      addEntry('Raya (Dating)', 'private', 0.50, 18, Math.random() * 120, true, 'WK-2026-12')
    }
    // Marketing messages
    addEntry('Hinge (Dating)', 'marketing', 5.00, 19, 3, true, 'WK-2026-12')
    addEntry('LinkedIn Recruiter', 'marketing', 5.00, 17, 8, true, 'WK-2026-12')

    // ── Week 2 (settled) — WK-2026-13 ──
    for (let i = 0; i < 56; i++) {
      addEntry('Toptal (Recruiting)', 'public', 0.02, 12, Math.random() * 168, true, 'WK-2026-13')
    }
    for (let i = 0; i < 24; i++) {
      addEntry('Raya (Dating)', 'private', 0.50, 10, Math.random() * 120, true, 'WK-2026-13')
    }
    for (let i = 0; i < 8; i++) {
      addEntry('AngelList (Investing)', 'private', 0.50, 11, Math.random() * 120, true, 'WK-2026-13')
    }
    addEntry('Raya (Dating)', 'marketing', 5.00, 13, 5, true, 'WK-2026-13')
    addEntry('Hinge (Dating)', 'marketing', 5.00, 9, 2, true, 'WK-2026-13')
    addEntry('LinkedIn Recruiter', 'marketing', 5.00, 10, 14, true, 'WK-2026-13')

    // ── Current week (unsettled) ──
    for (let i = 0; i < 38; i++) {
      addEntry('Toptal (Recruiting)', 'public', 0.02, 3, Math.random() * 72, false, null)
    }
    for (let i = 0; i < 15; i++) {
      addEntry('Raya (Dating)', 'private', 0.50, 2, Math.random() * 48, false, null)
    }
    for (let i = 0; i < 5; i++) {
      addEntry('AngelList (Investing)', 'private', 0.50, 1, Math.random() * 24, false, null)
    }
    for (let i = 0; i < 3; i++) {
      addEntry('Hinge (Dating)', 'private', 0.50, 4, Math.random() * 96, false, null)
    }
    addEntry('LinkedIn Recruiter', 'marketing', 5.00, 1, 6, false, null)
    addEntry('Raya (Dating)', 'marketing', 5.00, 0, 2, false, null)

    // Insert all entries
    const { data: inserted, error: insertErr } = await admin()
      .from('earnings_ledger')
      .insert(entries)
      .select('id')

    if (insertErr) {
      console.error('Seed earnings error:', insertErr)
      return NextResponse.json({ error: 'Failed to seed earnings', detail: insertErr.message }, { status: 500 })
    }

    // Calculate totals for response
    const totalGross = entries.reduce((s, e) => s + e.gross_amount, 0)
    const totalNet = entries.reduce((s, e) => s + e.net_earnings, 0)
    const settledTotal = entries.filter(e => e.settled).reduce((s, e) => s + e.net_earnings, 0)
    const unsettledTotal = entries.filter(e => !e.settled).reduce((s, e) => s + e.net_earnings, 0)

    return NextResponse.json({
      success: true,
      seeded: inserted?.length || 0,
      summary: {
        total_entries: entries.length,
        gross_revenue: Math.round(totalGross * 100) / 100,
        net_earnings: Math.round(totalNet * 100) / 100,
        settled: Math.round(settledTotal * 100) / 100,
        unsettled: Math.round(unsettledTotal * 100) / 100,
        tiers: {
          public: entries.filter(e => e.tier === 'public').length,
          private: entries.filter(e => e.tier === 'private').length,
          marketing: entries.filter(e => e.tier === 'marketing').length,
        },
        batches: ['WK-2026-12', 'WK-2026-13'],
      },
    })
  } catch (err) {
    console.error('Seed earnings API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
