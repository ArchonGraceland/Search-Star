import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getResend } from '@/lib/resend'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const db = createServiceClient()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify the commitment belongs to the authenticated user
  const { data: commitment, error: commitmentError } = await supabase
    .from('commitments')
    .select('id, status, sessions_logged, streak_starts_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (commitmentError || !commitment) {
    return NextResponse.json({ error: 'Commitment not found.' }, { status: 404 })
  }

  const body = await request.json()
  const { body: postBody } = body

  const newSessionsLogged = (commitment.sessions_logged ?? 0) + 1

  // Insert the post
  const { data: post, error: postError } = await supabase
    .from('commitment_posts')
    .insert({
      commitment_id: id,
      user_id: user.id,
      body: postBody?.trim() || null,
      session_number: newSessionsLogged,
      posted_at: new Date().toISOString(),
    })
    .select('id, session_number')
    .single()

  if (postError) {
    console.error('Error creating post:', postError)
    return NextResponse.json({ error: 'Failed to log session.' }, { status: 500 })
  }

  // Determine whether to advance status from launch → active
  const now = new Date()
  const streakStartsAt = commitment.streak_starts_at ? new Date(commitment.streak_starts_at) : null
  const newStatus = (commitment.status === 'launch' && streakStartsAt && now >= streakStartsAt)
    ? 'active'
    : commitment.status

  // Update sessions_logged (and possibly status)
  await supabase
    .from('commitments')
    .update({
      sessions_logged: newSessionsLogged,
      ...(newStatus !== commitment.status ? { status: newStatus } : {}),
    })
    .eq('id', id)

  // Notify active validators by email
  try {
    const { data: validators } = await db
      .from('validators')
      .select('validator_email, invite_token')
      .eq('commitment_id', id)
      .eq('status', 'active')
      .not('validator_email', 'is', null)

    const { data: profile } = await db
      .from('profiles')
      .select('display_name')
      .eq('user_id', user.id)
      .single()

    const practitionerName = profile?.display_name ?? 'Your practitioner'

    const { data: commitmentForEmail } = await db
      .from('commitments')
      .select('title')
      .eq('id', id)
      .single()

    const commitmentTitle = commitmentForEmail?.title ?? 'their commitment'

    if (validators && validators.length > 0) {
      const resend = getResend()
      await Promise.all(validators.map(v => {
        const validateUrl = `https://searchstar.com/validate/${id}/${v.invite_token}`
        return resend.emails.send({
          from: 'noreply@searchstar.com',
          to: v.validator_email!,
          subject: `${practitionerName} logged session ${newSessionsLogged} — ${commitmentTitle}`,
          html: `
            <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
              <div style="background: #1a3a6b; padding: 20px 24px; margin-bottom: 32px;">
                <span style="font-family: Georgia, serif; font-size: 20px; font-weight: 700; color: #ffffff;">Search Star</span>
              </div>
              <div style="padding: 0 24px 32px;">
                <h2 style="font-family: Georgia, serif; font-size: 24px; font-weight: 700; color: #1a1a1a; margin: 0 0 8px;">
                  Session ${newSessionsLogged} logged
                </h2>
                <p style="font-family: Arial, sans-serif; font-size: 14px; color: #5a5a5a; margin: 0 0 20px;">
                  <strong>${practitionerName}</strong> · ${commitmentTitle}
                </p>
                ${postBody?.trim() ? `
                <div style="background: #f5f5f5; border-left: 3px solid #1a3a6b; padding: 16px 20px; margin: 0 0 24px; border-radius: 2px;">
                  <p style="font-family: Georgia, serif; font-size: 16px; color: #1a1a1a; margin: 0; line-height: 1.6;">
                    "${postBody.trim()}"
                  </p>
                </div>` : ''}
                <a href="${validateUrl}" style="display: inline-block; background: #1a3a6b; color: #ffffff; font-family: Arial, sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 12px 24px; border-radius: 3px; text-decoration: none;">
                  Confirm this session →
                </a>
                <p style="font-family: Arial, sans-serif; font-size: 12px; color: #b8b8b8; margin: 20px 0 0;">
                  You're receiving this because you're a validator for this commitment.
                </p>
              </div>
            </div>
          `,
          text: `${practitionerName} logged session ${newSessionsLogged} on "${commitmentTitle}".${postBody?.trim() ? `\n\n"${postBody.trim()}"` : ''}\n\nConfirm this session: ${validateUrl}`,
        })
      }))
    }
  } catch (emailError) {
    console.error('Failed to send validator notifications:', emailError)
    // Don't fail the request — session is logged, email is best-effort
  }

  return NextResponse.json({ id: post.id, session_number: post.session_number })
}
