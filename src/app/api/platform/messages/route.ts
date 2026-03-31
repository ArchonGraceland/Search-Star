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

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: platform } = await admin()
      .from('platform_accounts')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!platform) {
      return NextResponse.json({ error: 'Platform account not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = 20

    // Get marketing messages sent by this platform
    // Messages sent by platforms have sender_id = null but we can match via platform_transactions
    const { data: txs } = await admin()
      .from('platform_transactions')
      .select('reference_id, created_at, amount, description')
      .eq('platform_id', platform.id)
      .eq('type', 'marketing_debit')
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    // Also get messages from messages table that match this platform
    const { data: messages, count } = await admin()
      .from('messages')
      .select('id, recipient_id, subject, body, price_paid, blocked, created_at', { count: 'exact' })
      .eq('type', 'marketing')
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    // Get recipient names
    const recipientIds = [...new Set((messages || []).map(m => m.recipient_id))]
    let recipientMap: Record<string, string> = {}
    if (recipientIds.length > 0) {
      const { data: profiles } = await admin()
        .from('profiles')
        .select('id, display_name, profile_number')
        .in('id', recipientIds)

      if (profiles) {
        recipientMap = Object.fromEntries(
          profiles.map(p => [p.id, `${p.display_name} (${p.profile_number || 'N/A'})`])
        )
      }
    }

    const enrichedMessages = (messages || []).map(m => ({
      ...m,
      recipient_name: recipientMap[m.recipient_id] || 'Unknown',
    }))

    // Block rate
    const totalSent = count || 0
    const blocked = (messages || []).filter(m => m.blocked).length
    const blockRate = totalSent > 0 ? (blocked / totalSent) * 100 : 0

    return NextResponse.json({
      messages: enrichedMessages,
      total: totalSent,
      page,
      limit,
      block_rate: blockRate,
      transactions: txs || [],
    })
  } catch (err) {
    console.error('Platform messages API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
