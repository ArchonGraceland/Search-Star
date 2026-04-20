'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  roomId: string
}

// Small client component: email input, post, show success/error.
// After a successful POST we router.refresh() so the parent page
// re-renders with the new pending invite in its list.
export default function RoomInviteForm({ roomId }: Props) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (submitting) return
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail.includes('@') || cleanEmail.length < 5) {
      setError('Enter a valid email address.')
      return
    }
    setError(null)
    setSuccess(null)
    setSubmitting(true)
    try {
      const res = await fetch(`/api/rooms/${roomId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitee_email: cleanEmail }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed to send invitation.')
      setSuccess(`Invitation sent to ${cleanEmail}.`)
      setEmail('')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send invitation.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #d4d4d4',
        borderRadius: '3px',
        padding: '20px 22px',
      }}
    >
      <label
        htmlFor="invite-email"
        style={{
          display: 'block',
          fontFamily: 'Roboto, sans-serif',
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: '#767676',
          marginBottom: '8px',
        }}
      >
        Email address
      </label>
      <input
        id="invite-email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="name@example.com"
        disabled={submitting}
        style={{
          width: '100%',
          padding: '10px 12px',
          fontFamily: 'Roboto, sans-serif',
          fontSize: '15px',
          color: '#1a1a1a',
          background: '#ffffff',
          border: '1px solid #d4d4d4',
          borderRadius: '3px',
          boxSizing: 'border-box',
        }}
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        style={{
          marginTop: '14px',
          width: '100%',
          padding: '12px 20px',
          fontFamily: 'Roboto, sans-serif',
          fontSize: '12px',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: '#ffffff',
          background: submitting ? '#5a5a5a' : '#1a3a6b',
          border: 'none',
          borderRadius: '3px',
          cursor: submitting ? 'wait' : 'pointer',
        }}
      >
        {submitting ? 'Sending…' : 'Send invitation'}
      </button>

      {success && (
        <p
          style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: '13px',
            color: '#2d6a2d',
            marginTop: '12px',
            marginBottom: 0,
          }}
        >
          {success}
        </p>
      )}
      {error && (
        <p
          style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: '13px',
            color: '#991b1b',
            marginTop: '12px',
            marginBottom: 0,
          }}
        >
          {error}
        </p>
      )}
    </div>
  )
}
