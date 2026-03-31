import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
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

export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: platform } = await admin()
      .from('platform_accounts')
      .select('id, credit_balance')
      .eq('user_id', user.id)
      .single()

    if (!platform) {
      return NextResponse.json({ error: 'Platform account not found' }, { status: 404 })
    }

    // Get all transactions
    const { data: allTx } = await admin()
      .from('platform_transactions')
      .select('*')
      .eq('platform_id', platform.id)
      .order('created_at', { ascending: false })

    const transactions = allTx || []
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    // Summary stats
    const totalSpend = transactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0)

    const monthSpend = transactions
      .filter(t => t.amount < 0 && new Date(t.created_at) >= monthStart)
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0)

    const totalQueries = transactions.filter(t => t.type === 'query_debit').length
    const totalMessages = transactions.filter(t => t.type === 'marketing_debit').length

    // Spend by tier
    const querySpend = transactions
      .filter(t => t.type === 'query_debit')
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0)
    const marketingSpend = transactions
      .filter(t => t.type === 'marketing_debit')
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0)

    // Query volume by week (last 8 weeks)
    const weeklyVolume: { week: string; queries: number; spend: number }[] = []
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now)
      weekStart.setDate(weekStart.getDate() - (i * 7) - weekStart.getDay())
      weekStart.setHours(0, 0, 0, 0)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 7)

      const weekTx = transactions.filter(t => {
        const d = new Date(t.created_at)
        return d >= weekStart && d < weekEnd && t.type === 'query_debit'
      })

      weeklyVolume.push({
        week: weekStart.toISOString().slice(0, 10),
        queries: weekTx.length,
        spend: weekTx.reduce((s, t) => s + Math.abs(Number(t.amount)), 0),
      })
    }

    // Average cost per query
    const avgQueryCost = totalQueries > 0 ? querySpend / totalQueries : 0
    const avgMarketingCost = totalMessages > 0 ? marketingSpend / totalMessages : 0

    // Top profiles queried (from descriptions)
    const profileCounts: Record<string, { name: string; count: number; spend: number }> = {}
    transactions.filter(t => t.type === 'query_debit').forEach(t => {
      const name = t.description?.replace('Public query — ', '') || 'Unknown'
      if (!profileCounts[name]) profileCounts[name] = { name, count: 0, spend: 0 }
      profileCounts[name].count++
      profileCounts[name].spend += Math.abs(Number(t.amount))
    })
    const topProfiles = Object.values(profileCounts)
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 10)

    // Credit usage forecast (trailing 7-day average)
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const recentSpend = transactions
      .filter(t => t.amount < 0 && new Date(t.created_at) >= sevenDaysAgo)
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0)
    const dailyAvg = recentSpend / 7
    const daysUntilEmpty = dailyAvg > 0 ? Math.floor(Number(platform.credit_balance) / dailyAvg) : null

    // Block rate (messages where recipient blocked)
    const { count: totalSentMessages } = await admin()
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('type', 'marketing')
      .eq('sender_id', platform.id)

    const { count: blockedMessages } = await admin()
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('type', 'marketing')
      .eq('sender_id', platform.id)
      .eq('blocked', true)

    const blockRate = (totalSentMessages && totalSentMessages > 0)
      ? ((blockedMessages || 0) / totalSentMessages) * 100
      : 0

    return NextResponse.json({
      summary: {
        total_spend: totalSpend,
        month_spend: monthSpend,
        total_queries: totalQueries,
        total_messages: totalMessages,
        balance: Number(platform.credit_balance),
      },
      spend_by_tier: {
        public: { spend: querySpend, count: totalQueries },
        marketing: { spend: marketingSpend, count: totalMessages },
      },
      weekly_volume: weeklyVolume,
      averages: {
        query_cost: avgQueryCost,
        marketing_cost: avgMarketingCost,
      },
      top_profiles: topProfiles,
      marketing_stats: {
        messages_sent: totalSentMessages || 0,
        total_spend: marketingSpend,
        block_rate: blockRate,
      },
      forecast: {
        daily_avg_spend: dailyAvg,
        days_until_empty: daysUntilEmpty,
      },
    })
  } catch (err) {
    console.error('Analytics API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
