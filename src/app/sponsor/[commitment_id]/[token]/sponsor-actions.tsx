'use client'

import { useState } from 'react'

interface Props {
  sponsorshipId: string
  token: string
  canRelease: boolean
  canVeto: boolean
  practitionerName: string
  pledgeAmount: number
}

type ReleaseResult = {
  released: boolean
  donated: boolean
  donationAmount: number
}

// Default suggested donation rate — matches DEFAULT_DONATION_RATE in
// src/lib/stripe.ts. Surfacing it here keeps the UI label honest if the
// default ever shifts; the server still clamps whatever we submit.
const DEFAULT_RATE = 0.05

function roundToCents(dollars: number): number {
  return Math.round(dollars * 100) / 100
}

function formatUsd(dollars: number): string {
  return dollars.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function SponsorActions({
  sponsorshipId,
  token,
  canRelease,
  canVeto,
  practitionerName,
  pledgeAmount,
}: Props) {
  const [pending, setPending] = useState<'release' | 'veto' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<null | { kind: 'released'; result: ReleaseResult } | { kind: 'vetoed' }>(null)
  const [showVetoForm, setShowVetoForm] = useState(false)
  const [vetoNote, setVetoNote] = useState('')

  // Release is a two-step flow: the green "Release pledge" button expands
  // an inline donation step (NOT a modal — per spec §7.7 no friction and
  // no dark patterns). The sponsor can edit the dollar amount directly,
  // skip with one click, or confirm. Submitting fires POST /action with
  // { donation_rate } where rate is clamped server-side.
  const [showDonationStep, setShowDonationStep] = useState(false)
  const [donationInput, setDonationInput] = useState<string>(
    roundToCents(pledgeAmount * DEFAULT_RATE).toFixed(2)
  )
  const [donationSkipped, setDonationSkipped] = useState(false)

  // Parse the dollar input into cents-safe dollars. Returns 0 for empty/invalid.
  const parsedDonation = (() => {
    if (donationSkipped) return 0
    const n = Number(donationInput)
    if (!Number.isFinite(n) || n < 0) return 0
    return roundToCents(n)
  })()

  // Compute rate from the parsed donation dollars for the API call. Rate,
  // not dollars, is what the server takes — so the source of truth is the
  // sponsor's edited dollar value, translated back to a rate at submit time.
  const effectiveRate = (() => {
    if (parsedDonation <= 0 || pledgeAmount <= 0) return 0
    return Math.min(1, Math.max(0, parsedDonation / pledgeAmount))
  })()

  async function submitRelease() {
    setPending('release')
    setError(null)
    try {
      const res = await fetch(`/api/sponsorships/${sponsorshipId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'release', token, donation_rate: effectiveRate }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Action failed.')
        setPending(null)
        return
      }
      if (json.already) {
        // Idempotent replay — we don't have donation detail, just show released.
        setDone({
          kind: 'released',
          result: { released: true, donated: false, donationAmount: 0 },
        })
      } else {
        setDone({
          kind: 'released',
          result: {
            released: Boolean(json.released),
            donated: Boolean(json.donated),
            donationAmount: Number(json.donation_amount ?? 0),
          },
        })
      }
    } catch {
      setError('Network error.')
    }
    setPending(null)
  }

  async function submitVeto(note?: string) {
    setPending('veto')
    setError(null)
    try {
      const res = await fetch(`/api/sponsorships/${sponsorshipId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'veto', token, note }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Action failed.')
        setPending(null)
        return
      }
      setDone({ kind: 'vetoed' })
    } catch {
      setError('Network error.')
    }
    setPending(null)
  }

  if (done?.kind === 'released') {
    const { donated, donationAmount } = done.result
    return (
      <div style={{ background: '#edf7ed', border: '1px solid #d4d4d4', borderLeft: '3px solid #2d6a2d', borderRadius: '3px', padding: '20px 24px', marginBottom: '32px' }}>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#2d6a2d', margin: '0 0 6px' }}>
          Pledge released
        </p>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#3a3a3a', lineHeight: 1.6, margin: 0 }}>
          Thank you for witnessing {practitionerName}&rsquo;s 90 days.
          {donated && donationAmount > 0 ? (
            <> Your {formatUsd(donationAmount)} contribution to Search Star was also recorded.</>
          ) : null}
        </p>
      </div>
    )
  }

  if (done?.kind === 'vetoed') {
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
            {practitionerName} has completed the 90-day streak. Release your pledge of {formatUsd(pledgeAmount)} to confirm the work was genuine and trigger payment.
          </p>

          {!showDonationStep ? (
            <button
              type="button"
              onClick={() => setShowDonationStep(true)}
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
              Release pledge
            </button>
          ) : (
            <div style={{ marginTop: '8px', paddingTop: '18px', borderTop: '1px solid #e8e8e8' }}>
              <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', margin: '0 0 8px' }}>
                Support Search Star
              </p>
              <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#3a3a3a', lineHeight: 1.6, margin: '0 0 14px' }}>
                Search Star runs on voluntary contributions. Your card is charged for this amount separately from {practitionerName}&rsquo;s pledge — the practitioner receives their {formatUsd(pledgeAmount)} in full.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <label style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 600, color: '#5a5a5a' }} htmlFor="donation-input">
                  Contribution
                </label>
                <div style={{ display: 'flex', alignItems: 'center', background: donationSkipped ? '#f5f5f5' : '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '7px 10px', maxWidth: '160px' }}>
                  <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: donationSkipped ? '#b8b8b8' : '#1a1a1a', marginRight: '4px' }}>
                    $
                  </span>
                  <input
                    id="donation-input"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={donationSkipped ? '0.00' : donationInput}
                    onChange={(e) => {
                      setDonationSkipped(false)
                      setDonationInput(e.target.value)
                    }}
                    disabled={donationSkipped || pending !== null}
                    style={{ width: '100px', border: 'none', outline: 'none', fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: donationSkipped ? '#b8b8b8' : '#1a1a1a', background: 'transparent' }}
                  />
                </div>
                <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#b8b8b8' }}>
                  suggested {formatUsd(roundToCents(pledgeAmount * DEFAULT_RATE))} (5%)
                </span>
                {!donationSkipped ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDonationSkipped(true)
                      setDonationInput('0.00')
                    }}
                    disabled={pending !== null}
                    style={{ background: 'transparent', border: 'none', padding: '6px 2px', color: '#767676', fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 500, textDecoration: 'underline', cursor: pending ? 'not-allowed' : 'pointer' }}
                  >
                    Skip this
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setDonationSkipped(false)
                      setDonationInput(roundToCents(pledgeAmount * DEFAULT_RATE).toFixed(2))
                    }}
                    disabled={pending !== null}
                    style={{ background: 'transparent', border: 'none', padding: '6px 2px', color: '#1a3a6b', fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 500, textDecoration: 'underline', cursor: pending ? 'not-allowed' : 'pointer' }}
                  >
                    Add contribution
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={submitRelease}
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
                  {pending === 'release'
                    ? 'Releasing...'
                    : parsedDonation > 0
                    ? `Release ${formatUsd(pledgeAmount)} and donate ${formatUsd(parsedDonation)}`
                    : `Release ${formatUsd(pledgeAmount)}`}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDonationStep(false)
                    setDonationSkipped(false)
                    setDonationInput(roundToCents(pledgeAmount * DEFAULT_RATE).toFixed(2))
                  }}
                  disabled={pending !== null}
                  style={{ background: 'transparent', color: '#5a5a5a', fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 500, padding: '9px 18px', borderRadius: '3px', border: '1px solid #d4d4d4', cursor: pending ? 'not-allowed' : 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
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
              style={{ background: 'transparent', color: '#991b1b', fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700, letterSpacing: '0.04em', padding: '9px 18px', borderRadius: '3px', border: '1px solid #991b1b', cursor: pending ? 'not-allowed' : 'pointer', textTransform: 'uppercase' }}
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
                  onClick={() => submitVeto(vetoNote.trim() || undefined)}
                  disabled={pending !== null}
                  style={{ background: pending ? '#8a9fc0' : '#991b1b', color: '#fff', fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700, letterSpacing: '0.04em', padding: '9px 18px', borderRadius: '3px', border: 'none', cursor: pending ? 'not-allowed' : 'pointer', textTransform: 'uppercase' }}
                >
                  {pending === 'veto' ? 'Vetoing...' : 'Confirm veto'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowVetoForm(false); setVetoNote('') }}
                  disabled={pending !== null}
                  style={{ background: 'transparent', color: '#5a5a5a', fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 500, padding: '9px 18px', borderRadius: '3px', border: '1px solid #d4d4d4', cursor: pending ? 'not-allowed' : 'pointer' }}
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
