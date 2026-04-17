import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { title, description, frequency, sessions_per_week, start_date } = body

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return NextResponse.json({ error: 'Title is required.' }, { status: 400 })
  }

  if (!frequency || !['daily', 'weekly'].includes(frequency)) {
    return NextResponse.json({ error: 'Frequency must be daily or weekly.' }, { status: 400 })
  }

  if (frequency === 'weekly' && (!sessions_per_week || sessions_per_week < 1 || sessions_per_week > 7)) {
    return NextResponse.json({ error: 'Sessions per week must be between 1 and 7.' }, { status: 400 })
  }

  if (!start_date) {
    return NextResponse.json({ error: 'Start date is required.' }, { status: 400 })
  }

  // Use service client for all DB operations to bypass RLS
  const db = createServiceClient()

  // Look up the user's practice
  const { data: practice } = await db
    .from('practices')
    .select('id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!practice) {
    return NextResponse.json({ error: 'No practice found. Please complete onboarding first.' }, { status: 400 })
  }

  // Date calculations — v4 spec §4.2: 14-day launch period + 90-day streak.
  // Initial projection here must match what /api/commitments/[id]/start does at
  // start ritual (streak_ends_at = now + 90) so the launch page shows accurate dates.
  const launchStartsAt = new Date(start_date + 'T00:00:00Z')
  const launchEndsAt = new Date(launchStartsAt)
  launchEndsAt.setUTCDate(launchEndsAt.getUTCDate() + 14)

  const streakStartsAt = new Date(launchEndsAt)
  const streakEndsAt = new Date(streakStartsAt)
  streakEndsAt.setUTCDate(streakEndsAt.getUTCDate() + 90)

  const { data, error } = await db
    .from('commitments')
    .insert({
      user_id: user.id,
      practice_id: practice.id,
      title: title.trim(),
      description: description?.trim() || null,
      frequency,
      sessions_per_week: frequency === 'weekly' ? sessions_per_week : null,
      status: 'launch',
      launch_starts_at: launchStartsAt.toISOString(),
      launch_ends_at: launchEndsAt.toISOString(),
      streak_starts_at: streakStartsAt.toISOString(),
      streak_ends_at: streakEndsAt.toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating commitment:', JSON.stringify({ message: error.message, code: error.code, details: error.details, hint: error.hint }))
    return NextResponse.json({ error: 'Failed to create commitment.', detail: error.message, code: error.code, hint: error.hint }, { status: 500 })
  }

  return NextResponse.json({ id: data.id })
}
