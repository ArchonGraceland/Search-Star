'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import PublicHeader from '@/components/public-header-static'
import StripePaymentForm from '@/components/stripe-payment-form'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

// /sponsor/invited/[invite_token]
//
// Landing surface for a sponsor clicking through an invitation email.
//
// Flow:
//   1. Page loads. We fetch invitation metadata (no auth required for the
//      lookup — just the token). If the invitation is not pending, show
//      an already-used or not-found panel.
//   2. Check the Supabase session. If logged out: show two CTAs
//      (sign in / sign up), both carry ?returnTo= pointing back here.
//   3. If logged in, show the streamlined pledge form — amount + optional
//      message. Name, email come from the profile/auth record, so the
//      user never retypes them.
//   4. POST /api/sponsorships with invite_token and pledge_amount. The
//      server auth-gates and does the insert + room membership.
//   5. On 200, mount StripePaymentForm with the returned client_secret.
//      On success, show the authorized panel with a link to the room.
//
// Decision #8: every sponsor is a room member. This page is the seam where
// a stranger with an email invite becomes a named account + room member.

interface InvitationData {
  invitation_id: string
  commitment_id: string
  commitment_title: string
  practitioner_name: string
  practice_name: string | null
  invitee_email: string
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  launch_ends_at: string | null
  streak_ends_at: string | null
  commitment_status: string
}

type Step = 'auth_gate' | 'details' | 'payment' | 'success'

