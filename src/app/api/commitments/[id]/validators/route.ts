import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getResend } from '@/lib/resend'

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

  // Verify commitment belongs to user
  const { data: commitment } = await supabase
    .from('commitments')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!commitment) {
    return NextResponse.json({ error: 'Commitment not found.' }, { status: 404 })
  }

  const { data: validators } = await supabase
    .from('validators')
    .select('id, validator_email, status, invited_at')
    .eq('commitment_id', id)
    .order('invited_at', { ascending: true })

  return NextResponse.json({ validators: validators ?? [] })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify commitment belongs to user
  const { data: commitment, error: commitmentError } = await supabase
    .from('commitments')
    .select('id, title, user_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (commitmentError || !commitment) {
    return NextResponse.json({ error: 'Commitment not found.' }, { status: 404 })
  }

  const body = await request.json()
  const { email } = body

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 })
  }

  const normalizedEmail = email.trim().toLowerCase()

  // Check validator count
  const { count } = await supabase
    .from('validators')
    .select('id', { count: 'exact', head: true })
    .eq('commitment_id', id)

  if ((count ?? 0) >= 3) {
    return NextResponse.json({ error: 'Validator limit reached (3/3).' }, { status: 400 })
  }

  // Check for duplicate
  const { data: existing } = await supabase
    .from('validators')
    .select('id')
    .eq('commitment_id', id)
    .eq('validator_email', normalizedEmail)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'This email has already been invited.' }, { status: 409 })
  }

  // Get practitioner display name
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('user_id', user.id)
    .single()

  const displayName = profile?.display_name ?? 'Someone'

  // Insert validator row
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: validator, error: insertError } = await supabase
    .from('validators')
    .insert({
      commitment_id: id,
      validator_email: normalizedEmail,
      status: 'invited',
      invite_expires_at: expiresAt,
      invited_at: new Date().toISOString(),
    })
    .select('id, invite_token')
    .single()

  if (insertError || !validator) {
    console.error('Error inserting validator:', insertError)
    return NextResponse.json({ error: 'Failed to create invitation.' }, { status: 500 })
  }

  const acceptUrl = `https://searchstar.com/api/validate/accept?token=${validator.invite_token}`

  // Send invite email
  try {
    await getResend().emails.send({
      from: 'noreply@searchstar.com',
      to: normalizedEmail,
      subject: `${displayName} invited you to validate their commitment on Search Star`,
      html: `
        <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
          <div style="background: #1a3a6b; padding: 20px 24px; margin-bottom: 32px;">
            <span style="font-family: Georgia, serif; font-size: 20px; font-weight: 700; color: #ffffff;">Search Star</span>
          </div>
          <div style="padding: 0 24px 32px;">
            <h2 style="font-family: Georgia, serif; font-size: 24px; font-weight: 700; color: #1a1a1a; margin: 0 0 16px;">
              ${displayName} invited you to be a validator
            </h2>
            <p style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #3a3a3a; margin: 0 0 12px;">
              <strong>${displayName}</strong> has started a 90-day commitment on Search Star:
            </p>
            <div style="background: #f5f5f5; border-left: 3px solid #1a3a6b; padding: 16px 20px; margin: 0 0 24px; border-radius: 2px;">
              <p style="font-family: Georgia, serif; font-size: 18px; font-weight: 700; margin: 0; color: #1a1a1a;">${commitment.title}</p>
            </div>
            <p style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #3a3a3a; margin: 0 0 24px;">
              As a validator, you'll see their session logs and can confirm sessions as genuine. You don't need a Search Star account — just click the link below to accept.
            </p>
            <a href="${acceptUrl}" style="display: inline-block; background: #1a3a6b; color: #ffffff; font-family: Arial, sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 12px 24px; border-radius: 3px; text-decoration: none;">
              Accept Validator Invitation →
            </a>
            <p style="font-family: Arial, sans-serif; font-size: 12px; color: #b8b8b8; margin: 24px 0 0;">
              This link expires in 7 days. If you weren't expecting this email, you can ignore it.
            </p>
          </div>
        </div>
      `,
      text: `${displayName} invited you to validate their commitment on Search Star.\n\nCommitment: ${commitment.title}\n\nAs a validator, you'll see their session logs and can confirm sessions as genuine. You don't need a Search Star account.\n\nAccept your invitation: ${acceptUrl}\n\nThis link expires in 7 days.`,
    })
  } catch (emailError) {
    console.error('Failed to send invite email:', emailError)
    // Don't fail the request — validator row is created, email can be resent
  }

  return NextResponse.json({ id: validator.id })
}
