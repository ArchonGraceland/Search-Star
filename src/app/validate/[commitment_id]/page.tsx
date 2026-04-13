'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Suspense } from 'react'

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
  launch_starts_at: string
  profiles: { display_name: string } | null
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  launch:    { bg: '#eef2f8', color: '#1a3a6b', label: 'Launch' },
  active:    { bg: '#edf7ed', color: '#2d6a2d', label: 'Active' },
  completed: { bg: '#fdf8ec', color: '#7a5c00', label: 'Completed' },
  abandoned: { bg: '#f5f5f5', color: '#767676', label: 'Abandoned' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function ValidatorViewContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const commitmentId = params.commitment_id as string
  const token = searchParams.get('token')

  const [commitment, setCommitment] = useState<Commitment | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [confirmedPostIds, setConfirmedPostIds] = useState<Set<string>>(new Set())
  const [validatorId, setValidatorId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tokenInvalid, setTokenInvalid] = useState(false)
  const [confirming, setConfirming] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) {
      setTokenInvalid(true)
      setLoading(false)
      return
    }

    const supabase = createClient()

    // Validate the token and get validator row
    const { data: validator } = await supabase
      .from('validators')
      .select('id, status, commitment_id')
      .eq('invite_token', token)
      .eq('commitment_id', commitmentId)
      .maybeSingle()

    if (!validator || validator.status !== 'active') {
      setTokenInvalid(true)
      setLoading(false)
      return
    }

    setValidatorId(validator.id)

    // Fetch commitment with practitioner profile
    const { data: comm } = await supabase
      .from('commitments')
      .select('id, title, status, sessions_logged, launch_starts_at, profiles(display_name)')
      .eq('id', commitmentId)
      .single()

    if (!comm) {
      setTokenInvalid(true)
      setLoading(false)
      return
    }

    setCommitment(comm as unknown as Commitment)

    // Fetch posts
    const { data: postData } = await supabase
      .from('commitment_posts')
      .select('id, body, session_number, posted_at')
      .eq('commitment_id', commitmentId)
      .order('posted_at', { ascending: false })

    const fetchedPosts = postData ?? []
    setPosts(fetchedPosts)

    // Fetch which posts this validator has already confirmed
    if (fetchedPosts.length > 0) {
      const postIds = fetchedPosts.map((p: Post) => p.id)
      const { data: confirmations } = await supabase
        .from('post_confirmations')
        .select('post_id')
        .eq('validator_id', validator.id)
        .in('post_id', postIds)

      const confirmed = new Set((confirmations ?? []).map((c: { post_id: string }) => c.post_id))
      setConfirmedPostIds(confirmed)
    }

    setLoading(false)
  }, [token, commitmentId])

  useEffect(() => { load() }, [load])

  const handleConfirm = async (postId: string) => {
    if (!token || confirming) return
    setConfirming(postId)

    const res = await fetch(`/api/validate/${commitmentId}/posts/${postId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ validator_token: token }),
    })

    if (res.ok) {
      setConfirmedPostIds(prev => new Set([...prev, postId]))
    }
    setConfirming(null)
  }

  const navHeader = (
    <header style={{ background: '#1a3a6b', borderBottom: '3px solid #112a4f', padding: '20px 24px' }}>
      <div style={{ maxWidth: '1120px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{
          fontFamily: '"Crimson Text", Georgia, serif',
          fontSize: '22px',
          fontWeight: 700,
          color: '#ffffff',
          textDecoration: 'none',
        }}>
          Search Star
        </a>
        <span style={{
          fontFamily: 'Roboto, sans-serif',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.55)',
        }}>
          Validator View
        </span>
      </div>
    </header>
  )

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', flexDirection: 'column' }}>
        {navHeader}
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#767676' }}>Loading commitment…</p>
        </main>
      </div>
    )
  }

  if (tokenInvalid || !commitment) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', flexDirection: 'column' }}>
        {navHeader}
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
          <div style={{
            background: '#fff',
            border: '1px solid #d4d4d4',
            borderRadius: '3px',
            padding: '48px 40px',
            maxWidth: '440px',
            width: '100%',
            textAlign: 'center',
          }}>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#991b1b', marginBottom: '16px' }}>
              Invalid Link
            </p>
            <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '24px', fontWeight: 700, color: '#1a1a1a', marginBottom: '12px' }}>
              This validator link is invalid or has expired.
            </p>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#767676', lineHeight: '1.6', marginBottom: '28px' }}>
              The invite link may have already been used, expired, or is incorrect. Ask the practitioner to resend the invitation.
            </p>
            <a href="/" style={{
              fontFamily: 'Roboto, sans-serif',
              fontSize: '13px',
              fontWeight: 700,
              color: '#1a3a6b',
              textDecoration: 'none',
            }}>
              ← Return to Search Star
            </a>
          </div>
        </main>
      </div>
    )
  }

  const badge = STATUS_BADGE[commitment.status] ?? STATUS_BADGE.abandoned
  const practitionerName = commitment.profiles?.display_name ?? 'The practitioner'

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', flexDirection: 'column' }}>
      {navHeader}

      <main style={{ flex: 1, padding: '40px 24px' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>

          {/* Eyebrow */}
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#767676', textTransform: 'uppercase', fontWeight: 700, marginBottom: '12px' }}>
            Validating for {practitionerName}
          </p>

          {/* Title + badge */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
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

          {/* Stats card */}
          <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '20px 24px', marginBottom: '32px' }}>
            <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
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
                  Started
                </p>
                <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#1a1a1a', margin: 0 }}>
                  {formatDate(commitment.launch_starts_at)}
                </p>
              </div>
              <div>
                <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#767676', margin: '0 0 2px' }}>
                  Confirmed by you
                </p>
                <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '28px', fontWeight: 700, color: '#2d6a2d', margin: 0 }}>
                  {confirmedPostIds.size}
                </p>
              </div>
            </div>
          </div>

          {/* Instruction banner */}
          <div style={{ background: '#eef2f8', border: '1px solid #c8d4e8', borderRadius: '3px', padding: '14px 18px', marginBottom: '24px' }}>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#1a3a6b', margin: 0, lineHeight: '1.5' }}>
              <strong>Your role:</strong> Review each session below and confirm the ones you know are genuine. Only confirm sessions you can personally vouch for.
            </p>
          </div>

          {/* Session feed */}
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', marginBottom: '16px' }}>
            Session history
          </p>

          {posts.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '32px 28px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#b8b8b8', margin: 0 }}>
                No sessions logged yet.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {posts.map((post) => {
                const isConfirmed = confirmedPostIds.has(post.id)
                const isConfirming = confirming === post.id
                return (
                  <div key={post.id} style={{
                    background: '#fff',
                    border: '1px solid #d4d4d4',
                    borderLeft: isConfirmed ? '2px solid #2d6a2d' : '2px solid #d4d4d4',
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

                      {/* Confirm button */}
                      <div style={{ flexShrink: 0, marginLeft: '16px' }}>
                        {isConfirmed ? (
                          <span style={{
                            display: 'inline-block',
                            background: '#edf7ed',
                            color: '#2d6a2d',
                            fontFamily: 'Roboto, sans-serif',
                            fontSize: '12px',
                            fontWeight: 700,
                            padding: '6px 14px',
                            borderRadius: '3px',
                            cursor: 'default',
                            whiteSpace: 'nowrap',
                          }}>
                            Confirmed ✓
                          </span>
                        ) : (
                          <button
                            onClick={() => handleConfirm(post.id)}
                            disabled={!!confirming}
                            style={{
                              background: isConfirming ? '#8a9fc0' : '#1a3a6b',
                              color: '#fff',
                              fontFamily: 'Roboto, sans-serif',
                              fontSize: '12px',
                              fontWeight: 700,
                              padding: '6px 14px',
                              borderRadius: '3px',
                              border: 'none',
                              cursor: confirming ? 'not-allowed' : 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {isConfirming ? '…' : 'Confirm session ✓'}
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
      </main>
    </div>
  )
}

export default function ValidatorViewPage() {
  return (
    <Suspense>
      <ValidatorViewContent />
    </Suspense>
  )
}
