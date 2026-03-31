import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

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

export async function POST() {
  try {
    const email = 'platform.test@test.searchstar.dev'
    const password = 'TestPass123!'
    const companyName = 'Acme Recruiting Corp'

    // Check if already exists
    const { data: existingUsers } = await admin().auth.admin.listUsers()
    const existing = existingUsers?.users?.find(u => u.email === email)

    let userId: string

    if (existing) {
      userId = existing.id
    } else {
      // Create auth user
      const { data: authData, error: authErr } = await admin().auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: companyName, role: 'platform' },
      })

      if (authErr) {
        return NextResponse.json({ error: 'Auth creation failed: ' + authErr.message }, { status: 500 })
      }
      userId = authData.user.id
    }

    // Update profile to platform role
    await admin()
      .from('profiles')
      .update({ role: 'platform', display_name: companyName })
      .eq('user_id', userId)

    // Check if platform account already exists
    const { data: existingPlat } = await admin()
      .from('platform_accounts')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    let platformId: string

    if (existingPlat) {
      platformId = existingPlat.id
      // Update balance
      await admin()
        .from('platform_accounts')
        .update({ credit_balance: 500.00 })
        .eq('id', platformId)
    } else {
      const apiKey = `sk_live_${randomUUID().replace(/-/g, '')}`
      const { data: platData, error: platErr } = await admin()
        .from('platform_accounts')
        .insert({
          name: companyName,
          api_key: apiKey,
          credit_balance: 500.00,
          auto_refill: true,
          auto_refill_threshold: 100,
          auto_refill_target: 500,
          status: 'active',
          user_id: userId,
          billing_email: email,
          company_url: 'https://acme-recruiting.example.com',
        })
        .select('id')
        .single()

      if (platErr) {
        return NextResponse.json({ error: 'Platform account creation failed: ' + platErr.message }, { status: 500 })
      }
      platformId = platData.id
    }

    // Clear existing transactions for this platform
    await admin()
      .from('platform_transactions')
      .delete()
      .eq('platform_id', platformId)

    // Get test user profiles for references
    const { data: testProfiles } = await admin()
      .from('profiles')
      .select('id, display_name, profile_number')
      .neq('role', 'platform')
      .eq('status', 'active')
      .limit(5)

    const profiles = testProfiles || []
    const now = new Date()
    const transactions: Array<{
      platform_id: string
      type: string
      amount: number
      balance_after: number
      description: string
      reference_id: string | null
      created_at: string
    }> = []

    let runningBalance = 0

    // Seed deposits
    const depositDates = [56, 42, 28, 14, 3]
    for (const daysAgo of depositDates) {
      const amount = [200, 300, 250, 500, 200][depositDates.indexOf(daysAgo)]
      runningBalance += amount
      transactions.push({
        platform_id: platformId,
        type: 'deposit',
        amount,
        balance_after: runningBalance,
        description: `Credit deposit — $${amount.toFixed(2)}`,
        reference_id: null,
        created_at: new Date(now.getTime() - daysAgo * 86400000).toISOString(),
      })
    }

    // Seed query debits (scattered over past 8 weeks)
    for (let i = 0; i < 35; i++) {
      const daysAgo = Math.floor(Math.random() * 56)
      const profileIdx = Math.floor(Math.random() * Math.max(profiles.length, 1))
      const profile = profiles[profileIdx] || { profile_number: `SS-TEST0${profileIdx + 1}`, display_name: 'Test User' }
      const cost = [0.02, 0.02, 0.05, 0.02, 0.10][Math.floor(Math.random() * 5)]
      runningBalance -= cost
      transactions.push({
        platform_id: platformId,
        type: 'query_debit',
        amount: -cost,
        balance_after: Math.max(runningBalance, 0),
        description: `Public query — ${profile.profile_number || profile.display_name}`,
        reference_id: null,
        created_at: new Date(now.getTime() - daysAgo * 86400000 - Math.random() * 86400000).toISOString(),
      })
    }

    // Seed marketing debits
    for (let i = 0; i < 15; i++) {
      const daysAgo = Math.floor(Math.random() * 42)
      const profileIdx = Math.floor(Math.random() * Math.max(profiles.length, 1))
      const profile = profiles[profileIdx] || { profile_number: `SS-TEST0${profileIdx + 1}`, display_name: 'Test User' }
      const cost = [5.00, 5.00, 10.00, 3.00, 5.00][Math.floor(Math.random() * 5)]
      runningBalance -= cost
      transactions.push({
        platform_id: platformId,
        type: 'marketing_debit',
        amount: -cost,
        balance_after: Math.max(runningBalance, 0),
        description: `Marketing message — ${profile.profile_number || profile.display_name}`,
        reference_id: null,
        created_at: new Date(now.getTime() - daysAgo * 86400000 - Math.random() * 86400000).toISOString(),
      })
    }

    // Sort by date and fix running balances
    transactions.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    let balance = 0
    for (const tx of transactions) {
      balance += tx.amount
      tx.balance_after = Math.round(Math.max(balance, 0) * 100) / 100
    }

    // Insert transactions
    const { error: txErr } = await admin()
      .from('platform_transactions')
      .insert(transactions)

    if (txErr) {
      return NextResponse.json({ error: 'Transaction seed failed: ' + txErr.message }, { status: 500 })
    }

    // Seed some marketing messages from this platform to test users
    if (profiles.length > 0) {
      const marketingMessages = profiles.slice(0, 3).map((p, i) => ({
        recipient_id: p.id,
        sender_id: platformId,
        type: 'marketing' as const,
        subject: `Message from ${companyName}`,
        body: [
          'We have an exciting senior engineering role that matches your profile. $180k-$250k, fully remote. Would you be open to a quick conversation?',
          'Your presence score and verified credentials caught our attention. We\'re building a curated talent network — interested in learning more?',
          'Hi! We noticed your skills in AI/ML. We have a client looking for exactly your expertise. 6-month contract, premium rates. Let\'s connect.',
        ][i],
        price_paid: 5.00,
        read: i === 2,
        blocked: i === 1,
        created_at: new Date(now.getTime() - (i + 1) * 86400000 * 3).toISOString(),
      }))

      await admin().from('messages').insert(marketingMessages)
    }

    return NextResponse.json({
      success: true,
      platform_user_email: email,
      platform_id: platformId,
      transactions_seeded: transactions.length,
      messages_seeded: Math.min(profiles.length, 3),
    })
  } catch (err) {
    console.error('Seed platform error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
