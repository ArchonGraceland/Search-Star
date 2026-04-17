import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const TYPE_LABELS: Record<string, string> = {
  employer: 'Employer',
  university: 'University',
  trade_program: 'Trade Program',
  foundation: 'Foundation',
  civic: 'Civic Organization',
  brand: 'Brand',
}

const STAGE_COLORS: Record<string, string> = {
  seedling: '#5a8a5a',
  rooting: '#2d6a6a',
  growing: '#1a3a6b',
  established: '#7a4a1a',
  mature: '#4a1a6b',
}

const STAGE_LABELS: Record<string, string> = {
  seedling: 'Seedling',
  rooting: 'Rooting',
  growing: 'Growing',
  established: 'Established',
  mature: 'Mature',
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '20px 24px', flex: 1, minWidth: '160px' }}>
      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', margin: '0 0 6px' }}>
        {label}
      </p>
      <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '32px', fontWeight: 700, color: '#1a3a6b', margin: 0, lineHeight: 1 }}>
        {value}
      </p>
      {sub && (
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#999', margin: '4px 0 0' }}>
          {sub}
        </p>
      )}
    </div>
  )
}

export default async function InstitutionDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ welcome?: string }>
}) {
  const { id } = await params
  const { welcome } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Load institution
  const { data: institution } = await supabase
    .from('institutions')
    .select('id, name, type, contact_name, contact_email, budget_total, budget_spent, skill_category_id')
    .eq('id', id)
    .single()

  if (!institution) redirect('/login')

  // Verify access: contact_email must match or platform admin
  const isAdmin = user.user_metadata?.role === 'admin'
  if (institution.contact_email !== user.email && !isAdmin) redirect('/dashboard')

  // Member count
  const { count: memberCount } = await supabase
    .from('institution_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('institution_id', id)

  // Stage distribution
  const { data: members } = await supabase
    .from('institution_memberships')
    .select('user_id')
    .eq('institution_id', id)

  const memberIds = (members ?? []).map((m) => m.user_id)

  const stageDist: Record<string, number> = {
    seedling: 0,
    rooting: 0,
    growing: 0,
    established: 0,
    mature: 0,
  }

  if (memberIds.length > 0) {
    const { data: trustRows } = await supabase
      .from('trust_records')
      .select('stage')
      .in('user_id', memberIds)
    for (const row of trustRows ?? []) {
      if (row.stage in stageDist) stageDist[row.stage]++
    }
  }

  // Skill category name
  let categoryName = 'All categories'
  if (institution.skill_category_id) {
    const { data: cat } = await supabase
      .from('skill_categories')
      .select('name')
      .eq('id', institution.skill_category_id)
      .single()
    if (cat) categoryName = cat.name
  }

  const budgetRemaining = (institution.budget_total ?? 0) - (institution.budget_spent ?? 0)
  const typeLabel = TYPE_LABELS[institution.type] ?? institution.type
  const totalMembers = memberCount ?? 0

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      {/* Portal header */}
      <header style={{ background: '#1a3a6b', borderBottom: '3px solid #112a4f', padding: '18px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#fff', textDecoration: 'none' }}>
          Search Star
        </Link>
        <nav style={{ display: 'flex', gap: '4px' }}>
          {[
            { href: `/institution/${id}/dashboard`, label: 'Overview' },
            { href: `/institution/${id}/members`, label: 'Members' },
            { href: `/institution/${id}/enroll`, label: 'Enroll' },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                fontFamily: 'Roboto, sans-serif',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '7px 16px',
                borderRadius: '3px',
                color: 'rgba(255,255,255,0.75)',
                textDecoration: 'none',
                background: link.label === 'Overview' ? 'rgba(255,255,255,0.12)' : 'transparent',
              }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 32px 80px' }}>

        {/* Welcome banner */}
        {welcome === '1' && (
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '3px', padding: '16px 20px', marginBottom: '32px', fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#166534', lineHeight: '1.6' }}>
            Your portal is ready. Start by enrolling members — paste their email addresses on the{' '}
            <Link href={`/institution/${id}/enroll`} style={{ color: '#166534', fontWeight: 700 }}>Enroll</Link>{' '}
            page. Once enrolled, members earn from your budget by completing validated 90-day commitments.
          </div>
        )}

        {/* Institution name + type */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
            <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '34px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
              {institution.name}
            </h1>
            <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 10px', background: '#eef2f8', color: '#1a3a6b', borderRadius: '3px' }}>
              {typeLabel}
            </span>
          </div>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#999', margin: 0 }}>
            Eligible category: {categoryName}
            {institution.contact_name && <> &middot; Contact: {institution.contact_name}</>}
          </p>
        </div>

        {/* Budget summary */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '32px' }}>
          <StatCard
            label="Budget allocated"
            value={`$${(institution.budget_total ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}`}
            sub="Total sponsorship budget"
          />
          <StatCard
            label="Budget spent"
            value={`$${(institution.budget_spent ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}`}
            sub="Paid out to members"
          />
          <StatCard
            label="Remaining"
            value={`$${budgetRemaining.toLocaleString('en-US', { minimumFractionDigits: 0 })}`}
            sub="Available to allocate"
          />
          <StatCard
            label="Members"
            value={String(totalMembers)}
            sub={<><Link href={`/institution/${id}/members`} style={{ color: '#1a3a6b', textDecoration: 'underline', fontFamily: 'Roboto, sans-serif', fontSize: '12px' }}>View all members</Link></> as unknown as string}
          />
        </div>

        {/* Trust stage distribution */}
        <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', overflow: 'hidden', marginBottom: '32px' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #e8e8e8' }}>
            <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '22px', fontWeight: 700, color: '#1a1a1a', margin: '0 0 4px' }}>
              Trust stage distribution
            </h2>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#999', margin: 0 }}>
              Aggregate view of where your members are in their practice development. No individual rankings.
            </p>
          </div>

          {totalMembers === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#b8b8b8', margin: '0 0 16px' }}>
                No members enrolled yet.
              </p>
              <Link
                href={`/institution/${id}/enroll`}
                style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#1a3a6b', textDecoration: 'none', border: '1px solid #1a3a6b', padding: '8px 20px', borderRadius: '3px', display: 'inline-block' }}
              >
                Enroll members
              </Link>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  {['Stage', 'Members', 'Share'].map((h) => (
                    <th
                      key={h}
                      style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', textAlign: 'left', padding: '10px 24px', borderBottom: '1px solid #e8e8e8' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(['seedling', 'rooting', 'growing', 'established', 'mature'] as const).map((stage, i, arr) => {
                  const count = stageDist[stage]
                  const pct = totalMembers > 0 ? Math.round((count / totalMembers) * 100) : 0
                  return (
                    <tr key={stage} style={{ borderBottom: i < arr.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                      <td style={{ padding: '14px 24px' }}>
                        <span style={{ display: 'inline-block', padding: '3px 10px', background: STAGE_COLORS[stage], borderRadius: '3px', fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#fff' }}>
                          {STAGE_LABELS[stage]}
                        </span>
                      </td>
                      <td style={{ padding: '14px 24px', fontFamily: '"Crimson Text", Georgia, serif', fontSize: '22px', fontWeight: 700, color: '#1a1a1a' }}>
                        {count}
                      </td>
                      <td style={{ padding: '14px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '120px', height: '6px', background: '#f0f0f0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: STAGE_COLORS[stage], borderRadius: '3px' }} />
                          </div>
                          <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#5a5a5a', minWidth: '32px' }}>
                            {pct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Quick links */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link
            href={`/institution/${id}/members`}
            style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '10px 20px', background: '#1a3a6b', color: '#fff', textDecoration: 'none', borderRadius: '3px' }}
          >
            View members
          </Link>
          <Link
            href={`/institution/${id}/enroll`}
            style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '10px 20px', background: '#fff', color: '#1a3a6b', textDecoration: 'none', borderRadius: '3px', border: '1px solid #1a3a6b' }}
          >
            Enroll members
          </Link>
        </div>

      </div>
    </div>
  )
}
