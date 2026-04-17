import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getResend } from '@/lib/resend'
import { getStripe } from '@/lib/stripe'

// POST — sponsor releases or vetoes a pledge. Authentication is the sponsorship's
// access_token (sponsors don't have Search Star accounts).
//
// Body: { action: 'release' | 'veto', token: string, note?: string }
//
// Release: permitted only when the commitment has reached day 90 (now >= streak_ends_at)
// and status is still 'active'. Marks sponsorship.status = 'released'. When all
// remaining sponsorships on the commitment are released, flips the commitment to
// 'completed' with completed_at = now().
//
// Veto: permitted any time during 'active' status. Marks sponsorship.status = 'vetoed'
// and flips the commitment to 'abandoned'. Notifies practitioner and other sponsors.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const { action, token, note } = body as {
    action?: 'release' | 'veto'
    token?: string
    note?: string
  }

  if (!action || !['release', 'veto'].includes(action)) {
    return NextResponse.json({ error: 'action must be "release" or "veto".' }, { status: 400 })
  }

  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'token is required.' }, { status: 400 })
  }

  const db = createServiceClient()

  // Look up the sponsorship by id + access_token. Both must match.
  const { data: sponsorship, error: lookupErr } = await db
    .from('sponsorships')
    .select('id, commitment_id, status, sponsor_name, sponsor_email, pledge_amount, stripe_payment_intent_id')
    .eq('id', id)
    .eq('access_token', token)
    .maybeSingle()

  if (lookupErr || !sponsorship) {
    return NextResponse.json({ error: 'Sponsorship not found.' }, { status: 404 })
  }

  // Idempotency: if already released or vetoed, return the current state without
  // re-applying. This guards against double-submits from the UI.
  if (sponsorship.status === 'released' || sponsorship.status === 'vetoed') {
    return NextResponse.json({
      already: true,
      status: sponsorship.status,
    })
  }

  if (sponsorship.status !== 'pledged') {
    return NextResponse.json(
      { error: `Sponsorship is in status "${sponsorship.status}" and cannot be acted on.` },
      { status: 409 }
    )
  }

  // Load the commitment to check timing and status.
  const { data: commitment } = await db
    .from('commitments')
    .select('id, title, status, user_id, streak_ends_at')
    .eq('id', sponsorship.commitment_id)
    .single()

  if (!commitment) {
    return NextResponse.json({ error: 'Commitment not found.' }, { status: 404 })
  }

  const now = new Date()

  if (action === 'release') {
    // Release guard: only when commitment is active and day 90 has arrived.
    if (commitment.status !== 'active') {
      return NextResponse.json(
        { error: 'This commitment is not currently active.' },
        { status: 409 }
      )
    }
    if (!commitment.streak_ends_at || new Date(commitment.streak_ends_at) > now) {
      return NextResponse.json(
        { error: 'The streak has not reached day 90 yet.' },
        { status: 409 }
      )
    }

    // Capture the held PaymentIntent before recording the release. Pledges
    // made prior to Stripe wiring have stripe_payment_intent_id = NULL —
    // those are pre-Stripe rows and the release is a pure DB transition
    // with no money movement. For Stripe-backed rows, the capture must
    // succeed before we transition the row; a failed capture means the
    // funds are not moving and the release has not occurred.
    if (sponsorship.stripe_payment_intent_id) {
      try {
        await getStripe().paymentIntents.capture(sponsorship.stripe_payment_intent_id)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Stripe capture failed'
        console.error(
          `Stripe capture failed for sponsorship ${id} (pi=${sponsorship.stripe_payment_intent_id}):`,
          message
        )
        return NextResponse.json(
          { error: `Payment capture failed: ${message}` },
          { status: 502 }
        )
      }
    }

    const { error: updateErr } = await db
      .from('sponsorships')
      .update({
        status: 'released',
        released_at: now.toISOString(),
      })
      .eq('id', id)

    if (updateErr) {
      console.error('Release update failed:', updateErr)
      return NextResponse.json({ error: 'Failed to record release.' }, { status: 500 })
    }

    // If all remaining pledged sponsorships are now released, complete the commitment.
    const { data: outstanding } = await db
      .from('sponsorships')
      .select('id, status')
      .eq('commitment_id', commitment.id)
      .in('status', ['pledged'])

    if (!outstanding || outstanding.length === 0) {
      await db
        .from('commitments')
        .update({
          status: 'completed',
          completed_at: now.toISOString(),
        })
        .eq('id', commitment.id)
    }

    return NextResponse.json({ ok: true, action: 'release' })
  }

  // Veto branch — any time during 'active' status.
  if (commitment.status !== 'active') {
    return NextResponse.json(
      { error: 'This commitment is not currently active.' },
      { status: 409 }
    )
  }

  // Cancel the held PaymentIntent. Unlike capture-on-release, a failed
  // cancel is non-fatal: we want veto to be forgiving and we still want
  // to record the sponsor's stated intent in the DB. A stranded PI can
  // be cleaned up manually from the Stripe dashboard if needed.
  if (sponsorship.stripe_payment_intent_id) {
    try {
      await getStripe().paymentIntents.cancel(sponsorship.stripe_payment_intent_id, {
        cancellation_reason: 'requested_by_customer',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Stripe cancel failed'
      console.error(
        `Stripe cancel failed for sponsorship ${id} (pi=${sponsorship.stripe_payment_intent_id}):`,
        message,
        '— continuing with DB veto anyway'
      )
    }
  }

  const { error: vetoErr } = await db
    .from('sponsorships')
    .update({
      status: 'vetoed',
      vetoed_at: now.toISOString(),
      veto_reason: note?.trim() || null,
    })
    .eq('id', id)

  if (vetoErr) {
    console.error('Veto update failed:', vetoErr)
    return NextResponse.json({ error: 'Failed to record veto.' }, { status: 500 })
  }

  // Flip the commitment to abandoned per the no-escape-hatch principle.
  await db
    .from('commitments')
    .update({
      status: 'abandoned',
      completed_at: null,
    })
    .eq('id', commitment.id)

  // Notify practitioner and the other still-pledged sponsors.
  try {
    const { data: practitionerAuth } = await db.auth.admin.getUserById(commitment.user_id)
    const practitionerEmail = practitionerAuth?.user?.email
    const { data: practitionerProfile } = await db
      .from('profiles')
      .select('display_name')
      .eq('user_id', commitment.user_id)
      .single()
    const practitionerName = practitionerProfile?.display_name ?? 'the practitioner'

    if (practitionerEmail) {
      await getResend().emails.send({
        from: 'noreply@searchstar.com',
        to: practitionerEmail,
        subject: `A sponsor has vetoed your commitment`,
        html: `
          <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
            <div style="background: #1a3a6b; padding: 20px 24px; margin-bottom: 32px;">
              <span style="font-family: Georgia, serif; font-size: 20px; font-weight: 700; color: #ffffff;">Search Star</span>
            </div>
            <div style="padding: 0 24px 32px;">
              <h2 style="font-family: Georgia, serif; font-size: 24px; font-weight: 700; color: #1a1a1a; margin: 0 0 16px;">
                Your commitment has ended
              </h2>
              <p style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.65; color: #3a3a3a; margin: 0 0 16px;">
                <strong>${sponsorship.sponsor_name}</strong> has vetoed your commitment <em>&ldquo;${commitment.title}&rdquo;</em>. Per the no-escape-hatch principle, any single sponsor veto ends the streak. No payment has been taken from any sponsor.
              </p>
              ${note?.trim() ? `<div style="background: #f5f5f5; border-left: 3px solid #991b1b; padding: 14px 18px; margin: 0 0 20px; border-radius: 2px;"><p style="font-family: Arial, sans-serif; font-size: 13px; color: #3a3a3a; margin: 0; font-style: italic;">&ldquo;${note.trim()}&rdquo;</p></div>` : ''}
              <p style="font-family: Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #767676; margin: 0;">
                You can start a new commitment whenever you&rsquo;re ready.
              </p>
            </div>
          </div>
        `,
        text: `${sponsorship.sponsor_name} has vetoed your commitment "${commitment.title}". Any single sponsor veto ends the streak. No payment has been taken.${note?.trim() ? `\n\nReason: "${note.trim()}"` : ''}`,
      })
    }

    // Notify other still-pledged sponsors (not the one who just vetoed).
    const { data: otherSponsors } = await db
      .from('sponsorships')
      .select('sponsor_email, sponsor_name')
      .eq('commitment_id', commitment.id)
      .eq('status', 'pledged')
      .neq('id', id)

    for (const other of otherSponsors ?? []) {
      if (!other.sponsor_email) continue
      try {
        await getResend().emails.send({
          from: 'noreply@searchstar.com',
          to: other.sponsor_email,
          subject: `The commitment you sponsored has ended`,
          html: `
            <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
              <div style="background: #1a3a6b; padding: 20px 24px; margin-bottom: 32px;">
                <span style="font-family: Georgia, serif; font-size: 20px; font-weight: 700; color: #ffffff;">Search Star</span>
              </div>
              <div style="padding: 0 24px 32px;">
                <h2 style="font-family: Georgia, serif; font-size: 24px; font-weight: 700; color: #1a1a1a; margin: 0 0 16px;">
                  The commitment has ended
                </h2>
                <p style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.65; color: #3a3a3a; margin: 0 0 16px;">
                  Another sponsor of <em>&ldquo;${commitment.title}&rdquo;</em> by ${practitionerName} has vetoed, ending the commitment. On Search Star, any single sponsor veto ends the streak. No payment has been taken from your pledge.
                </p>
                <p style="font-family: Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #767676; margin: 0;">
                  Thank you for being willing to witness.
                </p>
              </div>
            </div>
          `,
          text: `Another sponsor of "${commitment.title}" by ${practitionerName} has vetoed, ending the commitment. No payment has been taken from your pledge.`,
        })
      } catch (err) {
        console.error('Failed to notify sponsor of veto:', err)
      }
    }
  } catch (err) {
    console.error('Veto notifications failed:', err)
  }

  return NextResponse.json({ ok: true, action: 'veto' })
}