export default function InvitedSponsorPage() {
  const params = useParams()
  const invite_token = params.invite_token as string
  const returnTo = `/sponsor/invited/${invite_token}`

  const [data, setData] = useState<InvitationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Auth state. `null` = unknown (still checking). The two defined states
  // are { email: string } when signed in and `false` when confirmed
  // signed out. We branch the UI off this.
  const [authState, setAuthState] = useState<{ email: string } | false | null>(null)

  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [step, setStep] = useState<Step>('auth_gate')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [pledgedAmount, setPledgedAmount] = useState<number>(0)
  const [roomId, setRoomId] = useState<string | null>(null)

  // Load the invitation metadata.
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `/api/sponsors/invite/lookup?invite_token=${encodeURIComponent(invite_token)}`
        )
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          setLoadError(json.error || 'Invitation not found.')
        } else {
          const json = await res.json()
          setData(json)
        }
      } catch {
        setLoadError('Could not load the invitation.')
      }
      setLoading(false)
    }
    load()
  }, [invite_token])

  // Check auth state independently of the invitation load.
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        setAuthState({ email: user.email })
      } else {
        setAuthState(false)
      }
    })
  }, [])

  // Once both the invitation and auth state are resolved, decide the
  // initial step. If the invitee is signed in, jump straight to details.
  useEffect(() => {
    if (!data || authState === null) return
    if (data.status !== 'pending') return
    if (
      data.commitment_status === 'completed' ||
      data.commitment_status === 'abandoned'
    ) return

    if (authState === false) {
      setStep('auth_gate')
    } else {
      // Signed in. We don't strictly enforce the email match client-side;
      // the server does that at POST time. The server's error message is
      // clear enough if there's a mismatch.
      setStep('details')
    }
  }, [data, authState])

  async function handleDetailsSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!data) return
    setError(null)
    setSubmitting(true)

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum < 5) {
      setError('Minimum pledge amount is $5.')
      setSubmitting(false)
      return
    }

    const res = await fetch('/api/sponsorships', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commitment_id: data.commitment_id,
        pledge_amount: amountNum,
        message: message.trim() || undefined,
        invite_token,
      }),
    })

    const json = await res.json()
    if (res.ok && json.client_secret) {
      setPledgedAmount(amountNum)
      setClientSecret(json.client_secret)
      setRoomId(json.room_id ?? null)
      setStep('payment')
    } else {
      setError(json.error || 'Failed to start the pledge.')
    }
    setSubmitting(false)
  }

  function handlePaymentSuccess() {
    setStep('success')
  }

  // ── Loading / error gates ───────────────────────────────────────────

  if (loading || authState === null) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <PublicHeader />
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 'calc(100vh - 70px)',
          }}
        >
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#767676' }}>
            Loading...
          </p>
        </div>
      </div>
    )
  }

  if (loadError || !data) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <PublicHeader />
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 'calc(100vh - 70px)',
            padding: '32px 16px',
          }}
        >
          <div
            style={{
              background: '#fff',
              border: '1px solid #d4d4d4',
              borderRadius: '3px',
              padding: '40px 48px',
              maxWidth: '480px',
              textAlign: 'center',
            }}
          >
            <h2
              style={{
                fontFamily: '"Crimson Text", Georgia, serif',
                fontSize: '26px',
                fontWeight: 700,
                margin: '0 0 12px',
              }}
            >
              Invitation not found
            </h2>
            <p
              style={{
                fontFamily: 'Roboto, sans-serif',
                fontSize: '14px',
                color: '#767676',
                lineHeight: '1.6',
                margin: 0,
              }}
            >
              {loadError ?? 'This invitation link is no longer valid.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (data.status === 'accepted') {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <PublicHeader />
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 'calc(100vh - 70px)',
            padding: '32px 16px',
          }}
        >
          <div
            style={{
              background: '#fff',
              border: '1px solid #d4d4d4',
              borderRadius: '3px',
              padding: '40px 48px',
              maxWidth: '480px',
              textAlign: 'center',
            }}
          >
            <h2
              style={{
                fontFamily: '"Crimson Text", Georgia, serif',
                fontSize: '26px',
                fontWeight: 700,
                margin: '0 0 12px',
              }}
            >
              Already pledged
            </h2>
            <p
              style={{
                fontFamily: 'Roboto, sans-serif',
                fontSize: '14px',
                color: '#767676',
                lineHeight: '1.6',
                margin: 0,
              }}
            >
              You&rsquo;ve already pledged on this invitation. Sign in to
              visit {data.practitioner_name}&rsquo;s room.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (data.commitment_status === 'completed' || data.commitment_status === 'abandoned') {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <PublicHeader />
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 'calc(100vh - 70px)',
            padding: '32px 16px',
          }}
        >
          <div
            style={{
              background: '#fff',
              border: '1px solid #d4d4d4',
              borderRadius: '3px',
              padding: '40px 48px',
              maxWidth: '480px',
              textAlign: 'center',
            }}
          >
            <h2
              style={{
                fontFamily: '"Crimson Text", Georgia, serif',
                fontSize: '26px',
                fontWeight: 700,
                margin: '0 0 12px',
              }}
            >
              Commitment closed
            </h2>
            <p
              style={{
                fontFamily: 'Roboto, sans-serif',
                fontSize: '14px',
                color: '#767676',
                lineHeight: '1.6',
                margin: 0,
              }}
            >
              This commitment is no longer accepting pledges.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Success panel ───────────────────────────────────────────────────

  if (step === 'success') {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <PublicHeader />
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 'calc(100vh - 70px)',
            padding: '32px 16px',
          }}
        >
          <div
            style={{
              background: '#fff',
              border: '1px solid #d4d4d4',
              borderLeft: '3px solid #2d6a2d',
              borderRadius: '3px',
              padding: '48px',
              maxWidth: '520px',
              textAlign: 'center',
            }}
          >
            <h2
              style={{
                fontFamily: '"Crimson Text", Georgia, serif',
                fontSize: '28px',
                fontWeight: 700,
                margin: '0 0 16px',
                color: '#1a1a1a',
              }}
            >
              Pledge authorized
            </h2>
            <p
              style={{
                fontFamily: 'Roboto, sans-serif',
                fontSize: '15px',
                color: '#3a3a3a',
                lineHeight: '1.6',
                margin: '0 0 20px',
              }}
            >
              Your pledge of <strong>${pledgedAmount.toFixed(2)}</strong> is held on your card.
              You&rsquo;re a member of {data.practitioner_name}&rsquo;s room.
            </p>
            {roomId && (
              <Link
                href={`/room/${roomId}`}
                style={{
                  display: 'inline-block',
                  background: '#1a3a6b',
                  color: '#fff',
                  fontFamily: 'Roboto, sans-serif',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  padding: '12px 28px',
                  borderRadius: '3px',
                  textDecoration: 'none',
                  marginBottom: '20px',
                }}
              >
                Go to the room →
              </Link>
            )}
            <p
              style={{
                fontFamily: 'Roboto, sans-serif',
                fontSize: '13px',
                color: '#767676',
                lineHeight: '1.6',
                margin: '16px 0 0',
              }}
            >
              Your card is charged only at day 90 when you release payment. If
              the commitment is vetoed or abandoned, the hold is cancelled and
              nothing is charged.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Auth gate (signed-out visitor) ──────────────────────────────────

  if (step === 'auth_gate') {
    const signInUrl = `/login?returnTo=${encodeURIComponent(returnTo)}`
    const signUpUrl = `/signup?returnTo=${encodeURIComponent(returnTo)}&email=${encodeURIComponent(
      data.invitee_email
    )}`
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <PublicHeader />
        <div style={{ maxWidth: '560px', margin: '0 auto', padding: '40px 24px' }}>
          <p
            style={{
              fontFamily: 'Roboto, sans-serif',
              fontSize: '11px',
              letterSpacing: '0.2em',
              color: '#767676',
              textTransform: 'uppercase',
              fontWeight: 700,
              marginBottom: '12px',
            }}
          >
            You&rsquo;ve been invited to sponsor
          </p>
          <h1
            style={{
              fontFamily: '"Crimson Text", Georgia, serif',
              fontSize: '32px',
              fontWeight: 700,
              margin: '0 0 8px',
              color: '#1a1a1a',
            }}
          >
            {data.commitment_title}
          </h1>
          <p
            style={{
              fontFamily: 'Roboto, sans-serif',
              fontSize: '14px',
              color: '#5a5a5a',
              marginBottom: '28px',
            }}
          >
            by <strong>{data.practitioner_name}</strong>
            {data.practice_name && (
              <span style={{ color: '#767676' }}> · {data.practice_name}</span>
            )}
          </p>

          <div
            style={{
              background: '#fff',
              border: '1px solid #d4d4d4',
              borderLeft: '3px solid #1a3a6b',
              borderRadius: '3px',
              padding: '28px 32px',
              marginBottom: '20px',
            }}
          >
            <p
              style={{
                fontFamily: 'Roboto, sans-serif',
                fontSize: '14px',
                color: '#3a3a3a',
                lineHeight: '1.7',
                margin: '0 0 16px',
              }}
            >
              Sponsors are room members — named, visible to each other, and
              present in the room where the practice unfolds. To pledge, sign
              in or create an account with the email this invitation was sent to.
            </p>
            <p
              style={{
                fontFamily: 'Roboto, sans-serif',
                fontSize: '13px',
                color: '#767676',
                lineHeight: '1.65',
                margin: 0,
              }}
            >
              Invitation sent to: <strong>{data.invitee_email}</strong>
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Link
              href={signUpUrl}
              style={{
                flex: '1 1 200px',
                textAlign: 'center',
                background: '#1a3a6b',
                color: '#fff',
                fontFamily: 'Roboto, sans-serif',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                padding: '13px 20px',
                borderRadius: '3px',
                textDecoration: 'none',
              }}
            >
              Create an account
            </Link>
            <Link
              href={signInUrl}
              style={{
                flex: '1 1 200px',
                textAlign: 'center',
                background: '#fff',
                color: '#1a3a6b',
                border: '1px solid #1a3a6b',
                fontFamily: 'Roboto, sans-serif',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                padding: '13px 20px',
                borderRadius: '3px',
                textDecoration: 'none',
              }}
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Signed-in pledge flow ───────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <PublicHeader />
      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '40px 24px' }}>
        <p
          style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: '11px',
            letterSpacing: '0.2em',
            color: '#767676',
            textTransform: 'uppercase',
            fontWeight: 700,
            marginBottom: '12px',
          }}
        >
          You&rsquo;ve been invited to sponsor
        </p>

        <h1
          style={{
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '32px',
            fontWeight: 700,
            margin: '0 0 8px',
            color: '#1a1a1a',
          }}
        >
          {data.commitment_title}
        </h1>
        <p
          style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: '14px',
            color: '#5a5a5a',
            marginBottom: '24px',
          }}
        >
          by <strong>{data.practitioner_name}</strong>
          {data.practice_name && (
            <span style={{ color: '#767676' }}> · {data.practice_name}</span>
          )}
        </p>

        <div
          style={{
            background: '#fff',
            border: '1px solid #d4d4d4',
            borderLeft: '3px solid #1a3a6b',
            borderRadius: '3px',
            padding: '20px 24px',
            marginBottom: '28px',
          }}
        >
          <p
            style={{
              fontFamily: 'Roboto, sans-serif',
              fontSize: '13px',
              color: '#3a3a3a',
              lineHeight: '1.65',
              margin: '0 0 10px',
            }}
          >
            On Search Star, a sponsor is a witness. You pledge now, join the
            private room where the practice unfolds, and release payment at day
            90 when the commitment is complete.
          </p>
          <p
            style={{
              fontFamily: 'Roboto, sans-serif',
              fontSize: '13px',
              color: '#3a3a3a',
              lineHeight: '1.65',
              margin: 0,
            }}
          >
            If you ever believe the practice isn&rsquo;t genuine, you can veto
            at any time and no payment is taken.
          </p>
        </div>

        {/* Step indicator */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '16px',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontFamily: 'Roboto, sans-serif',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: step === 'details' ? '#1a3a6b' : '#b8b8b8',
            }}
          >
            1. Your pledge
          </span>
          <span
            style={{
              color: '#d4d4d4',
              fontFamily: 'Roboto, sans-serif',
              fontSize: '11px',
            }}
          >
            ·
          </span>
          <span
            style={{
              fontFamily: 'Roboto, sans-serif',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: step === 'payment' ? '#1a3a6b' : '#b8b8b8',
            }}
          >
            2. Payment
          </span>
        </div>

        {step === 'details' && (
          <div
            style={{
              background: '#fff',
              border: '1px solid #d4d4d4',
              borderLeft: '3px solid #1a3a6b',
              borderRadius: '3px',
              padding: '28px 32px',
            }}
          >
            <p
              style={{
                fontFamily: 'Roboto, sans-serif',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#767676',
                marginBottom: '20px',
                marginTop: 0,
              }}
            >
              Confirm your pledge
            </p>

            {authState && (
              <p
                style={{
                  fontFamily: 'Roboto, sans-serif',
                  fontSize: '13px',
                  color: '#5a5a5a',
                  marginBottom: '20px',
                  lineHeight: '1.5',
                }}
              >
                Signed in as <strong>{authState.email}</strong>
              </p>
            )}

            <form onSubmit={handleDetailsSubmit}>
              <div style={{ marginBottom: '14px' }}>
                <label
                  style={{
                    display: 'block',
                    fontFamily: 'Roboto, sans-serif',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#5a5a5a',
                    marginBottom: '5px',
                  }}
                >
                  Pledge amount (minimum $5)
                </label>
                <div style={{ position: 'relative' }}>
                  <span
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontFamily: 'Roboto, sans-serif',
                      fontSize: '14px',
                      color: '#5a5a5a',
                    }}
                  >
                    $
                  </span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    min="5"
                    step="1"
                    placeholder="25"
                    style={{
                      width: '100%',
                      padding: '9px 12px 9px 24px',
                      border: '1px solid #d4d4d4',
                      borderRadius: '3px',
                      fontFamily: 'Roboto, sans-serif',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#1a3a6b'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#d4d4d4'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label
                  style={{
                    display: 'block',
                    fontFamily: 'Roboto, sans-serif',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#5a5a5a',
                    marginBottom: '5px',
                  }}
                >
                  Message{' '}
                  <span style={{ fontWeight: 400, color: '#b8b8b8' }}>(optional)</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Words of encouragement..."
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    border: '1px solid #d4d4d4',
                    borderRadius: '3px',
                    fontFamily: 'Roboto, sans-serif',
                    fontSize: '14px',
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    lineHeight: '1.5',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#1a3a6b'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#d4d4d4'
                  }}
                />
              </div>

              {error && (
                <div
                  style={{
                    marginBottom: '16px',
                    padding: '10px 14px',
                    background: '#fef2f2',
                    borderLeft: '3px solid #991b1b',
                    borderRadius: '3px',
                  }}
                >
                  <p
                    style={{
                      fontFamily: 'Roboto, sans-serif',
                      fontSize: '13px',
                      color: '#991b1b',
                      margin: 0,
                    }}
                  >
                    {error}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: '100%',
                  background: submitting ? '#8a9fc0' : '#1a3a6b',
                  color: '#fff',
                  fontFamily: 'Roboto, sans-serif',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  padding: '13px 20px',
                  borderRadius: '3px',
                  border: 'none',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? 'Preparing…' : 'Continue to payment'}
              </button>

              <p
                style={{
                  fontFamily: 'Roboto, sans-serif',
                  fontSize: '11px',
                  color: '#b8b8b8',
                  marginTop: '12px',
                  marginBottom: 0,
                  lineHeight: '1.5',
                  textAlign: 'center',
                }}
              >
                Your card will be authorized now. Funds are held and only charged when
                {' '}
                {data.practitioner_name} reaches day 90 and you release your pledge.
              </p>
            </form>
          </div>
        )}

        {step === 'payment' && clientSecret && (
          <div
            style={{
              background: '#fff',
              border: '1px solid #d4d4d4',
              borderLeft: '3px solid #1a3a6b',
              borderRadius: '3px',
              padding: '28px 32px',
            }}
          >
            <p
              style={{
                fontFamily: 'Roboto, sans-serif',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#767676',
                marginBottom: '20px',
                marginTop: 0,
              }}
            >
              Authorize your pledge
            </p>
            <StripePaymentForm
              clientSecret={clientSecret}
              amount={pledgedAmount}
              onSuccess={handlePaymentSuccess}
            />
          </div>
        )}
      </div>
    </div>
  )
}
