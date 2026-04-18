import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LogClient from './client'

// /log is the primary logged-in landing. Middleware routes `/` here for any
// user with a commitment (launch or active). The page then branches on
// commitment status:
//
//   - active        → LogClient (the real session logger)
//   - launch        → "Your commitment starts on …" splash linking back
//                     to the dashboard so the practitioner can manage
//                     their launch window (invite sponsors, see pledges)
//   - none/else     → "No active commitment" splash linking to /start
//
// Completed and abandoned commitments both route through the none-case
// splash: they're closed records, not something to log against. The
// practitioner can start a new 90-day commitment from /start.
export default async function LogPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Pull the latest commitment of any status. The old query filtered to
  // status='active' which conflated "no commitment" and "launch-window
  // not yet started" — the splash looked the same either way, misleading
  // launch-window users into thinking they'd lost their commitment.
  const db = createServiceClient()
  const { data: commitment } = await db
    .from('commitments')
    .select('id, title, status, sessions_logged, streak_starts_at, streak_ends_at, launch_ends_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Shared splash layout. Used for both the launch-window and no-commitment
  // paths so the two states feel like variants of the same surface rather
  // than different pages.
  const splashPage = (
    heading: string,
    sub: string,
    cta: { label: string; href: string }
  ) => (
    <div style={{
      minHeight: '100dvh',
      background: '#1a3a6b',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '"Crimson Text", Georgia, serif',
      color: '#ffffff',
      padding: '32px',
      textAlign: 'center',
    }}>
      <p style={{ fontSize: '14px', letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: 'Roboto, sans-serif', color: 'rgba(255,255,255,0.5)', marginBottom: '16px' }}>
        Search Star
      </p>
      <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '12px', maxWidth: '520px' }}>
        {heading}
      </h1>
      <p style={{ fontSize: '18px', color: 'rgba(255,255,255,0.7)', marginBottom: '32px', maxWidth: '520px', lineHeight: 1.5 }}>
        {sub}
      </p>
      <a href={cta.href} style={{
        display: 'inline-block',
        padding: '14px 32px',
        background: '#ffffff',
        color: '#1a3a6b',
        fontFamily: 'Roboto, sans-serif',
        fontSize: '13px',
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        textDecoration: 'none',
        borderRadius: '3px',
      }}>
        {cta.label}
      </a>
    </div>
  )

  // Launch-window: the practitioner has a commitment, but the 90-day
  // streak hasn't started yet. Tell them exactly when it does and point
  // them at the dashboard to manage their launch window in the meantime.
  if (commitment?.status === 'launch') {
    const startDate = new Date(commitment.streak_starts_at)
    const startDateLabel = startDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
    return splashPage(
      `Your commitment starts on ${startDateLabel}.`,
      'Come back here then to log your first session. In the meantime, invite sponsors and manage your launch window from the dashboard.',
      { label: 'Go to dashboard', href: '/dashboard' }
    )
  }

  // No commitment, or the latest one is completed/abandoned. Either way,
  // the next step is to start a (new) 90-day commitment.
  if (!commitment || commitment.status !== 'active') {
    return splashPage(
      'No active commitment',
      'Start a 90-day streak to begin logging sessions.',
      { label: 'Start a commitment', href: '/start' }
    )
  }

  // Active commitment — render the real session logger.
  const { data: recentPosts } = await db
    .from('commitment_posts')
    .select('id, body, session_number, posted_at, media_urls')
    .eq('commitment_id', commitment.id)
    .order('posted_at', { ascending: false })
    .limit(10)

  const now = new Date()
  const streakStart = new Date(commitment.streak_starts_at)
  const streakEnd = new Date(commitment.streak_ends_at)
  const dayNumber = Math.min(90, Math.max(1, Math.floor((now.getTime() - streakStart.getTime()) / 86400000) + 1))
  const daysRemaining = Math.max(0, Math.ceil((streakEnd.getTime() - now.getTime()) / 86400000))

  const today = new Date().toDateString()
  const loggedToday = (recentPosts ?? []).some(
    p => new Date(p.posted_at).toDateString() === today
  )

  return (
    <LogClient
      commitmentId={commitment.id}
      title={commitment.title}
      dayNumber={dayNumber}
      daysRemaining={daysRemaining}
      sessionsLogged={commitment.sessions_logged ?? 0}
      recentPosts={recentPosts ?? []}
      loggedToday={loggedToday}
    />
  )
}
