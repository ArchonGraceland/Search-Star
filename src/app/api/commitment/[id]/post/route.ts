import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { body: postBody, media_urls = [] } = body

  if (!postBody?.trim() && !media_urls.length) {
    return NextResponse.json({ error: 'Post must have content' }, { status: 400 })
  }

  // Verify ownership
  const { data: commitment, error: fetchError } = await supabase
    .from('commitments')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !commitment) {
    return NextResponse.json({ error: 'Commitment not found' }, { status: 404 })
  }

  if (commitment.status === 'restart_eligible') {
    return NextResponse.json({ error: 'Restart this commitment before posting' }, { status: 400 })
  }

  const newLoggedDays = (commitment.logged_days || 0) + 1
  const newStreak = (commitment.current_streak || 0) + 1
  const newLongest = Math.max(commitment.longest_streak || 0, newStreak)
  const isMilestone = [10, 20, 30, 40].includes(newLoggedDays)

  let newStatus = commitment.status
  if (newLoggedDays >= 40 && commitment.status === 'active') {
    newStatus = 'ongoing'
  }

  const { data: post, error: postError } = await supabase
    .from('commitment_posts')
    .insert({
      commitment_id: id,
      user_id: user.id,
      body: postBody?.trim() || null,
      media_urls,
      day_number: newLoggedDays,
      is_milestone: isMilestone,
    })
    .select()
    .single()

  if (postError) return NextResponse.json({ error: postError.message }, { status: 500 })

  await supabase
    .from('commitments')
    .update({
      logged_days: newLoggedDays,
      current_streak: newStreak,
      longest_streak: newLongest,
      status: newStatus,
    })
    .eq('id', id)

  return NextResponse.json({ post, logged_days: newLoggedDays, status: newStatus, is_milestone: isMilestone })
}
