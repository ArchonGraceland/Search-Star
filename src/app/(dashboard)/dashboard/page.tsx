import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

// v4 Decision #8: the room is the primary post-login surface. When the
// user has an active commitment, we redirect to their room immediately.
// The dashboard remains as a "between commitments" fallback — a user who
// has no active commitment and no room yet sees trust stage + CTAs here.
export const dynamic = 'force-dynamic'

const STAGE_LABELS: Record<string, string> = {
  seedling: 'Seedling',
  rooting: 'Rooting',
  growing: 'Growing',
  established: 'Established',
  mature: 'Mature',
}

const STAGE_COLORS: Record<string, string> = {
  seedling: '#5a8a5a',
  rooting: '#2d6a6a',
  growing: '#1a3a6b',
  established: '#7a4a1a',
  mature: '#4a1a6b',
}

function streakDay(startedAt: string): number {
  const start = new Date(startedAt)
  const now = new Date()
  const diff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(1, Math.min(90, diff + 1))
}

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #d4d4d4',
  borderRadius: '3px',
  padding: '24px 28px',
  marginBottom: '20px',
}

const labelStyle: React.CSSProperties = {
  fontFamily: 'Roboto, sans-serif',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
  color: '#767676',
  marginBottom: '12px',
}

const ctaLink: React.CSSProperties = {
  display: 'inline-block',
  background: '#1a3a6b',
  color: '#fff',
  fontFamily: 'Roboto, sans-serif',
  fontSize: '13px',
  fontWeight: 600,
  padding: '9px 18px',
  borderRadius: '3px',
  textDecoration: 'none',
  letterSpacing: '0.02em',
}

const softLink: React.CSSProperties = {
  display: 'inline-block',
  fontFamily: 'Roboto, sans-serif',
  fontSize: '13px',
  fontWeight: 600,
  color: '#1a3a6b',
  textDecoration: 'none',
  borderBottom: '1px solid #1a3a6b',
  paddingBottom: '1px',
}

export default async function DashboardPage() {
  const ssr = await createClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) redirect('/login')

  const supabase = createServiceClient()

  // Onboarding gate — redirect to practice step if not yet completed
  const { data: practiceCheck } = await supabase
    .from('practices')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)
  if (!practiceCheck || practiceCheck.length === 0) redirect('/start')

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, trust_stage')
    .eq('user_id', user.id)
    .single()

  const name = profile?.display_name || 'Practitioner'
  const trustStage = profile?.trust_stage || 'seedling'

  // Active commitment — if one exists, the user belongs in their room.
  // Redirect immediately. The "dashboard as overview" model is retired
  // per Decision #8; the room is the home surface.
  type ActiveCommitmentRow = {
    id: string
    started_at: string
    room_id: string
    practices: { name: string } | { name: string }[] | null
  }
  const { data: activeCommitments } = await supabase
    .from('commitments')
    .select('id, started_at, room_id, practices(name)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .returns<ActiveCommitmentRow[]>()
  const activeCommitment = activeCommitments?.[0] ?? null

  if (activeCommitment) {
    redirect(`/room/${activeCommitment.room_id}`)
  }

  // Recent pledges across the user's commitments
  const { data: userCommitmentIds } = await supabase
    .from('commitments')
    .select('id')
    .eq('user_id', user.id)

  const userCommitmentIdList = (userCommitmentIds ?? []).map((c) => c.id)

  const { data: recentPledges } = userCommitmentIdList.length > 0
    ? await supabase
        .from('sponsorships')
        .select('sponsor_name, pledged_at, pledge_amount')
        .in('commitment_id', userCommitmentIdList)
        .order('pledged_at', { ascending: false })
        .limit(3)
    : { data: [] }

  let totalReleased = 0
  if (userCommitmentIdList.length > 0) {
    const { data: released } = await supabase
      .from('sponsorships')
      .select('pledge_amount')
      .in('commitment_id', userCommitmentIdList)
      .eq('status', 'released')
    totalReleased = (released ?? []).reduce((sum, r) => sum + (r.pledge_amount ?? 0), 0)
  }

  return (
    <div style={{ maxWidth: '740px' }}>
      <p style={labelStyle}>Dashboard</p>
      <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '32px', fontWeight: 700, marginBottom: '24px' }}>
        Welcome, {name}.
      </h1>

      {/* No active commitment — CTA to declare */}
      <div style={{ ...cardStyle, borderLeft: '3px solid #1a3a6b' }}>
        <p style={labelStyle}>No active commitment</p>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#767676', marginBottom: '16px' }}>
          Ready to declare your next 90 days?
        </p>
        <Link href="/start/commitment" style={ctaLink}>
          Declare your commitment →
        </Link>
      </div>

      {/* Trust stage */}
      <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <p style={labelStyle}>Trust Stage</p>
          <span style={{
            display: 'inline-block',
            fontFamily: 'Roboto, sans-serif',
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            background: STAGE_COLORS[trustStage] ?? '#1a3a6b',
            color: '#fff',
            borderRadius: '2px',
            padding: '4px 12px',
          }}>
            {STAGE_LABELS[trustStage] ?? 'Seedling'}
          </span>
        </div>
        <Link href="/trust" style={softLink}>View record →</Link>
      </div>

      {/* Recent sponsor pledges */}
      <div style={cardStyle}>
        <p style={labelStyle}>Recent Pledges</p>
        {recentPledges && recentPledges.length > 0 ? (
          <div>
            {recentPledges.map((p, i) => {
              const date = new Date(p.pledged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              return (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: i < recentPledges.length - 1 ? '1px solid #e8e8e8' : 'none',
                }}>
                  <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#1a1a1a' }}>
                    {p.sponsor_name} pledged ${Number(p.pledge_amount).toFixed(2)}
                  </span>
                  <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#767676' }}>
                    {date}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#767676' }}>
            No pledges yet.
          </p>
        )}
      </div>

      {/* Earnings summary */}
      <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <p style={labelStyle}>Lifetime Earnings</p>
          <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '24px', fontWeight: 700, color: '#1a1a1a' }}>
            ${totalReleased.toFixed(2)}
          </p>
        </div>
        <Link href="/earnings" style={softLink}>View earnings →</Link>
      </div>

      {/* Unused-but-suppressed: streakDay is imported for future card that shows
          partial streak info. Leaving the import+function in place so we don't
          have to re-add it in a day. */}
      <span style={{ display: 'none' }}>{streakDay('2026-04-20')}</span>
    </div>
  )
}
