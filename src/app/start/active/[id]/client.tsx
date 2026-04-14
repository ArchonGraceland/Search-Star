'use client'

import { useState } from 'react'
import Link from 'next/link'
import StageShell from '@/components/stage-shell'

interface Post {
  id: string
  body: string | null
  session_number: number
  posted_at: string
}

interface Props {
  commitmentId: string
  title: string
  dayNumber: number
  daysRemaining: number
  sessionsLogged: number
  recentPosts: Post[]
  loggedToday: boolean
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function ActiveStreakClient({
  commitmentId, title, dayNumber, daysRemaining,
  sessionsLogged, recentPosts, loggedToday: initialLoggedToday,
}: Props) {
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loggedToday, setLoggedToday] = useState(initialLoggedToday)
  const [posts, setPosts] = useState<Post[]>(recentPosts)
  const [sessionCount, setSessionCount] = useState(sessionsLogged)

  const handleLog = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true); setError(null)

    const res = await fetch(`/api/commitments/${commitmentId}/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: body.trim() || undefined }),
    })

    if (res.ok) {
      const data = await res.json()
      const newPost: Post = {
        id: data.id,
        body: body.trim() || null,
        session_number: sessionCount + 1,
        posted_at: new Date().toISOString(),
      }
      setPosts(prev => [newPost, ...prev])
      setSessionCount(c => c + 1)
      setLoggedToday(true)
      setBody('')
    } else {
      const data = await res.json()
      setError(data.error || 'Failed to log session.')
    }
    setSubmitting(false)
  }

  // Progress bar fill %
  const pct = Math.min(100, Math.round((dayNumber / 90) * 100))

  const labelStyle: React.CSSProperties = {
    fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700,
    letterSpacing: '0.12em', textTransform: 'uppercase', color: '#767676',
  }

  return (
    <StageShell stage={6}>
      {/* Title */}
      <div style={{ marginBottom: '28px' }}>
        <p style={{ ...labelStyle, marginBottom: '6px' }}>Active streak</p>
        <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '32px', fontWeight: 700, color: '#1a1a1a', lineHeight: 1.15, marginBottom: 0 }}>
          {title}
        </h1>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
          <span style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '28px', fontWeight: 700, color: '#1a3a6b' }}>
            Day {dayNumber}
          </span>
          <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#767676' }}>
            {daysRemaining} days remaining
          </span>
        </div>
        <div style={{ height: '6px', background: '#e8e8e8', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: '#1a3a6b', borderRadius: '3px', transition: 'width 0.3s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
          <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', color: '#b8b8b8' }}>Day 1</span>
          <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', color: '#b8b8b8' }}>{sessionCount} sessions logged</span>
          <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', color: '#b8b8b8' }}>Day 90</span>
        </div>
      </div>

      {/* Log today's session */}
      <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderLeft: `3px solid ${loggedToday ? '#2d6a2d' : '#1a3a6b'}`, borderRadius: '3px', padding: '24px', marginBottom: '24px' }}>
        <p style={{ ...labelStyle, marginBottom: '14px' }}>
          {loggedToday ? 'Session logged today ✓' : "Log today's session"}
        </p>

        {loggedToday ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#edf7ed', border: '2px solid #2d6a2d', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                <path d="M1 5l4 4 8-8" stroke="#2d6a2d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#2d6a2d', margin: 0, fontWeight: 600 }}>
              You've shown up today. Your validators can see it.
            </p>
          </div>
        ) : (
          <form onSubmit={handleLog}>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              maxLength={1000} rows={4}
              placeholder="What did you work on today? (optional — the fact of showing up is what matters)"
              style={{
                width: '100%', padding: '11px 14px', border: '1px solid #d4d4d4',
                borderRadius: '3px', fontFamily: 'Roboto, sans-serif', fontSize: '14px',
                outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6,
                marginBottom: '12px',
              }}
              onFocus={e => { e.target.style.borderColor = '#1a3a6b' }}
              onBlur={e => { e.target.style.borderColor = '#d4d4d4' }}
            />
            {error && (
              <div style={{ marginBottom: '12px', padding: '10px 14px', background: '#fef2f2', borderLeft: '3px solid #991b1b', borderRadius: '3px' }}>
                <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#991b1b', margin: 0 }}>{error}</p>
              </div>
            )}
            <button type="submit" disabled={submitting} style={{
              background: submitting ? '#8a9fc0' : '#1a3a6b', color: '#fff',
              fontFamily: 'Roboto, sans-serif', fontSize: '13px', fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase', padding: '11px 24px',
              border: 'none', borderRadius: '3px', cursor: submitting ? 'not-allowed' : 'pointer',
            }}>
              {submitting ? 'Logging...' : 'Log session →'}
            </button>
          </form>
        )}
      </div>

      {/* Recent sessions */}
      {posts.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <p style={{ ...labelStyle, marginBottom: '12px' }}>Recent sessions</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {posts.slice(0, 5).map(post => (
              <div key={post.id} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: '3px', padding: '14px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: post.body ? '6px' : 0 }}>
                  <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700, color: '#1a3a6b' }}>
                    {post.session_number > 0 ? `Session ${post.session_number}` : 'Start ritual'}
                  </span>
                  <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', color: '#b8b8b8' }}>
                    {formatDate(post.posted_at)}
                  </span>
                </div>
                {post.body && (
                  <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#3a3a3a', margin: 0, lineHeight: 1.6 }}>
                    {post.body}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* What now */}
      <div style={{ background: '#eef2f8', border: '1px solid #c8d4e8', borderRadius: '3px', padding: '24px', marginBottom: '24px' }}>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1a3a6b', marginBottom: '16px' }}>
          Your three jobs
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            { n: '01', text: 'Come back tomorrow and log your session. Every day for 90 days.' },
            { n: '02', text: "Share your sponsor link with people who believe in what you're building.", link: `/sponsor/${commitmentId}`, linkText: 'Copy sponsor link →' },
            { n: '03', text: 'Invite more validators — people who will witness the work is real.', link: `/start/validator/${commitmentId}`, linkText: 'Invite a validator →' },
          ].map(item => (
            <div key={item.n} style={{ display: 'flex', gap: '14px' }}>
              <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, color: '#1a3a6b', opacity: 0.5, flexShrink: 0, paddingTop: '2px', minWidth: '20px' }}>{item.n}</span>
              <div>
                <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#3a3a3a', margin: '0 0 4px', lineHeight: 1.55 }}>{item.text}</p>
                {item.link && (
                  <Link href={item.link} style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700, color: '#1a3a6b', textDecoration: 'none', borderBottom: '1px solid #1a3a6b' }}>
                    {item.linkText}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer links */}
      <div style={{ borderTop: '1px solid #e8e8e8', paddingTop: '20px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        <Link href="/dashboard" style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#767676', textDecoration: 'none' }}>
          Dashboard →
        </Link>
        <Link href={`/start/launch/${commitmentId}`} style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#767676', textDecoration: 'none' }}>
          View sponsors & validators →
        </Link>
      </div>
    </StageShell>
  )
}
