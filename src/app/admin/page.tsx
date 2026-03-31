import { createClient } from '@/lib/supabase/server'

// ─── Types ───
interface EarningsRow {
  id: string
  profile_id: string
  platform_id: string | null
  tier: string
  gross_amount: number
  marketplace_fee: number
  net_earnings: number
  settled: boolean
  settled_at: string | null
  settlement_batch: string | null
  created_at: string
}

interface PlatformAccount {
  id: string
  name: string
  credit_balance: number
  auto_refill: boolean
  auto_refill_threshold: number | null
  auto_refill_target: number | null
  status: string
  created_at: string
}

interface ProfileName {
  id: string
  display_name: string
  profile_number: string | null
}

// ─── Helpers ───
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function tierBadge(tier: string): { label: string; bg: string; text: string } {
  switch (tier) {
    case 'public': return { label: 'Public', bg: 'bg-[#eef2f8]', text: 'text-[#1a3a6b]' }
    case 'private': return { label: 'Private', bg: 'bg-[#f0fdf4]', text: 'text-[#166534]' }
    case 'marketing': return { label: 'Marketing', bg: 'bg-[#fffbeb]', text: 'text-[#92400e]' }
    default: return { label: tier, bg: 'bg-[#f5f5f5]', text: 'text-[#1a1a1a]' }
  }
}

