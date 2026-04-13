'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PublicHeader from '@/components/public-header'

interface Post {
  id: string
  body: string | null
  session_number: number
  posted_at: string
}

interface Commitment {
  id: string
  title: string
  status: string
  sessions_logged: number
  user_id: string
}

interface ValidatorRow {
  id: string
  status: string
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

export default function ValidatorPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const commitment_id = params.commitment_id as string
  const token = searchParams.get('token') ?? ''

  const [commitment, setCommitment] = useState<Commitment | null>(null)
  const [practitionerName, setPractitionerName] = useState<string>('')
  const [posts, setPosts] = useState<Post[]>([])
  const [confirmedPostIds, setConfirmedPostIds] = useState<Set<string>>(new Set())
  const [validatorId, setValidatorId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [invalid, setInvalid] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) { setInvalid(true); setLoading(false); return }

    const supabase = createClient()

    // Verify token and get validator row
    const { data: validator, error: validatorError } = await supabase
      .from('validators')
      .select('id, status, commitment_id')
      .eq('invite_token', token)
      .eq('commitment_id', commitment_id)
      .single()

    if (validatorError || !validator || validator.status !== 'active') {
      setInvalid(true)
      setLoading(false)
      return
    }

    setValidatorId(validator.id)

    // Fetch commitment
    const { data: comm, error: commError } = await supabase
      .from('commitments')
      .select('id, title, status, sessions_logged, user_id')
      .eq('id', commitment_id)
      .single()

    if (commError || !comm) {
      setInvalid(true)
      setLoading(false)
      return
    }

    setCommitment(comm)

    // Fetch practitioner display name
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', comm.user_id)
      .single()

    setPractitionerName(profile?.display_name ?? 'the practitioner')

    // Fetch posts
    const { data: postsData } = await supabase
      .from('commitment_posts')
      .select('id, body, session_number, posted_at')
      .eq('commitment_id', commitment_id)
      .order('posted_at', { ascending: false })

    setPosts(postsData ?? [])

    // Fetch which posts this validator has already confirmed
    if (postsData && postsData.length > 0) {
      const postIds = postsData.map((p) => p.id)
      const { data: confirmations } = await supabase
        .from('post_confirmations')
        .select('post_id')
        .eq('validator_id', validator.id)
        .in('post_id', postIds)

      setConfirmedPostIds(new Set((confirmations ?? []).map((c) => c.post_id)))
    }

    setLoading(false)
  }, [token, commitment_id])

  useEffect(() => { load() }, [load])

  const handleConfirm = async (postId: string) => {
    setConfirmingId(postId)
    try {
      const res = await fetch(`/api/validate/${commitment_id}/posts/${postId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ validator_token: token }),
      })
      if (res.ok) {
        setConfirmedPostIds((prev) => new Set([...prev, postId]))
      }
    } finally {
      setConfirmingId(null)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <PublicHeader />
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 70px)' }}>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#767676' }}>Loading...</p>
        </div>
      </div>
    )
  }

  if (invalid || !commitment) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <PublicHeader />
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 70px)', padding: '32px 16px' }}>
          <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '40px 48px', maxWidth: '480px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '24px', marginBottom: '12px' }}>⚠️</p>
            <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '24px', fontWeight: 700, margin: '0 0 12px' }}>
              Invalid validator link
            </h2>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#767676', lineHeight: '1.6', margin: '0 0 24px' }}>
              This validator link is invalid or has expired. Ask the practitioner to send a new invitation.
            </p>
            <a href="https://searchstar.com" style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#1a3a6b', textDecoration: 'none', fontWeight: 600 }}>
              ← Back to Search Star
            </a>
          </div>
        </div>
      </div>
    )
  }

  const badge = STATUS_BADGE[commitment.status] ?? STATUS_BADGE.abandoned

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

        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#5a5a5a', marginBottom: '8px' }}>
          by <strong>{practitionerName}</strong>
        </p>

        {/* Stats */}
        <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '20px 24px', marginBottom: '32px', marginTop: '20px' }}>
          <div style={{ display: 'flex', gap: '32px' }}>
            <div>
              <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#767676', margin: '0 0 2px' }}>
                Sessions logged
              </p>
              <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '28px', fontWeight: 700, color: '#1a3a6b', margin: 0 }}>
                {commitment.sessions_logged}
              </p>
            </div>
            <div>
              <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#767676', margin: '0 0 2px' }}>
                Your confirmations
              </p>
              <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '28px', fontWeight: 700, color: '#2d6a2d', margin: 0 }}>
                {confirmedPostIds.size}
              </p>
            </div>
          </div>
        </div>

        {/* Session feed */}
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', marginBottom: '16px' }}>
          Session history
        </p>

        {posts.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '40px 28px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#b8b8b8', margin: 0 }}>
              No sessions logged yet.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {posts.map((post) => {
              const confirmed = confirmedPostIds.has(post.id)
              const isConfirming = confirmingId === post.id
              return (
                <div key={post.id} style={{
                  background: '#fff',
                  border: '1px solid #d4d4d4',
                  borderLeft: confirmed ? '2px solid #2d6a2d' : '2px solid #d4d4d4',
                  borderRadius: '3px',
                  padding: '16px 20px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
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
                    <div style={{ flexShrink: 0 }}>
                      {confirmed ? (
                        <span style={{
                          fontFamily: 'Roboto, sans-serif',
                          fontSize: '12px',
                          fontWeight: 700,
                          background: '#edf7ed',
                          color: '#2d6a2d',
                          borderRadius: '2px',
                          padding: '6px 12px',
                          cursor: 'default',
                          display: 'inline-block',
                        }}>
                          Confirmed ✓
                        </span>
                      ) : (
                        <button
                          onClick={() => handleConfirm(post.id)}
                          disabled={isConfirming}
                          style={{
                            background: isConfirming ? '#8a9fc0' : '#1a3a6b',
                            color: '#fff',
                            fontFamily: 'Roboto, sans-serif',
                            fontSize: '12px',
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            padding: '6px 14px',
                            borderRadius: '3px',
                            border: 'none',
                            cursor: isConfirming ? 'not-allowed' : 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {isConfirming ? 'Confirming...' : 'Confirm session ✓'}
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
