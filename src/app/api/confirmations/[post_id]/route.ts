import { createServiceClient } from '@/lib/supabase/server'
import { getResend } from '@/lib/resend'
import { NextResponse } from 'next/server'

const qualityLabels: Record<string, string> = {
  showed_up: 'showed up and did the work',
  pushed_further: 'pushed past where they were comfortable',
  breakthrough: 'had a breakthrough',
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ post_id: string }> }
) {
  const { post_id } = await params
  const db = createServiceClient()

  const body = await request.json()
  const { validator_id, quality_choice, witness_note, private_message } = body

  if (!validator_id || !quality_choice || !witness_note) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  // Verify the post exists and get commitment_id
  const { data: post } = await db
    .from('commitment_posts')
    .select('id, commitment_id, session_number, user_id')
    .eq('id', post_id)
    .single()

  if (!post) {
    return NextResponse.json({ error: 'Post not found.' }, { status: 404 })
  }

  // Verify validator is active for this commitment
  const { data: validator } = await db
    .from('validators')
    .select('id, status, validator_email')
    .eq('id', validator_id)
    .eq('commitment_id', post.commitment_id)
    .single()

  if (!validator || validator.status === 'declined') {
    return NextResponse.json({ error: 'Not authorized to confirm this post.' }, { status: 403 })
  }

  // Upsert confirmation (one per validator per post)
  const { data: confirmation, error: confirmError } = await db
    .from('post_confirmations')
    .upsert({
      post_id,
      validator_id,
      quality_choice,
      witness_note: witness_note.trim(),
      private_message: private_message?.trim() || null,
      confirmed_at: new Date().toISOString(),
    }, {
      onConflict: 'post_id,validator_id',
    })
    .select('id')
    .single()

  if (confirmError) {
    console.error('Confirmation error:', confirmError)
    return NextResponse.json({ error: 'Failed to record confirmation.' }, { status: 500 })
  }

  // Increment sessions_logged on commitment if this is the first confirmation of this post
  const { count } = await db
    .from('post_confirmations')
    .select('id', { count: 'exact', head: true })
    .eq('post_id', post_id)

  if ((count ?? 0) <= 1) {
    const { data: comm } = await db
      .from('commitments')
      .select('sessions_logged')
      .eq('id', post.commitment_id)
      .single()

    if (comm) {
      await db
        .from('commitments')
        .update({ sessions_logged: (comm.sessions_logged ?? 0) + 1 })
        .eq('id', post.commitment_id)
    }
  }

  // Send email to practitioner
  try {
    const { data: practitionerProfile } = await db
      .from('profiles')
      .select('display_name')
      .eq('user_id', post.user_id)
      .single()

    const { data: practitionerAuth } = await db.auth.admin.getUserById(post.user_id)
    const practitionerEmail = practitionerAuth?.user?.email

    const { data: validatorProfile } = await db
      .from('profiles')
      .select('display_name')
      .eq('user_id', validator_id)
      .maybeSingle()

    const { data: commitment } = await db
      .from('commitments')
      .select('title')
      .eq('id', post.commitment_id)
      .single()

    const validatorName = validatorProfile?.display_name ?? 'Your validator'
    const commitmentTitle = commitment?.title ?? 'your commitment'
    const sessionLabel = post.session_number > 0 ? `session ${post.session_number}` : 'your start ritual'
    const qualityLabel = qualityLabels[quality_choice] ?? quality_choice
    const notePreview = witness_note.trim().slice(0, 100) + (witness_note.trim().length > 100 ? '…' : '')

    if (practitionerEmail) {
      const resend = getResend()
      await resend.emails.send({
        from: 'noreply@searchstar.com',
        to: practitionerEmail,
        subject: `${validatorName} witnessed your ${commitmentTitle} session`,
        html: `
          <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
            <div style="background: #1a3a6b; padding: 20px 24px; margin-bottom: 32px;">
              <span style="font-family: Georgia, serif; font-size: 20px; font-weight: 700; color: #ffffff;">Search Star</span>
            </div>
            <div style="padding: 0 24px 32px;">
              <h2 style="font-family: Georgia, serif; font-size: 24px; font-weight: 700; color: #1a1a1a; margin: 0 0 8px;">
                ${validatorName} witnessed ${sessionLabel}
              </h2>
              <p style="font-family: Arial, sans-serif; font-size: 14px; color: #5a5a5a; margin: 0 0 20px;">
                ${commitmentTitle}
              </p>
              <div style="background: #f0fdf4; border-left: 3px solid #166534; padding: 14px 18px; margin: 0 0 16px; border-radius: 2px;">
                <p style="font-family: Arial, sans-serif; font-size: 13px; font-weight: 700; color: #166534; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.08em;">
                  ${validatorName} says you ${qualityLabel}
                </p>
              </div>
              <div style="background: #f5f5f5; padding: 16px 20px; margin: 0 0 24px; border-radius: 3px;">
                <p style="font-family: Georgia, serif; font-size: 16px; color: #1a1a1a; margin: 0; line-height: 1.6;">
                  "${notePreview}"
                </p>
              </div>
              <a href="https://searchstar.com/log" style="display: inline-block; background: #1a3a6b; color: #ffffff; font-family: Arial, sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 12px 24px; border-radius: 3px; text-decoration: none;">
                Read the full witness →
              </a>
              <p style="font-family: Arial, sans-serif; font-size: 12px; color: #b8b8b8; margin: 20px 0 0;">
                You're receiving this because someone witnessed your practice session on Search Star.
              </p>
            </div>
          </div>
        `,
        text: `${validatorName} witnessed ${sessionLabel} on "${commitmentTitle}".\n\nThey say you ${qualityLabel}.\n\n"${notePreview}"\n\nRead the full witness: https://searchstar.com/log`,
      })

      // Mark email sent
      await db
        .from('post_confirmations')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', confirmation.id)
    }
  } catch (emailError) {
    console.error('Failed to send practitioner notification:', emailError)
    // Don't fail the request
  }

  return NextResponse.json({ id: confirmation.id })
}
