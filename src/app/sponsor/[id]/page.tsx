'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import PublicHeader from '@/components/public-header'

interface SponsorPageData {
  commitment_id: string
  title: string
  practitioner_name: string
  practice_name: string | null
  launch_ends_at: string
  streak_ends_at: string
  total_pledged: number
  pledge_count: number
  status: string
}

function daysRemaining(endDate: string): number {
  const end = new Date(endDate)
  const now = new Date()
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(0, diff)
}

export default function SponsorPage() {
  const params = useParams()
  const id = params.id as string

  const [data, setData] = useState<SponsorPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [closed, setClosed] = useState(false)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [pledgedAmount, setPledgedAmount] = useState<number>(0)

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/sponsorships?commitment_id=${id}`)
      if (res.ok) {
        const json = await res.json()
        if (json.status === 'completed' || json.status === 'abandoned') {
          setClosed(true)
        } else {
          setData(json)
        }
      } else {
        setClosed(true)
      }
      setLoading(false)
    }
    load()
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
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
        commitment_id: id,
        sponsor_email: email.trim().toLowerCase(),
        sponsor_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        pledge_amount: amountNum,
        message: message.trim() || undefined,
      }),
    })

    const json = await res.json()
    if (res.ok) {
      setPledgedAmount(amountNum)
      setSuccess(true)
    } else {
      setError(json.error || 'Failed to record pledge.')
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <PublicHeader />
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 70px)' }}>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#767676' }}>Loading...</p>
        </div>
      </div>
    )
  }

  if (closed || !data) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <PublicHeader />
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 70px)', padding: '32px 16px' }}>
          <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '40px 48px', maxWidth: '480px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '28px', marginBottom: '16px' }}>🔒</p>
            <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '26px', fontWeight: 700, margin: '0 0 12px' }}>
              Commitment closed
            </h2>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#767676', lineHeight: '1.6', margin: 0 }}>
              This commitment has already completed or been abandoned. Pledges are no longer being accepted.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const days = daysRemaining(data.launch_ends_at)

  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <PublicHeader />
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 70px)', padding: '32px 16px' }}>
          <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderLeft: '3px solid #2d6a2d', borderRadius: '3px', padding: '48px', maxWidth: '520px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '32px', marginBottom: '16px' }}>🎉</p>
            <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '28px', fontWeight: 700, margin: '0 0 16px', color: '#1a1a1a' }}>
              Pledge recorded!
            </h2>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '15px', color: '#3a3a3a', lineHeight: '1.6', margin: '0 0 8px' }}>
              Your pledge of <strong>${pledgedAmount.toFixed(2)}</strong> has been recorded.
            </p>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#767676', lineHeight: '1.6', margin: 0 }}>
              <strong>{data.practitioner_name}</strong> will be notified. Funds are recorded now and collected when they complete their commitment.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <PublicHeader />
      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '40px 24px' }}>

        {/* Eyebrow */}
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#767676', textTransform: 'uppercase', fontWeight: 700, marginBottom: '12px' }}>
          Sponsor a Commitment
        </p>

        {/* Title */}
        <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '32px', fontWeight: 700, margin: '0 0 8px', color: '#1a1a1a' }}>
          {data.title}
        </h1>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#5a5a5a', marginBottom: '4px' }}>
          by <strong>{data.practitioner_name}</strong>
          {data.practice_name && <span style={{ color: '#767676' }}> · {data.practice_name}</span>}
        </p>

        {/* Stats bar */}
        <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '16px 20px', marginTop: '20px', marginBottom: '28px', display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#767676', margin: '0 0 2px' }}>
              Sponsors
            </p>
            <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '24px', fontWeight: 700, color: '#1a3a6b', margin: 0 }}>
              {data.pledge_count === 0
                ? 'Be the first'
                : `${data.pledge_count} ${data.pledge_count === 1 ? 'person' : 'people'}`}
            </p>
          </div>
          <div>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#767676', margin: '0 0 2px' }}>
              Total pledged
            </p>
            <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '24px', fontWeight: 700, color: '#1a3a6b', margin: 0 }}>
              ${data.total_pledged.toFixed(2)}
            </p>
          </div>
          <div>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#767676', margin: '0 0 2px' }}>
              Streak ends
            </p>
            <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '24px', fontWeight: 700, color: '#1a3a6b', margin: 0 }}>
              {new Date(data.streak_ends_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Pledge form */}
        <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderLeft: '3px solid #1a3a6b', borderRadius: '3px', padding: '28px 32px' }}>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', marginBottom: '20px', marginTop: 0 }}>
            Make a pledge
          </p>

          <form onSubmit={handleSubmit}>
            {/* Name row */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 600, color: '#5a5a5a', marginBottom: '5px' }}>
                  First name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  placeholder="Jane"
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #d4d4d4', borderRadius: '3px', fontFamily: 'Roboto, sans-serif', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={(e) => { e.target.style.borderColor = '#1a3a6b' }}
                  onBlur={(e) => { e.target.style.borderColor = '#d4d4d4' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 600, color: '#5a5a5a', marginBottom: '5px' }}>
                  Last name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  placeholder="Smith"
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #d4d4d4', borderRadius: '3px', fontFamily: 'Roboto, sans-serif', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={(e) => { e.target.style.borderColor = '#1a3a6b' }}
                  onBlur={(e) => { e.target.style.borderColor = '#d4d4d4' }}
                />
              </div>
            </div>

            {/* Email */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 600, color: '#5a5a5a', marginBottom: '5px' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="jane@example.com"
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #d4d4d4', borderRadius: '3px', fontFamily: 'Roboto, sans-serif', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                onFocus={(e) => { e.target.style.borderColor = '#1a3a6b' }}
                onBlur={(e) => { e.target.style.borderColor = '#d4d4d4' }}
              />
            </div>

            {/* Amount */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 600, color: '#5a5a5a', marginBottom: '5px' }}>
                Pledge amount (minimum $5)
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#5a5a5a' }}>
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
                  style={{ width: '100%', padding: '9px 12px 9px 24px', border: '1px solid #d4d4d4', borderRadius: '3px', fontFamily: 'Roboto, sans-serif', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={(e) => { e.target.style.borderColor = '#1a3a6b' }}
                  onBlur={(e) => { e.target.style.borderColor = '#d4d4d4' }}
                />
              </div>
            </div>

            {/* Message (optional) */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 600, color: '#5a5a5a', marginBottom: '5px' }}>
                Message <span style={{ fontWeight: 400, color: '#b8b8b8' }}>(optional)</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Words of encouragement..."
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #d4d4d4', borderRadius: '3px', fontFamily: 'Roboto, sans-serif', fontSize: '14px', outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: '1.5' }}
                onFocus={(e) => { e.target.style.borderColor = '#1a3a6b' }}
                onBlur={(e) => { e.target.style.borderColor = '#d4d4d4' }}
              />
            </div>

            {error && (
              <div style={{ marginBottom: '16px', padding: '10px 14px', background: '#fef2f2', borderLeft: '3px solid #991b1b', borderRadius: '3px' }}>
                <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#991b1b', margin: 0 }}>{error}</p>
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
                fontSize: '14px',
                fontWeight: 700,
                letterSpacing: '0.04em',
                padding: '12px 20px',
                borderRadius: '3px',
                border: 'none',
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Recording pledge...' : `Pledge${amount && !isNaN(parseFloat(amount)) ? ` $${parseFloat(amount).toFixed(2)}` : ''} →`}
            </button>

            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', color: '#b8b8b8', marginTop: '12px', marginBottom: 0, lineHeight: '1.5', textAlign: 'center' }}>
              Pledges are recorded now. Payment is collected when {data.practitioner_name} completes their commitment. No payment is required today.
            </p>
          </form>
        </div>

      </div>
    </div>
  )
}
