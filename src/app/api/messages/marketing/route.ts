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
    const { api_key, recipient_profile_number, message, sender_name } = body

    // ─── Validate required fields ───
    if (!api_key) {
      return NextResponse.json(
        { error: 'Missing api_key' },
        { status: 401 }
      )
    }

    if (!recipient_profile_number) {
      return NextResponse.json(
        { error: 'Missing recipient_profile_number' },
        { status: 400 }
      )
    }

    if (!message) {
      return NextResponse.json(
        { error: 'Missing message body' },
        { status: 400 }
      )
    }

    // ─── Validate message length (500 char max per spec 4.3) ───
    if (message.length > 500) {
      return NextResponse.json(
        { error: 'Message exceeds 500 character limit', length: message.length },
        { status: 400 }
      )
    }

    // ─── Authenticate platform via API key ───
    const { data: platform, error: platformErr } = await admin()
      .from('platform_accounts')
      .select('*')
      .eq('api_key', api_key)
      .eq('status', 'active')
      .single()

    if (platformErr || !platform) {
      return NextResponse.json(
        { error: 'Invalid or inactive API key' },
        { status: 401 }
      )
    }

    // ─── Look up recipient profile ───
    const { data: recipient, error: recipientErr } = await admin()
      .from('profiles')
      .select('id, display_name, price_marketing, status')
      .eq('profile_number', recipient_profile_number)
      .single()

    if (recipientErr || !recipient) {
      return NextResponse.json(
        { error: 'Recipient profile not found' },
        { status: 404 }
      )
    }

    if (recipient.status !== 'active') {
      return NextResponse.json(
        { error: 'Recipient profile is not active' },
        { status: 403 }
      )
    }

    const price = Number(recipient.price_marketing)
    const balance = Number(platform.credit_balance)

    // ─── Check platform credit balance >= marketing price (spec 4.4) ───
    if (balance < price) {
      return NextResponse.json(
        {
          error: 'Insufficient credit balance',
          balance: balance,
          price: price,
          shortfall: price - balance,
        },
        { status: 402 }
      )
    }

    // ─── Atomic transaction: debit platform, credit owner, deliver message ───
    // Revenue split: 90% to owner, 10% to Search Star (spec 4.4)
    const grossAmount = price
    const marketplaceFee = Math.round(price * 0.10 * 100) / 100
    const netEarnings = Math.round(price * 0.90 * 100) / 100

    // 1. Debit platform balance
    const { error: debitErr } = await admin()
      .from('platform_accounts')
      .update({ credit_balance: balance - price })
      .eq('id', platform.id)
      .eq('credit_balance', balance) // Optimistic lock

    if (debitErr) {
      return NextResponse.json(
        { error: 'Failed to process payment — please retry' },
        { status: 500 }
      )
    }

    // 2. Create earnings ledger entry
    const { error: earningsErr } = await admin()
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

    if (earningsErr) {
      // Attempt to rollback platform balance
      await admin()
        .from('platform_accounts')
        .update({ credit_balance: balance })
        .eq('id', platform.id)

      return NextResponse.json(
        { error: 'Failed to record earnings' },
        { status: 500 }
      )
    }

    // 3. Deliver message
    const { data: msg, error: msgErr } = await admin()
      .from('messages')
      .insert({
        recipient_id: recipient.id,
        sender_id: null,
        type: 'marketing',
        subject: sender_name ? `Message from ${sender_name}` : `Message from ${platform.name}`,
        body: message,
        price_paid: price,
        read: false,
        blocked: false,
      })
      .select('id, created_at')
      .single()

    if (msgErr) {
      console.error('Message delivery failed after payment:', msgErr)
      return NextResponse.json(
        { error: 'Payment processed but message delivery failed — contact support' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message_id: msg.id,
      delivered_at: msg.created_at,
      price_charged: price,
      platform_balance_remaining: balance - price,
    })
  } catch (err) {
    console.error('Marketing message API error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
