'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'

interface Practice {
  id: string
  name: string
  label: string
  skill_categories: { name: string } | { name: string }[] | null
}

interface Commitment {
  id: string
  title: string
  description: string | null
  frequency: string
  sessions_per_week: number | null
  status: 'launch' | 'active' | 'completed' | 'abandoned'
  launch_starts_at: string
  launch_ends_at: string
  streak_starts_at: string
  streak_ends_at: string
  completed_at: string | null
  sessions_logged: number
  created_at: string
  practices: Practice | null
}

interface Post {
  id: string
  body: string | null
  session_number: number
  posted_at: string
}

interface Validator {
  id: string
  validator_email: string
  status: 'invited' | 'active' | 'declined'
  invited_at: string
}

const VALIDATOR_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  invited:  { bg: '#f5f5f5',  color: '#767676', label: 'Invited' },
  active:   { bg: '#edf7ed',  color: '#2d6a2d', label: 'Active' },
  declined: { bg: '#fef2f2',  color: '#991b1b', label: 'Declined' },
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  launch: { bg: '#eef2f8', color: '#1a3a6b', label: 'Launch' },
  active: { bg: '#edf7ed', color: '#2d6a2d', label: 'Active' },
  completed: { bg: '#fdf8ec', color: '#7a5c00', label: 'Completed' },
  abandoned: { bg: '#f5f5f5', color: '#767676', label: 'Abandoned' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function dayOfCommitment(launchStartsAt: string): number {
  const start = new Date(launchStartsAt)
  const now = new Date()
  const diff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(1, Math.min(90, diff + 1))
}

function TimelineBar({ commitment }: { commitment: Commitment }) {
  const launchStart = new Date(commitment.launch_starts_at)
  const streakEnd = new Date(commitment.streak_ends_at)
  const totalMs = streakEnd.getTime() - launchStart.getTime()
  const now = new Date()
  const elapsedMs = Math.max(0, Math.min(now.getTime() - launchStart.getTime(), totalMs))
  const todayPct = (elapsedMs / totalMs) * 100

  // Launch segment = 7/90 of total, streak = 83/90
  const launchPct = (7 / 90) * 100
  const day = dayOfCommitment(commitment.launch_starts_at)

  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
        <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#767676', fontWeight: 600 }}>
          Day {day} of 90
        </span>
        <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', color: '#b8b8b8' }}>
          {commitment.frequency === 'weekly'
            ? `${commitment.sessions_per_week} sessions/week`
            : 'Daily'}
        </span>
      </div>
      <div style={{ position: 'relative', height: '10px', display: 'flex', borderRadius: '3px', overflow: 'visible' }}>
        {/* Launch segment */}
        <div style={{
          width: `${launchPct}%`,
          background: '#1a3a6b',
          borderRadius: '3px 0 0 3px',
        }} />
        {/* Streak segment */}
        <div style={{
          flex: 1,
          background: '#4a6fa5',
          borderRadius: '0 3px 3px 0',
        }} />
        {/* Today tick */}
        <div style={{
          position: 'absolute',
          left: `${Math.min(todayPct, 98)}%`,
          top: '-4px',
          width: '3px',
          height: '18px',
          background: '#c8922a',
          borderRadius: '2px',
          transform: 'translateX(-50%)',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
        <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '10px', color: '#b8b8b8' }}>
          Launch (7 days)
        </span>
        <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '10px', color: '#b8b8b8' }}>
          Streak (83 days)
        </span>
      </div>
    </div>
  )
}

