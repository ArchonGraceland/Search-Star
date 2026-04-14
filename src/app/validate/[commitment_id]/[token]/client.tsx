'use client'

import { useState } from 'react'
import Link from 'next/link'
import PublicHeader from '@/components/public-header'

interface Post {
  id: string
  body: string | null
  session_number: number
  posted_at: string
}

interface Props {
  validatorId: string
  token: string
  commitmentId: string
  commitmentTitle: string
  commitmentStatus: string
  sessionsLogged: number
  practitionerName: string
  posts: Post[]
  confirmedPostIds: string[]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  launch: { bg: '#eef2f8', color: '#1a3a6b', label: 'Launch' },
  active: { bg: '#edf7ed', color: '#2d6a2d', label: 'Active' },
  completed: { bg: '#fdf8ec', color: '#7a5c00', label: 'Completed' },
  abandoned: { bg: '#f5f5f5', color: '#767676', label: 'Abandoned' },
}

export default function ValidatorClient({
  validatorId, token, commitmentId, commitmentTitle,
  commitmentStatus, sessionsLogged, practitionerName,
  posts, confirmedPostIds: initialConfirmed,
}: Props) {
  const [confirmedPostIds, setConfirmedPostIds] = useState(new Set(initialConfirmed))
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const handleConfirm = async (postId: string) => {
    setConfirmingId(postId)
    try {
      const res = await fetch(`/api/validate/${commitmentId}/posts/${postId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ validator_token: token }),
      })
      if (res.ok) setConfirmedPostIds(prev => new Set([...prev, postId]))
    } finally {
      setConfirmingId(null)
    }
  }

  const badge = STATUS_BADGE[commitmentStatus] ?? STATUS_BADGE.abandoned

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <PublicHeader />
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '40px 24px' }}>

        {/* Eyebrow */}
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#767676', textTransform: 'uppercase', fontWeight: 700, marginBottom: '12px' }}>
          Validator View
        </p>

        {/* Title + badge */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '32px', fontWeight: 700, margin: 0, flex: 1, minWidth: '200px' }}>
            {commitmentTitle}
          </h1>
          <span style={{
            fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            background: badge.bg, color: badge.color, borderRadius: '2px',
            padding: '4px 10px', whiteSpace: 'nowrap', alignSelf: 'center',
          }}>
            {badge.label}
          </span>
        </div>

        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#5a5a5a', marginBottom: '8px' }}>
          by <strong>{practitionerName}</strong>
        </p>

        {/* Stats */}
        <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '20px 24px', marginBottom: '24px', marginTop: '20px' }}>
          <div style={{ display: 'flex', gap: '32px' }}>
            <div>
              <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#767676', margin: '0 0 2px' }}>Sessions logged</p>
              <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '28px', fontWeight: 700, color: '#1a3a6b', margin: 0 }}>{sessionsLogged}</p>
            </div>
            <div>
              <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#767676', margin: '0 0 2px' }}>Your confirmations</p>
              <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '28px', fontWeight: 700, color: '#2d6a2d', margin: 0 }}>{confirmedPostIds.size}</p>
            </div>
          </div>
        </div>

        {/* Search Star intro */}
        <div style={{ background: '#eef2f8', border: '1px solid #c8d4e8', borderRadius: '3px', padding: '20px 24px', marginBottom: '28px' }}>
          <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#1a1a1a', marginBottom: '8px' }}>
            Want to build something of your own?
          </p>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#5a5a5a', lineHeight: 1.65, marginBottom: '14px' }}>
            Search Star is a platform for people making 90-day practice commitments — witnessed by people who know them, backed by sponsors who believe in them.
          </p>
          <Link href="/signup" style={{
            fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1a3a6b',
            textDecoration: 'none', borderBottom: '2px solid #1a3a6b', paddingBottom: '1px',
          }}>
            Start your own commitment →
          </Link>
        </div>

        {/* Session feed */}
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', marginBottom: '16px' }}>
          Session history
        </p>

        {posts.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '40px 28px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#b8b8b8', margin: 0 }}>No sessions logged yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {posts.map(post => {
              const confirmed = confirmedPostIds.has(post.id)
              const isConfirming = confirmingId === post.id
              return (
                <div key={post.id} style={{
                  background: '#fff', border: '1px solid #d4d4d4',
                  borderLeft: confirmed ? '2px solid #2d6a2d' : '2px solid #d4d4d4',
                  borderRadius: '3px', padding: '16px 20px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: post.body ? '10px' : 0 }}>
                        <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700, color: '#1a3a6b', letterSpacing: '0.04em' }}>
                          {post.session_number === 0 ? 'Start ritual' : `Session ${post.session_number}`}
                        </span>
                        <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', color: '#b8b8b8' }}>{formatDate(post.posted_at)}</span>
                      </div>
                      {post.body && <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#3a3a3a', margin: 0, lineHeight: '1.6' }}>{post.body}</p>}
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      {confirmed ? (
                        <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700, background: '#edf7ed', color: '#2d6a2d', borderRadius: '2px', padding: '6px 12px', display: 'inline-block' }}>
                          Confirmed ✓
                        </span>
                      ) : (
                        <button onClick={() => handleConfirm(post.id)} disabled={isConfirming} style={{
                          background: isConfirming ? '#8a9fc0' : '#1a3a6b', color: '#fff',
                          fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700,
                          letterSpacing: '0.04em', padding: '6px 14px', borderRadius: '3px',
                          border: 'none', cursor: isConfirming ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                        }}>
                          {isConfirming ? 'Confirming...' : 'Confirm ✓'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
