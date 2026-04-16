import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getResend } from '@/lib/resend'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ post_id: string }> }
) {
  const { post_id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceClient()
  const body = await request.json()
  const { confirmation_id, acknowledgment_note } = body

  if (!confirmation_id || !acknowledgment_note?.trim()) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  // Verify the confirmation belongs to a post owned by the authenticated user
  const { data: confirmation } = await db
    .from('post_confirmations')
    .select('id, validator_id, post_id, commitment_posts(user_id, commitment_id)')
    .eq('id', confirmation_id)
    .eq('post_id', post_id)
    .single()

  if (!confirmation) {
    return NextResponse.json({ error: 'Confirmation not found.' }, { status: 404 })
  }

  const postOwner = (confirmation.commitment_posts as { user_id: string } | null)?.user_id
  if (postOwner !== user.id) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
  }

  // Insert acknowledgment
  const { data: ack, error: ackError } = await db
    .from('confirmation_acknowledgments')
    .insert({
      confirmation_id,
      practitioner_user_id: user.id,
      acknowledgment_note: acknowledgment_note.trim(),
    })
    .select('id')
    .single()

  if (ackError) {
    console.error('Acknowledgment error:', ackError)
    return NextResponse.json({ error: 'Failed to save acknowledgment.' }, { status: 500 })
  }

  // Send email to validator
  try {
    const { data: practitionerProfile } = await db
      .from('profiles')
      .select('display_name')
      .eq('user_id', user.id)
      .single()

    const { data: validator } = await db
      .from('validators')
      .select('validator_email, validator_user_id')
      .eq('id', confirmation.validator_id)
      .single()

    const practitionerName = practitionerProfile?.display_name ?? 'The practitioner'

    let validatorEmail = validator?.validator_email

    // If validator has an account, look up their email
    if (!validatorEmail && validator?.validator_user_id) {
      const { data: vAuth } = await db.auth.admin.getUserById(validator.validator_user_id)
      validatorEmail = vAuth?.user?.email ?? null
    }

    if (validatorEmail) {
      const resend = getResend()
      await resend.emails.send({
        from: 'noreply@searchstar.com',
        to: validatorEmail,
        subject: `${practitionerName} read your witness`,
        html: `
          <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
            <div style="background: #1a3a6b; padding: 20px 24px; margin-bottom: 32px;">
              <span style="font-family: Georgia, serif; font-size: 20px; font-weight: 700; color: #ffffff;">Search Star</span>
            </div>
            <div style="padding: 0 24px 32px;">
              <h2 style="font-family: Georgia, serif; font-size: 24px; font-weight: 700; color: #1a1a1a; margin: 0 0 16px;">
                ${practitionerName} read your witness
              </h2>
              <div style="background: #f5f5f5; border-left: 3px solid #1a3a6b; padding: 16px 20px; margin: 0 0 16px; border-radius: 2px;">
                <p style="font-family: Georgia, serif; font-size: 17px; color: #1a1a1a; margin: 0; line-height: 1.6;">
                  "${acknowledgment_note.trim()}"
                </p>
              </div>
              <p style="font-family: Arial, sans-serif; font-size: 13px; color: #5a5a5a; margin: 0;">
                — ${practitionerName}
              </p>
            </div>
          </div>
        `,
        text: `${practitionerName} read your witness and said:\n\n"${acknowledgment_note.trim()}"\n\n— ${practitionerName}`,
      })
    }
  } catch (emailError) {
    console.error('Failed to send acknowledgment email:', emailError)
  }

  return NextResponse.json({ id: ack.id })
}
