'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface Invitation {
  id: string
  invitee_email: string
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  sent_at: string
  accepted_at: string | null
  declined_at: string | null
}

interface CommitmentLite {
  id: string
  title: string
  status: string
}

const STATUS_BADGE: Record<Invitation['status'], { bg: string; color: string; label: string }> = {
  pending: { bg: '#eef2f8', color: '#1a3a6b', label: 'Pending' },
  accepted: { bg: '#edf7ed', color: '#2d6a2d', label: 'Accepted' },
  declined: { bg: '#fef2f2', color: '#991b1b', label: 'Declined' },
  expired: { bg: '#f5f5f5', color: '#767676', label: 'Expired' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function InvitePage() {
  const params = useParams()
  const id = params.id as string

  const [commitment, setCommitment] = useState<CommitmentLite | null>(null)
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    // Commitment title + status (authoritative source for whether we can invite).
    const commitRes = await fetch(`/api/commitments/${id}`)
    if (!commitRes.ok) {
      setNotFound(true)
      setLoading(false)
      return
    }
    const commitJson = await commitRes.json()
    setCommitment({
      id: commitJson.id,
      title: commitJson.title,
      status: commitJson.status,
    })

    const invRes = await fetch(`/api/sponsors/invite?commitment_id=${id}`)
    if (invRes.ok) {
      const json = await invRes.json()
      setInvitations(json.invitations ?? [])
    }
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

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
      body: JSON.stringify({ commitment_id: id, invitee_email: clean }),
    })
    const json = await res.json()
    if (res.ok) {
      setSuccessMsg(`Invitation sent to ${clean}.`)
      setEmail('')
      await load()
    } else {
      setError(json.error || 'Failed to send invitation.')
    }
    setSubmitting(false)
  }

  async function handleCopyLink(inviteId: string) {
    // Re-fetch the invitation list is the simplest path; but we need the token.
    // The list endpoint does not expose invite_token for security — so copy-link
    // requires a fresh invite. For v1, surface an inline note telling the
    // practitioner to check the invitee's email.
    alert('The invitation was emailed directly. If it didn\u2019t arrive, invite again with the same address.')
    void inviteId
  }

  if (loading) {
    return (
      <main style={{ maxWidth: '720px', margin: '0 auto', padding: '40px 24px' }}>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#767676' }}>Loading...</p>
      </main>
    )
  }

  if (notFound || !commitment) {
    return (
      <main style={{ maxWidth: '720px', margin: '0 auto', padding: '40px 24px' }}>
        <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '28px', fontWeight: 700, margin: '0 0 8px' }}>
          Commitment not found
        </h1>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#767676' }}>
          This commitment doesn&rsquo;t exist or you don&rsquo;t have access.
        </p>
      </main>
    )
  }

  const canInvite = commitment.status === 'launch' || commitment.status === 'active'
  const pending = invitations.filter((i) => i.status === 'pending')
  const accepted = invitations.filter((i) => i.status === 'accepted')

  return (
    <main style={{ maxWidth: '720px', margin: '0 auto', padding: '40px 24px 80px' }}>
      <Link
        href={`/commit/${id}`}
        style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#767676', textDecoration: 'none', display: 'inline-block', marginBottom: '20px' }}
      >
        ← Back to commitment
      </Link>

      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#767676', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>
        Invite a Sponsor
      </p>
      <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '30px', fontWeight: 700, color: '#1a1a1a', margin: '0 0 8px', lineHeight: 1.15 }}>
        {commitment.title}
      </h1>
      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#5a5a5a', margin: '0 0 32px' }}>
        On Search Star, a sponsor is a witness. They pledge now, watch the practice unfold on a private feed, and release payment at day 90. Any sponsor can veto at any time and the streak ends.
      </p>

      {canInvite ? (
        <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderLeft: '3px solid #1a3a6b', borderRadius: '3px', padding: '24px 28px', marginBottom: '32px' }}>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', marginBottom: '14px', marginTop: 0 }}>
            Send an invitation
          </p>

          <form onSubmit={handleInvite}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="sponsor@example.com"
                style={{ flex: '1 1 240px', padding: '9px 12px', border: '1px solid #d4d4d4', borderRadius: '3px', fontFamily: 'Roboto, sans-serif', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                onFocus={(e) => { e.target.style.borderColor = '#1a3a6b' }}
                onBlur={(e) => { e.target.style.borderColor = '#d4d4d4' }}
              />
              <button
                type="submit"
                disabled={submitting}
                style={{
                  background: submitting ? '#8a9fc0' : '#1a3a6b',
                  color: '#fff',
                  fontFamily: 'Roboto, sans-serif',
                  fontSize: '13px',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  padding: '10px 20px',
                  borderRadius: '3px',
                  border: 'none',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  textTransform: 'uppercase',
                }}
              >
                {submitting ? 'Sending...' : 'Send invitation'}
              </button>
            </div>

            {error && (
              <div style={{ marginTop: '12px', padding: '10px 14px', background: '#fef2f2', borderLeft: '3px solid #991b1b', borderRadius: '3px' }}>
                <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#991b1b', margin: 0 }}>{error}</p>
              </div>
            )}
            {successMsg && (
              <div style={{ marginTop: '12px', padding: '10px 14px', background: '#edf7ed', borderLeft: '3px solid #2d6a2d', borderRadius: '3px' }}>
                <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#2d6a2d', margin: 0 }}>{successMsg}</p>
              </div>
            )}

            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', color: '#b8b8b8', marginTop: '14px', marginBottom: 0, lineHeight: '1.5' }}>
              The invitee receives an email with a pre-filled pledge form. They can adjust the amount before confirming.
            </p>
          </form>
        </div>
      ) : (
        <div style={{ background: '#f5f5f5', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '20px 24px', marginBottom: '32px' }}>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#5a5a5a', margin: 0, lineHeight: 1.6 }}>
            This commitment is {commitment.status}. Invitations are only sent during launch or active status.
          </p>
        </div>
      )}

      {invitations.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', marginBottom: '14px' }}>
            Invitations ({pending.length} pending, {accepted.length} accepted)
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {invitations.map((inv) => {
              const badge = STATUS_BADGE[inv.status]
              return (
                <div
                  key={inv.id}
                  style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#1a1a1a', margin: '0 0 2px', fontWeight: 600 }}>
                      {inv.invitee_email}
                    </p>
                    <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', color: '#767676', margin: 0 }}>
                      Sent {formatDate(inv.sent_at)}
                      {inv.accepted_at && ` · Accepted ${formatDate(inv.accepted_at)}`}
                    </p>
                  </div>
                  <span
                    style={{
                      fontFamily: 'Roboto, sans-serif',
                      fontSize: '10px',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      padding: '3px 9px',
                      borderRadius: '3px',
                      background: badge.bg,
                      color: badge.color,
                    }}
                  >
                    {badge.label}
                  </span>
                  {inv.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => handleCopyLink(inv.id)}
                      style={{
                        background: 'transparent',
                        color: '#1a3a6b',
                        fontFamily: 'Roboto, sans-serif',
                        fontSize: '11px',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        padding: '6px 10px',
                        borderRadius: '3px',
                        border: '1px solid #1a3a6b',
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                      }}
                    >
                      Details
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </main>
  )
}
