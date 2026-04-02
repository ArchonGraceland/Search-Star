import Link from 'next/link'

export const metadata = {
  title: 'Revenue Projections — Search Star',
  description: 'Five-year revenue model for Search Star, profile owners, and affiliates. Hockey stick growth with quarterly payouts.',
}

/* ── Data ── */

const years = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5']

const assumptions = [
  { label: 'Total profiles (end of year)', values: [5000, 25000, 100000, 500000, 2000000], fmt: 'num' },
  { label: 'Active profiles (% of total)', values: [0.60, 0.65, 0.70, 0.72, 0.75], fmt: 'pct' },
  { label: 'Active profiles (#)', values: [3000, 16250, 70000, 360000, 1500000], fmt: 'num' },
  { label: 'Querying platforms', values: [20, 80, 250, 800, 2500], fmt: 'num' },
]

const queryVolume = [
  { label: 'Avg public queries/profile/month', values: [50, 80, 120, 150, 180], fmt: 'num' },
  { label: 'Avg private queries/profile/month', values: [5, 10, 18, 25, 35], fmt: 'num' },
  { label: 'Avg marketing msgs/profile/month', values: [1, 2, 3, 4, 5], fmt: 'num' },
]

const pricing = [
  { label: 'Avg public tier price', values: [0.02, 0.02, 0.02, 0.02, 0.02], fmt: 'dollar2' },
  { label: 'Avg private tier price', values: [0.50, 0.50, 0.50, 0.50, 0.50], fmt: 'dollar2' },
  { label: 'Avg marketing tier price', values: [5.00, 5.00, 5.00, 5.00, 5.00], fmt: 'dollar2' },
]

const volume = [
  { label: 'Public tier queries', values: [1800000, 15600000, 100800000, 648000000, 3240000000], fmt: 'num' },
  { label: 'Private tier queries', values: [180000, 1950000, 15120000, 108000000, 630000000], fmt: 'num' },
  { label: 'Marketing messages', values: [36000, 390000, 2520000, 17280000, 90000000], fmt: 'num' },
  { label: 'Total queries + messages', values: [2016000, 17940000, 118440000, 773280000, 3960000000], fmt: 'num', bold: true },
]

const revenue = [
  { label: 'Public tier revenue', values: [36000, 312000, 2016000, 12960000, 64800000], fmt: 'dollar' },
  { label: 'Private tier revenue', values: [90000, 975000, 7560000, 54000000, 315000000], fmt: 'dollar' },
  { label: 'Marketing tier revenue', values: [180000, 1950000, 12600000, 86400000, 450000000], fmt: 'dollar' },
  { label: 'Total Gross Revenue', values: [306000, 3237000, 22176000, 153360000, 829800000], fmt: 'dollar', bold: true },
]

const distribution = [
  { label: 'Search Star revenue (10%)', values: [30600, 323700, 2217600, 15336000, 82980000], fmt: 'dollar' },
  { label: 'Profile owner earnings', values: [270810, 2872838, 19736640, 135644400, 735582000], fmt: 'dollar' },
  { label: 'Affiliate earnings', values: [4590, 40463, 221760, 1379600, 6238000], fmt: 'dollar' },
]

const costs = [
  { label: 'Infrastructure', values: [3600, 18000, 60000, 180000, 480000], fmt: 'dollar' },
  { label: 'Stripe processing (~3%)', values: [9180, 97110, 665280, 4600800, 24894000], fmt: 'dollar' },
  { label: 'Stripe payouts (quarterly)', values: [3000, 16250, 70000, 360000, 1500000], fmt: 'dollar' },
  { label: 'AI costs (Claude API)', values: [2400, 12000, 36000, 100000, 250000], fmt: 'dollar' },
  { label: 'Domain, DNS, security', values: [500, 1200, 2400, 5000, 12000], fmt: 'dollar' },
  { label: 'Customer support / ops', values: [0, 24000, 72000, 240000, 600000], fmt: 'dollar' },
  { label: 'Legal / compliance', values: [5000, 15000, 30000, 80000, 200000], fmt: 'dollar' },
  { label: 'Marketing & content', values: [6000, 24000, 60000, 300000, 1000000], fmt: 'dollar' },
  { label: 'Founder salary', values: [0, 60000, 120000, 200000, 300000], fmt: 'dollar' },
  { label: 'Engineering team', values: [0, 48000, 150000, 500000, 1200000], fmt: 'dollar' },
  { label: 'Total Operating Costs', values: [29680, 315560, 1265680, 6565800, 30436000], fmt: 'dollar', bold: true },
]

