'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

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

interface SponsorStats {
  total_pledged: number
  pledge_count: number
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
        <div style={{ width: `${launchPct}%`, background: '#1a3a6b', borderRadius: '3px 0 0 3px' }} />
        <div style={{ flex: 1, background: '#4a6fa5', borderRadius: '0 3px 3px 0' }} />
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
        <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '10px', color: '#b8b8b8' }}>Launch (7 days)</span>
        <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '10px', color: '#b8b8b8' }}>Streak (83 days)</span>
      </div>
    </div>
  )
}

function ContributionModal({
  commitment,
  totalPledged,
  onDismiss,
}: {
  commitment: Commitment
  totalPledged: number
  onDismiss: () => void
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '24px',
    }}>
      <div style={{
        background: '#fff', borderRadius: '3px', border: '1px solid #d4d4d4',
        maxWidth: '540px', width: '100%', maxHeight: '90vh', overflowY: 'auto',
        padding: '36px 40px',
      }}>
        <p style={{ fontSize: '36px', textAlign: 'center', marginBottom: '12px' }}>🎉</p>
        <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '26px', fontWeight: 700, margin: '0 0 8px', textAlign: 'center' }}>
          You completed {commitment.title}!
        </h2>

        <div style={{ background: '#eef2f8', borderRadius: '3px', padding: '12px 16px', margin: '16px 0 20px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#767676', margin: '0 0 2px' }}>
            Total pledged by sponsors
          </p>
          <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '32px', fontWeight: 700, color: '#1a3a6b', margin: 0 }}>
            ${totalPledged.toFixed(2)}
          </p>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#767676', margin: '4px 0 0' }}>
            This is yours — 100%.
          </p>
        </div>

        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#3a3a3a', lineHeight: '1.6', margin: '0 0 24px' }}>
          A voluntary-contribution prompt is coming soon. In the meantime, your completed commitment is recorded and the pledges are yours in full.
        </p>

        <button
          onClick={onDismiss}
          style={{ width: '100%', background: '#1a3a6b', color: '#fff', fontFamily: 'Roboto, sans-serif', fontSize: '14px', fontWeight: 700, letterSpacing: '0.04em', padding: '12px 20px', borderRadius: '3px', border: 'none', cursor: 'pointer' }}
        >
          Done
        </button>
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

  const [sponsorStats, setSponsorStats] = useState<SponsorStats>({ total_pledged: 0, pledge_count: 0 })
  const [copied, setCopied] = useState(false)

  const [showConfirmComplete, setShowConfirmComplete] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [showContributionModal, setShowContributionModal] = useState(false)
  const [totalPledgedAtCompletion, setTotalPledgedAtCompletion] = useState(0)

  const load = useCallback(async () => {
    const res = await fetch(`/api/commitments/${id}`)
    if (res.ok) {
      const data = await res.json()
      setCommitment(data.commitment)
      setPosts(data.posts)
      const todayStr = new Date().toISOString().slice(0, 10)
      const todayPost = data.posts.find((p: Post) => p.posted_at.slice(0, 10) === todayStr)
      setLoggedToday(!!todayPost)
    }

    const sRes = await fetch(`/api/sponsorships/${id}`)
    if (sRes.ok) {
      const sData = await sRes.json()
      setSponsorStats({
        total_pledged: sData.total_pledged ?? 0,
        pledge_count: sData.sponsorships?.length ?? 0,
      })
    }

    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  // After load: if completed and not dismissed, show the completion modal
  useEffect(() => {
    if (!commitment) return
    if (commitment.status !== 'completed') return
    const declined = typeof window !== 'undefined'
      ? localStorage.getItem(`contribution_declined_${id}`)
      : null
    if (declined) return
    setTotalPledgedAtCompletion(sponsorStats.total_pledged)
    setShowContributionModal(true)
  }, [commitment, id, sponsorStats.total_pledged])

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
    } else {
      const data = await res.json()
      setSubmitError(data.error || 'Failed to log session.')
    }
    setSubmitting(false)
  }

  const handleComplete = async () => {
    setCompleting(true)
    const res = await fetch(`/api/commitments/${id}/complete`, { method: 'POST' })
    const data = await res.json()
    setCompleting(false)
    setShowConfirmComplete(false)
    if (res.ok) {
      setTotalPledgedAtCompletion(data.total_pledged ?? 0)
      await load()
      setShowContributionModal(true)
    }
  }

  const handleDismissContribution = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`contribution_declined_${id}`, '1')
    }
    setShowContributionModal(false)
  }

  const sponsorUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/sponsor/${id}`
    : `https://searchstar.com/sponsor/${id}`

  const handleCopySponsorUrl = async () => {
    try {
      await navigator.clipboard.writeText(sponsorUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
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
      {/* Contribution modal */}
      {showContributionModal && commitment.status === 'completed' && (
        <ContributionModal
          commitment={commitment}
          totalPledged={totalPledgedAtCompletion}
          onDismiss={handleDismissContribution}
        />
      )}

      {/* Confirm complete dialog */}
      {showConfirmComplete && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 999, padding: '24px',
        }}>
          <div style={{ background: '#fff', borderRadius: '3px', border: '1px solid #d4d4d4', maxWidth: '440px', width: '100%', padding: '32px 36px' }}>
            <h3 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '22px', fontWeight: 700, margin: '0 0 12px' }}>
              Mark as complete?
            </h3>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#5a5a5a', lineHeight: '1.6', margin: '0 0 24px' }}>
              This will mark your commitment as completed and trigger the voluntary contribution prompt. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleComplete}
                disabled={completing}
                style={{ flex: 1, background: completing ? '#8a9fc0' : '#2d6a2d', color: '#fff', fontFamily: 'Roboto, sans-serif', fontSize: '13px', fontWeight: 700, letterSpacing: '0.04em', padding: '10px 20px', borderRadius: '3px', border: 'none', cursor: completing ? 'not-allowed' : 'pointer' }}
              >
                {completing ? 'Completing...' : 'Yes, mark complete'}
              </button>
              <button
                onClick={() => setShowConfirmComplete(false)}
                disabled={completing}
                style={{ flex: 1, background: '#fff', color: '#5a5a5a', fontFamily: 'Roboto, sans-serif', fontSize: '13px', fontWeight: 600, padding: '10px 20px', borderRadius: '3px', border: '1px solid #d4d4d4', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
          fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', background: badge.bg, color: badge.color, borderRadius: '2px',
          padding: '4px 10px', whiteSpace: 'nowrap', alignSelf: 'center',
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

      {/* Sponsor link section — launch status only */}
      {commitment.status === 'launch' && (
        <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderLeft: '3px solid #c8922a', borderRadius: '3px', padding: '20px 24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', margin: 0 }}>
              Invite sponsors
            </p>
            <Link
              href={`/commit/${id}/sponsors`}
              style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#1a3a6b', textDecoration: 'none', fontWeight: 600 }}
            >
              View all sponsors →
            </Link>
          </div>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#3a3a3a', marginBottom: '12px', lineHeight: '1.5', margin: '0 0 12px' }}>
            Share your commitment to invite sponsors.
            {sponsorStats.pledge_count > 0
              ? ` ${sponsorStats.pledge_count} ${sponsorStats.pledge_count === 1 ? 'person has' : 'people have'} pledged a total of $${sponsorStats.total_pledged.toFixed(2)}.`
              : ' No sponsors yet.'}
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input
              type="text"
              readOnly
              value={sponsorUrl}
              style={{ flex: 1, minWidth: '200px', padding: '9px 12px', border: '1px solid #d4d4d4', borderRadius: '3px', fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#5a5a5a', background: '#fafafa', outline: 'none' }}
            />
            <button
              onClick={handleCopySponsorUrl}
              style={{
                background: copied ? '#2d6a2d' : '#1a3a6b',
                color: '#fff', fontFamily: 'Roboto, sans-serif', fontSize: '13px', fontWeight: 700,
                letterSpacing: '0.04em', padding: '9px 16px', borderRadius: '3px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {copied ? '\u2713 Copied' : 'Copy link'}
            </button>
          </div>
        </div>
      )}

      {/* Log a session */}
      {(commitment.status === 'launch' || commitment.status === 'active') && (
        <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderLeft: '3px solid #1a3a6b', borderRadius: '3px', padding: '24px 28px', marginBottom: '24px' }}>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', marginBottom: '16px' }}>
            Log today&apos;s session
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
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '3px', fontFamily: 'Roboto, sans-serif', fontSize: '14px', outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: '1.5', marginBottom: '12px' }}
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
                style={{ background: submitting ? '#8a9fc0' : '#1a3a6b', color: '#fff', fontFamily: 'Roboto, sans-serif', fontSize: '13px', fontWeight: 700, letterSpacing: '0.04em', padding: '10px 20px', borderRadius: '3px', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer' }}
              >
                {submitting ? 'Logging...' : 'Log session \u2192'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Session feed */}
      <div style={{ marginBottom: '40px' }}>
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
              <div key={post.id} style={{ background: '#fff', border: '1px solid #d4d4d4', borderLeft: '2px solid #d4d4d4', borderRadius: '3px', padding: '16px 20px' }}>
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

      {/* Mark as complete — active status only */}
      {commitment.status === 'active' && (
        <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderLeft: '3px solid #2d6a2d', borderRadius: '3px', padding: '20px 24px', marginBottom: '40px' }}>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', marginBottom: '10px', marginTop: 0 }}>
            Finished your commitment?
          </p>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#3a3a3a', marginBottom: '14px', lineHeight: '1.5' }}>
            If you&apos;ve completed your 90-day commitment, mark it as complete to unlock your sponsor pledges.
          </p>
          <button
            onClick={() => setShowConfirmComplete(true)}
            style={{ background: '#2d6a2d', color: '#fff', fontFamily: 'Roboto, sans-serif', fontSize: '13px', fontWeight: 700, letterSpacing: '0.04em', padding: '10px 20px', borderRadius: '3px', border: 'none', cursor: 'pointer' }}
          >
            Mark as complete ✓
          </button>
        </div>
      )}

      {/* Sponsors section — Phase 2 builds the invitation flow and the release/veto actions */}
      <div>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', marginBottom: '16px' }}>
          Sponsors
        </p>
        <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderLeft: '3px solid #4a6fa5', borderRadius: '3px', padding: '20px 24px' }}>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#3a3a3a', margin: '0 0 8px', lineHeight: '1.6' }}>
            {sponsorStats.pledge_count > 0
              ? `${sponsorStats.pledge_count} ${sponsorStats.pledge_count === 1 ? 'sponsor has' : 'sponsors have'} pledged $${sponsorStats.total_pledged.toFixed(2)} so far.`
              : 'No sponsors yet. Share your pledge link above to invite someone who will back your commitment.'}
          </p>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#767676', margin: 0, lineHeight: '1.6' }}>
            Sponsor invitations and release/veto actions are coming in the next update.
          </p>
        </div>
      </div>
    </div>
  )
}
