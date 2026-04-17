import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getResend } from '@/lib/resend'
import { randomBytes } from 'crypto'

// POST — practitioner invites a sponsor by email. Creates a sponsor_invitations
// row with an opaque token. Sends invitation email via Resend. Callable during
// commitment status 'launch' or 'active'. The invitee clicks through to
// /sponsor/invited/[invite_token] which pre-fills their pledge.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { commitment_id, invitee_email } = body as {
    commitment_id?: string
    invitee_email?: string
  }

  if (!commitment_id || !invitee_email) {
    return NextResponse.json(
      { error: 'commitment_id and invitee_email are required.' },
      { status: 400 }
    )
  }

  const cleanEmail = invitee_email.trim().toLowerCase()
  if (!cleanEmail.includes('@') || cleanEmail.length < 5) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 })
  }

  const db = createServiceClient()

  // Verify commitment exists, belongs to the user, and is in an invitable status.
  const { data: commitment, error: commErr } = await db
    .from('commitments')
    .select('id, title, status, user_id')
    .eq('id', commitment_id)
    .eq('user_id', user.id)
    .single()

  if (commErr || !commitment) {
    return NextResponse.json({ error: 'Commitment not found.' }, { status: 404 })
  }

  if (!['launch', 'active'].includes(commitment.status)) {
    return NextResponse.json(
      { error: 'Invitations can only be sent during launch or active status.' },
      { status: 409 }
    )
  }

  // Prevent duplicate pending invitations to the same email for the same commitment.
  const { data: existing } = await db
    .from('sponsor_invitations')
    .select('id, status')
    .eq('commitment_id', commitment_id)
    .eq('invitee_email', cleanEmail)
    .eq('status', 'pending')
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'An invitation is already pending for that address.' },
      { status: 409 }
    )
  }

  // Look up the practitioner's display name for the email copy.
  const { data: profile } = await db
    .from('profiles')
    .select('display_name')
    .eq('user_id', user.id)
    .single()
  const practitionerName = profile?.display_name ?? 'Someone'

  // Mint the opaque invite token. 24 bytes → 32 url-safe chars, collision-resistant.
  const inviteToken = randomBytes(24).toString('base64url')

  const { data: invitation, error: insertErr } = await db
    .from('sponsor_invitations')
    .insert({
      commitment_id,
      inviter_user_id: user.id,
      invitee_email: cleanEmail,
      invite_token: inviteToken,
      status: 'pending',
    })
    .select('id, invite_token')
    .single()

  if (insertErr || !invitation) {
    console.error('Error creating sponsor invitation:', insertErr)
    return NextResponse.json({ error: 'Failed to create invitation.' }, { status: 500 })
  }

  const pledgeUrl = `https://www.searchstar.com/sponsor/invited/${invitation.invite_token}`

  // Send the invitation email. Failures are logged but do not roll back the row —
  // the practitioner can copy the pledge link directly from the invite list.
  try {
    await getResend().emails.send({
      from: 'noreply@searchstar.com',
      to: cleanEmail,
      subject: `${practitionerName} is inviting you to sponsor their 90-day commitment`,
      html: `
        <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
          <div style="background: #1a3a6b; padding: 20px 24px; margin-bottom: 32px;">
            <span style="font-family: Georgia, serif; font-size: 20px; font-weight: 700; color: #ffffff;">Search Star</span>
          </div>
          <div style="padding: 0 24px 32px;">
            <h2 style="font-family: Georgia, serif; font-size: 24px; font-weight: 700; color: #1a1a1a; margin: 0 0 16px;">
              ${practitionerName} has invited you to sponsor their 90 days
            </h2>
            <p style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.65; color: #3a3a3a; margin: 0 0 16px;">
              On Search Star, a sponsor is a witness. You pledge now, watch the practice unfold on a private feed, and release payment at day 90 when the commitment is complete.
            </p>
            <div style="background: #f5f5f5; border-left: 3px solid #1a3a6b; padding: 16px 20px; margin: 0 0 24px; border-radius: 2px;">
              <p style="font-family: Georgia, serif; font-size: 18px; font-weight: 700; margin: 0; color: #1a1a1a;">${commitment.title}</p>
            </div>
            <a href="${pledgeUrl}" style="display: inline-block; background: #1a3a6b; color: #ffffff; font-family: Arial, sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 12px 24px; border-radius: 3px; text-decoration: none; margin-bottom: 24px;">
              Review and pledge →
            </a>
            <p style="font-family: Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #767676; margin: 0;">
              No payment is required today. Funds are only collected when ${practitionerName} reaches day 90 and you release your pledge. If you ever believe the practice isn&rsquo;t genuine, you can veto at any time and no payment is taken.
            </p>
          </div>
        </div>
      `,
      text: `${practitionerName} has invited you to sponsor their 90-day commitment: "${commitment.title}".\n\nReview and pledge: ${pledgeUrl}\n\nNo payment is required today. Funds are only collected when they reach day 90 and you release your pledge.`,
    })
  } catch (err) {
    console.error('Failed to send sponsor invitation email:', err)
  }

  return NextResponse.json({
    id: invitation.id,
    invite_token: invitation.invite_token,
    pledge_url: pledgeUrl,
  })
}

// GET — list pending and processed invitations for a commitment (practitioner only).
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const commitment_id = searchParams.get('commitment_id')

  if (!commitment_id) {
    return NextResponse.json({ error: 'commitment_id is required' }, { status: 400 })
  }

  const db = createServiceClient()

  // Verify ownership first.
  const { data: commitment } = await db
    .from('commitments')
    .select('id, user_id')
    .eq('id', commitment_id)
    .eq('user_id', user.id)
    .single()

  if (!commitment) {
    return NextResponse.json({ error: 'Commitment not found.' }, { status: 404 })
  }

  const { data: invitations } = await db
    .from('sponsor_invitations')
    .select('id, invitee_email, status, sent_at, accepted_at, declined_at')
    .eq('commitment_id', commitment_id)
    .order('sent_at', { ascending: false })

  return NextResponse.json({ invitations: invitations ?? [] })
}
