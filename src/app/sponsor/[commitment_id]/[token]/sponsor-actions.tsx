'use client'

import { useState } from 'react'

interface Props {
  sponsorshipId: string
  token: string
  canRelease: boolean
  canVeto: boolean
  practitionerName: string
}

export default function SponsorActions({
  sponsorshipId,
  token,
  canRelease,
  canVeto,
  practitionerName,
}: Props) {
  const [pending, setPending] = useState<'release' | 'veto' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<'released' | 'vetoed' | null>(null)
  const [showVetoForm, setShowVetoForm] = useState(false)
  const [vetoNote, setVetoNote] = useState('')

  async function submitAction(action: 'release' | 'veto', note?: string) {
    setPending(action)
    setError(null)
    try {
      const res = await fetch(`/api/sponsorships/${sponsorshipId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, token, note }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Action failed.')
        setPending(null)
        return
      }
      if (json.already) {
        setDone(json.status === 'released' ? 'released' : 'vetoed')
      } else {
        setDone(action === 'release' ? 'released' : 'vetoed')
      }
    } catch {
      setError('Network error.')
    }
    setPending(null)
  }

  if (done === 'released') {
    return (
      <div style={{ background: '#edf7ed', border: '1px solid #d4d4d4', borderLeft: '3px solid #2d6a2d', borderRadius: '3px', padding: '20px 24px', marginBottom: '32px' }}>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#2d6a2d', margin: '0 0 6px' }}>
          Pledge released
        </p>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#3a3a3a', lineHeight: 1.6, margin: 0 }}>
          Thank you for witnessing {practitionerName}&rsquo;s 90 days. Your release has been recorded.
        </p>
      </div>
    )
  }

  if (done === 'vetoed') {
    return (
      <div style={{ background: '#fef2f2', border: '1px solid #d4d4d4', borderLeft: '3px solid #991b1b', borderRadius: '3px', padding: '20px 24px', marginBottom: '32px' }}>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#991b1b', margin: '0 0 6px' }}>
          Commitment vetoed
        </p>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#3a3a3a', lineHeight: 1.6, margin: 0 }}>
          You have vetoed this commitment. The streak has ended and no payment will be collected from any sponsor.
        </p>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: '32px' }}>
      {canRelease && (
        <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderLeft: '3px solid #2d6a2d', borderRadius: '3px', padding: '20px 24px', marginBottom: '16px' }}>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#2d6a2d', margin: '0 0 8px' }}>
            Day 90 has arrived
          </p>
          <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '17px', color: '#1a1a1a', lineHeight: 1.6, margin: '0 0 16px' }}>
            {practitionerName} has completed the 90-day streak. Release your pledge to confirm the work was genuine and trigger payment.
          </p>
          <button
            type="button"
            onClick={() => submitAction('release')}
            disabled={pending !== null}
            style={{
              background: pending ? '#8a9fc0' : '#2d6a2d',
              color: '#fff',
              fontFamily: 'Roboto, sans-serif',
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              padding: '11px 22px',
              borderRadius: '3px',
              border: 'none',
              cursor: pending ? 'not-allowed' : 'pointer',
              textTransform: 'uppercase',
            }}
          >
            {pending === 'release' ? 'Releasing...' : 'Release pledge'}
          </button>
        </div>
      )}

      {canVeto && (
        <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '20px 24px' }}>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', margin: '0 0 8px' }}>
            If something&rsquo;s wrong
          </p>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#3a3a3a', lineHeight: 1.6, margin: '0 0 14px' }}>
            If you believe this practice isn&rsquo;t genuine, you can veto the commitment. Any single sponsor veto ends the streak for everyone. No payment is collected. This is a serious action — use it only when you genuinely cannot witness what&rsquo;s happening.
          </p>

          {!showVetoForm ? (
            <button
              type="button"
              onClick={() => setShowVetoForm(true)}
              disabled={pending !== null}
              style={{
                background: 'transparent',
                color: '#991b1b',
                fontFamily: 'Roboto, sans-serif',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.04em',
                padding: '9px 18px',
                borderRadius: '3px',
                border: '1px solid #991b1b',
                cursor: pending ? 'not-allowed' : 'pointer',
                textTransform: 'uppercase',
              }}
            >
              Veto commitment
            </button>
          ) : (
            <div>
              <label style={{ display: 'block', fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 600, color: '#5a5a5a', marginBottom: '5px' }}>
                Reason <span style={{ fontWeight: 400, color: '#b8b8b8' }}>(optional, shared with the practitioner)</span>
              </label>
              <textarea
                value={vetoNote}
                onChange={(e) => setVetoNote(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Why are you vetoing?"
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #d4d4d4', borderRadius: '3px', fontFamily: 'Roboto, sans-serif', fontSize: '14px', outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: '1.5', marginBottom: '12px' }}
              />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => submitAction('veto', vetoNote.trim() || undefined)}
                  disabled={pending !== null}
                  style={{
                    background: pending ? '#8a9fc0' : '#991b1b',
                    color: '#fff',
                    fontFamily: 'Roboto, sans-serif',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    padding: '9px 18px',
                    borderRadius: '3px',
                    border: 'none',
                    cursor: pending ? 'not-allowed' : 'pointer',
                    textTransform: 'uppercase',
                  }}
                >
                  {pending === 'veto' ? 'Vetoing...' : 'Confirm veto'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowVetoForm(false); setVetoNote('') }}
                  disabled={pending !== null}
                  style={{
                    background: 'transparent',
                    color: '#5a5a5a',
                    fontFamily: 'Roboto, sans-serif',
                    fontSize: '12px',
                    fontWeight: 500,
                    padding: '9px 18px',
                    borderRadius: '3px',
                    border: '1px solid #d4d4d4',
                    cursor: pending ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{ marginTop: '14px', padding: '10px 14px', background: '#fef2f2', borderLeft: '3px solid #991b1b', borderRadius: '3px' }}>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#991b1b', margin: 0 }}>{error}</p>
        </div>
      )}
    </div>
  )
}
