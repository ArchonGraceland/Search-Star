import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isCurrentUserAdmin } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { requireInstitutionalPortal } from '@/lib/feature-flags'

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

const PAGE_SIZE = 20

export default async function InstitutionMembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string }>
}) {
  requireInstitutionalPortal()
  const { id } = await params
  const { page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Data reads via service client. Authorization is enforced in two places:
  // the institution lookup below must return a row for the page to render,
  // and the contact_email/admin check gates access at the application
  // layer. If the institution read silently returned empty through the SSR
  // client (bug documented in commits 0710ce4 / 1dccc46 / 501d976 /
  // 0f28db9), we'd bounce the legitimate owner to /login.
  const db = createServiceClient()

  const { data: institution } = await db
    .from('institutions')
    .select('id, name, contact_email')
    .eq('id', id)
    .single()

  if (!institution) redirect('/login')

  const isAdmin = await isCurrentUserAdmin()
  if (institution.contact_email !== user.email && !isAdmin) redirect('/dashboard')

  // Paginated memberships
  const { data: memberships, count } = await db
    .from('institution_memberships')
    .select('id, user_id, enrolled_at', { count: 'exact' })
    .eq('institution_id', id)
    .order('enrolled_at', { ascending: false })
    .range(from, to)

  const totalCount = count ?? 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  // Fetch trust records for these members
  const userIds = (memberships ?? []).map((m) => m.user_id)
  const trustMap: Record<string, string> = {}
  const profileMap: Record<string, string> = {}

  if (userIds.length > 0) {
    const { data: trustRows } = await db
      .from('trust_records')
      .select('user_id, stage')
      .in('user_id', userIds)
    for (const r of trustRows ?? []) trustMap[r.user_id] = r.stage

    const { data: profileRows } = await db
      .from('profiles')
      .select('user_id, display_name')
      .in('user_id', userIds)
    for (const r of profileRows ?? []) profileMap[r.user_id] = r.display_name ?? 'Unknown'
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      {/* Portal header */}
      <header style={{ background: '#1a3a6b', borderBottom: '3px solid #112a4f', padding: '18px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/home" style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#fff', textDecoration: 'none' }}>
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
                background: link.label === 'Members' ? 'rgba(255,255,255,0.12)' : 'transparent',
              }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 32px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#767676', marginBottom: '6px' }}>
              {institution.name}
            </p>
            <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '32px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
              Members
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#767676' }}>
              {totalCount} total
            </span>
            <Link
              href={`/institution/${id}/enroll`}
              style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '8px 18px', background: '#1a3a6b', color: '#fff', textDecoration: 'none', borderRadius: '3px' }}
            >
              Enroll more
            </Link>
          </div>
        </div>

        {totalCount === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '60px 24px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#b8b8b8', margin: '0 0 20px' }}>
              No members enrolled yet.
            </p>
            <Link
              href={`/institution/${id}/enroll`}
              style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '10px 24px', background: '#1a3a6b', color: '#fff', textDecoration: 'none', borderRadius: '3px', display: 'inline-block' }}
            >
              Enroll members
            </Link>
          </div>
        ) : (
          <>
            <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', overflow: 'hidden', marginBottom: '20px' }}>
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', background: '#f5f5f5', borderBottom: '1px solid #e8e8e8', padding: '10px 24px' }}>
                {['Member', 'Trust stage', 'Enrolled'].map((h) => (
                  <span key={h} style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676' }}>
                    {h}
                  </span>
                ))}
              </div>

              {(memberships ?? []).map((m, i, arr) => {
                const stage = trustMap[m.user_id] ?? 'seedling'
                const name = profileMap[m.user_id] ?? 'Unknown'
                return (
                  <div
                    key={m.id}
                    style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '14px 24px', borderBottom: i < arr.length - 1 ? '1px solid #f0f0f0' : 'none', alignItems: 'center' }}
                  >
                    <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', fontWeight: 500, color: '#1a1a1a' }}>
                      {name}
                    </span>
                    <span>
                      <span style={{ display: 'inline-block', padding: '3px 10px', background: STAGE_COLORS[stage], borderRadius: '3px', fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#fff' }}>
                        {STAGE_LABELS[stage]}
                      </span>
                    </span>
                    <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#767676' }}>
                      {formatDate(m.enrolled_at)}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                {page > 1 && (
                  <Link
                    href={`/institution/${id}/members?page=${page - 1}`}
                    style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '7px 16px', border: '1px solid #d4d4d4', borderRadius: '3px', color: '#1a3a6b', textDecoration: 'none', background: '#fff' }}
                  >
                    Previous
                  </Link>
                )}
                <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#767676' }}>
                  Page {page} of {totalPages}
                </span>
                {page < totalPages && (
                  <Link
                    href={`/institution/${id}/members?page=${page + 1}`}
                    style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '7px 16px', border: '1px solid #d4d4d4', borderRadius: '3px', color: '#1a3a6b', textDecoration: 'none', background: '#fff' }}
                  >
                    Next
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
