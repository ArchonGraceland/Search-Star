import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

// ─── Types ───
interface EarningsRow {
  tier: string
  gross_amount: number
  marketplace_fee: number
  net_earnings: number
  settled: boolean
  settled_at: string | null
  settlement_batch: string | null
  platform_id: string | null
  created_at: string
}

interface Profile {
  id: string
  profile_number: string | null
  handle: string | null
  display_name: string
  tagline: string | null
  presence_score: number | null
  trust_score: number | null
  price_public: number | null
  price_private: number | null
  price_marketing: number | null
  has_financial: boolean
  has_dating: boolean
  has_family: boolean
  has_advertising: boolean
  has_content_feed: boolean
  feed_item_count: number | null
  created_at: string
  age: number | null
  location: string | null
}

interface FeedSub {
  id: string
}

interface Message {
  id: string
  read: boolean
}

// ─── Helpers ───
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function getNextMonday(): string {
  const now = new Date()
  const day = now.getDay()
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day
  const nextMon = new Date(now)
  nextMon.setDate(now.getDate() + daysUntilMonday)
  return nextMon.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function calcCompleteness(profile: Profile): number {
  const fields = [
    !!profile.tagline,
    !!profile.handle,
    !!profile.location,
    !!profile.age,
    profile.has_financial,
    profile.has_dating,
    profile.has_advertising,
    profile.has_content_feed,
    (profile.presence_score ?? 0) > 0,
    (profile.price_public ?? 0) !== 0.02 || (profile.price_private ?? 0) !== 0.50 || (profile.price_marketing ?? 0) !== 5.00,
  ]
  const filled = fields.filter(Boolean).length
  return Math.round((filled / fields.length) * 100)
}

function tierLabel(tier: string): { label: string; bg: string; text: string } {
  switch (tier) {
    case 'public': return { label: 'Public', bg: 'bg-[#eef2f8]', text: 'text-[#1a3a6b]' }
    case 'private': return { label: 'Private', bg: 'bg-[#f0fdf4]', text: 'text-[#166534]' }
    case 'marketing': return { label: 'Marketing', bg: 'bg-[#fffbeb]', text: 'text-[#92400e]' }
    default: return { label: tier, bg: 'bg-[#f5f5f5]', text: 'text-[#1a1a1a]' }
  }
}

// ─── Page Component ───
export default async function Account() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    return (
      <div className="p-8">
        <div className="max-w-[960px]">
          <h1 className="font-heading text-[32px] font-bold mb-1">Account</h1>
          <p className="font-body text-sm text-[#767676] mb-8">Complete your profile to see your dashboard.</p>
          <Link href="/profile-builder" className="btn-primary no-underline">Build Profile</Link>
        </div>
      </div>
    )
  }

  // Fetch earnings
  const { data: earnings } = await supabase
    .from('earnings_ledger')
    .select('*')
    .eq('profile_id', profile.id)
    .order('created_at', { ascending: false }) as { data: EarningsRow[] | null }

  const allEarnings = earnings || []

  // Earnings calculations
  const totalLifetime = allEarnings.reduce((sum, e) => sum + Number(e.net_earnings), 0)
  const unsettled = allEarnings.filter(e => !e.settled)
  const unsettledTotal = unsettled.reduce((sum, e) => sum + Number(e.net_earnings), 0)

  // Last settlement
  const settledEntries = allEarnings.filter(e => e.settled && e.settlement_batch)
  const lastBatch = settledEntries.length > 0 ? settledEntries[0].settlement_batch : null
  const lastSettlementAmount = lastBatch
    ? settledEntries.filter(e => e.settlement_batch === lastBatch).reduce((sum, e) => sum + Number(e.net_earnings), 0)
    : 0

  // Revenue by tier
  const tierBreakdown = allEarnings.reduce((acc, e) => {
    if (!acc[e.tier]) acc[e.tier] = { count: 0, total: 0 }
    acc[e.tier].count += 1
    acc[e.tier].total += Number(e.net_earnings)
    return acc
  }, {} as Record<string, { count: number; total: number }>)

  // Revenue by platform
  const platformBreakdown = allEarnings.reduce((acc, e) => {
    const plat = e.platform_id || 'Unknown'
    if (!acc[plat]) acc[plat] = { count: 0, total: 0 }
    acc[plat].count += 1
    acc[plat].total += Number(e.net_earnings)
    return acc
  }, {} as Record<string, { count: number; total: number }>)
  const topPlatforms = Object.entries(platformBreakdown)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5)

  // Feed stats
  let subscriberCount = 0
  if (profile.has_content_feed) {
    const { data: subs } = await supabase
      .from('feed_subscriptions')
      .select('id')
      .eq('publisher_id', profile.id)
      .eq('status', 'active') as { data: FeedSub[] | null }
    subscriberCount = subs?.length || 0
  }

  // Unread messages
  const { data: unreadMsgs } = await supabase
    .from('messages')
    .select('id, read')
    .eq('recipient_id', profile.id)
    .eq('read', false)
    .eq('blocked', false) as { data: Message[] | null }
  const unreadCount = unreadMsgs?.length || 0

  const completeness = calcCompleteness(profile as unknown as Profile)
  const memberSince = new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="p-8">
      <div className="max-w-[960px]">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-[32px] font-bold mb-1">Account</h1>
          <p className="font-body text-sm text-[#767676]">
            Your earnings, profile stats, and settings.
          </p>
        </div>

        {/* ═══ Earnings Overview Cards ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <EarningsCard label="Lifetime Earnings" amount={totalLifetime} />
          <EarningsCard label="Unsettled Balance" amount={unsettledTotal} sublabel="Current period" />
          <EarningsCard
            label="Last Settlement"
            amount={lastSettlementAmount}
            sublabel={lastBatch ? `Batch ${lastBatch}` : 'No settlements yet'}
          />
        </div>

        {/* Settlement Notice */}
        <div className="bg-[#eef2f8] border-l-[3px] border-[#1a3a6b] rounded-[3px] px-5 py-3.5 mb-4">
          <p className="font-body text-sm text-[#1a3a6b] m-0">
            <span className="font-bold">Next settlement:</span> {getNextMonday()} at 00:00 UTC
            {unsettledTotal < 1.00 && unsettledTotal > 0 && (
              <span className="text-[#767676]"> · Below $1.00 minimum — rolls over to next week</span>
            )}
          </p>
        </div>

        {/* ═══ Revenue Breakdown ═══ */}
        {allEarnings.length > 0 && (
          <div className="card-grace p-6 mb-4">
            <h2 className="font-heading text-xl font-bold mb-5">Revenue Breakdown</h2>

            {/* By Tier */}
            <div className="mb-6">
              <h3 className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-3">By Tier</h3>
              <div className="space-y-2">
                {Object.entries(tierBreakdown)
                  .sort((a, b) => b[1].total - a[1].total)
                  .map(([tier, data]) => {
                    const t = tierLabel(tier)
                    return (
                      <div key={tier} className="flex items-center justify-between py-2 border-b border-[#f0f0f0] last:border-0">
                        <div className="flex items-center gap-3">
                          <span className={`font-body text-[10px] font-bold tracking-[0.1em] uppercase px-2 py-0.5 rounded-[2px] ${t.bg} ${t.text}`}>
                            {t.label}
                          </span>
                          <span className="font-body text-sm text-[#767676]">
                            {data.count} {data.count === 1 ? 'transaction' : 'transactions'}
                          </span>
                        </div>
                        <span className="font-mono text-sm font-medium text-[#166534]">
                          {formatCurrency(data.total)}
                        </span>
                      </div>
                    )
                  })}
              </div>
            </div>

            {/* By Platform */}
            {topPlatforms.length > 0 && (
              <div>
                <h3 className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-3">By Platform</h3>
                <div className="space-y-2">
                  {topPlatforms.map(([platform, data]) => (
                    <div key={platform} className="flex items-center justify-between py-2 border-b border-[#f0f0f0] last:border-0">
                      <div className="flex items-center gap-3">
                        <span className="font-body text-sm text-[#1a1a1a] font-medium">{platform}</span>
                        <span className="font-body text-xs text-[#767676]">
                          {data.count} {data.count === 1 ? 'query' : 'queries'}
                        </span>
                      </div>
                      <span className="font-mono text-sm font-medium text-[#166534]">
                        {formatCurrency(data.total)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty earnings state */}
        {allEarnings.length === 0 && (
          <div className="card-grace p-8 mb-4 text-center">
            <p className="font-body text-sm text-[#b8b8b8] m-0">
              No earnings yet. Once platforms query your profile or send marketing messages, your revenue will appear here.
            </p>
          </div>
        )}

        {/* ═══ Profile Stats ═══ */}
        <div className="card-grace p-6 mb-4">
          <h2 className="font-heading text-xl font-bold mb-5">Profile</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
            <StatRow label="Profile Number" value={profile.profile_number || 'Pending'} />
            <StatRow label="Handle" value={profile.handle ? `@${profile.handle}` : '—'} />
            <StatRow label="Display Name" value={profile.display_name} />
            <StatRow label="Presence Score" value={`${profile.presence_score ?? 0} / 100`} />
            <StatRow label="Trust Score" value={`${profile.trust_score ?? 0} / 100`} />
            <StatRow label="Member Since" value={memberSince} />
          </div>

          {/* Completeness bar */}
          <div className="mt-5 pt-5 border-t border-[#f0f0f0]">
            <div className="flex items-center justify-between mb-2">
              <span className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676]">
                Profile Completeness
              </span>
              <span className="font-mono text-sm font-medium text-[#1a1a1a]">{completeness}%</span>
            </div>
            <div className="w-full h-2 bg-[#f0f0f0] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${completeness}%`,
                  background: completeness >= 80 ? '#166534' : completeness >= 50 ? '#1a3a6b' : '#92400e',
                }}
              />
            </div>
          </div>
        </div>

        {/* ═══ Pricing ═══ */}
        <div className="card-grace p-6 mb-4">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-heading text-xl font-bold m-0">Pricing</h2>
            <Link
              href="/profile-builder"
              className="font-body text-xs font-bold tracking-[0.1em] uppercase text-[#1a3a6b] no-underline hover:underline"
            >
              Edit Pricing →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <PricingCard tier="Public" price={Number(profile.price_public ?? 0.02)} unit="/query" />
            <PricingCard tier="Private" price={Number(profile.price_private ?? 0.50)} unit="/query" />
            <PricingCard tier="Marketing" price={Number(profile.price_marketing ?? 5.00)} unit="/message" />
          </div>
        </div>

        {/* ═══ Feed Stats (conditional) ═══ */}
        {profile.has_content_feed && (
          <div className="card-grace p-6 mb-4">
            <h2 className="font-heading text-xl font-bold mb-5">Content Feed</h2>
            <div className="grid grid-cols-2 gap-6">
              <StatRow label="Subscribers" value={subscriberCount.toString()} />
              <StatRow label="Published Items" value={(profile.feed_item_count ?? 0).toString()} />
            </div>
          </div>
        )}

        {/* ═══ Quick Actions ═══ */}
        <div className="card-grace p-6 mb-4">
          <h2 className="font-heading text-xl font-bold mb-5">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <QuickAction href="/profile-builder" label="Edit Profile" />
            <QuickAction href="/feed" label={`View Feed${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`} />
            <QuickAction href="/spec.html" label="View Spec" external />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───

function EarningsCard({ label, amount, sublabel }: { label: string; amount: number; sublabel?: string }) {
  return (
    <div className="card-grace p-5">
      <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-2">{label}</div>
      <div className="font-mono text-2xl font-medium text-[#166534]">{formatCurrency(amount)}</div>
      {sublabel && <div className="font-body text-xs text-[#b8b8b8] mt-1">{sublabel}</div>}
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">{label}</div>
      <div className="font-body text-sm text-[#1a1a1a]">{value}</div>
    </div>
  )
}

function PricingCard({ tier, price, unit }: { tier: string; price: number; unit: string }) {
  const colors: Record<string, { bg: string; border: string; text: string }> = {
    Public: { bg: 'bg-[#eef2f8]', border: 'border-[#1a3a6b]', text: 'text-[#1a3a6b]' },
    Private: { bg: 'bg-[#f0fdf4]', border: 'border-[#166534]', text: 'text-[#166534]' },
    Marketing: { bg: 'bg-[#fffbeb]', border: 'border-[#92400e]', text: 'text-[#92400e]' },
  }
  const c = colors[tier] || colors.Public

  return (
    <div className={`${c.bg} border-t-[3px] ${c.border} rounded-[3px] p-4 text-center`}>
      <div className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-2">{tier}</div>
      <div className={`font-mono text-lg font-medium ${c.text}`}>
        {formatCurrency(price)}
      </div>
      <div className="font-body text-[11px] text-[#b8b8b8]">{unit}</div>
    </div>
  )
}

function QuickAction({ href, label, external }: { href: string; label: string; external?: boolean }) {
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-secondary no-underline text-center"
        style={{ padding: '10px 24px', fontSize: '11px' }}
      >
        {label}
      </a>
    )
  }
  return (
    <Link
      href={href}
      className="btn-secondary no-underline text-center"
      style={{ padding: '10px 24px', fontSize: '11px' }}
    >
      {label}
    </Link>
  )
}
