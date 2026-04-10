'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PublicHeader } from '@/components/public-header'
import { PublicFooter } from '@/components/public-footer'

export const dynamic = 'force-dynamic'

// ═══════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════

type Visibility = 'community' | 'public' | 'private'
type SupportRole = 'witness' | 'co_practitioner' | 'stakeholder'
type Step = 0 | 1 | 2 | 3 | 4

interface Supporter {
  handle: string
  role: SupportRole
}

const ROLE_LABELS: Record<SupportRole, string> = {
  witness: 'witness',
  co_practitioner: 'co-practice',
  stakeholder: 'stakeholder',
}

const ROLE_NEXT: Record<SupportRole, SupportRole> = {
  witness: 'co_practitioner',
  co_practitioner: 'stakeholder',
  stakeholder: 'witness',
}

const ROLE_COLORS: Record<SupportRole, string> = {
  witness: 'bg-[#F1EFE8] text-[#444441]',
  co_practitioner: 'bg-[#E6F1FB] text-[#185FA5]',
  stakeholder: 'bg-[#EAF3DE] text-[#3B6D11]',
}

// ═══════════════════════════════════════════════════
// Arc grid
// ═══════════════════════════════════════════════════

function ArcGrid({ filled, total = 40, size = 14 }: { filled: number; total?: number; size?: number }) {
  return (
    <div className="flex flex-wrap gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{ width: size, height: size, borderRadius: 3 }}
          className={
            i < filled
              ? 'bg-[#639922] border border-[#3B6D11]'
              : i === filled
              ? 'bg-[#3B6D11] border border-[#27500A]'
              : 'bg-white border border-[#d4d4d4]'
          }
        />
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════

export default function CommitmentPage() {
  const router = useRouter()

  const [step, setStep] = useState<Step>(0)
  const [habit, setHabit] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('community')
  const [supporters, setSupporters] = useState<Supporter[]>([])
  const [inviteHandle, setInviteHandle] = useState('')
  const [postBody, setPostBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [commitmentId, setCommitmentId] = useState<string | null>(null)
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    // lazy-init Supabase client only in browser to avoid prerender errors
    import('@/lib/supabase/client').then(({ createClient }) => {
      createClient().auth.getUser().then(({ data }) => {
        setUser(data.user)
      })
    })
  }, [])

  useEffect(() => {
    if (step === 0 && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [step])

  const TOTAL_STEPS = 5
  const progress = ((step + 1) / TOTAL_STEPS) * 100

  const displayHabit = habit.trim() || 'Read 20 pages of primary source before noon.'

  // ── Navigation ──────────────────────────────────

  async function advance() {
    setError('')

    if (step === 0) {
      if (!habit.trim()) { setError('Write your habit first.'); return }
      setStep(1)
      return
    }

    if (step === 1) {
      setStep(2)
      return
    }

    if (step === 2) {
      // Create the commitment
      if (!user) { router.push('/login?next=/commitment'); return }
      setLoading(true)
      try {
        const res = await fetch('/api/commitment/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ habit: habit.trim(), visibility }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to create commitment')
        setCommitmentId(data.commitment.id)

        // Fire off supporter invites (non-blocking)
        for (const s of supporters) {
          fetch('/api/commitment/support', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ commitment_id: data.commitment.id, invitee: s.handle, role: s.role }),
          }).catch(() => {})
        }

        setStep(3)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
      return
    }

    if (step === 3) {
      // Post day 1
      if (!postBody.trim()) { setError('Write something for day 1.'); return }
      if (!commitmentId) return
      setLoading(true)
      try {
        const res = await fetch('/api/commitment/post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ commitment_id: commitmentId, body: postBody.trim() }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to post')
        setStep(4)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
      return
    }

    if (step === 4) {
      router.push('/dashboard')
    }
  }

  function back() {
    if (step > 0) setStep((step - 1) as Step)
  }

  // ── Supporter management ─────────────────────────

  function addSupporter() {
    const h = inviteHandle.trim()
    if (!h) return
    if (supporters.find(s => s.handle.toLowerCase() === h.toLowerCase())) return
    setSupporters(prev => [...prev, { handle: h, role: 'witness' }])
    setInviteHandle('')
  }

  function cycleRole(handle: string) {
    setSupporters(prev => prev.map(s =>
      s.handle === handle ? { ...s, role: ROLE_NEXT[s.role] } : s
    ))
  }

  function removeSupporter(handle: string) {
    setSupporters(prev => prev.filter(s => s.handle !== handle))
  }

  // ── Button label ─────────────────────────────────

  const nextLabel =
    step === 4 ? 'go to dashboard →' :
    step === 3 ? (loading ? 'posting…' : 'post day 1') :
    step === 2 ? (loading ? 'creating…' : 'commit') :
    'next'

  // ═══════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <PublicHeader />

      <div className="flex items-start justify-center px-4 py-12 min-h-[calc(100vh-80px)]">
        <div className="w-full max-w-[460px]">

          {/* Card */}
          <div className="bg-white border border-[#d4d4d4] rounded-[3px]">

            {/* Top bar */}
            <div className="flex items-center justify-between px-6 pt-5 pb-0">
              <span className="font-body text-[11px] font-bold tracking-[0.12em] uppercase text-[#767676]">
                Search Star
              </span>
              <span className="font-body text-[11px] text-[#767676]">
                {step + 1} of {TOTAL_STEPS}
              </span>
            </div>

            {/* Progress bar */}
            <div className="mx-6 mt-3 h-[2px] bg-[#d4d4d4] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1a3a6b] rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Screen */}
            <div className="px-6 py-6 min-h-[400px] flex flex-col">

              {/* ── Step 0: The vow ── */}
              {step === 0 && (
                <div className="flex flex-col gap-4 flex-1 animate-[fadeUp_0.18s_ease]">
                  <h1 className="font-heading text-2xl leading-tight text-[#1a1a1a]">
                    What habit do you want to build?
                  </h1>
                  <p className="font-body text-sm text-[#767676] leading-relaxed">
                    Write it in your own words. No categories, no templates.
                  </p>
                  <textarea
                    ref={textareaRef}
                    value={habit}
                    onChange={e => setHabit(e.target.value)}
                    rows={4}
                    placeholder="Read 20 pages of primary source before noon…"
                    className="w-full bg-[#f5f5f5] border border-[#d4d4d4] rounded-[3px] px-4 py-3 font-body text-base text-[#1a1a1a] resize-none outline-none focus:border-[#1a3a6b] leading-relaxed placeholder:text-[#767676]"
                  />
                  <p className="font-body text-sm text-[#767676] leading-relaxed mt-auto">
                    Your profile will be built from what you post over the next 40 days — not from what you claim.
                  </p>
                </div>
              )}

              {/* ── Step 1: The arc ── */}
              {step === 1 && (
                <div className="flex flex-col gap-4 flex-1 animate-[fadeUp_0.18s_ease]">
                  <p className="font-body text-sm text-[#767676]">Your commitment</p>
                  <blockquote className="font-heading text-xl leading-relaxed text-[#1a1a1a] border-l-2 border-[#1a3a6b] pl-4 bg-[#f5f5f5] py-3 pr-4 rounded-r-[3px]">
                    {displayHabit}
                  </blockquote>

                  <div>
                    <p className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-2">
                      40 days — each square is a post
                    </p>
                    <ArcGrid filled={0} />
                    <div className="flex gap-4 mt-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-[2px] bg-[#639922]" />
                        <span className="font-body text-[11px] text-[#767676]">posted</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-[2px] bg-white border border-[#d4d4d4]" />
                        <span className="font-body text-[11px] text-[#767676]">not yet</span>
                      </div>
                    </div>
                  </div>

                  <p className="font-body text-sm text-[#767676] leading-relaxed">
                    Gaps stay visible. Day 41 it becomes a streak with no end. Abandoned runs can be restarted — the prior attempt stays on your profile.
                  </p>

                  <div className="mt-auto">
                    <p className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-2">
                      Visibility
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {(['community', 'public', 'private'] as Visibility[]).map(v => (
                        <button
                          key={v}
                          onClick={() => setVisibility(v)}
                          className={`font-body text-[11px] px-3 py-1.5 rounded-[3px] border transition-all ${
                            visibility === v
                              ? 'bg-[#1a3a6b] text-white border-[#1a3a6b]'
                              : 'bg-white text-[#767676] border-[#d4d4d4] hover:border-[#1a3a6b]'
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step 2: The witness ── */}
              {step === 2 && (
                <div className="flex flex-col gap-4 flex-1 animate-[fadeUp_0.18s_ease]">
                  <p className="font-body text-sm text-[#767676]">Who will hold you to this?</p>

                  <div className="bg-[#f5f5f5] border border-[#d4d4d4] rounded-[3px] p-4 flex flex-col gap-3">
                    {[
                      { role: 'witness' as SupportRole, desc: 'Follows your posts. No stake. The outer ring of care.' },
                      { role: 'co_practitioner' as SupportRole, desc: 'Commits the same habit alongside you. Streaks are linked.' },
                      { role: 'stakeholder' as SupportRole, desc: 'Stakes money on you completing day 40. Returned on completion.' },
                    ].map(({ role, desc }) => (
                      <div key={role} className="flex items-start gap-3">
                        <span className={`font-body text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 mt-0.5 ${ROLE_COLORS[role]}`}>
                          {ROLE_LABELS[role]}
                        </span>
                        <p className="font-body text-xs text-[#767676] leading-relaxed">{desc}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      value={inviteHandle}
                      onChange={e => setInviteHandle(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addSupporter()}
                      placeholder="Email or @handle…"
                      className="flex-1 bg-white border border-[#d4d4d4] rounded-[3px] px-3 py-2 font-body text-sm text-[#1a1a1a] outline-none focus:border-[#1a3a6b]"
                    />
                    <button
                      onClick={addSupporter}
                      className="font-body text-xs font-bold tracking-[0.08em] uppercase px-4 py-2 border border-[#d4d4d4] rounded-[3px] text-[#767676] hover:border-[#1a3a6b] hover:text-[#1a3a6b] transition-colors"
                    >
                      invite
                    </button>
                  </div>

                  {supporters.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      {supporters.map(s => (
                        <div key={s.handle} className="flex items-center gap-2 py-2 border-b border-[#d4d4d4]">
                          <div className="w-7 h-7 rounded-full bg-[#E6F1FB] flex items-center justify-center font-body text-[10px] font-bold text-[#185FA5] flex-shrink-0">
                            {s.handle.replace('@','').slice(0,2).toUpperCase()}
                          </div>
                          <span className="font-body text-sm flex-1 text-[#1a1a1a]">{s.handle}</span>
                          <button
                            onClick={() => cycleRole(s.handle)}
                            className={`font-body text-[10px] font-bold px-2 py-1 rounded-full cursor-pointer ${ROLE_COLORS[s.role]}`}
                            title="Tap to change role"
                          >
                            {ROLE_LABELS[s.role]}
                          </button>
                          <button
                            onClick={() => removeSupporter(s.handle)}
                            className="font-body text-xs text-[#767676] hover:text-[#991b1b] ml-1"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => advance()}
                    className="font-body text-xs text-[#767676] hover:text-[#1a3a6b] mt-auto text-left"
                  >
                    skip for now — people will find you when you post
                  </button>
                </div>
              )}

              {/* ── Step 3: Day 1 post ── */}
              {step === 3 && (
                <div className="flex flex-col gap-4 flex-1 animate-[fadeUp_0.18s_ease]">
                  <div className="flex items-center gap-2">
                    <span className="font-body text-[11px] font-bold tracking-[0.08em] uppercase px-2 py-1 rounded-full bg-[#EAF3DE] text-[#3B6D11]">
                      Day 1
                    </span>
                    <p className="font-body text-sm text-[#767676]">Post something. This makes it real.</p>
                  </div>
                  <textarea
                    value={postBody}
                    onChange={e => setPostBody(e.target.value)}
                    rows={5}
                    placeholder="What does today look like? A sentence, a photo description, anything…"
                    className="w-full bg-[#f5f5f5] border border-[#d4d4d4] rounded-[3px] px-4 py-3 font-body text-base text-[#1a1a1a] resize-none outline-none focus:border-[#1a3a6b] leading-relaxed placeholder:text-[#767676] flex-1"
                  />
                  <div className="flex gap-2">
                    <button className="flex-1 py-2.5 border border-dashed border-[#d4d4d4] rounded-[3px] font-body text-xs text-[#767676] hover:border-[#1a3a6b] transition-colors">
                      + photo
                    </button>
                    <button className="flex-1 py-2.5 border border-dashed border-[#d4d4d4] rounded-[3px] font-body text-xs text-[#767676] hover:border-[#1a3a6b] transition-colors">
                      + link
                    </button>
                  </div>
                  <p className="font-body text-xs text-[#767676] leading-relaxed mt-auto">
                    A commitment without a day 1 post is a plan. A commitment with one is a beginning.
  </p>
                </div>
              )}

              {/* ── Step 4: Confirmation ── */}
              {step === 4 && (
                <div className="flex flex-col items-center gap-5 flex-1 text-center animate-[fadeUp_0.18s_ease] justify-center">
                  <div>
                    <div className="font-heading text-[72px] leading-none text-[#1a1a1a]">1</div>
                    <div className="font-body text-sm text-[#767676] mt-1">day logged · 39 to go</div>
                  </div>

                  <div className="flex flex-wrap gap-1 justify-center max-w-[320px]">
                    <ArcGrid filled={1} size={12} />
                  </div>

                  <blockquote className="font-heading text-lg leading-relaxed text-[#1a1a1a] max-w-[260px] border-l-2 border-[#1a3a6b] pl-4 text-left">
                    {displayHabit}
                  </blockquote>

                  {supporters.length > 0 && (
                    <div className="flex flex-wrap gap-2 justify-center">
                      {supporters.map(s => (
                        <div key={s.handle} className="flex items-center gap-1.5 bg-[#f5f5f5] border border-[#d4d4d4] rounded-full px-2.5 py-1">
                          <div className="w-5 h-5 rounded-full bg-[#E6F1FB] flex items-center justify-center font-body text-[9px] font-bold text-[#185FA5]">
                            {s.handle.replace('@','').slice(0,2).toUpperCase()}
                          </div>
                          <span className="font-body text-xs text-[#767676]">{s.handle}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="font-body text-sm text-[#767676] leading-relaxed max-w-[300px]">
                    Come back tomorrow. Each post builds your profile — not from what you claim, from what you do.
                  </p>
                </div>
              )}

            </div>

            {/* Error */}
            {error && (
              <div className="mx-6 mb-4 px-4 py-2.5 bg-[#fef2f2] border border-[#d4d4d4] rounded-[3px]">
                <p className="font-body text-sm text-[#991b1b]">{error}</p>
              </div>
            )}

            {/* Bottom bar */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-[#d4d4d4]">
              <button
                onClick={back}
                className={`font-body text-xs font-bold tracking-[0.08em] uppercase px-4 py-2 border border-[#d4d4d4] rounded-[3px] text-[#767676] hover:border-[#1a3a6b] transition-colors ${step === 0 ? 'invisible' : ''}`}
              >
                back
              </button>
              <button
                onClick={advance}
                disabled={loading}
                className="font-body text-xs font-bold tracking-[0.1em] uppercase px-6 py-2 bg-[#1a3a6b] text-white rounded-[3px] hover:bg-[#112a4f] transition-colors disabled:opacity-60"
              >
                {nextLabel}
              </button>
            </div>

          </div>

          {/* Auth note */}
          {!user && step >= 2 && (
            <p className="font-body text-xs text-[#767676] text-center mt-4">
              You&apos;ll be asked to sign in before your commitment is saved.
            </p>
          )}

        </div>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <PublicFooter />
    </div>
  )
}
