import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { commitment_id, body: postBody, media_urls = [] } = body

  if (!commitment_id) {
    return NextResponse.json({ error: 'commitment_id is required' }, { status: 400 })
  }

  // Fetch the commitment and verify ownership
  const { data: commitment, error: fetchError } = await supabase
    .from('commitments')
    .select('*')
    .eq('id', commitment_id)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !commitment) {
    return NextResponse.json({ error: 'Commitment not found' }, { status: 404 })
  }

  const newLoggedDays = (commitment.logged_days || 0) + 1
  const newStreak = (commitment.current_streak || 0) + 1
  const newLongest = Math.max(commitment.longest_streak || 0, newStreak)
  const isMilestone = [10, 20, 30, 40].includes(newLoggedDays)

  // Determine new status
  let newStatus = commitment.status
  if (newLoggedDays >= 40 && commitment.status === 'active') {
    newStatus = 'ongoing'
  }

  // Insert post
  const { data: post, error: postError } = await supabase
    .from('commitment_posts')
    .insert({
      commitment_id,
      user_id: user.id,
      body: postBody || null,
      media_urls,
      day_number: newLoggedDays,
      is_milestone: isMilestone,
    })
    .select()
    .single()

  if (postError) return NextResponse.json({ error: postError.message }, { status: 500 })

  // Update commitment stats
  const { error: updateError } = await supabase
    .from('commitments')
    .update({
      logged_days: newLoggedDays,
      current_streak: newStreak,
      longest_streak: newLongest,
      status: newStatus,
    })
    .eq('id', commitment_id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({
    post,
    logged_days: newLoggedDays,
    current_streak: newStreak,
    status: newStatus,
    is_milestone: isMilestone,
  })
}
