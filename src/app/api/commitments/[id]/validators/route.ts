import { createClient } from '@/lib/supabase/server'
import { getResend } from '@/lib/resend'
import { NextResponse } from 'next/server'

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
  const { data: commitment, error: commitErr } = await supabase
    .from('commitments')
    .select('id, title, user_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (commitErr || !commitment) {
    return NextResponse.json({ error: 'Commitment not found.' }, { status: 404 })
  }

  const body = await request.json()
  const { email } = body

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 })
  }

  const normalizedEmail = email.trim().toLowerCase()

  // Check validator limit
  const { count } = await supabase
    .from('validators')
    .select('id', { count: 'exact', head: true })
    .eq('commitment_id', id)

  if ((count ?? 0) >= 3) {
    return NextResponse.json({ error: 'Validator limit reached (3/3).' }, { status: 400 })
  }

  // Check not already invited
  const { data: existing } = await supabase
    .from('validators')
    .select('id')
    .eq('commitment_id', id)
    .eq('validator_email', normalizedEmail)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'This email has already been invited.' }, { status: 409 })
  }

  // Fetch practitioner display name
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('user_id', user.id)
    .single()

  const displayName = profile?.display_name ?? 'Someone'

  // Generate expires_at = now + 7 days
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  // Insert validator row
  const { data: validator, error: insertErr } = await supabase
    .from('validators')
    .insert({
      commitment_id: id,
      validator_email: normalizedEmail,
      status: 'invited',
      invited_at: new Date().toISOString(),
      invite_expires_at: expiresAt,
    })
    .select('id, invite_token')
    .single()

  if (insertErr || !validator) {
    console.error('Error inserting validator:', insertErr)
    return NextResponse.json({ error: 'Failed to create invitation.' }, { status: 500 })
  }

  // Send invite email
  const acceptUrl = `https://searchstar.com/api/validate/accept?token=${validator.invite_token}`

  await getResend().emails.send({
    from: 'noreply@searchstar.com',
    to: normalizedEmail,
    subject: `${displayName} invited you to validate their commitment on Search Star`,
    html: `
      <div style="font-family: Roboto, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
        <div style="background: #1a3a6b; padding: 20px 28px; border-bottom: 3px solid #112a4f;">
          <span style="font-family: Georgia, serif; font-size: 22px; font-weight: 700; color: #fff;">Search Star</span>
        </div>
        <div style="padding: 32px 28px;">
          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
            <strong>${displayName}</strong> has invited you to validate their commitment on Search Star.
          </p>
          <p style="font-size: 15px; color: #3a3a3a; line-height: 1.6; margin-bottom: 8px;">
            <strong>Commitment:</strong> ${commitment.title}
          </p>
          <p style="font-size: 15px; color: #3a3a3a; line-height: 1.6; margin-bottom: 24px;">
            As a validator, you'll see their session logs and can confirm sessions as genuine. No account required.
          </p>
          <a href="${acceptUrl}" style="display: inline-block; background: #1a3a6b; color: #fff; font-family: Roboto, Arial, sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 0.04em; text-decoration: none; padding: 12px 24px; border-radius: 3px;">
            Accept invitation →
          </a>
          <p style="font-size: 12px; color: #999; margin-top: 32px; line-height: 1.5;">
            This invitation expires in 7 days. If you weren't expecting this, you can ignore this email.
          </p>
        </div>
      </div>
    `,
  })

  return NextResponse.json({ id: validator.id })
}

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
