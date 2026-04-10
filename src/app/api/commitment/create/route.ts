import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { habit, visibility = 'community', prior_attempt_id } = body

  if (!habit?.trim()) {
    return NextResponse.json({ error: 'Habit is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('commitments')
    .insert({
      user_id: user.id,
      habit: habit.trim(),
      visibility,
      prior_attempt_id: prior_attempt_id || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ commitment: data })
}
