'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import StageShell from '@/components/stage-shell'

export default function StageValidator() {
  const router = useRouter()
  const params = useParams()
  const commitmentId = params.id as string

  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [sent, setSent] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true); setError(null)

    const res = await fetch(`/api/commitments/${commitmentId}/validators`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), note: note.trim() || undefined }),
    })

    if (res.ok) {
      setSent(prev => [...prev, email.trim().toLowerCase()])
      setEmail(''); setNote('')
    } else {
      const data = await res.json()
      setError(data.error || 'Something went wrong.')
    }
    setLoading(false)
  }

  const inputStyle = {
    width: '100%', padding: '11px 14px', border: '1px solid #d4d4d4',
    borderRadius: '3px', fontFamily: 'Roboto, sans-serif', fontSize: '15px',
    outline: 'none', boxSizing: 'border-box' as const,
  }

  return (
    <StageShell stage={3}>
      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#767676', marginBottom: '12px' }}>
        Stage 3 of 6
      </p>
      <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '38px', fontWeight: 700, color: '#1a1a1a', lineHeight: 1.1, marginBottom: '10px' }}>
        Invite your first validator.
      </h1>
      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '15px', color: '#5a5a5a', lineHeight: 1.65, marginBottom: '32px' }}>
        A validator is someone who knows you well enough to confirm the work is real. Not a stranger — a friend, a family member, a coach. Someone who will notice if you stop showing up.
      </p>

      {/* Sent list */}
      {sent.length > 0 && (
        <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sent.map(e => (
            <div key={e} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: '#edf7ed', border: '1px solid #c3e6cb', borderRadius: '3px' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="7" fill="#2d6a2d"/><path d="M4 7l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#2d6a2d' }}>Invitation sent to {e}</span>
            </div>
          ))}
        </div>
      )}

      {/* Invite form */}
      <form onSubmit={handleInvite}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', display: 'block', marginBottom: '8px' }}>
            Validator's email address
          </label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="someone@example.com"
            style={inputStyle}
            onFocus={e => { e.target.style.borderColor = '#1a3a6b' }}
            onBlur={e => { e.target.style.borderColor = '#d4d4d4' }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', display: 'block', marginBottom: '8px' }}>
            Personal note <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
          </label>
          <textarea
            value={note} onChange={e => setNote(e.target.value)}
            maxLength={300} rows={2}
            placeholder="Why you're asking them specifically..."
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.55 }}
            onFocus={e => { e.target.style.borderColor = '#1a3a6b' }}
            onBlur={e => { e.target.style.borderColor = '#d4d4d4' }}
          />
        </div>

        {error && (
          <div style={{ marginBottom: '14px', padding: '10px 14px', background: '#fef2f2', borderLeft: '3px solid #991b1b', borderRadius: '3px' }}>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#991b1b', margin: 0 }}>{error}</p>
          </div>
        )}

        <button type="submit" disabled={loading || !email.trim()} style={{
          width: '100%', padding: '13px', background: loading || !email.trim() ? '#8a9fc0' : '#1a3a6b',
          color: '#fff', fontFamily: 'Roboto, sans-serif', fontSize: '13px', fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase', border: 'none',
          borderRadius: '3px', cursor: loading || !email.trim() ? 'not-allowed' : 'pointer',
        }}>
          {loading ? 'Sending...' : 'Send invitation →'}
        </button>
      </form>

      {/* Continue once at least one sent */}
      {sent.length > 0 && (
        <div style={{ marginTop: '24px', borderTop: '1px solid #e8e8e8', paddingTop: '24px' }}>
          <button
            onClick={() => router.push(`/start/mentor/${commitmentId}`)}
            style={{
              width: '100%', padding: '13px', background: '#ffffff',
              color: '#1a3a6b', fontFamily: 'Roboto, sans-serif', fontSize: '13px', fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              border: '2px solid #1a3a6b', borderRadius: '3px', cursor: 'pointer',
            }}
          >
            Continue →
          </button>
          {sent.length < 3 && (
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#b8b8b8', textAlign: 'center', marginTop: '10px' }}>
              You can invite up to 3 validators. You can also add more later.
            </p>
          )}
        </div>
      )}

      {/* Skip */}
      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#b8b8b8', textAlign: 'center', marginTop: '20px' }}>
        <button
          onClick={() => router.push(`/start/mentor/${commitmentId}`)}
          style={{ background: 'none', border: 'none', color: '#b8b8b8', cursor: 'pointer', fontFamily: 'Roboto, sans-serif', fontSize: '13px', textDecoration: 'underline' }}
        >
          Skip for now
        </button>
      </p>
    </StageShell>
  )
}
