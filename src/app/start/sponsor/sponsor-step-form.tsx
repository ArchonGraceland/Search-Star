'use client'

import { useState } from 'react'

interface Props {
  commitmentId: string
}

export default function SponsorStepForm({ commitmentId }: Props) {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [dismissing, setDismissing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)

    const clean = email.trim().toLowerCase()
    if (!clean.includes('@') || clean.length < 5) {
      setError('Enter a valid email address.')
      return
    }

    setSubmitting(true)
    const res = await fetch('/api/sponsors/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commitment_id: commitmentId, invitee_email: clean }),
    })
    const json = await res.json()
    setSubmitting(false)

    if (!res.ok) {
      setError(json.error || 'Failed to send invitation.')
      return
    }

    // Invitation sent — the stage resolver will now advance to step 4 on
    // the next navigation. Bounce through /start which re-resolves.
    setSuccessMsg(`Invitation sent to ${clean}. Taking you to the next step…`)
    setEmail('')
    // Small delay so the user sees confirmation.
    setTimeout(() => {
      // Hard navigation to the next stage, bypasses Router Cache.
      window.location.assign('/start/companion')
    }, 900)
  }

  async function handleDismiss() {
    setError(null)
    setDismissing(true)
    const res = await fetch('/api/profiles/sponsor-step-seen', { method: 'POST' })
    setDismissing(false)
    if (!res.ok) {
      setError('Could not record your choice. Try again.')
      return
    }
    // Hard navigation to the next stage, bypasses Router Cache.
    window.location.assign('/start/companion')
  }

  return (
    <>
      <div style={{
        background: '#fff', border: '1px solid #d4d4d4', borderLeft: '3px solid #1a3a6b',
        borderRadius: '3px', padding: '24px 26px', marginBottom: '20px',
      }}>
        <p style={{
          fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700,
          letterSpacing: '0.12em', textTransform: 'uppercase', color: '#767676',
          margin: '0 0 14px',
        }}>
          Invite a sponsor
        </p>

        <form onSubmit={handleInvite}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="sponsor@example.com"
              disabled={submitting}
              style={{
                flex: '1 1 240px', padding: '10px 13px', border: '1px solid #d4d4d4',
                borderRadius: '3px', fontFamily: 'Roboto, sans-serif', fontSize: '14px',
                outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#1a3a6b' }}
              onBlur={(e) => { e.target.style.borderColor = '#d4d4d4' }}
            />
            <button
              type="submit"
              disabled={submitting}
              style={{
                background: submitting ? '#8a9fc0' : '#1a3a6b',
                color: '#fff',
                fontFamily: 'Roboto, sans-serif', fontSize: '13px', fontWeight: 700,
                letterSpacing: '0.06em', padding: '10px 22px',
                borderRadius: '3px', border: 'none',
                cursor: submitting ? 'not-allowed' : 'pointer',
                textTransform: 'uppercase',
              }}
            >
              {submitting ? 'Sending…' : 'Send invitation'}
            </button>
          </div>

          {error && (
            <div style={{
              marginTop: '12px', padding: '10px 14px', background: '#fef2f2',
              borderLeft: '3px solid #991b1b', borderRadius: '3px',
            }}>
              <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#991b1b', margin: 0 }}>{error}</p>
            </div>
          )}
          {successMsg && (
            <div style={{
              marginTop: '12px', padding: '10px 14px', background: '#edf7ed',
              borderLeft: '3px solid #2d6a2d', borderRadius: '3px',
            }}>
              <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#2d6a2d', margin: 0 }}>{successMsg}</p>
            </div>
          )}

          <p style={{
            fontFamily: 'Roboto, sans-serif', fontSize: '11px', color: '#b8b8b8',
            marginTop: '14px', marginBottom: 0, lineHeight: 1.5,
          }}>
            They receive an email with a pre-filled pledge form. They can set the amount before confirming.
          </p>
        </form>
      </div>

      <div style={{ textAlign: 'center', marginTop: '8px' }}>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={dismissing}
          style={{
            background: 'transparent', color: '#5a5a5a',
            fontFamily: 'Roboto, sans-serif', fontSize: '13px', fontWeight: 500,
            padding: '10px 14px', border: 'none',
            cursor: dismissing ? 'not-allowed' : 'pointer',
            textDecoration: 'underline', textUnderlineOffset: '3px',
          }}
        >
          {dismissing ? 'Saving…' : 'I’ll invite sponsors later'}
        </button>
      </div>
    </>
  )
}
