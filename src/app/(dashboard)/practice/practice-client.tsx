'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// ═══════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════

type CommitmentStatus = 'active' | 'ongoing' | 'restart_eligible' | 'completed'
type SupportRole = 'witness' | 'co_practitioner' | 'stakeholder'

interface Post {
  id: string
  body: string | null
  media_urls: string[]
  day_number: number
  is_milestone: boolean
  posted_at: string
}

interface Supporter {
  commitment_id: string
  supporter_id: string
  role: SupportRole
}

interface Commitment {
  id: string
  habit: string
  status: CommitmentStatus
  logged_days: number
  current_streak: number
  longest_streak: number
  visibility: string
  started_at: string
  prior_attempt_id: string | null
  posts: Post[]
  supporters: Supporter[]
}

// ═══════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════

const STATUS_LABEL: Record<CommitmentStatus, string> = {
  active: 'active',
  ongoing: 'ongoing',
  restart_eligible: 'paused',
  completed: 'completed',
}

const STATUS_COLORS: Record<CommitmentStatus, string> = {
  active: 'bg-[#EAF3DE] text-[#3B6D11]',
  ongoing: 'bg-[#E6F1FB] text-[#185FA5]',
  restart_eligible: 'bg-[#FAEEDA] text-[#854F0B]',
  completed: 'bg-[#F1EFE8] text-[#444441]',
}

const ROLE_COLORS: Record<SupportRole, string> = {
  witness: 'bg-[#F1EFE8] text-[#444441]',
  co_practitioner: 'bg-[#E6F1FB] text-[#185FA5]',
  stakeholder: 'bg-[#EAF3DE] text-[#3B6D11]',
}

const ROLE_LABELS: Record<SupportRole, string> = {
  witness: 'witness',
  co_practitioner: 'co-practice',
  stakeholder: 'stakeholder',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  return `${d} days ago`
}

// ═══════════════════════════════════════════════════
// Arc grid
// ═══════════════════════════════════════════════════

