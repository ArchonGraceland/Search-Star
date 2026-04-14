import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { statement } = await request.json()

  const { data: commitment } = await supabase
    .from('commitments')
    .select('id, status, title')
    .eq('id', id).eq('user_id', user.id).single()

  if (!commitment) return NextResponse.json({ error: 'Commitment not found.' }, { status: 404 })
  if (commitment.status !== 'launch') return NextResponse.json({ error: 'Commitment is not in launch status.' }, { status: 400 })

  const now = new Date()
  const streakEndsAt = new Date(now)
  streakEndsAt.setUTCDate(streakEndsAt.getUTCDate() + 90)

  // Flip to active, set streak_starts_at to now
  const { error } = await supabase
    .from('commitments')
    .update({
      status: 'active',
      streak_starts_at: now.toISOString(),
      streak_ends_at: streakEndsAt.toISOString(),
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: 'Failed to start commitment.' }, { status: 500 })

  // Log the ritual statement as the first session post
  if (statement?.trim()) {
    await supabase.from('commitment_posts').insert({
      commitment_id: id,
      user_id: user.id,
      body: statement.trim(),
      session_number: 0,
      posted_at: now.toISOString(),
    })
  }

  return NextResponse.json({ ok: true })
}
