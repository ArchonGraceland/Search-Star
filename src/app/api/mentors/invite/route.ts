import { createClient } from '@/lib/supabase/server'
import { getResend } from '@/lib/resend'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { direction, mentor_email, mentee_email } = body

  if (!direction || !['request_mentor', 'invite_mentee'].includes(direction)) {
    return NextResponse.json({ error: 'direction must be request_mentor or invite_mentee.' }, { status: 400 })
  }

  const targetEmail: string = (direction === 'request_mentor' ? mentor_email : mentee_email) ?? ''
  if (!targetEmail) {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
  }

  // Resolve the target user_id via security-definer RPC
  const { data: targetUserId, error: rpcError } = await supabase
    .rpc('get_user_id_by_email', { p_email: targetEmail })

  if (rpcError || !targetUserId) {
    return NextResponse.json({ error: 'No Search Star account found for that email.' }, { status: 404 })
  }

  // Fetch target profile
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('user_id', targetUserId)
    .maybeSingle()

  if (!targetProfile) {
    return NextResponse.json({ error: 'No Search Star account found for that email.' }, { status: 404 })
  }

  // Fetch self profile
  const { data: selfProfile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('user_id', user.id)
    .single()

  const selfName = selfProfile?.display_name ?? 'A Search Star member'
  const targetName = targetProfile.display_name ?? 'there'

  const mentorId = direction === 'request_mentor' ? targetUserId : user.id
  const menteeId = direction === 'request_mentor' ? user.id : targetUserId

  // Insert relationship
  const { data: rel, error: insertError } = await supabase
    .from('mentor_relationships')
    .insert({
      mentor_user_id: mentorId,
      mentee_user_id: menteeId,
      status: 'active',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ error: 'A mentor relationship already exists between these users.' }, { status: 409 })
    }
    console.error('Error inserting mentor_relationship:', insertError)
    return NextResponse.json({ error: 'Failed to create mentor relationship.' }, { status: 500 })
  }

  // Send notification email
  const resend = getResend()
  if (direction === 'request_mentor') {
    await resend.emails.send({
      from: 'noreply@searchstar.com',
      to: targetEmail,
      subject: `${selfName} wants you as their mentor on Search Star`,
      html: `<p>Hi ${targetName},</p>
<p><strong>${selfName}</strong> has added you as their mentor on Search Star.</p>
<p>As their mentor, you will receive a share of any contributions they make when they complete a commitment. You can view their active commitments and recent session posts in your mentor dashboard.</p>
<p>Log in at <a href="https://searchstar.com/mentoring">searchstar.com/mentoring</a> to see your mentee cohort.</p>
<p>— The Search Star team</p>`,
    })
  } else {
    await resend.emails.send({
      from: 'noreply@searchstar.com',
      to: targetEmail,
      subject: `${selfName} has invited you to be part of their practice community`,
      html: `<p>Hi ${targetName},</p>
<p><strong>${selfName}</strong> has invited you to join their practice community on Search Star as a mentee.</p>
<p>On Search Star, mentors provide accountability and guidance as practitioners build commitments. When a practitioner completes a commitment and makes a contribution, a share of that contribution is routed to their mentor.</p>
<p>Log in at <a href="https://searchstar.com/mentors">searchstar.com/mentors</a> to view your mentor relationships.</p>
<p>— The Search Star team</p>`,
    })
  }

  return NextResponse.json({ id: rel.id })
}
