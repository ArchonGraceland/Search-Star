'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import StageShell from '@/components/stage-shell'

export default function StageCommitment() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('daily')
  const [sessionsPerWeek, setSessionsPerWeek] = useState(5)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const today = new Date().toISOString().slice(0, 10)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setError('Please give your commitment a title.'); return }
    setLoading(true); setError(null)

    const res = await fetch('/api/commitments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || undefined,
        frequency,
        sessions_per_week: frequency === 'weekly' ? sessionsPerWeek : undefined,
        start_date: today,
      }),
    })

    const data = await res.json()
    if (res.ok && data.id) {
      // refresh() invalidates the App Router's client-side cache so the
      // subsequent navigation re-fetches the /start RSC payload. Without
      // this, router.push('/start') can serve a cached "no commitment yet"
      // decision from before we just created the commitment, redirecting
      // the user right back to stage 2 with a blank form.
      router.refresh()
      router.push('/start')
    } else {
      setError(data.error || data.detail || 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '11px 14px', border: '1px solid #d4d4d4',
    borderRadius: '3px', fontFamily: 'Roboto, sans-serif', fontSize: '15px',
    outline: 'none', boxSizing: 'border-box' as const,
  }

  return (
    <StageShell stage={2}>
      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#767676', marginBottom: '12px' }}>
        Stage 2 of 6
      </p>
      <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '38px', fontWeight: 700, color: '#1a1a1a', lineHeight: 1.1, marginBottom: '10px' }}>
        Declare your 90-day commitment.
      </h1>
      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '15px', color: '#5a5a5a', lineHeight: 1.65, marginBottom: '36px' }}>
        Write what you&apos;ll do and how often. This is the statement your sponsors will hold you to. Make it specific enough that anyone reading it knows exactly what counts as showing up.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '22px' }}>
          <label style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', display: 'block', marginBottom: '8px' }}>
            Commitment title <span style={{ color: '#c0392b' }}>*</span>
          </label>
          <input
            type="text" value={title} onChange={e => setTitle(e.target.value)}
            required maxLength={120}
            placeholder="e.g. 90 days of daily Italian practice"
            style={inputStyle}
            onFocus={e => { e.target.style.borderColor = '#1a3a6b' }}
            onBlur={e => { e.target.style.borderColor = '#d4d4d4' }}
          />
        </div>

        <div style={{ marginBottom: '22px' }}>
          <label style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', display: 'block', marginBottom: '8px' }}>
            What does success look like? <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
          </label>
          <textarea
            value={description} onChange={e => setDescription(e.target.value)}
            maxLength={500} rows={3}
            placeholder="e.g. Learn at least one new Italian sentence every day using Duolingo and a workbook."
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.55 }}
            onFocus={e => { e.target.style.borderColor = '#1a3a6b' }}
            onBlur={e => { e.target.style.borderColor = '#d4d4d4' }}
          />
        </div>

        <div style={{ marginBottom: '32px' }}>
          <label style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', display: 'block', marginBottom: '8px' }}>
            How often?
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { value: 'daily', title: 'Daily', desc: 'At least one session every day.' },
              { value: 'weekly', title: 'Weekly', desc: 'A set number of sessions per week.' },
            ].map(opt => (
              <label key={opt.value} style={{
                display: 'flex', alignItems: 'flex-start', gap: '12px',
                padding: '12px 16px', border: `1px solid ${frequency === opt.value ? '#1a3a6b' : '#d4d4d4'}`,
                borderRadius: '3px', cursor: 'pointer', background: frequency === opt.value ? '#eef2f8' : '#fff',
              }}>
                <input type="radio" name="frequency" value={opt.value}
                  checked={frequency === opt.value}
                  onChange={() => setFrequency(opt.value as 'daily' | 'weekly')}
                  style={{ marginTop: '2px', accentColor: '#1a3a6b' }}
                />
                <div>
                  <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', fontWeight: 700, color: '#1a1a1a', display: 'block' }}>{opt.title}</span>
                  <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#767676' }}>{opt.desc}</span>
                </div>
              </label>
            ))}
          </div>

          {frequency === 'weekly' && (
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#5a5a5a' }}>Sessions per week:</label>
              <input type="number" min={1} max={7} value={sessionsPerWeek}
                onChange={e => setSessionsPerWeek(Math.min(7, Math.max(1, parseInt(e.target.value) || 1)))}
                style={{ width: '64px', padding: '8px 10px', border: '1px solid #d4d4d4', borderRadius: '3px', fontFamily: 'Roboto, sans-serif', fontSize: '14px', outline: 'none' }}
              />
            </div>
          )}
        </div>

        {error && (
          <div style={{ marginBottom: '16px', padding: '12px 16px', background: '#fef2f2', borderLeft: '3px solid #991b1b', borderRadius: '3px' }}>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#991b1b', margin: 0 }}>{error}</p>
          </div>
        )}

        <button type="submit" disabled={loading} style={{
          width: '100%', padding: '14px', background: loading ? '#8a9fc0' : '#1a3a6b',
          color: '#fff', fontFamily: 'Roboto, sans-serif', fontSize: '13px', fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase', border: 'none',
          borderRadius: '3px', cursor: loading ? 'not-allowed' : 'pointer',
        }}>
          {loading ? 'Declaring...' : 'Declare my commitment →'}
        </button>
      </form>
    </StageShell>
  )
}
