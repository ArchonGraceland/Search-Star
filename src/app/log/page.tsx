import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LogClient from './client'

export default async function LogPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Use service client to bypass RLS for the lookup
  const db = createServiceClient()
  const { data: commitment } = await db
    .from('commitments')
    .select('id, title, sessions_logged, streak_starts_at, streak_ends_at')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('streak_starts_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!commitment) {
    return (
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
        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '12px' }}>
          No active commitment
        </h1>
        <p style={{ fontSize: '18px', color: 'rgba(255,255,255,0.7)', marginBottom: '32px' }}>
          Start a 90-day streak to begin logging sessions.
        </p>
        <a href="/start" style={{
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
          Start a commitment
        </a>
      </div>
    )
  }

  const now = new Date()
  const streakStart = new Date(commitment.streak_starts_at)
  const dayNumber = Math.min(90, Math.max(1, Math.floor((now.getTime() - streakStart.getTime()) / 86400000) + 1))

  return (
    <LogClient
      commitmentId={commitment.id}
      title={commitment.title}
      dayNumber={dayNumber}
      sessionsLogged={commitment.sessions_logged ?? 0}
    />
  )
}
