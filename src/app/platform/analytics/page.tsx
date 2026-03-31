'use client'

import { useState, useEffect } from 'react'

interface Analytics {
  summary: {
    total_spend: number
    month_spend: number
    total_queries: number
    total_messages: number
    balance: number
  }
  spend_by_tier: {
    public: { spend: number; count: number }
    marketing: { spend: number; count: number }
  }
  weekly_volume: { week: string; queries: number; spend: number }[]
  averages: { query_cost: number; marketing_cost: number }
  top_profiles: { name: string; count: number; spend: number }[]
  marketing_stats: { messages_sent: number; total_spend: number; block_rate: number }
  forecast: { daily_avg_spend: number; days_until_empty: number | null }
}

export default function PlatformAnalytics() {
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAnalytics = async () => {
      const res = await fetch('/api/platform/analytics')
      if (res.ok) {
        setData(await res.json())
      }
      setLoading(false)
    }
    fetchAnalytics()
  }, [])

  if (loading) {
    return (
      <div className="p-8">
        <div className="font-body text-sm text-[#767676]">Loading analytics...</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-8">
        <div className="font-body text-sm text-[#991b1b]">Failed to load analytics data.</div>
      </div>
    )
  }

  const maxWeeklyQueries = Math.max(...data.weekly_volume.map(w => w.queries), 1)

  return (
    <div className="p-8 max-w-[1100px]">
      <div className="mb-8">
        <h1 className="font-heading text-[28px] font-bold mb-1">Spending Analytics</h1>
        <p className="font-body text-sm text-[#767676]">
          Track platform spending, query volume, and ROI metrics.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="card-grace p-5">
          <div className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">Total Spend</div>
          <div className="font-mono text-xl font-medium text-[#1a1a1a]">${data.summary.total_spend.toFixed(2)}</div>
          <div className="font-body text-[10px] text-[#767676]">lifetime</div>
        </div>
        <div className="card-grace p-5">
          <div className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">This Month</div>
          <div className="font-mono text-xl font-medium text-[#92400e]">${data.summary.month_spend.toFixed(2)}</div>
          <div className="font-body text-[10px] text-[#767676]">{new Date().toLocaleString('default', { month: 'long' })}</div>
        </div>
        <div className="card-grace p-5">
          <div className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">Total Queries</div>
          <div className="font-mono text-xl font-medium text-[#0d9488]">{data.summary.total_queries}</div>
          <div className="font-body text-[10px] text-[#767676]">public tier</div>
        </div>
        <div className="card-grace p-5">
          <div className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">Messages Sent</div>
          <div className="font-mono text-xl font-medium text-[#92400e]">{data.summary.total_messages}</div>
          <div className="font-body text-[10px] text-[#767676]">marketing tier</div>
        </div>
      </div>

      {/* Spend by Tier + Cost per Query */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="card-grace p-6">
          <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-4">Spend by Tier</div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-1">
                <span className="font-body text-sm">Public Queries</span>
                <span className="font-mono text-sm text-[#0d9488]">${data.spend_by_tier.public.spend.toFixed(2)}</span>
              </div>
              <div className="h-2 bg-[#f0f0f0] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#0d9488] rounded-full transition-all"
                  style={{ width: `${data.summary.total_spend > 0 ? (data.spend_by_tier.public.spend / data.summary.total_spend) * 100 : 0}%` }}
                />
              </div>
              <div className="font-body text-[10px] text-[#767676] mt-0.5">{data.spend_by_tier.public.count} queries</div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="font-body text-sm">Marketing Messages</span>
                <span className="font-mono text-sm text-[#92400e]">${data.spend_by_tier.marketing.spend.toFixed(2)}</span>
              </div>
              <div className="h-2 bg-[#f0f0f0] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#92400e] rounded-full transition-all"
                  style={{ width: `${data.summary.total_spend > 0 ? (data.spend_by_tier.marketing.spend / data.summary.total_spend) * 100 : 0}%` }}
                />
              </div>
              <div className="font-body text-[10px] text-[#767676] mt-0.5">{data.spend_by_tier.marketing.count} messages</div>
            </div>
          </div>
        </div>

        <div className="card-grace p-6">
          <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-4">Cost Per Action</div>
          <div className="space-y-4">
            <div>
              <div className="font-body text-xs text-[#767676]">Average Query Cost</div>
              <div className="font-mono text-2xl font-medium text-[#0d9488]">${data.averages.query_cost.toFixed(4)}</div>
            </div>
            <div>
              <div className="font-body text-xs text-[#767676]">Average Marketing Cost</div>
              <div className="font-mono text-2xl font-medium text-[#92400e]">${data.averages.marketing_cost.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Query Volume Chart (bar chart via divs) */}
      <div className="card-grace p-6 mb-8">
        <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-4">
          Query Volume — Last 8 Weeks
        </div>
        <div className="flex items-end gap-2 h-[120px]">
          {data.weekly_volume.map((week, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="font-mono text-[10px] text-[#767676]">{week.queries}</div>
              <div
                className="w-full bg-[#0d9488] rounded-t-[2px] transition-all min-h-[2px]"
                style={{ height: `${(week.queries / maxWeeklyQueries) * 80}px` }}
              />
              <div className="font-mono text-[9px] text-[#767676] truncate w-full text-center">
                {new Date(week.week).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Profiles + Marketing Stats + Forecast */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Top Profiles */}
        <div className="card-grace p-6">
          <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-3">Top Profiles Queried</div>
          {data.top_profiles.length === 0 ? (
            <div className="font-body text-xs text-[#767676]">No queries yet</div>
          ) : (
            <div className="space-y-2">
              {data.top_profiles.map((p, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="font-body text-xs text-[#5a5a5a] truncate flex-1">{p.name}</div>
                  <div className="font-mono text-xs text-[#0d9488] ml-2">{p.count}×</div>
                  <div className="font-mono text-xs text-[#767676] ml-2">${p.spend.toFixed(2)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Marketing Stats */}
        <div className="card-grace p-6">
          <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-3">Marketing Stats</div>
          <div className="space-y-3">
            <div>
              <div className="font-body text-xs text-[#767676]">Messages Sent</div>
              <div className="font-mono text-lg font-medium">{data.marketing_stats.messages_sent}</div>
            </div>
            <div>
              <div className="font-body text-xs text-[#767676]">Total Spend</div>
              <div className="font-mono text-lg font-medium text-[#92400e]">${data.marketing_stats.total_spend.toFixed(2)}</div>
            </div>
            <div>
              <div className="font-body text-xs text-[#767676]">Block Rate</div>
              <div className={`font-mono text-lg font-medium ${data.marketing_stats.block_rate > 20 ? 'text-[#991b1b]' : 'text-[#166534]'}`}>
                {data.marketing_stats.block_rate.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        {/* Credit Forecast */}
        <div className="card-grace p-6">
          <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-3">Credit Forecast</div>
          <div className="space-y-3">
            <div>
              <div className="font-body text-xs text-[#767676]">Current Balance</div>
              <div className="font-mono text-lg font-medium text-[#166534]">${data.summary.balance.toFixed(2)}</div>
            </div>
            <div>
              <div className="font-body text-xs text-[#767676]">Daily Avg Spend (7d)</div>
              <div className="font-mono text-lg font-medium">${data.forecast.daily_avg_spend.toFixed(2)}</div>
            </div>
            <div>
              <div className="font-body text-xs text-[#767676]">Days Until Empty</div>
              <div className={`font-mono text-lg font-medium ${(data.forecast.days_until_empty || 999) < 7 ? 'text-[#991b1b]' : 'text-[#166534]'}`}>
                {data.forecast.days_until_empty !== null ? `${data.forecast.days_until_empty} days` : '∞'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
