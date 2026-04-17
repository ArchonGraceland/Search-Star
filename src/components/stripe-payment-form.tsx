'use client'

import { useState } from 'react'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'

// Load Stripe once at module scope. loadStripe is idempotent and memoised
// internally by the SDK, but keeping the Promise at module scope means the
// network round-trip to m.stripejs.com happens a single time per page load
// regardless of how many <StripePaymentForm>s render.
const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
let stripePromise: Promise<Stripe | null> | null = null
function getStripePromise() {
  if (stripePromise) return stripePromise
  if (!publishableKey) {
    console.error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set')
    return Promise.resolve(null)
  }
  stripePromise = loadStripe(publishableKey)
  return stripePromise
}

interface StripePaymentFormProps {
  clientSecret: string
  amount: number
  onSuccess: () => void
}

// Inner form — must be a child of <Elements> so the Stripe hooks resolve.
function InnerForm({ amount, onSuccess }: { amount: number; onSuccess: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault()
    if (!stripe || !elements) return

    setSubmitting(true)
    setError(null)

    // confirmPayment with redirect: 'if_required' keeps the user on-page for
    // card flows that don't need 3DS redirection; methods that do require a
    // redirect (iDEAL, some 3DS flows) will bounce out and come back via
    // return_url, so we still pass a sensible return_url for that case.
    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}${window.location.pathname}`,
      },
      redirect: 'if_required',
    })

    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed. Please try again.')
      setSubmitting(false)
      return
    }

    // With capture_method: 'manual' the expected terminal state after
    // confirm is 'requires_capture' — the card has been authorized and
    // funds are held, ready for the day-90 release to capture them.
    // 'succeeded' would also be acceptable (covers edge cases), as would
    // 'processing' for async methods. Anything else is a genuine failure.
    if (
      paymentIntent &&
      ['requires_capture', 'succeeded', 'processing'].includes(paymentIntent.status)
    ) {
      onSuccess()
      return
    }

    setError('Payment did not complete. Please try again or use a different card.')
    setSubmitting(false)
  }

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <PaymentElement />
      </div>

      {error && (
        <div style={{ marginBottom: '16px', padding: '10px 14px', background: '#fef2f2', borderLeft: '3px solid #991b1b', borderRadius: '3px' }}>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#991b1b', margin: 0 }}>{error}</p>
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!stripe || !elements || submitting}
        style={{
          width: '100%',
          background: submitting || !stripe ? '#8a9fc0' : '#1a3a6b',
          color: '#fff',
          fontFamily: 'Roboto, sans-serif',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          padding: '13px 20px',
          borderRadius: '3px',
          border: 'none',
          cursor: submitting || !stripe ? 'not-allowed' : 'pointer',
        }}
      >
        {submitting ? 'Processing…' : `Authorize $${amount.toFixed(2)}`}
      </button>

      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', color: '#b8b8b8', marginTop: '14px', marginBottom: 0, lineHeight: '1.5', textAlign: 'center' }}>
        Your card is authorized now. Funds are held and only charged at day 90 when you release payment. If the commitment is vetoed or abandoned, the authorization is cancelled and nothing is charged.
      </p>
    </div>
  )
}

export default function StripePaymentForm({ clientSecret, amount, onSuccess }: StripePaymentFormProps) {
  const stripePromise = getStripePromise()

  if (!publishableKey) {
    return (
      <div style={{ padding: '16px', background: '#fef2f2', borderLeft: '3px solid #991b1b', borderRadius: '3px' }}>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#991b1b', margin: 0 }}>
          Payment is temporarily unavailable. Please try again shortly.
        </p>
      </div>
    )
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#1a3a6b',
            colorText: '#1a1a1a',
            colorDanger: '#991b1b',
            fontFamily: 'Roboto, sans-serif',
            borderRadius: '3px',
          },
        },
      }}
    >
      <InnerForm amount={amount} onSuccess={onSuccess} />
    </Elements>
  )
}
