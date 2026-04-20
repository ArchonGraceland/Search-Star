import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getResend } from '@/lib/resend'
import { randomBytes } from 'crypto'

// POST /api/rooms/[id]/invite
//
// Room-scoped sponsor invitation. The caller (the practitioner) invites
// someone by email to join the room as a sponsor of their active
// commitment. The invitation is framed at the room level in the copy —
// "Dave invites you into the room where he's committing to…" — but the
// underlying record is still a commitment-scoped sponsor_invitation,
// because every sponsorship in v4 is attached to a specific commitment.
//
// This endpoint exists so the room UI doesn't have to know or expose
// the commitment ID; callers send { invitee_email } and we resolve the
// commitment from the caller's active one in this room.
//
// Caller must be:
// - An active member of the room.
// - The practitioner of an active commitment in this room (you can
//   only invite sponsors for a commitment that is yours).
//
// The email flow and token generation mirror /api/sponsors/invite/route.ts.

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: roomId } = await params

  const ssr = await createClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { invitee_email } = body as { invitee_email?: string }

  if (!invitee_email || typeof invitee_email !== 'string') {
    return NextResponse.json({ error: 'invitee_email is required.' }, { status: 400 })
  }
  const cleanEmail = invitee_email.trim().toLowerCase()
  if (!cleanEmail.includes('@') || cleanEmail.length < 5) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 })
  }

  const db = createServiceClient()

  // Membership check.
  const { data: membership } = await db
    .from('room_memberships')
    .select('id, state')
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership || membership.state !== 'active') {
    return NextResponse.json({ error: 'Not a member of this room.' }, { status: 403 })
  }

  // Find the caller's active commitment in this room. In v4, a user
  // has at most one active commitment at a time; but we still scope to
  // the room so we can't accidentally attach an invite to a commitment
  // in a different room.
  type CommitmentRow = {
    id: string
    user_id: string
    practices: { name: string } | { name: string }[] | null
  }
  const { data: commitment } = await db
    .from('commitments')
    .select('id, user_id, practices(name)')
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<CommitmentRow>()

  if (!commitment) {
    return NextResponse.json(
      { error: 'You do not have an active commitment in this room to invite sponsors for.' },
      { status: 409 }
    )
  }

  // Practice name is the commitment statement (title column retired in v4).
  const practiceJoin = Array.isArray(commitment.practices)
    ? commitment.practices[0]
    : commitment.practices
  const commitmentTitle = practiceJoin?.name ?? 'their 90-day commitment'

  // De-dup pending invitations to the same email on this commitment.
  const { data: existing } = await db
    .from('sponsor_invitations')
    .select('id, status')
    .eq('commitment_id', commitment.id)
    .eq('invitee_email', cleanEmail)
    .eq('status', 'pending')
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'An invitation is already pending for that address.' },
      { status: 409 }
    )
  }

  // Practitioner display name for the email.
  const { data: profile } = await db
    .from('profiles')
    .select('display_name')
    .eq('user_id', user.id)
    .maybeSingle()
  const practitionerName = profile?.display_name ?? 'Someone'

  const inviteToken = randomBytes(24).toString('base64url')

  const { data: invitation, error: insertErr } = await db
    .from('sponsor_invitations')
    .insert({
      commitment_id: commitment.id,
      inviter_user_id: user.id,
      invitee_email: cleanEmail,
      invite_token: inviteToken,
      status: 'pending',
    })
    .select('id, invite_token')
    .single()

  if (insertErr || !invitation) {
    console.error('[rooms/invite] insert error:', insertErr)
    return NextResponse.json({ error: 'Failed to create invitation.' }, { status: 500 })
  }

  const pledgeUrl = `https://www.searchstar.com/sponsor/invited/${invitation.invite_token}`

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
              On Search Star, a sponsor is a witness. You pledge now, watch the practice unfold in a small private room, and release payment at day 90 when the commitment is complete.
            </p>
            <div style="background: #f5f5f5; border-left: 3px solid #1a3a6b; padding: 16px 20px; margin: 0 0 24px; border-radius: 2px;">
              <p style="font-family: Georgia, serif; font-size: 18px; font-weight: 700; margin: 0; color: #1a1a1a;">${commitmentTitle}</p>
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
      text: `${practitionerName} has invited you to sponsor their 90-day commitment: "${commitmentTitle}".\n\nReview and pledge: ${pledgeUrl}\n\nNo payment is required today. Funds are only collected when they reach day 90 and you release your pledge.`,
    })
  } catch (err) {
    console.error('[rooms/invite] email failed:', err)
  }

  return NextResponse.json({
    id: invitation.id,
    invite_token: invitation.invite_token,
    pledge_url: pledgeUrl,
  })
}