export default async function AdminDashboard() {
  const supabase = await createClient()

  // ─── Fetch all earnings ───
  const { data: allEarnings } = await supabase
    .from('earnings_ledger')
    .select('*')
    .order('created_at', { ascending: false }) as { data: EarningsRow[] | null }

  const earnings = allEarnings || []

  // ─── Summary calculations ───
  const marketplaceRevenue = earnings.reduce((s, e) => s + Number(e.marketplace_fee), 0)
  const pendingSettlements = earnings.filter(e => !e.settled).reduce((s, e) => s + Number(e.net_earnings), 0)
  const totalSettled = earnings.filter(e => e.settled).reduce((s, e) => s + Number(e.net_earnings), 0)
  const totalGross = earnings.reduce((s, e) => s + Number(e.gross_amount), 0)

  // ─── Revenue by tier ───
  const tierBreakdown = earnings.reduce((acc, e) => {
    if (!acc[e.tier]) acc[e.tier] = { count: 0, gross: 0, fee: 0, net: 0 }
    acc[e.tier].count += 1
    acc[e.tier].gross += Number(e.gross_amount)
    acc[e.tier].fee += Number(e.marketplace_fee)
    acc[e.tier].net += Number(e.net_earnings)
    return acc
  }, {} as Record<string, { count: number; gross: number; fee: number; net: number }>)

  // ─── Revenue by week ───
  const weeklyRevenue = earnings.reduce((acc, e) => {
    const d = new Date(e.created_at)
    const weekStart = new Date(d)
    weekStart.setDate(d.getDate() - d.getDay())
    const key = weekStart.toISOString().split('T')[0]
    if (!acc[key]) acc[key] = { gross: 0, fee: 0, count: 0 }
    acc[key].gross += Number(e.gross_amount)
    acc[key].fee += Number(e.marketplace_fee)
    acc[key].count += 1
    return acc
  }, {} as Record<string, { gross: number; fee: number; count: number }>)
  const weeklyEntries = Object.entries(weeklyRevenue).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 8)

  // ─── Platform accounts ───
  const { data: platforms } = await supabase
    .from('platform_accounts')
    .select('*')
    .order('credit_balance', { ascending: false }) as { data: PlatformAccount[] | null }

  // ─── Recent transactions (last 20) ───
  const recent20 = earnings.slice(0, 20)

  // Get profile names for recent transactions
  const profileIds = [...new Set(recent20.map(e => e.profile_id))]
  const { data: profileNames } = await supabase
    .from('profiles')
    .select('id, display_name, profile_number')
    .in('id', profileIds) as { data: ProfileName[] | null }

  const nameMap = (profileNames || []).reduce((acc, p) => {
    acc[p.id] = p
    return acc
  }, {} as Record<string, ProfileName>)

  return (
    <div className="p-8">
      <div className="max-w-[1100px]">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-[32px] font-bold mb-1">Financial Dashboard</h1>
          <p className="font-body text-sm text-[#767676]">
            Marketplace revenue, settlements, and platform balances.
          </p>
        </div>

        {/* ═══ Summary Cards ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <SummaryCard label="Marketplace Revenue" amount={marketplaceRevenue} sublabel="Search Star's 10% cut" accent="#991b1b" />
          <SummaryCard label="Gross Volume" amount={totalGross} sublabel="Total platform spend" accent="#1a3a6b" />
          <SummaryCard label="Pending Settlements" amount={pendingSettlements} sublabel="Owed to profile owners" accent="#92400e" />
          <SummaryCard label="Total Settled" amount={totalSettled} sublabel="Already paid out" accent="#166534" />
        </div>

        {/* ═══ Revenue by Tier ═══ */}
        <div className="card-grace p-6 mb-6">
          <h2 className="font-heading text-xl font-bold mb-5">Revenue by Tier</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#d4d4d4]">
                  <th className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] text-left py-3">Tier</th>
                  <th className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] text-right py-3">Transactions</th>
                  <th className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] text-right py-3">Gross Revenue</th>
                  <th className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] text-right py-3">Marketplace Fee</th>
                  <th className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] text-right py-3">Owner Earnings</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(tierBreakdown)
                  .sort((a, b) => b[1].gross - a[1].gross)
                  .map(([tier, data]) => {
                    const t = tierBadge(tier)
                    return (
                      <tr key={tier} className="border-b border-[#f0f0f0] last:border-0">
                        <td className="py-3">
                          <span className={`font-body text-[10px] font-bold tracking-[0.1em] uppercase px-2 py-0.5 rounded-[2px] ${t.bg} ${t.text}`}>
                            {t.label}
                          </span>
                        </td>
                        <td className="font-mono text-sm text-right py-3">{data.count}</td>
                        <td className="font-mono text-sm text-right py-3">{formatCurrency(data.gross)}</td>
                        <td className="font-mono text-sm text-right py-3 text-[#991b1b]">{formatCurrency(data.fee)}</td>
                        <td className="font-mono text-sm text-right py-3 text-[#166534]">{formatCurrency(data.net)}</td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ═══ Revenue by Week ═══ */}
        <div className="card-grace p-6 mb-6">
          <h2 className="font-heading text-xl font-bold mb-5">Revenue by Week</h2>
          {weeklyEntries.length > 0 ? (
            <div className="space-y-3">
              {weeklyEntries.map(([week, data]) => {
                const maxGross = Math.max(...weeklyEntries.map(w => w[1].gross))
                const barWidth = maxGross > 0 ? (data.gross / maxGross) * 100 : 0
                return (
                  <div key={week}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-body text-sm text-[#1a1a1a]">Week of {formatDate(week)}</span>
                      <div className="flex items-center gap-4">
                        <span className="font-body text-xs text-[#767676]">{data.count} txns</span>
                        <span className="font-mono text-sm font-medium text-[#991b1b]">{formatCurrency(data.fee)}</span>
                        <span className="font-mono text-sm font-medium text-[#1a1a1a]">{formatCurrency(data.gross)}</span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-[#f0f0f0] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#1a3a6b] transition-all"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="font-body text-sm text-[#b8b8b8]">No revenue data yet.</p>
          )}
        </div>

        {/* ═══ Platform Balances ═══ */}
        <div className="card-grace p-6 mb-6">
          <h2 className="font-heading text-xl font-bold mb-5">Platform Accounts</h2>
          {(platforms && platforms.length > 0) ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#d4d4d4]">
                    <th className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] text-left py-3">Platform</th>
                    <th className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] text-right py-3">Credit Balance</th>
                    <th className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] text-center py-3">Auto-Refill</th>
                    <th className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] text-center py-3">Status</th>
                    <th className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] text-right py-3">Since</th>
                  </tr>
                </thead>
                <tbody>
                  {platforms.map((p) => (
                    <tr key={p.id} className="border-b border-[#f0f0f0] last:border-0">
                      <td className="font-body text-sm font-medium py-3">{p.name}</td>
                      <td className="font-mono text-sm text-right py-3">{formatCurrency(Number(p.credit_balance))}</td>
                      <td className="text-center py-3">
                        {p.auto_refill ? (
                          <span className="font-body text-[10px] font-bold tracking-[0.1em] uppercase px-2 py-0.5 rounded-[2px] bg-[#f0fdf4] text-[#166534]">
                            On
                          </span>
                        ) : (
                          <span className="font-body text-[10px] font-bold tracking-[0.1em] uppercase px-2 py-0.5 rounded-[2px] bg-[#f5f5f5] text-[#767676]">
                            Off
                          </span>
                        )}
                      </td>
                      <td className="text-center py-3">
                        <span className={`font-body text-[10px] font-bold tracking-[0.1em] uppercase px-2 py-0.5 rounded-[2px] ${
                          p.status === 'active' ? 'bg-[#f0fdf4] text-[#166534]' : 'bg-[#fef2f2] text-[#991b1b]'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="font-body text-xs text-[#767676] text-right py-3">{formatDate(p.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="font-body text-sm text-[#b8b8b8]">No platform accounts registered.</p>
          )}
        </div>

        {/* ═══ Recent Transactions ═══ */}
        <div className="card-grace p-6 mb-6">
          <h2 className="font-heading text-xl font-bold mb-5">Recent Transactions</h2>
          {recent20.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#d4d4d4]">
                    <th className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] text-left py-3">Profile</th>
                    <th className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] text-left py-3">Platform</th>
                    <th className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] text-center py-3">Tier</th>
                    <th className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] text-right py-3">Gross</th>
                    <th className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] text-right py-3">Fee</th>
                    <th className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] text-right py-3">Net</th>
                    <th className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] text-center py-3">Settled</th>
                    <th className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] text-right py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recent20.map((e) => {
                    const t = tierBadge(e.tier)
                    const prof = nameMap[e.profile_id]
                    return (
                      <tr key={e.id} className="border-b border-[#f0f0f0] last:border-0">
                        <td className="font-body text-sm py-3">
                          <div className="font-medium">{prof?.display_name || 'Unknown'}</div>
                          <div className="text-[11px] text-[#767676]">{prof?.profile_number || '—'}</div>
                        </td>
                        <td className="font-body text-sm py-3">{e.platform_id || '—'}</td>
                        <td className="text-center py-3">
                          <span className={`font-body text-[10px] font-bold tracking-[0.1em] uppercase px-2 py-0.5 rounded-[2px] ${t.bg} ${t.text}`}>
                            {t.label}
                          </span>
                        </td>
                        <td className="font-mono text-sm text-right py-3">{formatCurrency(Number(e.gross_amount))}</td>
                        <td className="font-mono text-sm text-right py-3 text-[#991b1b]">{formatCurrency(Number(e.marketplace_fee))}</td>
                        <td className="font-mono text-sm text-right py-3 text-[#166534]">{formatCurrency(Number(e.net_earnings))}</td>
                        <td className="text-center py-3">
                          {e.settled ? (
                            <span className="font-body text-[10px] font-bold tracking-[0.1em] uppercase px-2 py-0.5 rounded-[2px] bg-[#f0fdf4] text-[#166534]">Yes</span>
                          ) : (
                            <span className="font-body text-[10px] font-bold tracking-[0.1em] uppercase px-2 py-0.5 rounded-[2px] bg-[#fffbeb] text-[#92400e]">No</span>
                          )}
                        </td>
                        <td className="font-body text-xs text-[#767676] text-right py-3 whitespace-nowrap">{formatDateTime(e.created_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="font-body text-sm text-[#b8b8b8]">No transactions yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───

function SummaryCard({ label, amount, sublabel, accent }: { label: string; amount: number; sublabel: string; accent: string }) {
  return (
    <div className="card-grace p-5" style={{ borderTop: `3px solid ${accent}` }}>
      <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-2">{label}</div>
      <div className="font-mono text-2xl font-medium" style={{ color: accent }}>{formatCurrency(amount)}</div>
      <div className="font-body text-xs text-[#b8b8b8] mt-1">{sublabel}</div>
    </div>
  )
}
