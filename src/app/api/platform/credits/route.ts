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

// POST — Add credits (mock deposit for MVP)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { amount } = body

    if (!amount || amount <= 0 || amount > 10000) {
      return NextResponse.json({ error: 'Amount must be between $0.01 and $10,000' }, { status: 400 })
    }

    // Get platform account
    const { data: platform, error: platErr } = await admin()
      .from('platform_accounts')
      .select('id, credit_balance')
      .eq('user_id', user.id)
      .single()

    if (platErr || !platform) {
      return NextResponse.json({ error: 'Platform account not found' }, { status: 404 })
    }

    const newBalance = Number(platform.credit_balance) + Number(amount)

    // Update balance
    const { error: updateErr } = await admin()
      .from('platform_accounts')
      .update({ credit_balance: newBalance })
      .eq('id', platform.id)

    if (updateErr) {
      return NextResponse.json({ error: 'Failed to add credits' }, { status: 500 })
    }

    // Log transaction
    await admin()
      .from('platform_transactions')
      .insert({
        platform_id: platform.id,
        type: 'deposit',
        amount: Number(amount),
        balance_after: newBalance,
        description: `Credit deposit — $${Number(amount).toFixed(2)}`,
      })

    return NextResponse.json({
      success: true,
      new_balance: newBalance,
      amount_added: Number(amount),
    })
  } catch (err) {
    console.error('Credits API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET — Transaction history
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const typeFilter = searchParams.get('type')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Get platform account
    const { data: platform } = await admin()
      .from('platform_accounts')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!platform) {
      return NextResponse.json({ error: 'Platform account not found' }, { status: 404 })
    }

    let query = admin()
      .from('platform_transactions')
      .select('*', { count: 'exact' })
      .eq('platform_id', platform.id)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (typeFilter) {
      query = query.eq('type', typeFilter)
    }

    const { data: transactions, count, error } = await query

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
    }

    return NextResponse.json({
      transactions: transactions || [],
      total: count || 0,
      page,
      limit,
    })
  } catch (err) {
    console.error('Transactions API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
