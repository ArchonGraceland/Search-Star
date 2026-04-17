import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// Valid time range filters. `all` is the fallback and returns everything.
type RangeKey = '7d' | '30d' | '90d' | 'all'

const RANGE_DAYS: Record<Exclude<RangeKey, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

function parseRange(raw: string | string[] | undefined): RangeKey {
  const v = Array.isArray(raw) ? raw[0] : raw
  if (v === '7d' || v === '30d' || v === '90d' || v === 'all') return v
  return '30d'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatUsd(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

// Redact an email for the admin list. We surface admin-useful info without
// splattering raw addresses across the page. "first3***@domain.tld".
function redactEmail(email: string | null | undefined): string {
  if (!email) return '—'
  const [local, domain] = email.split('@')
  if (!local || !domain) return '—'
  const head = local.slice(0, 3)
  return `${head}${'*'.repeat(Math.max(0, local.length - 3))}@${domain}`
}

type DonationRow = {
  id: string
  commitment_id: string
  sponsor_id: string | null
  pledge_amount: number | null
  donation_amount: number | null
  donation_rate: number | null
  stripe_payment_intent_id: string | null
  status: string
  created_at: string
}

type SponsorshipRow = {
  id: string
  sponsor_name: string | null
  sponsor_email: string | null
  commitment_id: string
}

type CommitmentRow = {
  id: string
  title: string | null
}

export default async function AdminDonationsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Admin layout already gates access via profiles.role === 'admin', but
  // defense in depth: re-check here so this route is safe if the layout
  // is ever bypassed.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const params = await searchParams
  const range = parseRange(params?.range)

  // Build the time window. 'all' means no lower bound.
  const now = new Date()
  const windowStart =
    range === 'all'
      ? null
      : new Date(now.getTime() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000)

  // Fetch donations in range. Status='succeeded' is the "real revenue" set;
  // pending/failed/canceled are displayed in the table with a status badge
  // so admins can reconcile with Stripe if needed.
  let donationsQuery = supabase
    .from('donations')
    .select(
      'id, commitment_id, sponsor_id, pledge_amount, donation_amount, donation_rate, stripe_payment_intent_id, status, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(200)
  if (windowStart) {
    donationsQuery = donationsQuery.gte('created_at', windowStart.toISOString())
  }
  const { data: donationsRaw } = await donationsQuery
  const donations = (donationsRaw as DonationRow[] | null) ?? []

  // This-month revenue is a separate query — independent of the range filter —
  // because the "this month" card is a fixed metric admins expect to see
  // regardless of what time window the table is showing.
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const { data: monthRaw } = await supabase
    .from('donations')
    .select('donation_amount')
    .eq('status', 'succeeded')
    .gte('created_at', monthStart.toISOString())
  const thisMonthRevenue = (monthRaw ?? []).reduce(
    (sum, d) => sum + Number((d as { donation_amount: number | null }).donation_amount ?? 0),
    0
  )

  // Hydrate the sponsorship + commitment labels for each donation row.
  const sponsorshipIds = Array.from(
    new Set(donations.map((d) => d.sponsor_id).filter((x): x is string => Boolean(x)))
  )
  const commitmentIds = Array.from(new Set(donations.map((d) => d.commitment_id)))

  const [sponsorshipsRes, commitmentsRes] = await Promise.all([
    sponsorshipIds.length > 0
      ? supabase
          .from('sponsorships')
          .select('id, sponsor_name, sponsor_email, commitment_id')
          .in('id', sponsorshipIds)
      : Promise.resolve({ data: [] as SponsorshipRow[] }),
    commitmentIds.length > 0
      ? supabase.from('commitments').select('id, title').in('id', commitmentIds)
      : Promise.resolve({ data: [] as CommitmentRow[] }),
  ])
  const sponsorshipsById = new Map<string, SponsorshipRow>()
  for (const row of (sponsorshipsRes.data as SponsorshipRow[] | null) ?? []) {
    sponsorshipsById.set(row.id, row)
  }
  const commitmentsById = new Map<string, CommitmentRow>()
  for (const row of (commitmentsRes.data as CommitmentRow[] | null) ?? []) {
    commitmentsById.set(row.id, row)
  }

  // Compute summary cards over the filtered donation set. We use succeeded-only
  // rows for revenue and average-rate metrics; pending/failed rows would
  // inflate the totals misleadingly.
  const succeeded = donations.filter((d) => d.status === 'succeeded')
  const totalRevenue = succeeded.reduce(
    (sum, d) => sum + Number(d.donation_amount ?? 0),
    0
  )
  const avgRate =
    succeeded.length > 0
      ? succeeded.reduce((sum, d) => sum + Number(d.donation_rate ?? 0), 0) /
        succeeded.length
      : 0

  // "Percent of releases with a donation" — asks: of all pledges that were
  // released in this window, how many had any donation row attached (any
  // status)? Pulls the count of released sponsorships in the same window.
  let releasesQuery = supabase
    .from('sponsorships')
    .select('id', { count: 'exact', head: true })
    .in('status', ['released', 'paid'])
  if (windowStart) {
    releasesQuery = releasesQuery.gte('released_at', windowStart.toISOString())
  }
  const { count: releaseCount } = await releasesQuery
  const donationCoverage =
    releaseCount && releaseCount > 0 ? donations.length / releaseCount : 0

  // Build the Stripe dashboard URL for a PI. Works for both live and test mode;
  // Stripe redirects appropriately based on the authenticated session.
  function stripeDashboardUrl(piId: string | null | undefined): string | null {
    if (!piId) return null
    return `https://dashboard.stripe.com/payments/${piId}`
  }

  const rangeLabels: Record<RangeKey, string> = {
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
    '90d': 'Last 90 days',
    all: 'All time',
  }

  return (
    <div className="p-8">
      <div className="max-w-[1100px]">
        <div className="mb-8">
          <p className="font-body text-[11px] font-bold tracking-[0.2em] uppercase text-[#767676] mb-2">
            Admin
          </p>
          <h1 className="font-heading text-[32px] font-bold mb-1">Voluntary Donations</h1>
          <p className="font-body text-sm text-[#767676]">
            Search Star revenue from the 5% sponsor tip at pledge release.
          </p>
        </div>

        {/* Range filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(Object.keys(rangeLabels) as RangeKey[]).map((k) => {
            const active = k === range
            return (
              <Link
                key={k}
                href={`/admin/donations?range=${k}`}
                className="no-underline"
                style={{
                  fontFamily: 'Roboto, sans-serif',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '8px 14px',
                  borderRadius: '3px',
                  background: active ? '#1a3a6b' : '#ffffff',
                  color: active ? '#ffffff' : '#1a3a6b',
                  border: '1px solid #1a3a6b',
                }}
              >
                {rangeLabels[k]}
              </Link>
            )
          })}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="card-grace p-5">
            <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">
              Total revenue — {rangeLabels[range].toLowerCase()}
            </div>
            <div className="font-mono text-2xl font-medium text-[#1a1a1a]">
              {formatUsd(totalRevenue)}
            </div>
            <div className="font-body text-xs text-[#b8b8b8] mt-1">
              {succeeded.length} succeeded
            </div>
          </div>
          <div className="card-grace p-5">
            <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">
              This month
            </div>
            <div className="font-mono text-2xl font-medium text-[#1a1a1a]">
              {formatUsd(thisMonthRevenue)}
            </div>
            <div className="font-body text-xs text-[#b8b8b8] mt-1">Succeeded only</div>
          </div>
          <div className="card-grace p-5">
            <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">
              Avg donation rate
            </div>
            <div className="font-mono text-2xl font-medium text-[#1a1a1a]">
              {succeeded.length > 0 ? formatPct(avgRate) : '—'}
            </div>
            <div className="font-body text-xs text-[#b8b8b8] mt-1">Of pledge amount</div>
          </div>
          <div className="card-grace p-5">
            <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">
              Releases with donation
            </div>
            <div className="font-mono text-2xl font-medium text-[#1a1a1a]">
              {releaseCount && releaseCount > 0 ? formatPct(donationCoverage) : '—'}
            </div>
            <div className="font-body text-xs text-[#b8b8b8] mt-1">
              {donations.length}/{releaseCount ?? 0} releases
            </div>
          </div>
        </div>

        {/* Donations table */}
        <div className="card-grace p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-xl font-bold">Donation records</h2>
            <span className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676]">
              Showing {donations.length}
            </span>
          </div>

          {donations.length === 0 ? (
            <p className="font-body text-sm text-[#b8b8b8]">
              No donations in this window.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Date', 'Sponsor', 'Commitment', 'Pledge', 'Donation', 'Rate', 'Status', 'Stripe'].map((h) => (
                      <th
                        key={h}
                        style={{
                          fontFamily: 'Roboto, sans-serif',
                          fontSize: '10px',
                          fontWeight: 700,
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          color: '#767676',
                          textAlign: 'left',
                          padding: '10px 8px',
                          borderBottom: '2px solid #e8e8e8',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {donations.map((d) => {
                    const sp = d.sponsor_id ? sponsorshipsById.get(d.sponsor_id) : null
                    const cm = commitmentsById.get(d.commitment_id)
                    const statusColor = (() => {
                      switch (d.status) {
                        case 'succeeded':
                          return { bg: '#f0fdf4', fg: '#166534' }
                        case 'pending':
                          return { bg: '#fffbeb', fg: '#92400e' }
                        case 'failed':
                          return { bg: '#fef2f2', fg: '#991b1b' }
                        case 'canceled':
                          return { bg: '#f5f5f5', fg: '#767676' }
                        default:
                          return { bg: '#f5f5f5', fg: '#767676' }
                      }
                    })()
                    const piUrl = stripeDashboardUrl(d.stripe_payment_intent_id)
                    return (
                      <tr key={d.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '10px 8px', fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#3a3a3a' }}>
                          {formatDate(d.created_at)}
                        </td>
                        <td style={{ padding: '10px 8px', fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#3a3a3a' }}>
                          <div style={{ fontWeight: 600 }}>{sp?.sponsor_name ?? '—'}</div>
                          <div style={{ color: '#b8b8b8', fontSize: '11px' }}>
                            {redactEmail(sp?.sponsor_email)}
                          </div>
                        </td>
                        <td style={{ padding: '10px 8px', fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#3a3a3a', maxWidth: '240px' }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {cm?.title ?? d.commitment_id.slice(0, 8)}
                          </div>
                        </td>
                        <td style={{ padding: '10px 8px', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: '#3a3a3a' }}>
                          {d.pledge_amount != null ? formatUsd(Number(d.pledge_amount)) : '—'}
                        </td>
                        <td style={{ padding: '10px 8px', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: '#1a1a1a', fontWeight: 600 }}>
                          {d.donation_amount != null ? formatUsd(Number(d.donation_amount)) : '—'}
                        </td>
                        <td style={{ padding: '10px 8px', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: '#5a5a5a' }}>
                          {d.donation_rate != null ? formatPct(Number(d.donation_rate)) : '—'}
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          <span
                            style={{
                              fontFamily: 'Roboto, sans-serif',
                              fontSize: '10px',
                              fontWeight: 700,
                              letterSpacing: '0.08em',
                              textTransform: 'uppercase',
                              padding: '3px 8px',
                              borderRadius: '2px',
                              background: statusColor.bg,
                              color: statusColor.fg,
                            }}
                          >
                            {d.status}
                          </span>
                        </td>
                        <td style={{ padding: '10px 8px', fontFamily: 'Roboto, sans-serif', fontSize: '11px' }}>
                          {piUrl ? (
                            <a
                              href={piUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#1a3a6b', textDecoration: 'underline' }}
                            >
                              View
                            </a>
                          ) : (
                            <span style={{ color: '#b8b8b8' }}>—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="font-body text-xs text-[#b8b8b8] mt-6">
          Table shows up to 200 most recent rows in the selected window. For older
          records, query the donations table directly in Supabase.
        </p>
      </div>
    </div>
  )
}
