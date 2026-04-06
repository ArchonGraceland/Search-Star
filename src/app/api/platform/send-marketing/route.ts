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
    const { recipient_profile_id, message } = body

    if (!recipient_profile_id || !message) {
      return NextResponse.json({ error: 'Missing recipient_profile_id or message' }, { status: 400 })
    }

    if (message.length > 500) {
      return NextResponse.json({ error: 'Message exceeds 500 character limit' }, { status: 400 })
    }

    // Get platform account
    const { data: platform } = await admin()
      .from('platform_accounts')
      .select('id, name, credit_balance')
      .eq('user_id', user.id)
      .single()

    if (!platform) {
      return NextResponse.json({ error: 'Platform account not found' }, { status: 404 })
    }

    // Get recipient profile
    const { data: recipient } = await admin()
      .from('profiles')
      .select('id, display_name, price_marketing, status, profile_number, seeding_status')
      .eq('id', recipient_profile_id)
      .single()

    if (!recipient || recipient.status !== 'active') {
      return NextResponse.json({ error: 'Recipient not found or inactive' }, { status: 404 })
    }

    // ═══ Unclaimed profile guard ═══
    // Spec Section 3.9: "Marketing messages disabled — no one profits from unclaimed data"
    if (recipient.seeding_status === 'unclaimed') {
      return NextResponse.json({
        error: 'Cannot send marketing messages to unclaimed profiles',
        profile_number: recipient.profile_number,
        seeding_status: 'unclaimed',
      }, { status: 403 })
    }

    const price = Number(recipient.price_marketing)
    const balance = Number(platform.credit_balance)

    if (balance < price) {
      return NextResponse.json({
        error: 'Insufficient credit balance',
        balance,
        price,
      }, { status: 402 })
    }

    // Revenue split: 90/10
    const grossAmount = price
    const marketplaceFee = Math.round(price * 0.10 * 100) / 100
    const netEarnings = Math.round(price * 0.90 * 100) / 100
    const newBalance = Math.round((balance - price) * 100) / 100

    // 1. Debit platform (optimistic lock)
    const { error: debitErr } = await admin()
      .from('platform_accounts')
      .update({ credit_balance: newBalance })
      .eq('id', platform.id)
      .eq('credit_balance', balance)

    if (debitErr) {
      return NextResponse.json({ error: 'Payment failed — please retry' }, { status: 500 })
    }

    // 2. Earnings ledger
    const { data: earning } = await admin()
      .from('earnings_ledger')
      .insert({
        profile_id: recipient.id,
        platform_id: platform.id,
        tier: 'marketing',
        gross_amount: grossAmount,
        marketplace_fee: marketplaceFee,
        net_earnings: netEarnings,
        referral_share: 0,
        settled: false,
      })
      .select('id')
      .single()

    // 3. Platform transaction log
    await admin()
      .from('platform_transactions')
      .insert({
        platform_id: platform.id,
        type: 'marketing_debit',
        amount: -price,
        balance_after: newBalance,
        description: `Marketing message — ${recipient.profile_number || recipient.display_name}`,
        reference_id: earning?.id || null,
      })

    // 4. Deliver message
    const { data: msg } = await admin()
      .from('messages')
      .insert({
        recipient_id: recipient.id,
        sender_id: platform.id,
        type: 'marketing',
        subject: `Message from ${platform.name}`,
        body: message,
        price_paid: price,
        read: false,
        blocked: false,
      })
      .select('id, created_at')
      .single()

    return NextResponse.json({
      success: true,
      message_id: msg?.id,
      price_charged: price,
      balance_remaining: newBalance,
    })
  } catch (err) {
    console.error('Send marketing error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
