'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

// ═══════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════

type Step = 'practice' | 'pricing' | 'confirm' | 'success' | 'legacy-url' | 'legacy-validate'

interface Pricing {
  publicPrice: string
  privatePrice: string
  marketingPrice: string
}

interface CommitmentSummary {
  id: string
  habit: string
  status: 'active' | 'ongoing' | 'restart_eligible' | 'completed'
  logged_days: number
  current_streak: number
  longest_streak: number
  supporter_count: number
}

interface PracticeData {
  commitments: CommitmentSummary[]
  total_days: number
  active_count: number
  completed_count: number
  ongoing_count: number
  total_supporters: number
  practice_depth_score: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProfileJSON = Record<string, any>

interface LegacyExtracted {
  display_name: string
  handle: string | null
  tagline: string | null
  location: string | null
  age: number | null
  age_cohort: string | null
  presence_score: number
  net_worth_percentile: number | null
  income_percentile: number | null
  skills_count: number
  interests_tags: string[]
  has_financial: boolean
  has_dating: boolean
  has_advertising: boolean
  has_content_feed: boolean
}

function generateProfileNumber() {
  const num = Math.floor(Math.random() * 999999) + 1
  return `SS-${num.toString().padStart(6, '0')}`
}

function computePracticeDepthScore(data: PracticeData): number {
  const completedPts = (data.completed_count + data.ongoing_count) * 10
  const ongoingPts = data.commitments
    .filter(c => c.status === 'ongoing')
    .reduce((sum, c) => sum + Math.floor(Math.max(0, c.logged_days - 40) / 10), 0)
  const activePts = data.commitments
    .filter(c => c.status === 'active')
    .reduce((sum, c) => sum + Math.floor(c.logged_days / 10), 0)
  const supporterPts = Math.min(data.total_supporters * 2, 20)
  return Math.min(completedPts + ongoingPts + activePts + supporterPts, 100)
}

const STATUS_LABEL: Record<string, string> = {
  active: 'in progress',
  ongoing: 'ongoing streak',
  restart_eligible: 'paused',
  completed: 'completed',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-[#EAF3DE] text-[#3B6D11]',
  ongoing: 'bg-[#E6F1FB] text-[#185FA5]',
  restart_eligible: 'bg-[#FAEEDA] text-[#854F0B]',
  completed: 'bg-[#F1EFE8] text-[#444441]',
}

function ArcMini({ filled, total = 40 }: { filled: number; total?: number }) {
  const show = Math.min(total, 40)
  return (
    <div className="flex flex-wrap gap-[2px]">
      {Array.from({ length: show }).map((_, i) => (
        <div
          key={i}
          style={{ width: 8, height: 8, borderRadius: 1, flexShrink: 0 }}
          className={i < Math.min(filled, show) ? 'bg-[#639922]' : 'bg-[#f0f0f0] border border-[#d4d4d4]'}
        />
      ))}
    </div>
  )
}

export default function ProfileBuilderPage() {
  return (
    <Suspense fallback={<div className="p-8"><p className="font-body text-sm text-[#767676]">Loading…</p></div>}>
      <ProfileBuilder />
    </Suspense>
  )
}

function ProfileBuilder() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isFromActivate = searchParams.get('source') === 'activate'

  const [step, setStep] = useState<Step>('practice')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profileNumber, setProfileNumber] = useState('')
  const [practiceData, setPracticeData] = useState<PracticeData | null>(null)
  const [practiceLoading, setPracticeLoading] = useState(true)
  const [pricing, setPricing] = useState<Pricing>({ publicPrice: '0.02', privatePrice: '0.50', marketingPrice: '5.00' })

  const [endpointUrl, setEndpointUrl] = useState('')
  const [profileJson, setProfileJson] = useState<ProfileJSON | null>(null)
  const [legacyExtracted, setLegacyExtracted] = useState<LegacyExtracted | null>(null)
  const [legacyValidating, setLegacyValidating] = useState(false)
  const [legacyErrors, setLegacyErrors] = useState<string[]>([])
  const [showManualPaste, setShowManualPaste] = useState(false)
  const [manualJson, setManualJson] = useState('')