function ArcGrid({ filled, total = 40, size = 12 }: { filled: number; total?: number; size?: number }) {
  return (
    <div className="flex flex-wrap gap-[3px]">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{ width: size, height: size, borderRadius: 2, flexShrink: 0 }}
          className={
            i < filled
              ? 'bg-[#639922] border border-[#3B6D11]'
              : i === filled
              ? 'bg-[#3B6D11] border border-[#27500A]'
              : 'bg-[#f5f5f5] border border-[#d4d4d4]'
          }
        />
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════
// Post composer
// ═══════════════════════════════════════════════════

function PostComposer({
  commitment,
  onPosted,
}: {
  commitment: Commitment
  onPosted: (updated: Partial<Commitment> & { newPost: Post }) => void
}) {
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const nextDay = commitment.logged_days + 1
  const isMilestone = [10, 20, 30, 40].includes(nextDay)

  async function submit() {
    if (!body.trim()) { setError('Write something first.'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/commitment/${commitment.id}/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: body.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to post')
      onPosted({
        logged_days: data.logged_days,
        current_streak: data.logged_days,
        status: data.status,
        newPost: data.post,
      })
      setBody('')
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full text-left px-4 py-3 bg-[#f5f5f5] border border-dashed border-[#d4d4d4] rounded-[3px] font-body text-sm text-[#767676] hover:border-[#1a3a6b] hover:text-[#1a3a6b] transition-colors"
      >
        {isMilestone
          ? `+ post day ${nextDay} — milestone`
          : `+ post day ${nextDay}`}
      </button>
    )
  }

  return (
    <div className="border border-[#1a3a6b] rounded-[3px] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-[#f5f5f5] border-b border-[#d4d4d4]">
        <span className="font-body text-[11px] font-bold tracking-[0.08em] uppercase text-[#1a3a6b]">
          Day {nextDay}
        </span>
        {isMilestone && (
          <span className="font-body text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EAF3DE] text-[#3B6D11]">
            milestone
          </span>
        )}
        {isMilestone && (
          <span className="font-body text-xs text-[#767676] ml-1">What has changed since day 1?</span>
        )}
      </div>
      <textarea
        autoFocus
        value={body}
        onChange={e => setBody(e.target.value)}
        rows={4}
        placeholder="What happened today?"
        className="w-full px-4 py-3 font-body text-sm text-[#1a1a1a] bg-white resize-none outline-none leading-relaxed placeholder:text-[#b8b8b8]"
      />
      {error && (
        <div className="px-4 py-2 bg-[#fef2f2] border-t border-[#d4d4d4]">
          <p className="font-body text-xs text-[#991b1b]">{error}</p>
        </div>
      )}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#d4d4d4] bg-[#f5f5f5]">
        <button
          onClick={() => { setOpen(false); setBody(''); setError('') }}
          className="font-body text-xs text-[#767676] hover:text-[#1a1a1a]"
        >
          cancel
        </button>
        <button
          onClick={submit}
          disabled={loading}
          className="font-body text-[11px] font-bold tracking-[0.08em] uppercase px-4 py-2 bg-[#1a3a6b] text-white rounded-[3px] hover:bg-[#112a4f] disabled:opacity-60 transition-colors"
        >
          {loading ? 'posting…' : 'post'}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════
// Commitment card
// ═══════════════════════════════════════════════════

function CommitmentCard({
  commitment: initial,
  onAbandon,
}: {
  commitment: Commitment
  onAbandon: (id: string) => void
}) {
  const [commitment, setCommitment] = useState(initial)
  const [showAllPosts, setShowAllPosts] = useState(false)
  const [abandoning, setAbandoning] = useState(false)

  const isActive = commitment.status === 'active' || commitment.status === 'ongoing'
  const arcFilled = Math.min(commitment.logged_days, 40)
  const recentPosts = showAllPosts ? commitment.posts : commitment.posts.slice(0, 3)

  function handlePosted(updated: Partial<Commitment> & { newPost: Post }) {
    setCommitment(prev => ({
      ...prev,
      logged_days: updated.logged_days ?? prev.logged_days,
      current_streak: updated.current_streak ?? prev.current_streak,
      status: updated.status ?? prev.status,
      posts: [updated.newPost, ...prev.posts],
    }))
  }

  async function handleAbandon() {
    if (!confirm('Mark this commitment as paused? You can restart it later.')) return
    setAbandoning(true)
    try {
      await fetch(`/api/commitment/${commitment.id}/abandon`, { method: 'PATCH' })
      onAbandon(commitment.id)
    } finally {
      setAbandoning(false)
    }
  }

  return (
    <div className="bg-white border border-[#d4d4d4] rounded-[3px] shadow-sm overflow-hidden">

      {/* Header */}
      <div className="px-6 py-5 border-b border-[#d4d4d4]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`font-body text-[10px] font-bold tracking-[0.08em] uppercase px-2 py-0.5 rounded-full ${STATUS_COLORS[commitment.status]}`}>
                {STATUS_LABEL[commitment.status]}
              </span>
              <span className="font-body text-[11px] text-[#767676]">
                started {formatDate(commitment.started_at)}
              </span>
              {commitment.prior_attempt_id && (
                <span className="font-body text-[10px] text-[#b8b8b8]">restart</span>
              )}
            </div>
            <blockquote className="font-heading text-xl leading-snug text-[#1a1a1a]">
              {commitment.habit}
            </blockquote>
          </div>

          {/* Stats */}
          <div className="flex gap-4 flex-shrink-0 text-right">
            <div>
              <div className="font-heading text-2xl leading-none text-[#1a3a6b]">
                {commitment.logged_days}
              </div>
              <div className="font-body text-[10px] text-[#767676] mt-0.5">
                {commitment.status === 'active' ? `of 40` : 'days'}
              </div>
            </div>
            <div>
              <div className="font-heading text-2xl leading-none text-[#1a3a6b]">
                {commitment.current_streak}
              </div>
              <div className="font-body text-[10px] text-[#767676] mt-0.5">streak</div>
            </div>
          </div>
        </div>

        {/* Arc */}
        <div className="mt-4">
          {commitment.status === 'active' ? (
            <ArcGrid filled={arcFilled} total={40} />
          ) : commitment.status === 'ongoing' ? (
            <div className="flex items-center gap-3">
              <ArcGrid filled={Math.min(commitment.logged_days, 120)} total={120} size={10} />
            </div>
          ) : (
            <ArcGrid filled={arcFilled} total={40} />
          )}
        </div>

        {/* Supporters */}
        {commitment.supporters.length > 0 && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {commitment.supporters.map(s => (
              <span
                key={s.supporter_id}
                className={`font-body text-[10px] font-bold px-2 py-0.5 rounded-full ${ROLE_COLORS[s.role]}`}
              >
                {ROLE_LABELS[s.role]}
              </span>
            ))}
            <span className="font-body text-[11px] text-[#767676]">
              {commitment.supporters.length} supporter{commitment.supporters.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Post composer */}
      {isActive && (
        <div className="px-6 py-4 border-b border-[#d4d4d4]">
          <PostComposer commitment={commitment} onPosted={handlePosted} />
        </div>
      )}

      {/* Restart eligible */}
      {commitment.status === 'restart_eligible' && (
        <div className="px-6 py-4 border-b border-[#d4d4d4] flex items-center justify-between">
          <p className="font-body text-sm text-[#767676]">
            Paused on day {commitment.logged_days}. Ready when you are.
          </p>
          <Link
            href="/commitment"
            className="font-body text-[11px] font-bold tracking-[0.08em] uppercase px-4 py-2 border border-[#1a3a6b] text-[#1a3a6b] rounded-[3px] no-underline hover:bg-[#1a3a6b] hover:text-white transition-colors"
          >
            restart
          </Link>
        </div>
      )}

      {/* Posts feed */}
      {commitment.posts.length > 0 && (
        <div className="divide-y divide-[#d4d4d4]">
          {recentPosts.map(post => (
            <div key={post.id} className="px-6 py-4">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-body text-[11px] font-bold tracking-[0.06em] uppercase text-[#1a3a6b]">
                  Day {post.day_number}
                </span>
                {post.is_milestone && (
                  <span className="font-body text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#EAF3DE] text-[#3B6D11]">
                    milestone
                  </span>
                )}
                <span className="font-body text-[11px] text-[#b8b8b8] ml-auto">
                  {timeAgo(post.posted_at)}
                </span>
              </div>
              {post.body && (
                <p className="font-body text-sm text-[#1a1a1a] leading-relaxed">{post.body}</p>
              )}
              {post.media_urls?.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {post.media_urls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                      className="font-body text-xs text-[#1a3a6b] underline">
                      media {i + 1}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
          {commitment.posts.length > 3 && !showAllPosts && (
            <button
              onClick={() => setShowAllPosts(true)}
              className="w-full px-6 py-3 font-body text-xs text-[#767676] hover:text-[#1a3a6b] text-center transition-colors"
            >
              show all {commitment.posts.length} posts
            </button>
          )}
        </div>
      )}

      {/* Footer actions */}
      {isActive && commitment.status !== 'ongoing' && (
        <div className="px-6 py-3 border-t border-[#d4d4d4] flex justify-end">
          <button
            onClick={handleAbandon}
            disabled={abandoning}
            className="font-body text-[11px] text-[#b8b8b8] hover:text-[#991b1b] transition-colors"
          >
            {abandoning ? 'pausing…' : 'pause commitment'}
          </button>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════
// Main client component
// ═══════════════════════════════════════════════════

export function PracticeClient() {
  const [commitments, setCommitments] = useState<Commitment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'paused'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/commitment/mine')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setCommitments(data.commitments || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function handleAbandon(id: string) {
    setCommitments(prev =>
      prev.map(c => c.id === id ? { ...c, status: 'restart_eligible' as CommitmentStatus } : c)
    )
  }

  const filtered = commitments.filter(c => {
    if (filter === 'active') return c.status === 'active' || c.status === 'ongoing'
    if (filter === 'paused') return c.status === 'restart_eligible'
    return true
  })

  const activeCount = commitments.filter(c => c.status === 'active' || c.status === 'ongoing').length
  const totalDays = commitments.reduce((sum, c) => sum + c.logged_days, 0)
  const longestStreak = commitments.reduce((max, c) => Math.max(max, c.longest_streak), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="font-body text-sm text-[#767676]">Loading…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-[#fef2f2] border border-[#d4d4d4] rounded-[3px] p-6">
        <p className="font-body text-sm text-[#991b1b]">{error}</p>
        <button onClick={load} className="font-body text-xs text-[#767676] mt-2 underline">retry</button>
      </div>
    )
  }

  if (commitments.length === 0) {
    return (
      <div className="bg-white border border-[#d4d4d4] rounded-[3px] shadow-sm p-12 text-center">
        <p className="font-heading text-2xl text-[#1a1a1a] mb-2">No commitments yet.</p>
        <p className="font-body text-sm text-[#767676] mb-6 max-w-[360px] mx-auto leading-relaxed">
          Your profile is built from what you practice, not what you claim.
          Make your first commitment to start.
        </p>
        <a
          href="/commitment"
          className="font-body text-[11px] font-bold tracking-[0.1em] uppercase px-6 py-3 bg-[#1a3a6b] text-white rounded-[3px] no-underline hover:bg-[#112a4f] transition-colors"
        >
          make a commitment
        </a>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Active commitments', value: activeCount },
          { label: 'Total days logged', value: totalDays },
          { label: 'Longest streak', value: longestStreak },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white border border-[#d4d4d4] rounded-[3px] shadow-sm p-5">
            <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">{label}</div>
            <div className="font-heading text-3xl font-bold text-[#1a3a6b]">{value}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      {commitments.length > 1 && (
        <div className="flex gap-2">
          {(['all', 'active', 'paused'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`font-body text-[11px] font-bold tracking-[0.08em] uppercase px-4 py-2 rounded-[3px] border transition-colors ${
                filter === f
                  ? 'bg-[#1a3a6b] text-white border-[#1a3a6b]'
                  : 'bg-white text-[#767676] border-[#d4d4d4] hover:border-[#1a3a6b]'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {/* Commitment cards */}
      {filtered.length === 0 ? (
        <p className="font-body text-sm text-[#767676] py-4">No commitments in this filter.</p>
      ) : (
        filtered.map(c => (
          <CommitmentCard key={c.id} commitment={c} onAbandon={handleAbandon} />
        ))
      )}

    </div>
  )
}
