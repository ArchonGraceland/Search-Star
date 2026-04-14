'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import StageShell from '@/components/stage-shell'

export default function StageRitual() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [statement, setStatement] = useState('')
  const [commitmentTitle, setCommitmentTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timestamp] = useState(() => new Date().toLocaleString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  }))

  useEffect(() => {
    fetch(`/api/commitments/${id}`)
      .then(r => r.json())
      .then(d => setCommitmentTitle(d.commitment?.title ?? ''))
  }, [id])

  const handleStart = async () => {
    setLoading(true); setError(null)
    const res = await fetch(`/api/commitments/${id}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statement }),
    })
    if (res.ok) {
      router.push(`/start/active/${id}`)
    } else {
      const data = await res.json()
      setError(data.error || 'Something went wrong.')
      setLoading(false)
    }
  }

  return (
    <StageShell stage={6}>
      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#767676', marginBottom: '12px' }}>
        Stage 6 of 7
      </p>
      <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '38px', fontWeight: 700, color: '#1a1a1a', lineHeight: 1.1, marginBottom: '10px' }}>
        The start ritual.
      </h1>
      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '15px', color: '#5a5a5a', lineHeight: 1.65, marginBottom: '36px' }}>
        This is the moment you step from declaring to doing. Write what you're beginning and what it means to you. This statement is timestamped and shared with your validator circle.
      </p>

      {/* Commitment title */}
      {commitmentTitle && (
        <div style={{ background: '#eef2f8', border: '1px solid #c8d4e8', borderRadius: '3px', padding: '16px 20px', marginBottom: '28px' }}>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1a3a6b', marginBottom: '4px' }}>Commitment</p>
          <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>{commitmentTitle}</p>
        </div>
      )}

      {/* Timestamp */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2d6a2d', flexShrink: 0 }} />
        <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#767676', fontStyle: 'italic' }}>
          {timestamp}
        </span>
      </div>

      {/* Statement */}
      <div style={{ marginBottom: '28px' }}>
        <label style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', display: 'block', marginBottom: '8px' }}>
          Your statement of intent <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
        </label>
        <textarea
          value={statement}
          onChange={e => setStatement(e.target.value)}
          maxLength={1000} rows={5}
          placeholder="Write what you are beginning. What does this commitment mean to you? What do you expect the work to require?"
          style={{
            width: '100%', padding: '12px 14px', border: '1px solid #d4d4d4',
            borderRadius: '3px', fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '17px', outline: 'none', resize: 'vertical',
            boxSizing: 'border-box', lineHeight: 1.6, color: '#1a1a1a',
          }}
          onFocus={e => { e.target.style.borderColor = '#1a3a6b' }}
          onBlur={e => { e.target.style.borderColor = '#d4d4d4' }}
        />
      </div>

      {error && (
        <div style={{ marginBottom: '16px', padding: '12px 16px', background: '#fef2f2', borderLeft: '3px solid #991b1b', borderRadius: '3px' }}>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#991b1b', margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Begin */}
      <button
        onClick={handleStart}
        disabled={loading}
        style={{
          width: '100%', padding: '16px', background: loading ? '#8a9fc0' : '#1a3a6b',
          color: '#fff', fontFamily: '"Crimson Text", Georgia, serif',
          fontSize: '20px', fontWeight: 700, border: 'none',
          borderRadius: '3px', cursor: loading ? 'not-allowed' : 'pointer',
          letterSpacing: '0.02em',
        }}
      >
        {loading ? 'Beginning...' : 'Begin my 90 days'}
      </button>
      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#b8b8b8', textAlign: 'center', marginTop: '10px' }}>
        This starts your streak clock. Day 1 of 90 begins now.
      </p>
    </StageShell>
  )
}