  const loadPractice = useCallback(async () => {
    setPracticeLoading(true)
    try {
      const res = await fetch('/api/commitment/mine')
      const data = await res.json()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const commitments: CommitmentSummary[] = (data.commitments || []).map((c: any) => ({
        id: c.id, habit: c.habit, status: c.status,
        logged_days: c.logged_days, current_streak: c.current_streak,
        longest_streak: c.longest_streak, supporter_count: (c.supporters || []).length,
      }))
      const total_days = commitments.reduce((s, c) => s + c.logged_days, 0)
      const active_count = commitments.filter(c => c.status === 'active').length
      const completed_count = commitments.filter(c => c.status === 'completed').length
      const ongoing_count = commitments.filter(c => c.status === 'ongoing').length
      const total_supporters = commitments.reduce((s, c) => s + c.supporter_count, 0)
      const pd: PracticeData = { commitments, total_days, active_count, completed_count, ongoing_count, total_supporters, practice_depth_score: 0 }
      pd.practice_depth_score = computePracticeDepthScore(pd)
      setPracticeData(pd)
    } catch {
      setPracticeData({ commitments: [], total_days: 0, active_count: 0, completed_count: 0, ongoing_count: 0, total_supporters: 0, practice_depth_score: 0 })
    } finally {
      setPracticeLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPractice()
    if (isFromActivate) {
      try {
        const raw = sessionStorage.getItem('activate_handoff')
        if (raw) {
          const d = JSON.parse(raw)
          if (d.public_price) setPricing({ publicPrice: d.public_price, privatePrice: d.private_price || '0.50', marketingPrice: d.marketing_price || '5.00' })
        }
      } catch { /* ignore */ }
    }
  }, [loadPractice, isFromActivate])

  async function handleLegacyFetch() {
    setLegacyValidating(true); setLegacyErrors([])
    try {
      const res = await fetch(`/api/activate/fields?url=${encodeURIComponent(endpointUrl)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const errors = validateLegacyJSON(json)
      setLegacyErrors(errors)
      if (errors.length === 0) { setProfileJson(json); setLegacyExtracted(extractLegacyData(json)); setStep('legacy-validate') }
    } catch (e) {
      setLegacyErrors([e instanceof Error ? e.message : 'Failed to fetch profile'])
    } finally { setLegacyValidating(false) }
  }

  function handleLegacyManualPaste() {
    try {
      const json = JSON.parse(manualJson)
      const errors = validateLegacyJSON(json)
      setLegacyErrors(errors)
      if (errors.length === 0) { setProfileJson(json); setLegacyExtracted(extractLegacyData(json)); setStep('legacy-validate') }
    } catch { setLegacyErrors(['Invalid JSON — make sure you copied the complete profile.json contents.']) }
  }

  function validateLegacyJSON(json: ProfileJSON): string[] {
    const errors: string[] = []
    if (!json['@context']) errors.push('Missing @context — not a valid Search Star profile')
    if (!json.identity?.displayName) errors.push('Missing identity.displayName')
    if (!json.accessPolicy) errors.push('Missing accessPolicy')
    return errors
  }

  function extractLegacyData(json: ProfileJSON): LegacyExtracted {
    const identity = json.identity || {}
    const financial = json.financial || {}
    const skills = json.skills || []
    const interests = json.interests || {}
    const interestTags = [
      ...(interests.athletic || []).map((i: { name?: string }) => i.name || i),
      ...(interests.social || []).map((i: { name?: string }) => i.name || i),
      ...(interests.intellectual || []).map((i: { name?: string }) => i.name || i),
    ].filter(Boolean).slice(0, 10)
    return {
      display_name: identity.displayName || 'Unknown', handle: identity.handle || null,
      tagline: identity.tagline || null, location: identity.location || null,
      age: identity.age || null, age_cohort: identity.ageCohort || null,
      presence_score: json.presence?.composite || 0,
      net_worth_percentile: financial.netWorthPercentile || null,
      income_percentile: financial.incomePercentile || null,
      skills_count: Array.isArray(skills) ? skills.length : 0,
      interests_tags: interestTags as string[],
      has_financial: !!json.financial, has_dating: !!json.intimateDating,
      has_advertising: !!json.advertisingProfile, has_content_feed: !!json.contentFeed,
    }
  }

  const isLegacyPath = step === 'legacy-url' || step === 'legacy-validate' || (step === 'confirm' && !!legacyExtracted && !practiceData?.commitments.length)

  const handleRegister = async () => {
    setSaving(true); setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const pNum = generateProfileNumber()
      setProfileNumber(pNum)

      const directoryRow = isLegacyPath && legacyExtracted ? {
        display_name: legacyExtracted.display_name, handle: legacyExtracted.handle,
        location: legacyExtracted.location, age_cohort: legacyExtracted.age_cohort,
        presence_score: legacyExtracted.presence_score, skills_count: legacyExtracted.skills_count,
        interest_tags: legacyExtracted.interests_tags,
        has_financial: legacyExtracted.has_financial, has_dating: legacyExtracted.has_dating,
        has_advertising: legacyExtracted.has_advertising, has_content_feed: legacyExtracted.has_content_feed,
        net_worth_percentile: legacyExtracted.net_worth_percentile,
        income_percentile: legacyExtracted.income_percentile,
        trust_score: 10, has_practice: false,
        practice_depth_score: 0, commitment_count: 0, total_days_logged: 0,
      } : {
        display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User',
        handle: null, location: null, age_cohort: null, presence_score: 0, skills_count: 0,
        interest_tags: practiceData?.commitments.map(c => c.habit.split(' ').slice(0, 3).join(' ')).slice(0, 5) || [],
        has_financial: false, has_dating: false, has_advertising: false, has_content_feed: false,
        net_worth_percentile: null, income_percentile: null,
        trust_score: practiceData?.practice_depth_score || 0,
        has_practice: true,
        practice_depth_score: practiceData?.practice_depth_score || 0,
        commitment_count: (practiceData?.completed_count || 0) + (practiceData?.ongoing_count || 0) + (practiceData?.active_count || 0),
        total_days_logged: practiceData?.total_days || 0,
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          profile_number: pNum, ...directoryRow,
          endpoint_url: endpointUrl || null,
          domain: endpointUrl ? (() => { try { return new URL(endpointUrl).hostname } catch { return null } })() : null,
          price_public: parseFloat(pricing.publicPrice),
          price_private: parseFloat(pricing.privatePrice),
          price_marketing: parseFloat(pricing.marketingPrice),
          profile_json: profileJson || null,
          onboarding_completed: true, status: 'active',
        })
        .eq('user_id', user.id)

      if (updateError) throw updateError
      setStep('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register profile')
    } finally { setSaving(false) }
  }

  const mainSteps = [{ key: 'practice', label: 'Practice' }, { key: 'pricing', label: 'Pricing' }, { key: 'confirm', label: 'Register' }]
  const legacySteps = [{ key: 'legacy-url', label: 'Endpoint' }, { key: 'legacy-validate', label: 'Review' }, { key: 'pricing', label: 'Pricing' }, { key: 'confirm', label: 'Register' }]
  const activeSteps = (step === 'legacy-url' || step === 'legacy-validate') ? legacySteps : mainSteps
  const stepIndex = activeSteps.findIndex(s => s.key === step)

  return (
    <div className="p-8 max-w-[720px]">
      <div className="mb-8">
        <h1 className="font-heading text-[28px] font-bold mb-1">Register Your Profile</h1>
        <p className="font-body text-sm text-[#767676]">Join the Search Star directory. Platforms pay to query your profile — you keep 90%.</p>
      </div>

      {step !== 'success' && (
        <div className="flex items-center gap-0 mb-8">
          {activeSteps.map((s, i) => (
            <div key={s.key} className="flex items-center">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-[3px] ${i === stepIndex ? 'bg-[#1a3a6b] text-white' : i < stepIndex ? 'text-[#166534]' : 'text-[#b8b8b8]'}`}>
                <span className="font-body text-[11px] font-bold tracking-[0.08em] uppercase">{s.label}</span>
              </div>
              {i < activeSteps.length - 1 && <div className={`w-6 h-[1px] ${i < stepIndex ? 'bg-[#166534]' : 'bg-[#d4d4d4]'}`} />}
            </div>
          ))}
        </div>
      )}

      {/* ═══ PRACTICE SUMMARY ═══ */}
      {step === 'practice' && (
        <div className="card-grace p-8">
          <h2 className="font-heading text-xl font-bold mb-1">Your practice record</h2>
          <p className="font-body text-sm text-[#5a5a5a] mb-6">This is what will be registered in the directory. Built from what you have actually done, not what you claim.</p>

          {practiceLoading ? (
            <p className="font-body text-sm text-[#767676] py-8 text-center">Loading your commitments…</p>
          ) : practiceData && practiceData.commitments.length > 0 ? (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Habits completed', value: practiceData.completed_count + practiceData.ongoing_count },
                  { label: 'Days logged', value: practiceData.total_days },
                  { label: 'Supporters', value: practiceData.total_supporters },
                ].map(({ label, value }) => (
                  <div key={label} className="p-4 bg-[#f5f5f5] rounded-[3px] text-center">
                    <div className="font-heading text-3xl font-bold text-[#1a3a6b]">{value}</div>
                    <div className="font-body text-[10px] font-bold tracking-[0.08em] uppercase text-[#767676] mt-1">{label}</div>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-[#eef2f8] border-l-[3px] border-[#1a3a6b] rounded-[3px]">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#1a3a6b] mb-0.5">Starting Trust Score</div>
                    <div className="font-body text-xs text-[#767676]">Derived from completed habits, days logged, and supporters. Grows as you practice.</div>
                  </div>
                  <div className="font-heading text-4xl font-bold text-[#1a3a6b]">{practiceData.practice_depth_score}</div>
                </div>
              </div>
              <div>
                <div className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-2">Your commitments</div>
                <div className="space-y-2">
                  {practiceData.commitments.map(c => (
                    <div key={c.id} className="p-3 bg-[#f5f5f5] rounded-[3px]">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`font-body text-[10px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_COLORS[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                        <span className="font-body text-[11px] text-[#767676]">day {c.logged_days}{c.status === 'active' ? ' of 40' : ''}</span>
                        {c.supporter_count > 0 && <span className="font-body text-[11px] text-[#767676]">· {c.supporter_count} supporter{c.supporter_count !== 1 ? 's' : ''}</span>}
                      </div>
                      <p className="font-heading text-base text-[#1a1a1a] leading-snug">{c.habit}</p>
                      <div className="mt-2"><ArcMini filled={Math.min(c.logged_days, 40)} /></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 mt-2 items-center justify-between">
                <button onClick={() => setStep('legacy-url')} className="font-body text-xs text-[#b8b8b8] hover:text-[#767676] transition-colors">
                  I have an existing profile.json →
                </button>
                <button onClick={() => setStep('pricing')} className="btn-primary">Set Pricing →</button>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center">
              <p className="font-heading text-lg text-[#1a1a1a] mb-2">No practice record yet.</p>
              <p className="font-body text-sm text-[#767676] mb-6 max-w-[340px] mx-auto leading-relaxed">
                Your profile is built from habits you have kept, not credentials you hold. Make at least one commitment before registering.
              </p>
              <div className="flex gap-3 justify-center">
                <Link href="/commitment" className="btn-primary no-underline">Make a commitment →</Link>
                <button onClick={() => setStep('legacy-url')} className="btn-secondary">Use profile.json instead</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ LEGACY URL ═══ */}
      {step === 'legacy-url' && (
        <div className="card-grace p-8">
          <h2 className="font-heading text-xl font-bold mb-2">Where is your profile hosted?</h2>
          <p className="font-body text-sm text-[#5a5a5a] mb-6">Enter the URL of your <code className="font-mono text-xs bg-[#f5f5f5] px-1 py-0.5 rounded">profile.json</code> endpoint.</p>
          <div className="space-y-4">
            <div>
              <label className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] block mb-2">Profile endpoint URL</label>
              <input type="url" value={endpointUrl} onChange={e => setEndpointUrl(e.target.value)}
                placeholder="https://yourname.com/profile.json"
                className="w-full px-4 py-3 border border-[#d4d4d4] rounded-[3px] font-mono text-sm outline-none focus:border-[#1a3a6b]" />
            </div>
            {legacyErrors.length > 0 && (
              <div className="p-3 bg-[#fef2f2] border border-[#d4d4d4] rounded-[3px]">
                {legacyErrors.map((e, i) => <p key={i} className="font-body text-sm text-[#991b1b]">{e}</p>)}
              </div>
            )}
            <button onClick={handleLegacyFetch} disabled={legacyValidating || !endpointUrl} className="btn-primary disabled:opacity-50">
              {legacyValidating ? 'Fetching…' : 'Fetch Profile →'}
            </button>
            <div className="border-t border-[#f0f0f0] pt-4">
              <button onClick={() => setShowManualPaste(!showManualPaste)} className="font-body text-xs text-[#767676] underline">
                {showManualPaste ? 'Hide manual paste' : 'Paste JSON manually instead'}
              </button>
              {showManualPaste && (
                <div className="mt-3 space-y-3">
                  <textarea value={manualJson} onChange={e => setManualJson(e.target.value)} rows={8}
                    placeholder="Paste your profile.json contents here…"
                    className="w-full px-3 py-2 border border-[#d4d4d4] rounded-[3px] font-mono text-xs outline-none focus:border-[#1a3a6b] resize-none" />
                  <button onClick={handleLegacyManualPaste} className="btn-primary">Parse JSON →</button>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={() => setStep('practice')} className="btn-secondary">← Back</button>
          </div>
        </div>
      )}

      {/* ═══ LEGACY VALIDATE ═══ */}
      {step === 'legacy-validate' && legacyExtracted && (
        <div className="card-grace p-8">
          <h2 className="font-heading text-xl font-bold mb-2">Review your directory listing</h2>
          <p className="font-body text-sm text-[#5a5a5a] mb-6">This metadata was extracted from your profile.json. This is what platforms see in the directory.</p>
          <div className="space-y-4">
            <div className="p-4 bg-[#f5f5f5] rounded-[3px]">
              <div className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-2">Identity</div>
              <div className="font-heading text-lg font-bold">{legacyExtracted.display_name}</div>
              {legacyExtracted.handle && <div className="font-mono text-sm text-[#767676]">{legacyExtracted.handle}</div>}
              <div className="font-body text-xs text-[#767676] mt-1">{[legacyExtracted.location, legacyExtracted.age_cohort].filter(Boolean).join(' · ') || 'No location set'}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-[#f5f5f5] rounded-[3px]">
                <div className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">Presence Score</div>
                <div className="font-mono text-2xl font-medium text-[#1a3a6b]">{legacyExtracted.presence_score}</div>
              </div>
              <div className="p-4 bg-[#f5f5f5] rounded-[3px]">
                <div className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">Skills</div>
                <div className="font-mono text-2xl font-medium">{legacyExtracted.skills_count}</div>
              </div>
            </div>
            {legacyExtracted.interests_tags.length > 0 && (
              <div className="p-4 bg-[#f5f5f5] rounded-[3px]">
                <div className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-2">Interests</div>
                <div className="flex flex-wrap gap-1.5">
                  {legacyExtracted.interests_tags.map((tag, i) => <span key={i} className="font-body text-xs px-2 py-0.5 bg-[#eef2f8] text-[#1a3a6b] rounded-[2px]">{tag}</span>)}
                </div>
              </div>
            )}
            {endpointUrl && (
              <div className="p-3 bg-[#1a1a1a] rounded-[3px]">
                <div className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-white/40 mb-1">Endpoint</div>
                <div className="font-mono text-xs text-[#5eead4] break-all">{endpointUrl}</div>
              </div>
            )}
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={() => setStep('legacy-url')} className="btn-secondary">← Back</button>
            <button onClick={() => setStep('pricing')} className="btn-primary">Looks Good →</button>
          </div>
        </div>
      )}

      {/* ═══ PRICING ═══ */}
      {step === 'pricing' && (
        <div className="card-grace p-8">
          <h2 className="font-heading text-xl font-bold mb-2">Set your access pricing</h2>
          <p className="font-body text-sm text-[#5a5a5a] mb-6">Choose what platforms pay to query your profile at each tier. You keep 90% of every query.</p>
          <div className="space-y-5">
            {[
              { key: 'publicPrice' as const, label: 'Public Tier', desc: 'Practice record, habit history, trust score', range: '$0.01 – $0.10', color: 'bg-[#eef2f8]', labelColor: 'text-[#1a3a6b]' },
              { key: 'privatePrice' as const, label: 'Private Tier', desc: 'Full profile including all commitment data', range: '$0.10 – $2.00', color: 'bg-[#f5f5f5]', labelColor: 'text-[#1a1a1a]' },
              { key: 'marketingPrice' as const, label: 'Marketing Tier', desc: 'Pay to message you directly. No refunds.', range: '$1.00 – $50.00', color: 'bg-[#fffbeb]', labelColor: 'text-[#92400e]' },
            ].map(({ key, label, desc, range, color, labelColor }) => (
              <div key={key} className={`p-4 ${color} rounded-[3px]`}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className={`font-body text-[11px] font-bold tracking-[0.1em] uppercase ${labelColor}`}>{label}</div>
                    <div className="font-body text-xs text-[#767676]">{desc}</div>
                  </div>
                  <div className="font-body text-[10px] text-[#767676]">Suggested: {range}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-[#767676]">$</span>
                  <input type="number" step="0.01" min="0.01" value={pricing[key]}
                    onChange={e => setPricing(p => ({ ...p, [key]: e.target.value }))}
                    className="w-32 px-3 py-2 border border-[#d4d4d4] rounded-[3px] font-mono text-sm outline-none focus:border-[#1a3a6b]" />
                  <span className="font-body text-xs text-[#767676]">{key === 'marketingPrice' ? 'per message' : 'per query'}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 p-3 bg-[#f0fdf4] border-l-[3px] border-[#166534] rounded-[3px]">
            <p className="font-body text-sm text-[#166534] m-0"><strong>Revenue split:</strong> You keep 90% of every query and message. On a $0.50 Private tier query, you earn $0.45.</p>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={() => setStep(legacyExtracted ? 'legacy-validate' : 'practice')} className="btn-secondary">← Back</button>
            <button onClick={() => setStep('confirm')} className="btn-primary">Set Pricing →</button>
          </div>
        </div>
      )}

      {/* ═══ CONFIRM ═══ */}
      {step === 'confirm' && (
        <div className="card-grace p-8">
          <h2 className="font-heading text-xl font-bold mb-2">Confirm &amp; register</h2>
          <p className="font-body text-sm text-[#5a5a5a] mb-6">Review your directory listing before going live.</p>
          <div className="space-y-3">
            {!isLegacyPath && practiceData ? (
              <>
                <div className="flex justify-between py-2 border-b border-[#f0f0f0]">
                  <span className="font-body text-sm text-[#767676]">Profile type</span>
                  <span className="font-body text-sm font-medium text-[#1a3a6b]">Practice-based</span>
                </div>
                <div className="flex justify-between py-2 border-b border-[#f0f0f0]">
                  <span className="font-body text-sm text-[#767676]">Commitments</span>
                  <span className="font-mono text-sm">{practiceData.commitments.length}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-[#f0f0f0]">
                  <span className="font-body text-sm text-[#767676]">Days logged</span>
                  <span className="font-mono text-sm">{practiceData.total_days}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-[#f0f0f0]">
                  <span className="font-body text-sm text-[#767676]">Starting Trust Score</span>
                  <span className="font-mono text-sm font-medium text-[#1a3a6b]">{practiceData.practice_depth_score}</span>
                </div>
              </>
            ) : legacyExtracted ? (
              <>
                <div className="flex justify-between py-2 border-b border-[#f0f0f0]">
                  <span className="font-body text-sm text-[#767676]">Name</span>
                  <span className="font-body text-sm font-medium">{legacyExtracted.display_name}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-[#f0f0f0]">
                  <span className="font-body text-sm text-[#767676]">Presence Score</span>
                  <span className="font-mono text-sm font-medium text-[#1a3a6b]">{legacyExtracted.presence_score}</span>
                </div>
              </>
            ) : null}
            <div className="flex justify-between py-2 border-b border-[#f0f0f0]">
              <span className="font-body text-sm text-[#767676]">Public Price</span>
              <span className="font-mono text-sm text-[#166534]">${parseFloat(pricing.publicPrice).toFixed(2)}/query</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#f0f0f0]">
              <span className="font-body text-sm text-[#767676]">Private Price</span>
              <span className="font-mono text-sm text-[#166534]">${parseFloat(pricing.privatePrice).toFixed(2)}/query</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="font-body text-sm text-[#767676]">Marketing Price</span>
              <span className="font-mono text-sm text-[#92400e]">${parseFloat(pricing.marketingPrice).toFixed(2)}/message</span>
            </div>
          </div>
          {error && <div className="mt-4 p-3 bg-[#fef2f2] border border-[#d4d4d4] rounded-[3px]"><p className="font-body text-sm text-[#991b1b]">{error}</p></div>}
          <div className="flex gap-3 mt-8">
            <button onClick={() => setStep('pricing')} className="btn-secondary">← Back</button>
            <button onClick={handleRegister} disabled={saving} className="btn-primary disabled:opacity-50 flex-1">
              {saving ? 'Registering…' : 'Register in Directory'}
            </button>
          </div>
        </div>
      )}

      {/* ═══ SUCCESS ═══ */}
      {step === 'success' && (
        <div className="card-grace p-8 text-center">
          <div className="text-4xl mb-4">🌱</div>
          <h2 className="font-heading text-[28px] font-bold mb-2">You&apos;re in the directory</h2>
          <div className="inline-block bg-[#1a3a6b] text-white font-mono text-xl font-medium px-6 py-3 rounded-[3px] mb-4">{profileNumber}</div>
          <p className="font-body text-sm text-[#5a5a5a] mb-3 max-w-[440px] mx-auto leading-relaxed">
            Your profile is now discoverable by platforms. Your Trust Score grows as you keep your commitments and add supporters.
          </p>
          <p className="font-body text-sm text-[#767676] mb-8 max-w-[440px] mx-auto leading-relaxed">
            Keep posting to your active commitments — every day you log strengthens your profile and increases your query value.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/practice" className="btn-secondary no-underline text-center">Go to Practice</Link>
            <button onClick={() => router.push('/dashboard')} className="btn-primary">Go to Dashboard</button>
          </div>
        </div>
      )}
    </div>
  )
}
