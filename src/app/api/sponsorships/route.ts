import { createServiceClient } from '@/lib/supabase/server'
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

// POST — record a sponsorship pledge (no auth required)
export async function POST(request: Request) {
  const body = await request.json()
  const { commitment_id, sponsor_email, sponsor_name, pledge_amount, message, invite_token } = body

  if (!commitment_id || !sponsor_email || !sponsor_name || !pledge_amount) {
    return NextResponse.json({ error: 'commitment_id, sponsor_email, sponsor_name, and pledge_amount are required.' }, { status: 400 })
  }

  if (typeof pledge_amount !== 'number' || pledge_amount < 5) {
    return NextResponse.json({ error: 'Minimum pledge amount is $5.' }, { status: 400 })
  }

  if (!sponsor_email.includes('@')) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // If an invite_token was supplied, resolve the invitation and enforce single-use.
  // This is the branch used by /sponsor/invited/[invite_token]; the original
  // /sponsor/[id] flow does not send invite_token and continues to work unchanged.
  let invitationId: string | null = null
  if (invite_token && typeof invite_token === 'string') {
    const { data: invitation } = await supabase
      .from('sponsor_invitations')
      .select('id, commitment_id, invitee_email, status')
      .eq('invite_token', invite_token)
      .maybeSingle()

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 })
    }
    if (invitation.status !== 'pending') {
      return NextResponse.json({ error: 'This invitation has already been used.' }, { status: 409 })
    }
    if (invitation.commitment_id !== commitment_id) {
      return NextResponse.json({ error: 'Invitation does not match this commitment.' }, { status: 409 })
    }
    invitationId = invitation.id
  }

  // Fetch commitment and verify it's accepting pledges. v4 Decision #8: the
  // 'launch' status is retired; only 'active' commitments accept pledges
  // (any point between day 1 and day 90, per decision #3).
  type CommitmentPOSTRow = {
    id: string
    status: string
    user_id: string
    practices: { name: string } | { name: string }[] | null
  }
  const { data: commitment, error: commError } = await supabase
    .from('commitments')
    .select('id, status, user_id, practices(name)')
    .eq('id', commitment_id)
    .single<CommitmentPOSTRow>()

  if (commError || !commitment) {
    return NextResponse.json({ error: 'Commitment not found.' }, { status: 404 })
  }

  if (commitment.status !== 'active') {
    return NextResponse.json({ error: 'This commitment is no longer accepting pledges.' }, { status: 409 })
  }

  const practiceForDesc = Array.isArray(commitment.practices)
    ? commitment.practices[0]?.name ?? 'a practice'
    : commitment.practices?.name ?? 'a practice'

  // Generate a URL-safe access token. The sponsor uses this to follow the practice
  // at /sponsor/[commitment_id]/[token] without needing a Search Star account.
  const accessToken = randomBytes(24).toString('base64url')

  // Create a Stripe Customer first so the payment method attached to the
  // pledge PI can be reused at release time to charge the optional Search
  // Star donation off-session — no card re-entry. Customer creation is
  // cheap and idempotent-ish (a fresh Customer per sponsorship is fine;
  // we're not trying to unify sponsors across multiple pledges).
  //
  // Then create the PaymentIntent. capture_method: 'manual' authorizes and
  // holds funds without charging — release captures; veto cancels. Setting
  // setup_future_usage: 'off_session' saves the payment method to the
  // Customer on authorization, enabling the donation reuse at Phase 5
  // release time. If Stripe errors here we return 502 and do NOT insert
  // anything, so failed pledges leave no DB artefact.
  let paymentIntentId: string
  let clientSecret: string
  let stripeCustomerId: string
  try {
    const customer = await getStripe().customers.create({
      email: sponsor_email.trim().toLowerCase(),
      name: sponsor_name.trim(),
      metadata: {
        commitment_id,
        source: 'searchstar_pledge',
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
        sponsor_email: sponsor_email.trim().toLowerCase(),
      },
      description: `Search Star pledge: ${practiceForDesc}`,
    })
    if (!pi.client_secret) {
      throw new Error('Stripe returned a PaymentIntent without a client_secret.')
    }
    paymentIntentId = pi.id
    clientSecret = pi.client_secret
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stripe PaymentIntent creation failed'
    console.error('Failed to create Stripe PaymentIntent:', message)
    return NextResponse.json(
      { error: `Payment setup failed: ${message}` },
      { status: 502 }
    )
  }

  // Insert sponsorship — now that Stripe has confirmed the PI exists.
  const { data: sponsorship, error: insertError } = await supabase
    .from('sponsorships')
    .insert({
      commitment_id,
      sponsor_email: sponsor_email.trim().toLowerCase(),
      sponsor_name: sponsor_name.trim(),
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
    console.error('Error inserting sponsorship:', insertError)
    // Best-effort cancel of the orphaned PaymentIntent so we don't leave
    // dangling holds in Stripe when our DB write fails.
    try {
      await getStripe().paymentIntents.cancel(paymentIntentId)
    } catch (cancelErr) {
      console.error('Failed to cancel orphaned PaymentIntent:', cancelErr)
    }
    return NextResponse.json({ error: 'Failed to record pledge.' }, { status: 500 })
  }

  // If this pledge resolved an invitation, mark it accepted. Non-fatal on failure.
  if (invitationId) {
    try {
      await supabase
        .from('sponsor_invitations')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', invitationId)
    } catch (err) {
      console.error('Failed to mark invitation accepted:', err)
    }
  }

  // Pledge and practitioner notification emails are NOT sent from here.
  // They are dispatched from the Stripe webhook's
  // payment_intent.amount_capturable_updated branch — which only fires once
  // the sponsor's card has been genuinely authorized (funds are held,
  // ready to capture at release).
  //
  // Rationale: at this point in the flow the sponsorship row is inserted
  // but the card may not yet have been authorized. If we emailed here and
  // the sponsor then abandoned the Stripe Elements step, we'd have a
  // "pledge confirmed!" email sitting in their inbox for a pledge that
  // never actually landed. The webhook is the honest signal.

  return NextResponse.json({ id: sponsorship.id, client_secret: clientSecret })
}
