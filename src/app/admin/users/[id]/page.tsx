import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AdminUserActions } from '@/components/admin-user-actions'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default async function AdminUserDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch profile
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !profile) {
    return (
      <div className="p-8">
        <div className="max-w-[960px]">
          <Link href="/admin/users" className="font-body text-sm text-[#1a3a6b] no-underline hover:underline mb-4 block">← Back to Users</Link>
          <h1 className="font-heading text-[32px] font-bold mb-1">User Not Found</h1>
          <p className="font-body text-sm text-[#767676]">This profile does not exist.</p>
        </div>
      </div>
    )
  }

  // Fetch earnings summary
  const { data: earnings } = await supabase
    .from('earnings_ledger')
    .select('tier, gross_amount, marketplace_fee, net_earnings, settled')
    .eq('profile_id', id)

  const allEarnings = earnings || []
  const totalEarnings = allEarnings.reduce((s, e) => s + Number(e.net_earnings), 0)
  const unsettled = allEarnings.filter(e => !e.settled).reduce((s, e) => s + Number(e.net_earnings), 0)
  const txCount = allEarnings.length

  // Tier breakdown
  const tierBreakdown = allEarnings.reduce((acc, e) => {
    if (!acc[e.tier]) acc[e.tier] = { count: 0, total: 0 }
    acc[e.tier].count += 1
    acc[e.tier].total += Number(e.net_earnings)
    return acc
  }, {} as Record<string, { count: number; total: number }>)

  // Message count
  const { count: messageCount } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', id)

  const memberSince = formatDate(profile.created_at)

  return (
    <div className="p-8">
      <div className="max-w-[960px]">
        {/* Back link */}
        <Link href="/admin/users" className="font-body text-sm text-[#1a3a6b] no-underline hover:underline mb-4 block">
          ← Back to Users
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-heading text-[32px] font-bold mb-1">{profile.display_name}</h1>
            <p className="font-body text-sm text-[#767676]">
              {profile.profile_number || 'No profile number'} · {profile.handle ? `@${profile.handle}` : 'No handle'} · Member since {memberSince}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`font-body text-[10px] font-bold tracking-[0.1em] uppercase px-3 py-1 rounded-[2px] ${
              profile.status === 'active' ? 'bg-[#f0fdf4] text-[#166534]' :
              profile.status === 'suspended' ? 'bg-[#fef2f2] text-[#991b1b]' :
              'bg-[#f5f5f5] text-[#767676]'
            }`}>
              {profile.status || 'active'}
            </span>
            {profile.role === 'admin' && (
              <span className="font-body text-[10px] font-bold tracking-[0.1em] uppercase px-3 py-1 rounded-[2px] bg-[#fef2f2] text-[#991b1b]">
                Admin
              </span>
            )}
          </div>
        </div>

        {/* ═══ Profile Details ═══ */}
        <div className="card-grace p-6 mb-6">
          <h2 className="font-heading text-xl font-bold mb-5">Profile Details</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
            <StatRow label="Profile Number" value={profile.profile_number || '—'} />
            <StatRow label="Handle" value={profile.handle ? `@${profile.handle}` : '—'} />
            <StatRow label="Display Name" value={profile.display_name} />
            <StatRow label="Location" value={profile.location || '—'} />
            <StatRow label="Age" value={profile.age?.toString() || '—'} />
            <StatRow label="Age Cohort" value={profile.age_cohort || '—'} />
            <StatRow label="Presence Score" value={`${profile.presence_score ?? 0} / 100`} />
            <StatRow label="Trust Score" value={`${profile.trust_score ?? 0} / 100`} />
            <StatRow label="Skills Count" value={`${profile.skills_count ?? 0}`} />
            <StatRow label="Endpoint URL" value={profile.endpoint_url || 'Not configured'} />
            <StatRow label="Domain" value={profile.domain || '—'} />
            <StatRow label="Domain Verified" value={profile.domain_verified ? 'Yes' : 'No'} />
          </div>

          {/* Data extensions */}
          <div className="mt-5 pt-5 border-t border-[#f0f0f0]">
            <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-3">Data Extensions</div>
            <div className="flex flex-wrap gap-2">
              {profile.has_financial && <ExtBadge label="Financial" />}
              {profile.has_dating && <ExtBadge label="Dating" />}
              {profile.has_family && <ExtBadge label="Family" />}
              {profile.has_advertising && <ExtBadge label="Advertising" />}
              {profile.has_content_feed && <ExtBadge label="Content Feed" />}
              {profile.has_adult_extension && <ExtBadge label="Adult" />}
              {!profile.has_financial && !profile.has_dating && !profile.has_family && !profile.has_advertising && !profile.has_content_feed && (
                <span className="font-body text-sm text-[#b8b8b8]">None enabled</span>
              )}
            </div>
          </div>

          {/* Pricing */}
          <div className="mt-5 pt-5 border-t border-[#f0f0f0]">
            <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-3">Pricing</div>
            <div className="grid grid-cols-3 gap-4">
              <PricingCard tier="Public" price={Number(profile.price_public ?? 0.02)} unit="/query" />
              <PricingCard tier="Private" price={Number(profile.price_private ?? 0.50)} unit="/query" />
              <PricingCard tier="Marketing" price={Number(profile.price_marketing ?? 5.00)} unit="/message" />
            </div>
          </div>
        </div>

        {/* ═══ Earnings Summary ═══ */}
        <div className="card-grace p-6 mb-6">
          <h2 className="font-heading text-xl font-bold mb-5">Earnings Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <div>
              <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">Lifetime Earnings</div>
              <div className="font-mono text-lg font-medium text-[#166534]">{formatCurrency(totalEarnings)}</div>
            </div>
            <div>
              <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">Unsettled</div>
              <div className="font-mono text-lg font-medium text-[#92400e]">{formatCurrency(unsettled)}</div>
            </div>
            <div>
              <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">Transactions</div>
              <div className="font-mono text-lg font-medium">{txCount}</div>
            </div>
            <div>
              <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">Messages Received</div>
              <div className="font-mono text-lg font-medium">{messageCount ?? 0}</div>
            </div>
          </div>

          {Object.keys(tierBreakdown).length > 0 && (
            <div className="space-y-2">
              {Object.entries(tierBreakdown)
                .sort((a, b) => b[1].total - a[1].total)
                .map(([tier, data]) => (
                  <div key={tier} className="flex items-center justify-between py-2 border-b border-[#f0f0f0] last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="font-body text-sm font-medium capitalize">{tier}</span>
                      <span className="font-body text-xs text-[#767676]">{data.count} txns</span>
                    </div>
                    <span className="font-mono text-sm font-medium text-[#166534]">{formatCurrency(data.total)}</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* ═══ Admin Actions ═══ */}
        <div className="card-grace p-6 mb-6" style={{ borderTop: '3px solid #991b1b' }}>
          <h2 className="font-heading text-xl font-bold mb-5">Admin Actions</h2>
          <AdminUserActions
            profileId={id}
            currentTrustScore={profile.trust_score ?? 0}
            currentStatus={profile.status || 'active'}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">{label}</div>
      <div className="font-body text-sm text-[#1a1a1a] break-all">{value}</div>
    </div>
  )
}

function ExtBadge({ label }: { label: string }) {
  return (
    <span className="font-body text-[10px] font-bold tracking-[0.1em] uppercase px-2 py-0.5 rounded-[2px] bg-[#eef2f8] text-[#1a3a6b]">
      {label}
    </span>
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
    <div className={`${c.bg} border-t-[3px] ${c.border} rounded-[3px] p-3 text-center`}>
      <div className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">{tier}</div>
      <div className={`font-mono text-base font-medium ${c.text}`}>{formatCurrency(price)}</div>
      <div className="font-body text-[10px] text-[#b8b8b8]">{unit}</div>
    </div>
  )
}
