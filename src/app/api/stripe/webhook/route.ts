import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/server'
import { getResend } from '@/lib/resend'

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
        // Funds are authorized and held. This event is Stripe's honest signal
        // that the sponsor's card actually cleared authorization — before
        // this point the sponsorship row exists but the money isn't yet
        // committed.
        //
        // Phase 5.1: this is where the two pledge-confirmation emails fire
        // (sponsor "your pledge was recorded" and practitioner "new sponsor
        // pledge"). Previously they went out from POST /api/sponsorships,
        // which fired them before the card was authorized — so an abandoned
        // Elements step produced a confirmation email for a pledge that
        // never landed. The webhook is the correct trigger.
        const pi = event.data.object as Stripe.PaymentIntent
        console.log(
          `[stripe] amount_capturable_updated pi=${pi.id} amount=${pi.amount} capturable=${pi.amount_capturable}`
        )

        // Only the pledge PI fires these emails. Donation PIs use the
        // off-session Customer from release and don't need confirmation
        // emails.
        const intentType = (pi.metadata?.intent_type ?? 'pledge') as string
        if (intentType !== 'pledge') break

        const { data: sponsorship } = await db
          .from('sponsorships')
          .select(
            'id, commitment_id, sponsor_email, sponsor_name, pledge_amount, access_token, message, pledged_notified_at',
          )
          .eq('stripe_payment_intent_id', pi.id)
          .maybeSingle()

        if (!sponsorship) {
          console.warn(
            `[stripe] amount_capturable_updated for pi=${pi.id} but no sponsorship row found`
          )
          break
        }

        // Replay guard: this event can refire (Stripe retries, dashboard
        // resends, etc). Once pledged_notified_at is set, don't re-email.
        if (sponsorship.pledged_notified_at) {
          console.log(
            `[stripe] amount_capturable_updated for pi=${pi.id} replayed; emails already sent at ${sponsorship.pledged_notified_at}`
          )
          break
        }

        // Look up commitment + practitioner display info for email bodies.
        type CommitmentStripeRow = {
          id: string
          user_id: string
          practices: { name: string } | { name: string }[] | null
        }
        const { data: commitment } = await db
          .from('commitments')
          .select('id, user_id, practices(name)')
          .eq('id', sponsorship.commitment_id)
          .maybeSingle<CommitmentStripeRow>()

        if (!commitment) {
          console.error(
            `[stripe] amount_capturable_updated pi=${pi.id} sponsorship ${sponsorship.id} references missing commitment ${sponsorship.commitment_id}`
          )
          break
        }

        const { data: profile } = await db
          .from('profiles')
          .select('display_name')
          .eq('user_id', commitment.user_id)
          .maybeSingle()
        const practitionerName = profile?.display_name ?? 'the practitioner'

        const { data: authUser } = await db.auth.admin.getUserById(commitment.user_id)
        const practitionerEmail = authUser?.user?.email

        const pledgeAmount = Number(sponsorship.pledge_amount ?? 0)
        const sponsorFeedUrl = `https://www.searchstar.com/sponsor/${commitment.id}/${sponsorship.access_token}`
        const sponsorEmail = sponsorship.sponsor_email
        const sponsorName = sponsorship.sponsor_name ?? 'A sponsor'
        // v4: practice name serves as the commitment title (title column retired)
        const practiceJoin = Array.isArray(commitment.practices)
          ? commitment.practices[0]
          : commitment.practices
        const commitmentTitle = practiceJoin?.name ?? 'their commitment'
        const sponsorMessage = sponsorship.message

        // Sponsor confirmation email — copied verbatim (minus template
        // variables) from what used to live in POST /api/sponsorships.
        if (sponsorEmail) {
          try {
            await getResend().emails.send({
              from: 'noreply@searchstar.com',
              to: sponsorEmail,
              subject: `Your pledge to support ${practitionerName} has been recorded`,
              html: `
                <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
                  <div style="background: #1a3a6b; padding: 20px 24px; margin-bottom: 32px;">
                    <span style="font-family: Georgia, serif; font-size: 20px; font-weight: 700; color: #ffffff;">Search Star</span>
                  </div>
                  <div style="padding: 0 24px 32px;">
                    <h2 style="font-family: Georgia, serif; font-size: 24px; font-weight: 700; color: #1a1a1a; margin: 0 0 16px;">
                      Your pledge has been recorded
                    </h2>
                    <p style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #3a3a3a; margin: 0 0 12px;">
                      Thank you for supporting <strong>${practitionerName}</strong> on their commitment:
                    </p>
                    <div style="background: #f5f5f5; border-left: 3px solid #1a3a6b; padding: 16px 20px; margin: 0 0 24px; border-radius: 2px;">
                      <p style="font-family: Georgia, serif; font-size: 18px; font-weight: 700; margin: 0 0 8px; color: #1a1a1a;">${commitmentTitle}</p>
                      <p style="font-family: Arial, sans-serif; font-size: 15px; color: #1a3a6b; font-weight: 700; margin: 0;">
                        Pledge amount: $${pledgeAmount.toFixed(2)}
                      </p>
                    </div>
                    <p style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #3a3a3a; margin: 0 0 20px;">
                      Follow along as ${practitionerName} works through their 90 days. The link below is yours &mdash; keep it private; it gives you read-only access to the practice feed.
                    </p>
                    <a href="${sponsorFeedUrl}" style="display: inline-block; background: #1a3a6b; color: #ffffff; font-family: Arial, sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 12px 24px; border-radius: 3px; text-decoration: none; margin-bottom: 24px;">
                      Follow the practice &rarr;
                    </a>
                    <p style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #767676; margin: 0;">
                      Your pledge is recorded now. Funds are collected when ${practitionerName} completes their 90-day commitment. If they don&rsquo;t complete it, no payment is collected.
                    </p>
                  </div>
                </div>
              `,
              text: `Your pledge of $${pledgeAmount.toFixed(2)} to support ${practitionerName}'s commitment "${commitmentTitle}" has been recorded.\n\nFollow the practice: ${sponsorFeedUrl}\n\nFunds are collected when they complete their 90-day commitment.`,
            })
          } catch (err) {
            console.error(
              `[stripe] failed to send sponsor confirmation email for sponsorship ${sponsorship.id}:`,
              err instanceof Error ? err.message : err
            )
          }
        }

        // Practitioner notification email.
        if (practitionerEmail) {
          try {
            await getResend().emails.send({
              from: 'noreply@searchstar.com',
              to: practitionerEmail,
              subject: `${sponsorName} pledged $${pledgeAmount.toFixed(2)} to your commitment`,
              html: `
                <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
                  <div style="background: #1a3a6b; padding: 20px 24px; margin-bottom: 32px;">
                    <span style="font-family: Georgia, serif; font-size: 20px; font-weight: 700; color: #ffffff;">Search Star</span>
                  </div>
                  <div style="padding: 0 24px 32px;">
                    <h2 style="font-family: Georgia, serif; font-size: 24px; font-weight: 700; color: #1a1a1a; margin: 0 0 16px;">
                      New sponsor pledge
                    </h2>
                    <p style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #3a3a3a; margin: 0 0 12px;">
                      <strong>${sponsorName}</strong> has pledged <strong>$${pledgeAmount.toFixed(2)}</strong> to your commitment:
                    </p>
                    <div style="background: #f5f5f5; border-left: 3px solid #2d6a2d; padding: 16px 20px; margin: 0 0 24px; border-radius: 2px;">
                      <p style="font-family: Georgia, serif; font-size: 18px; font-weight: 700; margin: 0 0 8px; color: #1a1a1a;">${commitmentTitle}</p>
                      ${sponsorMessage ? `<p style="font-family: Arial, sans-serif; font-size: 14px; color: #3a3a3a; margin: 0; font-style: italic;">&ldquo;${sponsorMessage}&rdquo;</p>` : ''}
                    </div>
                    <a href="https://www.searchstar.com/commit/${commitment.id}/sponsors" style="display: inline-block; background: #1a3a6b; color: #ffffff; font-family: Arial, sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 12px 24px; border-radius: 3px; text-decoration: none;">
                      View all sponsors &rarr;
                    </a>
                  </div>
                </div>
              `,
              text: `${sponsorName} pledged $${pledgeAmount.toFixed(2)} to your commitment "${commitmentTitle}". View sponsors: https://www.searchstar.com/commit/${commitment.id}/sponsors`,
            })
          } catch (err) {
            console.error(
              `[stripe] failed to send practitioner notification email for sponsorship ${sponsorship.id}:`,
              err instanceof Error ? err.message : err
            )
          }
        }

        // Mark as notified so a replay of this event doesn't re-send. A
        // failure of this update is not fatal — the emails already went
        // out; the worst case is a duplicate set on replay, which is
        // preferable to blocking Stripe's retry on a transient DB error.
        const { error: notifyErr } = await db
          .from('sponsorships')
          .update({ pledged_notified_at: new Date().toISOString() })
          .eq('id', sponsorship.id)
        if (notifyErr) {
          console.error(
            `[stripe] failed to set pledged_notified_at for sponsorship ${sponsorship.id}:`,
            notifyErr
          )
        }
        break
      }

      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent
        const intentType = (pi.metadata?.intent_type ?? 'pledge') as string

        if (intentType === 'donation') {
          // Advance the donations row pending → succeeded. The row is
          // already inserted synchronously in the release action route;
          // this webhook is the async confirmation that the off-session
          // charge actually cleared. If no row is found, we log and move
          // on — could be a manual test charge or an admin reconciliation
          // of a row that didn't persist at release time.
          const { data: donation } = await db
            .from('donations')
            .select('id, status')
            .eq('stripe_payment_intent_id', pi.id)
            .maybeSingle()

          if (!donation) {
            console.warn(
              `[stripe] donation succeeded for pi=${pi.id} but no donations row found`
            )
            break
          }

          if (donation.status === 'succeeded') {
            // Replay — no-op.
            break
          }

          const { error: donationUpdateErr } = await db
            .from('donations')
            .update({ status: 'succeeded' })
            .eq('id', donation.id)
          if (donationUpdateErr) {
            console.error(
              `[stripe] failed to mark donation ${donation.id} succeeded:`,
              donationUpdateErr
            )
          }
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
        const intentType = (pi.metadata?.intent_type ?? 'pledge') as string

        if (intentType === 'donation') {
          const { data: donation } = await db
            .from('donations')
            .select('id, status')
            .eq('stripe_payment_intent_id', pi.id)
            .maybeSingle()
          if (donation && donation.status !== 'canceled' && donation.status !== 'succeeded') {
            const { error: donationUpdateErr } = await db
              .from('donations')
              .update({ status: 'canceled' })
              .eq('id', donation.id)
            if (donationUpdateErr) {
              console.error(
                `[stripe] failed to mark donation ${donation.id} canceled:`,
                donationUpdateErr
              )
            }
          }
          break
        }

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
        const intentType = (pi.metadata?.intent_type ?? 'pledge') as string
        const lastError = pi.last_payment_error?.message ?? 'unknown'

        if (intentType === 'donation') {
          console.warn(`[stripe] donation payment_failed pi=${pi.id} error=${lastError}`)
          const { data: donation } = await db
            .from('donations')
            .select('id, status')
            .eq('stripe_payment_intent_id', pi.id)
            .maybeSingle()
          if (donation && donation.status === 'pending') {
            const { error: donationUpdateErr } = await db
              .from('donations')
              .update({ status: 'failed' })
              .eq('id', donation.id)
            if (donationUpdateErr) {
              console.error(
                `[stripe] failed to mark donation ${donation.id} failed:`,
                donationUpdateErr
              )
            }
          }
          break
        }

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
