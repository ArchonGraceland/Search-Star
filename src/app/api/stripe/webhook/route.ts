import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Stripe webhook handler. Verifies signature against STRIPE_WEBHOOK_SECRET,
// then reacts to a small set of PaymentIntent lifecycle events by advancing
// the corresponding sponsorship row. Transitions are forward-only.
//
// Phase 4a scope: log amount_capturable_updated and payment_failed; mark
// 'paid' on succeeded (capture completed at release); mark 'refunded' on
// canceled if the sponsorship is not already terminal.
//
// Phase 5 scope (future): donation succeeded/failed events will also land
// here and will be dispatched by inspecting metadata.intent_type.
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Webhook secret not configured.' }, { status: 500 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header.' }, { status: 400 })
  }

  // MUST use request.text() (not request.json()) — signature verification
  // runs against the raw body bytes.
  const rawBody = await request.text()

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown signature error'
    console.error('Stripe webhook signature verification failed:', message)
    return NextResponse.json({ error: `Signature verification failed: ${message}` }, { status: 400 })
  }

  const db = createServiceClient()

  try {
    switch (event.type) {
      case 'payment_intent.amount_capturable_updated': {
        // Funds are authorized and held. The sponsorship row is already
        // 'pledged' at this point from the POST /api/sponsorships flow.
        // Phase 4b may promote the row here; for now, log only.
        const pi = event.data.object as Stripe.PaymentIntent
        console.log(
          `[stripe] amount_capturable_updated pi=${pi.id} amount=${pi.amount} capturable=${pi.amount_capturable}`
        )
        break
      }

      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent
        const intentType = (pi.metadata?.intent_type ?? 'pledge') as string

        if (intentType === 'donation') {
          // Phase 5 will handle donation capture completions here. For now,
          // log — no donation rows are being created in Phase 4a.
          console.log(`[stripe] donation succeeded pi=${pi.id} amount=${pi.amount}`)
          break
        }

        // Pledge capture completed — sponsor released at day 90. Mark the
        // sponsorship 'paid' only if it's currently 'released' (the
        // practitioner-facing transition is driven by the release action
        // route; this webhook confirms the money actually landed).
        const { data: sponsorship } = await db
          .from('sponsorships')
          .select('id, status')
          .eq('stripe_payment_intent_id', pi.id)
          .maybeSingle()

        if (!sponsorship) {
          console.warn(`[stripe] succeeded for pi=${pi.id} but no sponsorship row found`)
          break
        }

        // Forward-only: only advance from 'released' to 'paid'. If the row
        // is already 'paid', this is a replay — no-op. Any other status is
        // unexpected and we log but don't regress.
        if (sponsorship.status === 'released') {
          const { error: updateErr } = await db
            .from('sponsorships')
            .update({ status: 'paid', paid_at: new Date().toISOString() })
            .eq('id', sponsorship.id)
          if (updateErr) {
            console.error(`[stripe] failed to mark sponsorship ${sponsorship.id} paid:`, updateErr)
          }
        } else if (sponsorship.status !== 'paid') {
          console.warn(
            `[stripe] succeeded for pi=${pi.id} but sponsorship status is "${sponsorship.status}"; not advancing`
          )
        }
        break
      }

      case 'payment_intent.canceled': {
        const pi = event.data.object as Stripe.PaymentIntent
        const { data: sponsorship } = await db
          .from('sponsorships')
          .select('id, status')
          .eq('stripe_payment_intent_id', pi.id)
          .maybeSingle()

        if (!sponsorship) {
          console.log(`[stripe] canceled for pi=${pi.id} — no matching sponsorship (likely test)`)
          break
        }

        // If the row is already terminal (paid, released, refunded, vetoed)
        // don't regress. Only flip to 'refunded' from non-terminal states.
        const terminal = ['paid', 'refunded', 'vetoed']
        if (terminal.includes(sponsorship.status)) {
          console.log(
            `[stripe] canceled for pi=${pi.id} but sponsorship ${sponsorship.id} is already "${sponsorship.status}"`
          )
          break
        }

        const { error: updateErr } = await db
          .from('sponsorships')
          .update({ status: 'refunded' })
          .eq('id', sponsorship.id)
        if (updateErr) {
          console.error(`[stripe] failed to mark sponsorship ${sponsorship.id} refunded:`, updateErr)
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent
        const lastError = pi.last_payment_error?.message ?? 'unknown'
        console.warn(`[stripe] payment_failed pi=${pi.id} error=${lastError}`)
        // Phase 4b may surface this to the sponsor pledge UI. No DB change now.
        break
      }

      default: {
        // Unhandled events are fine — Stripe will not retry 200 responses.
        console.log(`[stripe] unhandled event type: ${event.type}`)
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    // Return 500 so Stripe retries the webhook.
    const message = err instanceof Error ? err.message : 'Unknown handler error'
    console.error('[stripe] webhook handler error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
