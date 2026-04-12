import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: commitment, error } = await supabase
    .from('commitments')
    .select(`
      id, title, description, frequency, sessions_per_week,
      status, launch_starts_at, launch_ends_at,
      streak_starts_at, streak_ends_at, completed_at,
      sessions_logged, created_at,
      practices (id, name, label, skill_categories(name))
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !commitment) {
    return NextResponse.json({ error: 'Commitment not found.' }, { status: 404 })
  }

  const { data: posts } = await supabase
    .from('commitment_posts')
    .select('id, body, session_number, posted_at')
    .eq('commitment_id', id)
    .order('posted_at', { ascending: false })

  return NextResponse.json({ commitment, posts: posts ?? [] })
}