const netIncome = [
  { label: 'Platform revenue', values: [30600, 323700, 2217600, 15336000, 82980000], fmt: 'dollar' },
  { label: 'Total costs', values: [29680, 315560, 1265680, 6565800, 30436000], fmt: 'dollar' },
  { label: 'Net Income (Loss)', values: [920, 8140, 951920, 8770200, 52544000], fmt: 'dollar', highlight: true },
  { label: 'Net Margin', values: [0.030, 0.025, 0.429, 0.572, 0.633], fmt: 'pct', highlight: true },
]

const cumulative = [
  { label: 'Cumulative net income', values: [920, 9060, 960980, 9731180, 62275180], fmt: 'dollar', bold: true },
  { label: 'Cumulative gross revenue', values: [306000, 3543000, 25719000, 179079000, 1008879000], fmt: 'dollar' },
  { label: 'Cumulative paid to owners', values: [270810, 3143648, 22880288, 158524688, 894106688], fmt: 'dollar' },
]

/* Profile owner */
const ownerScenarios = ['Low Activity', 'Medium Activity', 'High Activity']
const ownerData = [
  { section: 'Monthly Query Volume' },
  { label: 'Public queries/month', values: [20, 80, 200] },
  { label: 'Private queries/month', values: [2, 10, 30] },
  { label: 'Marketing messages/month', values: [0.5, 2, 5] },
  { section: 'Your Pricing' },
  { label: 'Public tier ($/query)', values: [0.02, 0.02, 0.03], fmt: 'dollar2' },
  { label: 'Private tier ($/query)', values: [0.30, 0.50, 0.75], fmt: 'dollar2' },
  { label: 'Marketing tier ($/msg)', values: [3.00, 5.00, 10.00], fmt: 'dollar2' },
  { section: 'Monthly Gross Revenue' },
  { label: 'Public revenue', values: [0.40, 1.60, 6.00], fmt: 'dollar2' },
  { label: 'Private revenue', values: [0.60, 5.00, 22.50], fmt: 'dollar2' },
  { label: 'Marketing revenue', values: [1.50, 10.00, 50.00], fmt: 'dollar2' },
  { label: 'Monthly gross', values: [2.50, 16.60, 78.50], fmt: 'dollar2', bold: true },
  { section: 'After Deductions' },
  { label: 'Search Star fee (10%)', values: [0.25, 1.66, 7.85], fmt: 'dollar2' },
  { label: 'Net monthly earnings', values: [2.17, 14.86, 70.57], fmt: 'dollar2', highlight: true },
  { label: 'Annual net earnings', values: [26, 178, 847], fmt: 'dollar', highlight: true },
  { section: 'Year 5 Scenario (higher volume)' },
  { label: 'Year 5 monthly gross', values: [12.50, 53.00, 237.00], fmt: 'dollar2', bold: true },
  { label: 'Year 5 annual net', values: [135, 572, 2560], fmt: 'dollar', highlight: true },
]

/* Affiliate */
const affScenarios = ['Casual Referrer', 'Active Recruiter', 'Power Affiliate']
const affData = [
  { section: 'Year 1–3' },
  { label: 'Profiles recruited', values: [5, 25, 100] },
  { label: 'Avg profile revenue/month', values: [10, 20, 30], fmt: 'dollar' },
  { label: 'Annual affiliate earnings', values: [30, 300, 1800], fmt: 'dollar', highlight: true },
  { section: 'Year 4 (hockey stick)' },
  { label: 'Profiles recruited', values: [10, 50, 250] },
  { label: 'Avg profile revenue/month', values: [30, 50, 80], fmt: 'dollar' },
  { label: 'Year 4 annual earnings', values: [180, 1500, 12000], fmt: 'dollar', highlight: true },
  { section: 'Year 5 (mainstream)' },
  { label: 'Profiles recruited', values: [20, 100, 500] },
  { label: 'Avg profile revenue/month', values: [50, 80, 120], fmt: 'dollar' },
  { label: 'Year 5 annual earnings', values: [600, 4800, 36000], fmt: 'dollar', highlight: true },
]

/* ── Formatters ── */

function fmt(value: number, format?: string): string {
  if (format === 'pct') return `${(value * 100).toFixed(1)}%`
  if (format === 'dollar2') return `$${value.toFixed(2)}`
  if (format === 'dollar') {
    if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
    if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
    if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
    return `$${value.toLocaleString()}`
  }
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  return value.toLocaleString()
}

