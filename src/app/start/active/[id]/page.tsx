import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ActiveStreakClient from './client'

export default async function StageActive({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: commitment } = await supabase
    .from('commitments')
    .select('id, title, status, sessions_logged, streak_starts_at, streak_ends_at')
    .eq('id', id).eq('user_id', user.id).single()

  if (!commitment) redirect('/start')
  if (commitment.status !== 'active') redirect('/start')

  const { data: posts } = await supabase
    .from('commitment_posts')
    .select('id, body, session_number, posted_at')
    .eq('commitment_id', id)
    .order('posted_at', { ascending: false })
    .limit(10)

  const now = new Date()
  const streakStart = new Date(commitment.streak_starts_at)
  const streakEnd = new Date(commitment.streak_ends_at)
  const dayNumber = Math.min(90, Math.max(1, Math.floor((now.getTime() - streakStart.getTime()) / 86400000) + 1))
  const daysRemaining = Math.max(0, Math.ceil((streakEnd.getTime() - now.getTime()) / 86400000))

  const todayStr = now.toISOString().slice(0, 10)
  const loggedToday = (posts ?? []).some(p => p.posted_at.slice(0, 10) === todayStr)

  return (
    <ActiveStreakClient
      commitmentId={id}
      title={commitment.title}
      dayNumber={dayNumber}
      daysRemaining={daysRemaining}
      sessionsLogged={commitment.sessions_logged}
      recentPosts={posts ?? []}
      loggedToday={loggedToday}
    />
  )
}
