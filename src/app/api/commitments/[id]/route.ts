import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// v4 commitment detail GET. The title/description/frequency/launch_*/streak_*
// columns are all retired (see 20260420_v4_rooms_and_messages). What remains:
// id, status, started_at, room_id, created_at, completed_at, target_payout_amount.
// The practice name substitutes for the old title. sessions_logged is computed
// from room_messages.is_session=true. posts come from room_messages scoped to
// this commitment with message_type='practitioner_post'.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ssr = await createClient()
  const { data: { user } } = await ssr.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const { data: commitment, error } = await supabase
    .from('commitments')
    .select(`
      id, status, started_at, completed_at, created_at,
      room_id, target_payout_amount,
      practices (id, name, label, skill_categories(name))
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !commitment) {
    return NextResponse.json({ error: 'Commitment not found.' }, { status: 404 })
  }

  const { data: posts } = await supabase
    .from('room_messages')
    .select('id, body, posted_at, is_session')
    .eq('commitment_id', id)
    .eq('message_type', 'practitioner_post')
    .order('posted_at', { ascending: false })

  // Compute sessions_logged as the count of is_session=true posts.
  const sessionsLogged = (posts ?? []).filter((p) => p.is_session).length

  return NextResponse.json({
    commitment: { ...commitment, sessions_logged: sessionsLogged },
    posts: posts ?? [],
  })
}
