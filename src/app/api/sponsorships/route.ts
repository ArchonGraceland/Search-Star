import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getStripe, pledgeDollarsToCents } from '@/lib/stripe'
import { randomBytes } from 'crypto'

// GET — fetch public commitment data for the sponsor page (no auth)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const commitment_id = searchParams.get('commitment_id')

  if (!commitment_id) {
    return NextResponse.json({ error: 'commitment_id is required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  type CommitmentRow = {
    id: string
    status: string
    started_at: string
    user_id: string
    practices: { name: string } | { name: string }[] | null
  }
  const { data: commitment, error } = await supabase
    .from('commitments')
    .select(`
      id, status, started_at, user_id,
      practices (name)
    `)
    .eq('id', commitment_id)
    .single<CommitmentRow>()

  if (error || !commitment) {
    return NextResponse.json({ error: 'Commitment not found.' }, { status: 404 })
  }

  // Get practitioner name
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, user_id')
    .eq('user_id', commitment.user_id)
    .single()

  // Get pledge stats
  const { data: pledges } = await supabase
    .from('sponsorships')
    .select('pledge_amount')
    .eq('commitment_id', commitment_id)
    .in('status', ['pledged', 'paid'])

  const total_pledged = (pledges ?? []).reduce((sum, p) => sum + (p.pledge_amount ?? 0), 0)
  const pledge_count = (pledges ?? []).length

  const practice = commitment.practices
  const practice_name = practice
    ? (Array.isArray(practice) ? practice[0]?.name : practice.name) ?? null
    : null

  // v4: streak_ends_at computed from started_at + 90d. launch_ends_at retired.
  const streakEndsAt = commitment.started_at
    ? new Date(new Date(commitment.started_at).getTime() + 90 * 24 * 60 * 60 * 1000).toISOString()
    : null

  return NextResponse.json({
    commitment_id: commitment.id,
    title: practice_name, // practice name IS the commitment statement
    status: commitment.status,
    launch_ends_at: null, // retired
    streak_ends_at: streakEndsAt,
    practitioner_name: profile?.display_name ?? 'the practitioner',
    practice_name,
    total_pledged,
    pledge_count,
  })
}

// POST — record a sponsorship pledge.
//
// v4 Decision #8: sponsors are room members. Every pledge requires:
//   1. An invite_token referencing a pending sponsor_invitation.
//   2. An authenticated caller (the invitee has signed up/in).
//
// The anonymous-pledge path (POST without invite_token, sponsor_email +
// sponsor_name supplied in body) is retired. There is no discovery
// surface for sponsorship; every sponsor arrives by invitation from an
// existing room member. The 410 Gone response for tokenless POSTs is
// the honest signal that this path no longer exists.
//
// Side effects on a successful pledge:
//   - Stripe Customer + PaymentIntent (capture_method='manual') created.
//   - sponsorships row inserted with sponsor_user_id = auth.uid().
//   - room_memberships row inserted (or ignored on conflict) tying the
//     sponsor to the room the commitment lives in, with state='active'.
//     This is what lets the sponsor see the room, post sponsor_message,
//     and affirm session-marked messages.
//   - sponsor_invitations row flipped to 'accepted'.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const { commitment_id, pledge_amount, message, invite_token } = body as {
    commitment_id?: string
    pledge_amount?: number
    message?: string
    invite_token?: string
  }

  if (!invite_token || typeof invite_token !== 'string') {
    return NextResponse.json(
      {
        error:
          'Sponsorship requires an invitation. Anonymous pledging is no longer supported — ask the practitioner to invite you from their room.',
      },
      { status: 410 }
    )
  }

  if (!commitment_id || !pledge_amount) {
    return NextResponse.json(
      { error: 'commitment_id and pledge_amount are required.' },
      { status: 400 }
    )
  }

  if (typeof pledge_amount !== 'number' || pledge_amount < 5) {
    return NextResponse.json({ error: 'Minimum pledge amount is $5.' }, { status: 400 })
  }

  // Authenticate the caller. The invite-accept flow on the client must
  // route the visitor through sign-in/sign-up before submitting here.
  const ssr = await createClient()
  const {
    data: { user },
  } = await ssr.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'You must be signed in to complete a pledge.' },
      { status: 401 }
    )
  }

  const supabase = createServiceClient()

  // Resolve the invitation and enforce single-use + email match.
  const { data: invitation } = await supabase
    .from('sponsor_invitations')
    .select('id, commitment_id, invitee_email, status')
    .eq('invite_token', invite_token)
    .maybeSingle()

  if (!invitation) {
    return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 })
  }
  if (invitation.status !== 'pending') {
    return NextResponse.json(
      { error: 'This invitation has already been used.' },
      { status: 409 }
    )
  }
  if (invitation.commitment_id !== commitment_id) {
    return NextResponse.json(
      { error: 'Invitation does not match this commitment.' },
      { status: 409 }
    )
  }

  // The invitation was sent to a specific email. The authenticated user
  // must match. Without this check, anyone with the invite_token could
  // redeem it on their own account. Email comparison is case-insensitive.
  const authEmail = user.email?.trim().toLowerCase()
  const inviteEmail = invitation.invitee_email?.trim().toLowerCase()
  if (!authEmail || !inviteEmail || authEmail !== inviteEmail) {
    return NextResponse.json(
      {
        error:
          'This invitation was sent to a different email address than the one you signed in with.',
      },
      { status: 403 }
    )
  }

  // Load commitment. Sponsors cannot back their own commitment; catch that
  // before Stripe fires.
  type CommitmentPOSTRow = {
    id: string
    status: string
    user_id: string
    room_id: string
    practices: { name: string } | { name: string }[] | null
  }
  const { data: commitment, error: commError } = await supabase
    .from('commitments')
    .select('id, status, user_id, room_id, practices(name)')
    .eq('id', commitment_id)
    .single<CommitmentPOSTRow>()

  if (commError || !commitment) {
    return NextResponse.json({ error: 'Commitment not found.' }, { status: 404 })
  }

  if (commitment.status !== 'active') {
    return NextResponse.json(
      { error: 'This commitment is no longer accepting pledges.' },
      { status: 409 }
    )
  }

  if (commitment.user_id === user.id) {
    return NextResponse.json(
      { error: 'You cannot sponsor your own commitment.' },
      { status: 409 }
    )
  }

  // Display name for the Stripe Customer description. Prefer the
  // profile's display_name; fall back to the email local-part so Stripe
  // has something human-readable even for users who haven't set a name.
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('user_id', user.id)
    .maybeSingle()
  const sponsorName =
    profile?.display_name?.trim() || authEmail.split('@')[0] || 'Sponsor'

  const practiceForDesc = Array.isArray(commitment.practices)
    ? commitment.practices[0]?.name ?? 'a practice'
    : commitment.practices?.name ?? 'a practice'

  // Generate a URL-safe access token. The release/veto email flow
  // (/api/sponsorships/[id]/action) still uses this to authenticate a
  // sponsor clicking through from their inbox without requiring a live
  // browser session. Replacing that flow with authenticated release is
  // deferred to a later commit.
  const accessToken = randomBytes(24).toString('base64url')

  // Create Stripe Customer + PaymentIntent. capture_method='manual'
  // authorizes funds without charging; setup_future_usage='off_session'
  // saves the method to the Customer so the day-90 donation PI can
  // reuse it without re-prompting.
  let paymentIntentId: string
  let clientSecret: string
  let stripeCustomerId: string
  try {
    const customer = await getStripe().customers.create({
      email: authEmail,
      name: sponsorName,
      metadata: {
        commitment_id,
        source: 'searchstar_pledge',
        sponsor_user_id: user.id,
      },
    })
    stripeCustomerId = customer.id

    const pi = await getStripe().paymentIntents.create({
      amount: pledgeDollarsToCents(pledge_amount),
      currency: 'usd',
      capture_method: 'manual',
      customer: stripeCustomerId,
      setup_future_usage: 'off_session',
      automatic_payment_methods: { enabled: true },
      metadata: {
        commitment_id,
        intent_type: 'pledge',
        sponsor_user_id: user.id,
        sponsor_email: authEmail,
      },
      description: `Search Star pledge: ${practiceForDesc}`,
    })
    if (!pi.client_secret) {
      throw new Error('Stripe returned a PaymentIntent without a client_secret.')
    }
    paymentIntentId = pi.id
    clientSecret = pi.client_secret
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Stripe PaymentIntent creation failed'
    console.error('[sponsorships POST] Stripe PI creation failed:', msg)
    return NextResponse.json(
      { error: `Payment setup failed: ${msg}` },
      { status: 502 }
    )
  }

  // Insert sponsorship row.
  const { data: sponsorship, error: insertError } = await supabase
    .from('sponsorships')
    .insert({
      commitment_id,
      sponsor_user_id: user.id,
      sponsor_email: authEmail,
      sponsor_name: sponsorName,
      sponsor_type: 'personal',
      pledge_amount,
      status: 'pledged',
      pledged_at: new Date().toISOString(),
      access_token: accessToken,
      stripe_payment_intent_id: paymentIntentId,
      stripe_customer_id: stripeCustomerId,
      message: message ? String(message).trim().slice(0, 2000) : null,
    })
    .select('id')
    .single()

  if (insertError || !sponsorship) {
    console.error('[sponsorships POST] insert error:', insertError)
    // Best-effort cancel of the orphaned PaymentIntent.
    try {
      await getStripe().paymentIntents.cancel(paymentIntentId)
    } catch (cancelErr) {
      console.error('[sponsorships POST] failed to cancel orphaned PI:', cancelErr)
    }
    return NextResponse.json({ error: 'Failed to record pledge.' }, { status: 500 })
  }

  // Insert room membership. ON CONFLICT DO NOTHING handles the case
  // where the sponsor was already a room member (e.g., an existing
  // practitioner in the same room who's now also sponsoring someone).
  // Membership insert failure is logged but NOT fatal — the sponsorship
  // is already recorded, and a later repair job can reconcile. Without
  // the membership row the sponsor won't be able to see the room until
  // that repair runs, but they'll keep their pledge and Stripe hold.
  const { error: membershipError } = await supabase
    .from('room_memberships')
    .upsert(
      {
        room_id: commitment.room_id,
        user_id: user.id,
        state: 'active',
      },
      { onConflict: 'room_id,user_id', ignoreDuplicates: true }
    )

  if (membershipError) {
    console.error(
      '[sponsorships POST] room_memberships insert failed — sponsor pledged but not in room:',
      membershipError
    )
    // Do not return an error to the client; the pledge succeeded. A
    // human can reconcile from logs if needed.
  }

  // Mark the invitation accepted. Non-fatal.
  try {
    await supabase
      .from('sponsor_invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', invitation.id)
  } catch (err) {
    console.error('[sponsorships POST] failed to mark invitation accepted:', err)
  }

  // Pledge and practitioner notification emails are dispatched from the
  // Stripe webhook's payment_intent.amount_capturable_updated branch,
  // which fires once the card has been genuinely authorized. Sending
  // from here would produce "pledge confirmed" emails for pledges the
  // sponsor then abandoned at the Stripe Elements step.

  return NextResponse.json({
    id: sponsorship.id,
    client_secret: clientSecret,
    room_id: commitment.room_id,
  })
}
