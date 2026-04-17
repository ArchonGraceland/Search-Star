import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

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

function streakDay(streakStartsAt: string): number {
  const start = new Date(streakStartsAt)
  const now = new Date()
  const diff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(1, Math.min(90, diff + 1))
}

function launchDaysRemaining(launchEndsAt: string): number {
  const end = new Date(launchEndsAt)
  const now = new Date()
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(0, diff)
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

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

  // Active commitment
  const { data: activeCommitments } = await supabase
    .from('commitments')
    .select('id, title, status, sessions_logged, streak_starts_at, launch_ends_at')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
  const activeCommitment = activeCommitments?.[0] ?? null

  // Launch window commitment
  const { data: launchCommitments } = await supabase
    .from('commitments')
    .select('id, title, status, launch_ends_at')
    .eq('user_id', user.id)
    .eq('status', 'launch')
    .order('created_at', { ascending: false })
    .limit(1)
  const launchCommitment = launchCommitments?.[0] ?? null

  // Sponsor count for launch commitment
  let sponsorCount = 0
  if (launchCommitment) {
    const { count: sc } = await supabase
      .from('sponsorships').select('id', { count: 'exact', head: true }).eq('commitment_id', launchCommitment.id)
    sponsorCount = sc ?? 0
  }

  // Recent sponsor pledges on user's commitments — Phase 2 will add richer sponsor-activity surfaces.
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

  // Lifetime contributions received — sum of gross_amount on contributions for this user's commitments
  let totalContributions = 0
  if (userCommitmentIdList.length > 0) {
    const { data: contribs } = await supabase
      .from('contributions')
      .select('gross_amount')
      .in('commitment_id', userCommitmentIdList)
    totalContributions = (contribs ?? []).reduce((sum, c) => sum + (c.gross_amount ?? 0), 0)
  }

  return (
    <div style={{ maxWidth: '740px' }}>
      <p style={labelStyle}>Dashboard</p>
      <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '32px', fontWeight: 700, marginBottom: '24px' }}>
        Welcome, {name}.
      </h1>

      {/* Continue journey CTA */}
      <Link
        href="/start"
        style={{
          display: 'flex',
          background: '#1a3a6b',
          borderRadius: '3px',
          padding: '16px 24px',
          marginBottom: '24px',
          textDecoration: 'none',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>Your practice</span>
        <span style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#ffffff' }}>Continue your journey →</span>
      </Link>

      {/* Active commitment */}
      <div style={{ ...cardStyle, borderLeft: '3px solid #1a3a6b' }}>
        <p style={labelStyle}>Active Commitment</p>
        {activeCommitment ? (
          <>
            <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '22px', fontWeight: 700, marginBottom: '12px', color: '#1a1a1a' }}>
              {activeCommitment.title}
            </p>
            <div style={{ display: 'flex', gap: '24px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#5a5a5a' }}>
                Day {activeCommitment.streak_starts_at ? streakDay(activeCommitment.streak_starts_at) : '—'} of 90
              </span>
              <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#5a5a5a' }}>
                {activeCommitment.sessions_logged} session{activeCommitment.sessions_logged !== 1 ? 's' : ''} logged
              </span>
            </div>
            <Link href={`/commit/${activeCommitment.id}`} style={softLink}>
              View commitment →
            </Link>
          </>
        ) : (
          <>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#767676', marginBottom: '16px' }}>
              No active commitment. Ready to start your 90 days?
            </p>
            <Link href="/commit" style={ctaLink}>
              Declare your commitment →
            </Link>
          </>
        )}
      </div>

      {/* Launch window (only shown if exists) */}
      {launchCommitment && (
        <div style={{ ...cardStyle, borderLeft: '3px solid #b45309' }}>
          <p style={{ ...labelStyle, color: '#b45309' }}>Launch Window</p>
          <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '22px', fontWeight: 700, marginBottom: '12px', color: '#1a1a1a' }}>
            {launchCommitment.title}
          </p>
          <div style={{ display: 'flex', gap: '24px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#5a5a5a' }}>
              {launchDaysRemaining(launchCommitment.launch_ends_at)} days remaining
            </span>
            <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#5a5a5a' }}>
              {sponsorCount} sponsor{sponsorCount !== 1 ? 's' : ''} pledged
            </span>
          </div>
          <Link href={`/commit/${launchCommitment.id}`} style={ctaLink}>
              Log a session →
            </Link>
        </div>
      )}

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
          <p style={labelStyle}>Lifetime Contributions</p>
          <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '24px', fontWeight: 700, color: '#1a1a1a' }}>
            ${totalContributions.toFixed(2)}
          </p>
        </div>
        <Link href="/earnings" style={softLink}>View earnings →</Link>
      </div>
    </div>
  )
}