/* ── Components ── */

function DataTable({ headers, rows, headerColor = '#1A3A6B' }: {
  headers: string[]
  rows: { label?: string; section?: string; values?: number[]; fmt?: string; bold?: boolean; highlight?: boolean }[]
  headerColor?: string
}) {
  return (
    <div className="overflow-x-auto mb-8" style={{ border: '1px solid #1E293B', borderRadius: '3px' }}>
      <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: '14px' }}>
        <thead>
          <tr>
            <th style={{ background: headerColor, color: '#F5F0E8', padding: '10px 16px', textAlign: 'left', fontFamily: "'Roboto', sans-serif", fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}></th>
            {headers.map((h, i) => (
              <th key={i} style={{ background: headerColor, color: '#F5F0E8', padding: '10px 16px', textAlign: 'right', fontFamily: "'Roboto', sans-serif", fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            if (row.section) {
              return (
                <tr key={i}>
                  <td colSpan={headers.length + 1} style={{ padding: '12px 16px 6px', fontFamily: "'Roboto', sans-serif", fontSize: '11px', fontWeight: 700, color: '#94A3B8', letterSpacing: '0.15em', textTransform: 'uppercase' as const, borderTop: '1px solid #1E293B' }}>
                    {row.section}
                  </td>
                </tr>
              )
            }
            return (
              <tr key={i} style={{ borderBottom: '1px solid #151F2E' }}>
                <td style={{
                  padding: '8px 16px',
                  color: row.highlight ? '#0D9488' : '#CBD5E1',
                  fontWeight: row.bold || row.highlight ? 700 : 400,
                  fontFamily: "'Roboto', sans-serif",
                  fontSize: '13px',
                  whiteSpace: 'nowrap',
                }}>
                  {row.label}
                </td>
                {row.values?.map((v, j) => (
                  <td key={j} style={{
                    padding: '8px 16px',
                    textAlign: 'right',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '13px',
                    color: row.highlight ? '#0D9488' : '#CBD5E1',
                    fontWeight: row.bold || row.highlight ? 700 : 400,
                    background: row.highlight ? 'rgba(13, 148, 136, 0.06)' : 'transparent',
                    whiteSpace: 'nowrap',
                  }}>
                    {fmt(v, row.fmt)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ── Page ── */

export default function ProjectionsPage() {
  return (
    <div className="min-h-screen" style={{ background: '#0A1220' }}>

      {/* Header */}
      <header className="border-b" style={{ borderColor: '#1E293B' }}>
        <div className="max-w-[1100px] mx-auto px-8 py-6 flex justify-between items-center">
          <Link href="/" className="no-underline" style={{ color: '#C5A55A' }}>
            <span className="font-heading text-xl font-bold tracking-wide">SEARCH STAR</span>
          </Link>
          <Link href="/" className="no-underline font-body text-xs font-medium tracking-[0.1em] uppercase" style={{ color: '#94A3B8' }}>
            ← Back to Home
          </Link>
        </div>
      </header>
      <div className="h-[3px]" style={{ background: '#C5A55A' }} />

      <div className="max-w-[1100px] mx-auto px-8 pt-16 pb-20">

        <p className="font-body text-xs font-bold tracking-[0.25em] uppercase mb-4" style={{ color: '#C5A55A' }}>
          Financial Model
        </p>
        <h1 className="font-heading text-4xl font-bold leading-tight mb-3" style={{ color: '#F5F0E8' }}>
          Revenue Projections
        </h1>
        <p className="font-body text-base mb-12" style={{ color: '#94A3B8' }}>
          Five-year model with hockey stick growth · Quarterly payouts · All inputs are assumptions — change them freely in the <a href="/SearchStar_Revenue_Projections.xlsx" className="underline" style={{ color: '#0D9488' }}>downloadable spreadsheet</a>.
        </p>

        {/* ── MODEL 1: Search Star Platform ── */}
        <div className="mb-16">
          <h2 className="font-heading text-2xl font-bold mb-2" style={{ color: '#F5F0E8' }}>
            Search Star Platform Revenue
          </h2>
          <p className="font-body text-sm mb-6" style={{ color: '#64748B' }}>
            10% take rate on all query revenue flowing through the marketplace.
          </p>

          <h3 className="font-body text-xs font-bold tracking-[0.15em] uppercase mb-3" style={{ color: '#94A3B8' }}>Key Assumptions</h3>
          <DataTable headers={years} rows={assumptions} />

          <h3 className="font-body text-xs font-bold tracking-[0.15em] uppercase mb-3" style={{ color: '#94A3B8' }}>Query Volume & Pricing</h3>
          <DataTable headers={years} rows={[...queryVolume, ...pricing]} />

          <h3 className="font-body text-xs font-bold tracking-[0.15em] uppercase mb-3" style={{ color: '#94A3B8' }}>Annual Query Volume</h3>
          <DataTable headers={years} rows={volume} />

          <h3 className="font-body text-xs font-bold tracking-[0.15em] uppercase mb-3" style={{ color: '#94A3B8' }}>Gross Revenue</h3>
          <DataTable headers={years} rows={revenue} />

          <h3 className="font-body text-xs font-bold tracking-[0.15em] uppercase mb-3" style={{ color: '#94A3B8' }}>Revenue Distribution</h3>
          <DataTable headers={years} rows={distribution} />

          <h3 className="font-body text-xs font-bold tracking-[0.15em] uppercase mb-3" style={{ color: '#94A3B8' }}>Operating Costs</h3>
          <DataTable headers={years} rows={costs} />

          <h3 className="font-body text-xs font-bold tracking-[0.15em] uppercase mb-3" style={{ color: '#94A3B8' }}>Net Income</h3>
          <DataTable headers={years} rows={netIncome} />

          <h3 className="font-body text-xs font-bold tracking-[0.15em] uppercase mb-3" style={{ color: '#94A3B8' }}>Cumulative</h3>
          <DataTable headers={years} rows={cumulative} />
        </div>

        {/* Divider */}
        <div className="h-[1px] mb-16" style={{ background: '#1E293B' }} />

        {/* ── MODEL 2: Profile Owner ── */}
        <div className="mb-16">
          <h2 className="font-heading text-2xl font-bold mb-2" style={{ color: '#F5F0E8' }}>
            Profile Owner Economics
          </h2>
          <p className="font-body text-sm mb-6" style={{ color: '#64748B' }}>
            What a single profile owner earns per year across activity levels.
          </p>
          <DataTable headers={ownerScenarios} rows={ownerData} headerColor="#0D9488" />
        </div>

        {/* Divider */}
        <div className="h-[1px] mb-16" style={{ background: '#1E293B' }} />

        {/* ── MODEL 3: Affiliate ── */}
        <div className="mb-16">
          <h2 className="font-heading text-2xl font-bold mb-2" style={{ color: '#F5F0E8' }}>
            Affiliate &amp; Recruiter Economics
          </h2>
          <p className="font-body text-sm mb-6" style={{ color: '#64748B' }}>
            Single-tier referral — 5% of referred profile&apos;s query revenue, paid in perpetuity.
          </p>
          <DataTable headers={affScenarios} rows={affData} headerColor="#C5A55A" />
        </div>

        {/* Download CTA */}
        <div className="text-center mt-16">
          <a
            href="/SearchStar_Revenue_Projections.xlsx"
            className="inline-block no-underline font-body text-sm font-bold tracking-[0.15em] uppercase px-8 py-3 rounded-[3px]"
            style={{ background: '#0D9488', color: '#F5F0E8', border: '1px solid #0D9488' }}
          >
            Download Editable Spreadsheet (.xlsx)
          </a>
        </div>

      </div>

      {/* Footer */}
      <footer className="py-8" style={{ borderTop: '1px solid #1E293B' }}>
        <div className="max-w-[1100px] mx-auto px-8">
          <div className="font-body text-xs flex justify-between" style={{ color: 'rgba(255,255,255,0.35)' }}>
            <div><strong style={{ color: 'rgba(255,255,255,0.6)' }}>Search Star</strong> — The Sovereign Personal Data Standard</div>
            <div className="flex gap-6">
              <Link href="/spec.html" className="no-underline font-medium tracking-[0.1em] uppercase" style={{ color: 'rgba(255,255,255,0.35)' }}>Spec</Link>
              <Link href="/roadmap.html" className="no-underline font-medium tracking-[0.1em] uppercase" style={{ color: 'rgba(255,255,255,0.35)' }}>Roadmap</Link>
              <Link href="/manifesto" className="no-underline font-medium tracking-[0.1em] uppercase" style={{ color: 'rgba(255,255,255,0.35)' }}>Manifesto</Link>
              <a href="https://github.com/ArchonGraceland/Search-Star" className="no-underline font-medium tracking-[0.1em] uppercase" style={{ color: 'rgba(255,255,255,0.35)' }}>GitHub</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
