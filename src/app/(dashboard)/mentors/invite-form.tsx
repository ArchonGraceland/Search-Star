'use client'

import { useState } from 'react'

interface Props {
  direction: 'request_mentor' | 'invite_mentee'
  placeholder: string
  buttonLabel: string
}

export function InviteForm({ direction, placeholder, buttonLabel }: Props) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setStatus('loading')
    setErrorMsg('')

    const body: Record<string, string> = { direction }
    if (direction === 'request_mentor') body.mentor_email = email
    else body.mentee_email = email

    try {
      const res = await fetch('/api/mentors/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setStatus('success')
        setEmail('')
      } else {
        const data = await res.json()
        setErrorMsg(data.error ?? 'Something went wrong.')
        setStatus('error')
      }
    } catch {
      setErrorMsg('Network error. Please try again.')
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#2d6a6a', fontWeight: 600 }}>
        {direction === 'request_mentor'
          ? 'Mentor relationship created. They have been notified by email.'
          : 'Practitioner invited. They have been notified by email.'}
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={placeholder}
        required
        disabled={status === 'loading'}
        style={{
          fontFamily: 'Roboto, sans-serif',
          fontSize: '13px',
          padding: '8px 12px',
          border: '1px solid #d4d4d4',
          borderRadius: '3px',
          outline: 'none',
          width: '240px',
        }}
      />
      <button
        type="submit"
        disabled={status === 'loading'}
        style={{
          fontFamily: 'Roboto, sans-serif',
          fontSize: '12px',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          padding: '8px 16px',
          background: status === 'loading' ? '#767676' : '#1a3a6b',
          color: '#fff',
          border: 'none',
          borderRadius: '3px',
          cursor: status === 'loading' ? 'not-allowed' : 'pointer',
        }}
      >
        {status === 'loading' ? 'Sending...' : buttonLabel}
      </button>
      {status === 'error' && (
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#c0392b', margin: 0, width: '100%' }}>
          {errorMsg}
        </p>
      )}
    </form>
  )
}
