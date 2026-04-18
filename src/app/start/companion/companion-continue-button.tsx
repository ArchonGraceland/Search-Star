'use client'

import { useState } from 'react'

interface Props {
  commitmentId: string
}

export default function CompanionContinueButton({ commitmentId }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleContinue() {
    setError(null)
    setSubmitting(true)
    const res = await fetch('/api/profiles/companion-step-seen', { method: 'POST' })
    setSubmitting(false)
    if (!res.ok) {
      setError('Could not continue. Try again.')
      return
    }
    // Hard navigation direct to the launch page for this commitment.
    // Skips both the stage resolver and the App Router cache, which have
    // caused bounces back to earlier stages in production.
    window.location.assign(`/start/launch/${commitmentId}`)
  }

  return (
    <>
      <div style={{
        background: '#1a3a6b', borderRadius: '3px', padding: '24px',
        textAlign: 'center', marginTop: '8px',
      }}>
        <button
          type="button"
          onClick={handleContinue}
          disabled={submitting}
          style={{
            display: 'inline-block', padding: '13px 36px', background: '#ffffff',
            color: '#1a3a6b', fontFamily: 'Roboto, sans-serif', fontSize: '13px',
            fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            borderRadius: '3px', border: 'none',
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? 'Continuing…' : 'Continue →'}
        </button>
        <p style={{
          fontFamily: 'Roboto, sans-serif', fontSize: '12px',
          color: 'rgba(255,255,255,0.55)', marginTop: '12px', marginBottom: 0,
        }}>
          Takes you to your launch window.
        </p>
      </div>

      {error && (
        <div style={{
          marginTop: '14px', padding: '10px 14px', background: '#fef2f2',
          borderLeft: '3px solid #991b1b', borderRadius: '3px',
        }}>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#991b1b', margin: 0 }}>{error}</p>
        </div>
      )}
    </>
  )
}
