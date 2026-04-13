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

  const [validatorStatus, setValidatorStatus] = useState<'invited' | 'active' | null>(null)
  const [validatorId, setValidatorId] = useState<string | null>(null)
  const [commitment, setCommitment] = useState<Commitment | null>(null)
  const [practitionerName, setPractitionerName] = useState<string>('')
  const [posts, setPosts] = useState<Post[]>([])
  const [confirmedPostIds, setConfirmedPostIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [invalid, setInvalid] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) { setInvalid(true); setLoading(false); return }

    const supabase = createClient()

    // Look up validator row by token (public read policy allows this)
    const { data: validator, error: validatorError } = await supabase
      .from('validators')
      .select('id, status, commitment_id')
      .eq('invite_token', token)
      .eq('commitment_id', commitment_id)
      .single()

    if (validatorError || !validator) {
      setInvalid(true)
      setLoading(false)
      return
    }

    setValidatorId(validator.id)
    setValidatorStatus(validator.status as 'invited' | 'active')

    // If just invited, show acceptance screen — don't load posts yet
    if (validator.status === 'invited') {
      // Still fetch commitment title and practitioner name for the acceptance screen
      const res = await fetch(`/api/validate/${commitment_id}/info?token=${token}`)
      if (res.ok) {
        const info = await res.json()
        setCommitment({ id: commitment_id, title: info.title, status: info.status, sessions_logged: 0, user_id: '' })
        setPractitionerName(info.practitioner_name)
      }
      setLoading(false)
      return
    }

    // Active validator — load full feed
    const { data: comm } = await supabase
      .from('commitments')
      .select('id, title, status, sessions_logged, user_id')
      .eq('id', commitment_id)
      .single()

    if (!comm) { setInvalid(true); setLoading(false); return }
    setCommitment(comm)

    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', comm.user_id)
      .single()
    setPractitionerName(profile?.display_name ?? 'the practitioner')

    const { data: postsData } = await supabase
      .from('commitment_posts')
      .select('id, body, session_number, posted_at')
      .eq('commitment_id', commitment_id)
      .order('posted_at', { ascending: false })
    setPosts(postsData ?? [])

    if (postsData && postsData.length > 0) {
      const { data: confirmations } = await supabase
        .from('post_confirmations')
        .select('post_id')
        .eq('validator_id', validator.id)
        .in('post_id', postsData.map((p) => p.id))
      setConfirmedPostIds(new Set((confirmations ?? []).map((c) => c.post_id)))
    }

    setLoading(false)
  }, [token, commitment_id])

  useEffect(() => { load() }, [load])

  const handleAccept = async () => {
    setAccepting(true)
    const res = await fetch(`/api/validate/${commitment_id}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    if (res.ok) {
      setValidatorStatus('active')
      setLoading(true)
      await load()
    }
    setAccepting(false)
  }

  const handleConfirm = async (postId: string) => {
    setConfirmingId(postId)
    try {
      const res = await fetch(`/api/validate/${commitment_id}/posts/${postId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ validator_token: token }),
      })
      if (res.ok) setConfirmedPostIds((prev) => new Set([...prev, postId]))
    } finally {
      setConfirmingId(null)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <PublicHeader />
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 70px)' }}>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#767676' }}>Loading...</p>
      </div>
    </div>
  )

  if (invalid) return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <PublicHeader />
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 70px)', padding: '32px 16px' }}>
        <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '40px 48px', maxWidth: '480px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '24px', marginBottom: '12px' }}>⚠️</p>
          <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '24px', fontWeight: 700, margin: '0 0 12px' }}>
            Invalid invitation link
          </h2>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#767676', lineHeight: '1.6', margin: '0 0 24px' }}>
            This validator invitation link is invalid or could not be found. It may have been used already, or the link may be incorrect.
          </p>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#767676', lineHeight: '1.6', margin: '0 0 24px' }}>
            Ask the practitioner to send you a new invitation link.
          </p>
          <a href="https://searchstar.com" style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#1a3a6b', textDecoration: 'none', fontWeight: 600 }}>
            ← Back to Search Star
          </a>
        </div>
      </div>
    </div>
  )

  // ── Acceptance screen ──────────────────────────────────────────────────────
  if (validatorStatus === 'invited') return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <PublicHeader />
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', minHeight: 'calc(100vh - 70px)', padding: '64px 16px 32px' }}>
        <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '48px', maxWidth: '520px', width: '100%' }}>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#767676', marginBottom: '12px' }}>
            Validator Invitation
          </p>
          <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '32px', fontWeight: 700, color: '#1a1a1a', lineHeight: 1.15, marginBottom: '12px' }}>
            {practitionerName} has invited you to validate their commitment.
          </h1>
          {commitment && (
            <div style={{ background: '#eef2f8', border: '1px solid #c8d4e8', borderRadius: '3px', padding: '16px 20px', marginBottom: '28px' }}>
              <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
                {commitment.title}
              </p>
            </div>
          )}
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#5a5a5a', lineHeight: 1.7, marginBottom: '32px' }}>
            As a validator, you'll see {practitionerName}'s session posts and confirm that the work is real.
            Your confirmation carries the weight of your relationship — you're staking your word on their effort.
          </p>
          <button
            onClick={handleAccept}
            disabled={accepting}
            style={{
              width: '100%', padding: '13px', background: accepting ? '#8a9fc0' : '#1a3a6b',
              color: '#fff', fontFamily: 'Roboto, sans-serif', fontSize: '13px', fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase', border: 'none',
              borderRadius: '3px', cursor: accepting ? 'not-allowed' : 'pointer',
            }}
          >
            {accepting ? 'Accepting...' : 'Accept — I\'ll witness this commitment'}
          </button>
        </div>
      </div>
    </div>
  )

  // ── Active validator feed ──────────────────────────────────────────────────
  const badge = commitment ? (STATUS_BADGE[commitment.status] ?? STATUS_BADGE.abandoned) : STATUS_BADGE.launch

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <PublicHeader />
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '40px 24px' }}>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#767676', textTransform: 'uppercase', fontWeight: 700, marginBottom: '12px' }}>
          Validator View
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '32px', fontWeight: 700, margin: 0, flex: 1, minWidth: '200px' }}>
            {commitment?.title}
          </h1>
          <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: badge.bg, color: badge.color, borderRadius: '2px', padding: '4px 10px', whiteSpace: 'nowrap', alignSelf: 'center' }}>
            {badge.label}
          </span>
        </div>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#5a5a5a', marginBottom: '8px' }}>
          by <strong>{practitionerName}</strong>
        </p>
        <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '20px 24px', marginBottom: '32px', marginTop: '20px' }}>
          <div style={{ display: 'flex', gap: '32px' }}>
            <div>
              <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#767676', margin: '0 0 2px' }}>Sessions logged</p>
              <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '28px', fontWeight: 700, color: '#1a3a6b', margin: 0 }}>{commitment?.sessions_logged ?? 0}</p>
            </div>
            <div>
              <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#767676', margin: '0 0 2px' }}>Your confirmations</p>
              <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '28px', fontWeight: 700, color: '#2d6a2d', margin: 0 }}>{confirmedPostIds.size}</p>
            </div>
          </div>
        </div>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', marginBottom: '16px' }}>
          Session history
        </p>
        {posts.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '40px 28px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#b8b8b8', margin: 0 }}>No sessions logged yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {posts.map((post) => {
              const confirmed = confirmedPostIds.has(post.id)
              const isConfirming = confirmingId === post.id
              return (
                <div key={post.id} style={{ background: '#fff', border: '1px solid #d4d4d4', borderLeft: confirmed ? '2px solid #2d6a2d' : '2px solid #d4d4d4', borderRadius: '3px', padding: '16px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: post.body ? '10px' : 0 }}>
                        <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700, color: '#1a3a6b', letterSpacing: '0.04em' }}>Session {post.session_number}</span>
                        <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', color: '#b8b8b8' }}>{formatDate(post.posted_at)}</span>
                      </div>
                      {post.body && <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#3a3a3a', margin: 0, lineHeight: '1.6' }}>{post.body}</p>}
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      {confirmed ? (
                        <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700, background: '#edf7ed', color: '#2d6a2d', borderRadius: '2px', padding: '6px 12px', display: 'inline-block' }}>Confirmed ✓</span>
                      ) : (
                        <button onClick={() => handleConfirm(post.id)} disabled={isConfirming} style={{ background: isConfirming ? '#8a9fc0' : '#1a3a6b', color: '#fff', fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700, letterSpacing: '0.04em', padding: '6px 14px', borderRadius: '3px', border: 'none', cursor: isConfirming ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
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