export default function CommitDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [commitment, setCommitment] = useState<Commitment | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [sessionBody, setSessionBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [loggedToday, setLoggedToday] = useState(false)

  // Validators state
  const [validators, setValidators] = useState<Validator[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/commitments/${id}`)
    if (res.ok) {
      const data = await res.json()
      setCommitment(data.commitment)
      setPosts(data.posts)

      // Check if a post exists for today (UTC)
      const todayStr = new Date().toISOString().slice(0, 10)
      const todayPost = data.posts.find((p: Post) => p.posted_at.slice(0, 10) === todayStr)
      setLoggedToday(!!todayPost)
    }
    setLoading(false)
  }, [id])

  const loadValidators = useCallback(async () => {
    const res = await fetch(`/api/commitments/${id}/validators`)
    if (res.ok) {
      const data = await res.json()
      setValidators(data.validators ?? [])
    }
  }, [id])

  useEffect(() => {
    load()
    loadValidators()
  }, [load, loadValidators])

  const handleInviteValidator = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviting(true)
    setInviteError(null)
    setInviteSuccess(null)

    const res = await fetch(`/api/commitments/${id}/validators`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail }),
    })

    if (res.ok) {
      setInviteSuccess(`Invite sent to ${inviteEmail}`)
      setInviteEmail('')
      await loadValidators()
    } else {
      const data = await res.json()
      setInviteError(data.error || 'Failed to send invitation.')
    }
    setInviting(false)
  }

  const handleLogSession = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError(null)

    const res = await fetch(`/api/commitments/${id}/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: sessionBody }),
    })

    if (res.ok) {
      setSessionBody('')
      await load()
    } else if (res.status === 409) {
      setLoggedToday(true)
      setSubmitError(null)
    } else {
      const data = await res.json()
      setSubmitError(data.error || 'Failed to log session.')
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div style={{ maxWidth: '720px' }}>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#767676' }}>Loading commitment...</p>
      </div>
    )
  }

  if (!commitment) {
    return (
      <div style={{ maxWidth: '720px' }}>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#767676' }}>Commitment not found.</p>
      </div>
    )
  }

  const badge = STATUS_BADGE[commitment.status] ?? STATUS_BADGE.abandoned
  const practice = commitment.practices
  const categoryName = practice?.skill_categories
    ? (Array.isArray(practice.skill_categories)
        ? (practice.skill_categories[0] as { name: string })?.name
        : (practice.skill_categories as { name: string }).name)
    : null
  const labelCap = practice?.label
    ? practice.label.charAt(0).toUpperCase() + practice.label.slice(1)
    : null

  return (
    <div style={{ maxWidth: '720px' }}>
      {/* Eyebrow */}
      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#767676', textTransform: 'uppercase', fontWeight: 700, marginBottom: '12px' }}>
        Commitment
      </p>

      {/* Title + badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '32px', fontWeight: 700, margin: 0, flex: 1, minWidth: '200px' }}>
          {commitment.title}
        </h1>
        <span style={{
          fontFamily: 'Roboto, sans-serif',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          background: badge.bg,
          color: badge.color,
          borderRadius: '2px',
          padding: '4px 10px',
          whiteSpace: 'nowrap',
          alignSelf: 'center',
        }}>
          {badge.label}
        </span>
      </div>

      {/* Practice tags */}
      {practice && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5a5a5a', background: '#f0f0f0', borderRadius: '2px', padding: '3px 8px' }}>
            {practice.name}
          </span>
          {labelCap && (
            <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#1a3a6b', background: '#eef2f8', borderRadius: '2px', padding: '3px 8px' }}>
              {labelCap}
            </span>
          )}
          {categoryName && (
            <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5a5a5a', background: '#f0f0f0', borderRadius: '2px', padding: '3px 8px' }}>
              {categoryName}
            </span>
          )}
        </div>
      )}

      {commitment.description && (
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#5a5a5a', marginBottom: '24px', lineHeight: '1.6' }}>
          {commitment.description}
        </p>
      )}

      {/* Timeline */}
      <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '20px 24px', marginBottom: '24px' }}>
        <TimelineBar commitment={commitment} />
        <div style={{ display: 'flex', gap: '24px' }}>
          <div>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#767676', margin: '0 0 2px' }}>
              Sessions logged
            </p>
            <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '24px', fontWeight: 700, color: '#1a3a6b', margin: 0 }}>
              {commitment.sessions_logged}
            </p>
          </div>
          <div>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#767676', margin: '0 0 2px' }}>
              Started
            </p>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#1a1a1a', margin: 0 }}>
              {formatDate(commitment.launch_starts_at)}
            </p>
          </div>
        </div>
      </div>

      {/* Log a session */}
      <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderLeft: '3px solid #1a3a6b', borderRadius: '3px', padding: '24px 28px', marginBottom: '24px' }}>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', marginBottom: '16px' }}>
          Log today's session
        </p>

        {loggedToday ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>✓</span>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#2d6a2d', fontWeight: 600, margin: 0 }}>
              Session logged today
            </p>
          </div>
        ) : (
          <form onSubmit={handleLogSession}>
            <textarea
              value={sessionBody}
              onChange={(e) => setSessionBody(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="What did you work on today? (optional)"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d4d4d4',
                borderRadius: '3px',
                fontFamily: 'Roboto, sans-serif',
                fontSize: '14px',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
                lineHeight: '1.5',
                marginBottom: '12px',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#1a3a6b' }}
              onBlur={(e) => { e.target.style.borderColor = '#d4d4d4' }}
            />
            {sessionBody.length > 0 && (
              <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', color: '#b8b8b8', marginBottom: '12px', textAlign: 'right' }}>
                {sessionBody.length}/1000
              </p>
            )}
            {submitError && (
              <div style={{ marginBottom: '12px', padding: '10px 14px', background: '#fef2f2', borderLeft: '3px solid #991b1b', borderRadius: '3px' }}>
                <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#991b1b', margin: 0 }}>{submitError}</p>
              </div>
            )}
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
              }}
            >
              {submitting ? 'Logging...' : 'Log session →'}
            </button>
          </form>
        )}
      </div>

      {/* Session feed */}
      <div>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', marginBottom: '16px' }}>
          Session history
        </p>

        {posts.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '32px 28px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#b8b8b8', margin: 0 }}>
              No sessions logged yet. Log your first session above.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {posts.map((post) => (
              <div key={post.id} style={{
                background: '#fff',
                border: '1px solid #d4d4d4',
                borderLeft: '2px solid #d4d4d4',
                borderRadius: '3px',
                padding: '16px 20px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: post.body ? '10px' : 0 }}>
                  <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700, color: '#1a3a6b', letterSpacing: '0.04em' }}>
                    Session {post.session_number}
                  </span>
                  <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', color: '#b8b8b8' }}>
                    {formatDate(post.posted_at)}
                  </span>
                </div>
                {post.body && (
                  <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#3a3a3a', margin: 0, lineHeight: '1.6' }}>
                    {post.body}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Validators section */}
      <div style={{ marginTop: '40px' }}>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', marginBottom: '16px' }}>
          Validators
        </p>

        {validators.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            {validators.map((v) => {
              const vBadge = VALIDATOR_BADGE[v.status] ?? VALIDATOR_BADGE.invited
              return (
                <div key={v.id} style={{
                  background: '#fff',
                  border: '1px solid #d4d4d4',
                  borderRadius: '3px',
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#1a1a1a' }}>
                    {v.validator_email}
                  </span>
                  <span style={{
                    fontFamily: 'Roboto, sans-serif',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    background: vBadge.bg,
                    color: vBadge.color,
                    borderRadius: '2px',
                    padding: '3px 9px',
                  }}>
                    {vBadge.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderLeft: '3px solid #4a6fa5', borderRadius: '3px', padding: '20px 24px' }}>
          {validators.length >= 3 ? (
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#767676', margin: 0 }}>
              Validator limit reached (3/3). Remove an existing validator to invite someone new.
            </p>
          ) : (
            <>
              <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#767676', marginBottom: '14px' }}>
                Invite a validator ({validators.length}/3)
              </p>
              <form onSubmit={handleInviteValidator} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => { setInviteEmail(e.target.value); setInviteSuccess(null); setInviteError(null) }}
                  placeholder="email@example.com"
                  required
                  style={{
                    flex: 1,
                    minWidth: '200px',
                    padding: '9px 12px',
                    border: '1px solid #d4d4d4',
                    borderRadius: '3px',
                    fontFamily: 'Roboto, sans-serif',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#1a3a6b' }}
                  onBlur={(e) => { e.target.style.borderColor = '#d4d4d4' }}
                />
                <button
                  type="submit"
                  disabled={inviting}
                  style={{
                    background: inviting ? '#8a9fc0' : '#1a3a6b',
                    color: '#fff',
                    fontFamily: 'Roboto, sans-serif',
                    fontSize: '13px',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    padding: '9px 20px',
                    borderRadius: '3px',
                    border: 'none',
                    cursor: inviting ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {inviting ? 'Sending…' : 'Send invite →'}
                </button>
              </form>
              {inviteSuccess && (
                <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#2d6a2d', marginTop: '10px', marginBottom: 0 }}>
                  ✓ {inviteSuccess}
                </p>
              )}
              {inviteError && (
                <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#991b1b', marginTop: '10px', marginBottom: 0 }}>
                  {inviteError}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
