'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ─── Types ───────────────────────────────────────────────────────

type Mode = 'choose' | 'import' | 'manual'
type ImportStep = 'paste' | 'endpoint' | 'pricing' | 'confirm'
type ManualStep = 'identity' | 'financial' | 'presence' | 'skills' | 'interests' | 'pricing' | 'review'

interface Identity {
  displayName: string
  handle: string
  tagline: string
  location: string
  age: string
}

interface Financial {
  ageCohort: string
  netWorth: string
  income: string
  savingsRate: string
  creditScore: string
  debtToIncome: string
}

interface PresenceScores {
  rizz: number
  vibe: number
  drip: number
}

interface Skill {
  id: string
  name: string
  level: string
  score: number
}

interface Interest {
  id: string
  name: string
  category: string
  domain: 'athletic' | 'social' | 'intellectual'
}

interface Pricing {
  publicPrice: string
  privatePrice: string
  marketingPrice: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProfileJSON = Record<string, any>

// ─── Constants ────────────────────────────────────────────────────

const AGE_COHORTS = [
  '18-24', '25-29', '30-34', '35-39', '40-44',
  '45-49', '50-54', '55-59', '60-64', '65-69', '70-74', '75-79', '80-84', '85-89', '90+'
]

const PERCENTILE_OPTIONS = [
  { value: '25', label: '25th percentile' },
  { value: '50', label: '50th percentile (median)' },
  { value: '75', label: '75th percentile' },
  { value: '90', label: '90th percentile' },
  { value: '95', label: '95th percentile' },
  { value: '99', label: '99th percentile' },
]

const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert']

const MANUAL_STEPS: { key: ManualStep; label: string; icon: string }[] = [
  { key: 'identity', label: 'Identity', icon: '👤' },
  { key: 'financial', label: 'Financial', icon: '📊' },
  { key: 'presence', label: 'Presence', icon: '✨' },
  { key: 'skills', label: 'Skills', icon: '🔧' },
  { key: 'interests', label: 'Interests', icon: '🎯' },
  { key: 'pricing', label: 'Pricing', icon: '💰' },
  { key: 'review', label: 'Review', icon: '✅' },
]


// ─── Main Component ──────────────────────────────────────────────

export default function ProfileBuilder() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('choose')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // ── Import path state ──
  const [importStep, setImportStep] = useState<ImportStep>('paste')
  const [jsonInput, setJsonInput] = useState('')
  const [endpointUrl, setEndpointUrl] = useState('')
  const [parsedProfile, setParsedProfile] = useState<ProfileJSON | null>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  // ── Manual path state ──
  const [manualStep, setManualStep] = useState<ManualStep>('identity')
  const [identity, setIdentity] = useState<Identity>({
    displayName: '', handle: '', tagline: '', location: '', age: ''
  })
  const [financial, setFinancial] = useState<Financial>({
    ageCohort: '', netWorth: '50', income: '50', savingsRate: '50', creditScore: '50', debtToIncome: '50'
  })
  const [presence, setPresence] = useState<PresenceScores>({ rizz: 50, vibe: 50, drip: 50 })
  const [skills, setSkills] = useState<Skill[]>([])
  const [interests, setInterests] = useState<Interest[]>([])
  const [pricing, setPricing] = useState<Pricing>({
    publicPrice: '0.02', privatePrice: '0.50', marketingPrice: '5.00'
  })

  // ── Shared helpers ──
  const generateProfileNumber = () => {
    const num = Math.floor(Math.random() * 999999) + 1
    return `SS-${num.toString().padStart(6, '0')}`
  }

  // ── JSON-LD Validation ──
  const validateProfileJSON = (json: ProfileJSON): string[] => {
    const errors: string[] = []
    if (!json['@context'] && !json.identity && !json.presenceComposite) {
      errors.push('This doesn\'t look like a Search Star JSON-LD profile. Expected @context, identity, or presenceComposite fields.')
      return errors
    }
    if (!json.identity?.displayName) errors.push('Missing identity.displayName (required)')
    if (json.financial) {
      if (json.financial.netWorth?.percentile && typeof json.financial.netWorth.percentile !== 'number') {
        errors.push('financial.netWorth.percentile must be a number')
      }
    }
    return errors
  }

  // Parse pasted JSON
  const handleParseJSON = () => {
    setError(null)
    setValidationErrors([])
    try {
      const parsed = JSON.parse(jsonInput.trim())
      const errors = validateProfileJSON(parsed)
      if (errors.length > 0) {
        setValidationErrors(errors)
        return
      }
      setParsedProfile(parsed)
      // Pre-fill pricing from parsed JSON if available
      if (parsed.accessPolicy?.tiers) {
        const tiers = parsed.accessPolicy.tiers
        if (tiers.public?.pricePerQuery) setPricing(p => ({ ...p, publicPrice: String(tiers.public.pricePerQuery) }))
        if (tiers.private?.pricePerQuery) setPricing(p => ({ ...p, privatePrice: String(tiers.private.pricePerQuery) }))
        if (tiers.marketing?.pricePerMessage) setPricing(p => ({ ...p, marketingPrice: String(tiers.marketing.pricePerMessage) }))
      }
      setImportStep('endpoint')
    } catch {
      setError('Invalid JSON. Make sure you copied the complete JSON-LD output from the AI.')
    }
  }

  // Extract profile data from parsed JSON for Supabase directory
  const extractFromJSON = (json: ProfileJSON) => {
    const id = json.identity || {}
    const fin = json.financial || {}
    const pc = json.presenceComposite || {}
    const sk = json.skills || []
    const int = json.interests || {}

    const presenceScore = pc.score || (pc.rizz?.score && pc.vibe?.score && pc.drip?.score
      ? Math.round((pc.rizz.score + pc.vibe.score + pc.drip.score) / 3) : 0)

    const allInterests = [
      ...(int.athletic || []).map((i: { name?: string }) => i.name),
      ...(int.social || []).map((i: { name?: string }) => i.name),
      ...(int.intellectual || []).map((i: { name?: string }) => i.name),
    ].filter(Boolean)

    return {
      display_name: id.displayName || 'Unknown',
      handle: id.handle || null,
      tagline: id.tagline || null,
      location: id.location || null,
      age: id.age || null,
      age_cohort: fin.ageCohort || null,
      presence_score: presenceScore,
      net_worth_percentile: fin.netWorth?.percentile || null,
      income_percentile: fin.income?.percentile || null,
      skills_count: sk.length,
      interests_tags: allInterests,
      has_financial: !!fin.ageCohort || !!fin.netWorth,
      has_dating: !!json.dating,
      has_advertising: !!json.advertising,
      has_content_feed: !!json.contentFeed,
    }
  }

  // ── Save imported profile ──
  const handleSaveImport = async () => {
    if (!parsedProfile) return
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const extracted = extractFromJSON(parsedProfile)
      const profileNumber = generateProfileNumber()

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          profile_number: profileNumber,
          ...extracted,
          endpoint_url: endpointUrl || null,
          domain: endpointUrl ? new URL(endpointUrl).hostname : null,
          trust_score: 50,
          price_public: parseFloat(pricing.publicPrice),
          price_private: parseFloat(pricing.privatePrice),
          price_marketing: parseFloat(pricing.marketingPrice),
          profile_json: parsedProfile,
          onboarding_completed: true,
          status: 'active',
        })
        .eq('user_id', user.id)

      if (updateError) throw updateError
      setSuccess(true)
      setTimeout(() => router.push('/dashboard'), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  // ── Save manual profile (same as original) ──
  const buildProfileJSON = () => {
    const presenceScore = Math.round((presence.rizz + presence.vibe + presence.drip) / 3)
    return {
      '@context': 'https://schema.searchstar.org/v0.1',
      '@type': 'SearchStar',
      version: '0.1.0',
      identity: {
        displayName: identity.displayName,
        handle: identity.handle,
        tagline: identity.tagline,
        location: identity.location,
        age: parseInt(identity.age) || null,
      },
      financial: {
        ageCohort: financial.ageCohort,
        netWorth: { percentile: parseInt(financial.netWorth), label: `${financial.netWorth}th percentile` },
        income: { percentile: parseInt(financial.income), label: `${financial.income}th percentile` },
        savingsRate: { percentile: parseInt(financial.savingsRate), label: `${financial.savingsRate}th percentile` },
        creditScore: { percentile: parseInt(financial.creditScore), label: `${financial.creditScore}th percentile` },
        debtToIncome: { percentile: parseInt(financial.debtToIncome), label: `${financial.debtToIncome}th percentile` },
      },
      presenceComposite: {
        score: presenceScore,
        rizz: { score: presence.rizz },
        vibe: { score: presence.vibe },
        drip: { score: presence.drip },
      },
      skills: skills.map(s => ({ name: s.name, level: s.level, score: s.score })),
      interests: {
        athletic: interests.filter(i => i.domain === 'athletic').map(i => ({ name: i.name, category: i.category })),
        social: interests.filter(i => i.domain === 'social').map(i => ({ name: i.name, category: i.category })),
        intellectual: interests.filter(i => i.domain === 'intellectual').map(i => ({ name: i.name, category: i.category })),
      },
      accessPolicy: {
        tiers: {
          public: { pricePerQuery: parseFloat(pricing.publicPrice) },
          private: { pricePerQuery: parseFloat(pricing.privatePrice) },
          marketing: { pricePerMessage: parseFloat(pricing.marketingPrice) },
        }
      }
    }
  }

  const handleSaveManual = async () => {
    setSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const profileNumber = generateProfileNumber()
      const profileJson = buildProfileJSON()
      const presenceScore = Math.round((presence.rizz + presence.vibe + presence.drip) / 3)

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          profile_number: profileNumber,
          handle: identity.handle || null,
          display_name: identity.displayName,
          tagline: identity.tagline || null,
          location: identity.location || null,
          age: parseInt(identity.age) || null,
          age_cohort: financial.ageCohort || null,
          presence_score: presenceScore,
          trust_score: 50,
          net_worth_percentile: parseInt(financial.netWorth) || null,
          income_percentile: parseInt(financial.income) || null,
          skills_count: skills.length,
          interests_tags: interests.map(i => i.name),
          has_financial: financial.ageCohort !== '',
          price_public: parseFloat(pricing.publicPrice),
          price_private: parseFloat(pricing.privatePrice),
          price_marketing: parseFloat(pricing.marketingPrice),
          profile_json: profileJson,
          onboarding_completed: true,
          status: 'active',
        })
        .eq('user_id', user.id)

      if (updateError) throw updateError
      setSuccess(true)
      setTimeout(() => router.push('/dashboard'), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  // ── Success screen ──
  if (success) {
    return (
      <div className="p-8">
        <div className="max-w-[640px] mx-auto text-center py-16">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="font-heading text-[32px] font-bold mb-2">Profile registered!</h1>
          <p className="font-body text-sm text-[#767676]">
            Your Search Star profile is live in the directory. Redirecting to your dashboard...
          </p>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════
  // MODE: CHOOSE — path selection
  // ═══════════════════════════════════════════════════════════════
  if (mode === 'choose') {
    return (
      <div className="p-8">
        <div className="max-w-[800px]">
          <div className="mb-8">
            <h1 className="font-heading text-[32px] font-bold mb-1">Register your profile</h1>
            <p className="font-body text-sm text-[#767676]">
              Search Star is a sovereign data standard — you create and host your profile, we index it in the directory.
            </p>
          </div>

          {/* Path A: AI-generated (primary) */}
          <div className="card-grace p-8 mb-4 border-l-[4px] !border-l-[#1a3a6b]">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-[#1a3a6b] rounded-[3px] flex items-center justify-center text-white font-body font-bold text-sm shrink-0">A</div>
              <div className="flex-1">
                <div className="font-body text-[10px] font-bold tracking-[0.15em] uppercase text-[#166534] bg-[#f0fdf4] px-2 py-0.5 rounded-[2px] inline-block mb-2">Recommended</div>
                <h2 className="font-heading text-xl font-bold mb-2">I have a profile from AI</h2>
                <p className="font-body text-sm text-[#5a5a5a] leading-relaxed mb-4">
                  You used Claude, Grok, or ChatGPT with the Search Star prompt to build your JSON-LD profile. Paste the JSON output here, optionally enter your hosting endpoint URL, set your pricing, and register in the directory.
                </p>

                <div className="p-4 bg-[#eef2f8] rounded-[3px] mb-4">
                  <p className="font-body text-[13px] text-[#5a5a5a] m-0 leading-relaxed">
                    <strong className="text-[#1a1a1a]">Don&apos;t have a profile yet?</strong> Copy the AI prompt from{' '}
                    <a href="/create.html" target="_blank" className="text-[#1a3a6b] font-bold no-underline hover:underline">
                      the Create page
                    </a>
                    , paste it into any AI, and follow the conversation. It takes about 10 minutes. Then come back here with the JSON-LD output.
                  </p>
                </div>

                <div className="p-4 bg-[#f0fdf4] rounded-[3px] mb-5">
                  <p className="font-body text-[13px] text-[#5a5a5a] m-0 leading-relaxed">
                    <strong className="text-[#1a1a1a]">Self-hosting?</strong> Follow our{' '}
                    <a href="/setup.html" target="_blank" className="text-[#166534] font-bold no-underline hover:underline">
                      hosting setup guide
                    </a>
                    {' '}to put your profile on Cloudflare Pages, Vercel, Netlify, or your own server. Then register the endpoint URL here so platforms can query it.
                  </p>
                </div>

                <button onClick={() => setMode('import')} className="btn-primary">
                  Register AI-Generated Profile
                </button>
              </div>
            </div>
          </div>

          {/* Path B: Manual (fallback) */}
          <div className="card-grace p-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-white border-2 border-[#d4d4d4] rounded-[3px] flex items-center justify-center text-[#767676] font-body font-bold text-sm shrink-0">B</div>
              <div className="flex-1">
                <h2 className="font-heading text-xl font-bold mb-2">Build manually</h2>
                <p className="font-body text-sm text-[#5a5a5a] leading-relaxed mb-4">
                  Fill in your profile using a guided form. Search Star will generate the JSON-LD for you, but you won&apos;t get the self-hosting benefits until you export and host the file yourself.
                </p>
                <button onClick={() => setMode('manual')} className="btn-secondary">
                  Build Profile Manually
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════
  // MODE: IMPORT — AI-generated profile registration
  // ═══════════════════════════════════════════════════════════════
  if (mode === 'import') {
    return (
      <div className="p-8">
        <div className="max-w-[800px]">
          <div className="mb-6">
            <button onClick={() => { setMode('choose'); setImportStep('paste'); setParsedProfile(null); setError(null); setValidationErrors([]) }} className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-3 cursor-pointer bg-transparent border-none hover:text-[#1a3a6b]">
              ← Back to options
            </button>
            <h1 className="font-heading text-[32px] font-bold mb-1">Register your profile</h1>
            <p className="font-body text-sm text-[#767676]">
              Paste your AI-generated JSON-LD, set your endpoint and pricing, and join the directory.
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex gap-1 mb-6">
            {(['paste', 'endpoint', 'pricing', 'confirm'] as ImportStep[]).map((step, i) => {
              const labels = ['1. Paste JSON', '2. Endpoint URL', '3. Set Pricing', '4. Confirm']
              const stepIdx = (['paste', 'endpoint', 'pricing', 'confirm'] as ImportStep[]).indexOf(importStep)
              return (
                <div
                  key={step}
                  className={`flex-1 py-2 px-2 rounded-[3px] font-body text-[11px] font-bold tracking-[0.05em] uppercase text-center border ${
                    i === stepIdx ? 'bg-[#1a3a6b] text-white border-[#1a3a6b]'
                    : i < stepIdx ? 'bg-[#f0fdf4] text-[#166534] border-[#166534]/20'
                    : 'bg-white text-[#b8b8b8] border-[#d4d4d4]'
                  }`}
                >
                  {labels[i]}
                </div>
              )
            })}
          </div>

          <div className="card-grace p-8">
            {/* Step 1: Paste JSON */}
            {importStep === 'paste' && (
              <div>
                <h2 className="font-heading text-xl font-bold mb-1">Paste your profile JSON-LD</h2>
                <p className="font-body text-sm text-[#767676] mb-4">
                  Copy the complete JSON output from your AI conversation and paste it below.
                </p>
                <textarea
                  value={jsonInput}
                  onChange={e => setJsonInput(e.target.value)}
                  placeholder={'{\n  "@context": "https://schema.searchstar.org/v0.1",\n  "@type": "SearchStar",\n  "identity": { ... },\n  ...\n}'}
                  className="w-full h-64 px-4 py-3 border border-[#d4d4d4] rounded-[3px] font-mono text-[13px] outline-none focus:border-[#1a3a6b] resize-y leading-relaxed"
                />
                {validationErrors.length > 0 && (
                  <div className="mt-3 p-3 bg-[#fffbeb] border-l-[3px] border-[#92400e] rounded-[3px]">
                    <div className="font-body text-[11px] font-bold uppercase text-[#92400e] mb-1">Validation issues</div>
                    {validationErrors.map((e, i) => (
                      <p key={i} className="font-body text-sm text-[#92400e] m-0">{e}</p>
                    ))}
                  </div>
                )}
                {error && (
                  <div className="mt-3 p-3 bg-[#fef2f2] border-l-[3px] border-[#991b1b] rounded-[3px]">
                    <p className="font-body text-sm text-[#991b1b] m-0">{error}</p>
                  </div>
                )}
                <div className="flex justify-between mt-6 pt-6 border-t border-[#e8e8e8]">
                  <div />
                  <button
                    onClick={handleParseJSON}
                    disabled={!jsonInput.trim()}
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Validate & Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Endpoint URL */}
            {importStep === 'endpoint' && parsedProfile && (
              <div>
                <h2 className="font-heading text-xl font-bold mb-1">Profile endpoint</h2>
                <p className="font-body text-sm text-[#767676] mb-4">
                  If you&apos;re self-hosting your profile, enter the URL where your JSON-LD is served. Platforms will query this endpoint directly. If you haven&apos;t set up hosting yet, you can skip this and add it later.
                </p>

                {/* Preview of parsed data */}
                <div className="p-4 bg-[#f0fdf4] border-l-[3px] border-[#166534] rounded-[3px] mb-5">
                  <div className="font-body text-[11px] font-bold uppercase text-[#166534] mb-2">Profile parsed successfully</div>
                  <div className="grid grid-cols-2 gap-2">
                    <MiniStat label="Name" value={parsedProfile.identity?.displayName || '—'} />
                    <MiniStat label="Handle" value={parsedProfile.identity?.handle || '—'} />
                    <MiniStat label="Location" value={parsedProfile.identity?.location || '—'} />
                    <MiniStat label="Presence" value={
                      parsedProfile.presenceComposite?.score
                        ? `${parsedProfile.presenceComposite.score}/100`
                        : '—'
                    } />
                    <MiniStat label="Skills" value={parsedProfile.skills?.length?.toString() || '0'} />
                    <MiniStat label="Financial" value={parsedProfile.financial?.ageCohort || 'Not set'} />
                  </div>
                </div>

                <label className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] block mb-1.5">
                  Endpoint URL <span className="text-[#b8b8b8] font-normal normal-case">(optional — add later if not hosting yet)</span>
                </label>
                <input
                  value={endpointUrl}
                  onChange={e => setEndpointUrl(e.target.value)}
                  placeholder="https://yourname.com/profile.json"
                  className="w-full px-3 py-2.5 border border-[#d4d4d4] rounded-[3px] font-mono text-sm outline-none focus:border-[#1a3a6b] transition-colors"
                />
                <p className="font-body text-[12px] text-[#b8b8b8] mt-1.5 mb-0">
                  Not sure how to host? Read the <a href="/setup.html" target="_blank" className="text-[#1a3a6b] no-underline hover:underline">self-hosting setup guide</a>.
                </p>

                <div className="flex justify-between mt-6 pt-6 border-t border-[#e8e8e8]">
                  <button onClick={() => setImportStep('paste')} className="btn-secondary">Back</button>
                  <button onClick={() => setImportStep('pricing')} className="btn-primary">Continue</button>
                </div>
              </div>
            )}

            {/* Step 3: Pricing */}
            {importStep === 'pricing' && (
              <div>
                <h2 className="font-heading text-xl font-bold mb-1">Set your pricing</h2>
                <p className="font-body text-sm text-[#767676] mb-6">
                  Set per-query prices for each access tier. You earn 90% — Search Star takes a 10% marketplace fee.
                  {parsedProfile?.accessPolicy?.tiers && (
                    <span className="text-[#166534] font-medium"> (Pre-filled from your JSON — adjust as needed.)</span>
                  )}
                </p>
                <div className="space-y-5">
                  <PriceInput icon="🌐" tier="Public" color="#1a3a6b"
                    desc="Open to all platforms. Identity, skills, interests, Presence headline."
                    suggested="$0.01 – $0.10" value={pricing.publicPrice}
                    onChange={v => setPricing(p => ({ ...p, publicPrice: v }))} unit="per query" />
                  <PriceInput icon="🔐" tier="Private" color="#166534"
                    desc="Platforms you approve. Full profile — financials, Presence breakdown, advertising, media."
                    suggested="$0.10 – $2.00" value={pricing.privatePrice}
                    onChange={v => setPricing(p => ({ ...p, privatePrice: v }))} unit="per query" />
                  <PriceInput icon="📨" tier="Marketing" color="#92400e"
                    desc="Anyone can message you. Recruiters, brands, dates. No refunds."
                    suggested="$1.00 – $25.00" value={pricing.marketingPrice}
                    onChange={v => setPricing(p => ({ ...p, marketingPrice: v }))} unit="per message" />
                </div>
                <div className="flex justify-between mt-6 pt-6 border-t border-[#e8e8e8]">
                  <button onClick={() => setImportStep('endpoint')} className="btn-secondary">Back</button>
                  <button onClick={() => setImportStep('confirm')} className="btn-primary">Continue</button>
                </div>
              </div>
            )}

            {/* Step 4: Confirm */}
            {importStep === 'confirm' && parsedProfile && (
              <div>
                <h2 className="font-heading text-xl font-bold mb-1">Confirm & register</h2>
                <p className="font-body text-sm text-[#767676] mb-6">
                  Review your profile details. Once registered, you&apos;ll receive a permanent profile number (SS-XXXXXX) and be indexed in the directory.
                </p>

                <div className="space-y-3">
                  <ReviewSection title="Identity">
                    <ReviewRow label="Name" value={parsedProfile.identity?.displayName || '—'} />
                    <ReviewRow label="Handle" value={parsedProfile.identity?.handle || '—'} />
                    <ReviewRow label="Tagline" value={parsedProfile.identity?.tagline || '—'} />
                    <ReviewRow label="Location" value={parsedProfile.identity?.location || '—'} />
                  </ReviewSection>
                  <ReviewSection title="Hosting">
                    <ReviewRow label="Endpoint" value={endpointUrl || 'Not set (Search Star hosted)'} />
                    <ReviewRow label="Domain" value={endpointUrl ? new URL(endpointUrl).hostname : '—'} />
                  </ReviewSection>
                  <ReviewSection title="Pricing">
                    <ReviewRow label="Public" value={`$${pricing.publicPrice}/query`} />
                    <ReviewRow label="Private" value={`$${pricing.privatePrice}/query`} />
                    <ReviewRow label="Marketing" value={`$${pricing.marketingPrice}/message`} />
                  </ReviewSection>
                </div>

                {error && (
                  <div className="mt-4 p-3 bg-[#fef2f2] border-l-[3px] border-[#991b1b] rounded-[3px]">
                    <p className="font-body text-sm text-[#991b1b] m-0">{error}</p>
                  </div>
                )}

                <div className="flex justify-between mt-6 pt-6 border-t border-[#e8e8e8]">
                  <button onClick={() => setImportStep('pricing')} className="btn-secondary">Back</button>
                  <button
                    onClick={handleSaveImport}
                    disabled={saving}
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Registering...' : 'Register Profile'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════
  // MODE: MANUAL — guided form (preserved from original)
  // ═══════════════════════════════════════════════════════════════
  const manualStepIndex = MANUAL_STEPS.findIndex(s => s.key === manualStep)
  const goNext = () => { if (manualStepIndex < MANUAL_STEPS.length - 1) setManualStep(MANUAL_STEPS[manualStepIndex + 1].key) }
  const goBack = () => { if (manualStepIndex > 0) setManualStep(MANUAL_STEPS[manualStepIndex - 1].key) }

  return (
    <div className="p-8">
      <div className="max-w-[800px]">
        <div className="mb-6">
          <button onClick={() => setMode('choose')} className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-3 cursor-pointer bg-transparent border-none hover:text-[#1a3a6b]">
            ← Back to options
          </button>
          <h1 className="font-heading text-[32px] font-bold mb-1">Build your profile</h1>
          <p className="font-body text-sm text-[#767676]">
            Complete each section. For a faster, richer profile, try the{' '}
            <button onClick={() => setMode('choose')} className="text-[#1a3a6b] font-bold underline cursor-pointer bg-transparent border-none p-0 font-body text-sm">
              AI-assisted path
            </button> instead.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex gap-1 mb-6">
          {MANUAL_STEPS.map((step, i) => (
            <button
              key={step.key}
              onClick={() => setManualStep(step.key)}
              className={`flex-1 py-2 px-2 rounded-[3px] font-body text-[11px] font-bold tracking-[0.05em] uppercase text-center transition-all cursor-pointer border ${
                i === manualStepIndex
                  ? 'bg-[#1a3a6b] text-white border-[#1a3a6b]'
                  : i < manualStepIndex
                  ? 'bg-[#f0fdf4] text-[#166534] border-[#166534]/20'
                  : 'bg-white text-[#b8b8b8] border-[#d4d4d4]'
              }`}
            >
              <span className="hidden md:inline">{step.icon} </span>{step.label}
            </button>
          ))}
        </div>

        <div className="card-grace p-8">
          {manualStep === 'identity' && <IdentityStep identity={identity} onChange={setIdentity} />}
          {manualStep === 'financial' && <FinancialStep financial={financial} onChange={setFinancial} />}
          {manualStep === 'presence' && <PresenceStep presence={presence} onChange={setPresence} />}
          {manualStep === 'skills' && <SkillsStep skills={skills} onChange={setSkills} />}
          {manualStep === 'interests' && <InterestsStep interests={interests} onChange={setInterests} />}
          {manualStep === 'pricing' && <PricingStep pricing={pricing} onChange={setPricing} />}
          {manualStep === 'review' && (
            <ManualReviewStep identity={identity} financial={financial} presence={presence}
              skills={skills} interests={interests} pricing={pricing} />
          )}

          {error && (
            <div className="mt-4 p-3 bg-[#fef2f2] border-l-[3px] border-[#991b1b] rounded-[3px]">
              <p className="font-body text-sm text-[#991b1b] m-0">{error}</p>
            </div>
          )}

          <div className="flex justify-between mt-8 pt-6 border-t border-[#e8e8e8]">
            <button onClick={goBack} disabled={manualStepIndex === 0} className="btn-secondary disabled:opacity-30 disabled:cursor-not-allowed">
              Back
            </button>
            {manualStep === 'review' ? (
              <button onClick={handleSaveManual} disabled={saving || !identity.displayName}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? 'Creating profile...' : 'Register Profile'}
              </button>
            ) : (
              <button onClick={goNext} className="btn-primary">Continue</button>
            )}
          </div>
        </div>

        {/* Nudge toward AI path */}
        <div className="mt-4 p-4 bg-[#eef2f8] border-l-[3px] border-[#1a3a6b] rounded-[3px]">
          <p className="font-body text-[13px] text-[#5a5a5a] m-0">
            <strong className="text-[#1a1a1a]">Tip:</strong> For a richer profile, use the{' '}
            <a href="/create.html" target="_blank" className="text-[#1a3a6b] font-bold no-underline hover:underline">AI prompt</a>
            {' '}to build your profile from your existing data (emails, financial exports, fitness apps). The AI can pull more detail than a form.
          </p>
        </div>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════
// MANUAL STEP COMPONENTS (preserved from original Phase 1b)
// ═══════════════════════════════════════════════════════════════════

function IdentityStep({ identity, onChange }: { identity: Identity; onChange: (v: Identity) => void }) {
  const update = (key: keyof Identity, value: string) => onChange({ ...identity, [key]: value })
  return (
    <div>
      <h2 className="font-heading text-xl font-bold mb-1">Identity</h2>
      <p className="font-body text-sm text-[#767676] mb-6">Basic information for your Search Star profile.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Display Name" required value={identity.displayName} onChange={v => update('displayName', v)} placeholder="Steve Smith" />
        <Field label="Handle" value={identity.handle} onChange={v => update('handle', v)} placeholder="stevesmith" />
        <Field label="Age" value={identity.age} onChange={v => update('age', v)} placeholder="32" />
        <Field label="Location" value={identity.location} onChange={v => update('location', v)} placeholder="New York, NY" />
      </div>
      <div className="mt-4">
        <Field label="Tagline" value={identity.tagline} onChange={v => update('tagline', v)} placeholder="Builder of things, investor in people." />
      </div>
    </div>
  )
}

function FinancialStep({ financial, onChange }: { financial: Financial; onChange: (v: Financial) => void }) {
  const update = (key: keyof Financial, value: string) => onChange({ ...financial, [key]: value })
  return (
    <div>
      <h2 className="font-heading text-xl font-bold mb-1">Financial Standing</h2>
      <p className="font-body text-sm text-[#767676] mb-2">
        All financial data is expressed as percentiles within your age cohort. No raw dollar amounts.
      </p>
      <div className="p-3 bg-[#eef2f8] border-l-[3px] border-[#1a3a6b] rounded-[3px] mb-6">
        <p className="font-body text-[12px] text-[#5a5a5a] m-0">
          A 28-year-old at the 90th percentile and a 55-year-old at the 90th percentile are directly comparable.
        </p>
      </div>
      <div className="mb-5">
        <label className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] block mb-1.5">Age Cohort</label>
        <select value={financial.ageCohort} onChange={e => update('ageCohort', e.target.value)}
          className="w-full px-3 py-2.5 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#1a3a6b] bg-white">
          <option value="">Select your age cohort</option>
          {AGE_COHORTS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PercentileSelect label="Net Worth" value={financial.netWorth} onChange={v => update('netWorth', v)} />
        <PercentileSelect label="Annual Income" value={financial.income} onChange={v => update('income', v)} />
        <PercentileSelect label="Savings Rate" value={financial.savingsRate} onChange={v => update('savingsRate', v)} />
        <PercentileSelect label="Credit Score" value={financial.creditScore} onChange={v => update('creditScore', v)} />
        <PercentileSelect label="Debt-to-Income" value={financial.debtToIncome} onChange={v => update('debtToIncome', v)} />
      </div>
    </div>
  )
}

function PresenceStep({ presence, onChange }: { presence: PresenceScores; onChange: (v: PresenceScores) => void }) {
  const update = (key: keyof PresenceScores, value: number) => onChange({ ...presence, [key]: value })
  const composite = Math.round((presence.rizz + presence.vibe + presence.drip) / 3)
  return (
    <div>
      <h2 className="font-heading text-xl font-bold mb-1">Presence Composite</h2>
      <p className="font-body text-sm text-[#767676] mb-2">Score yourself on three dimensions (0–100). Be honest.</p>
      <div className="p-3 bg-[#fffbeb] border-l-[3px] border-[#92400e] rounded-[3px] mb-6">
        <p className="font-body text-[12px] text-[#5a5a5a] m-0">
          Self-assessed scores get a 0.85 confidence discount. Adding photos and peer reviews later will remove the discount.
        </p>
      </div>
      <div className="space-y-6">
        <SliderField label="Rizz" sublabel="Interpersonal magnetism — wit, warmth, presence, confidence" value={presence.rizz} onChange={v => update('rizz', v)} />
        <SliderField label="Vibe" sublabel="Aesthetic taste & curation — cultural range, consistency, environment" value={presence.vibe} onChange={v => update('vibe', v)} />
        <SliderField label="Drip" sublabel="Visual style — fit & silhouette, color sense, originality, context match" value={presence.drip} onChange={v => update('drip', v)} />
      </div>
      <div className="mt-6 p-4 bg-[#fafafa] border border-[#e8e8e8] rounded-[3px] text-center">
        <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">Presence Composite</div>
        <div className="font-heading text-[36px] font-bold text-[#1a3a6b]">{composite}</div>
        <div className="font-mono text-[11px] text-[#b8b8b8]">After 0.85 discount: {Math.round(composite * 0.85)}</div>
      </div>
    </div>
  )
}

function SkillsStep({ skills, onChange }: { skills: Skill[]; onChange: (v: Skill[]) => void }) {
  const [name, setName] = useState('')
  const [level, setLevel] = useState('intermediate')
  const addSkill = () => {
    if (!name.trim()) return
    const scoreMap: Record<string, number> = { beginner: 25, intermediate: 50, advanced: 75, expert: 90 }
    onChange([...skills, { id: Date.now().toString(), name: name.trim(), level, score: scoreMap[level] || 50 }])
    setName('')
  }
  const removeSkill = (id: string) => onChange(skills.filter(s => s.id !== id))

  return (
    <div>
      <h2 className="font-heading text-xl font-bold mb-1">Skills & Credentials</h2>
      <p className="font-body text-sm text-[#767676] mb-6">Add your professional skills.</p>
      <div className="flex gap-2 mb-4">
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSkill()}
          placeholder="e.g. TypeScript, Product Strategy" className="flex-1 px-3 py-2.5 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#1a3a6b]" />
        <select value={level} onChange={e => setLevel(e.target.value)}
          className="px-3 py-2.5 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#1a3a6b] bg-white">
          {SKILL_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <button onClick={addSkill} className="btn-primary !py-2.5 !px-4">Add</button>
      </div>
      {skills.length > 0 ? (
        <div className="space-y-2">
          {skills.map(s => (
            <div key={s.id} className="flex items-center justify-between p-3 bg-[#fafafa] border border-[#e8e8e8] rounded-[3px]">
              <div>
                <span className="font-body text-sm font-medium text-[#1a1a1a]">{s.name}</span>
                <span className="font-body text-[11px] text-[#767676] ml-2 capitalize">{s.level}</span>
              </div>
              <button onClick={() => removeSkill(s.id)} className="font-body text-[11px] text-[#991b1b] font-bold uppercase cursor-pointer bg-transparent border-none">Remove</button>
            </div>
          ))}
        </div>
      ) : (
        <p className="font-body text-sm text-[#b8b8b8] text-center py-6">No skills added yet.</p>
      )}
    </div>
  )
}

function InterestsStep({ interests, onChange }: { interests: Interest[]; onChange: (v: Interest[]) => void }) {
  const [name, setName] = useState('')
  const [domain, setDomain] = useState<'athletic' | 'social' | 'intellectual'>('athletic')
  const addInterest = () => {
    if (!name.trim()) return
    onChange([...interests, { id: Date.now().toString(), name: name.trim(), category: name.trim(), domain }])
    setName('')
  }
  const removeInterest = (id: string) => onChange(interests.filter(i => i.id !== id))
  const domainLabels = { athletic: '🏃 Athletic', social: '🎭 Social', intellectual: '📚 Intellectual' }

  return (
    <div>
      <h2 className="font-heading text-xl font-bold mb-1">Interests</h2>
      <p className="font-body text-sm text-[#767676] mb-6">Add interests across three domains.</p>
      <div className="flex gap-2 mb-2">
        <select value={domain} onChange={e => setDomain(e.target.value as typeof domain)}
          className="px-3 py-2.5 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#1a3a6b] bg-white">
          <option value="athletic">🏃 Athletic</option>
          <option value="social">🎭 Social</option>
          <option value="intellectual">📚 Intellectual</option>
        </select>
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addInterest()}
          placeholder="e.g. Trail Running, Wine Tasting" className="flex-1 px-3 py-2.5 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#1a3a6b]" />
        <button onClick={addInterest} className="btn-primary !py-2.5 !px-4">Add</button>
      </div>
      {(['athletic', 'social', 'intellectual'] as const).map(d => {
        const items = interests.filter(i => i.domain === d)
        if (items.length === 0) return null
        return (
          <div key={d} className="mt-4">
            <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-2">{domainLabels[d]}</div>
            <div className="space-y-1">
              {items.map(i => (
                <div key={i.id} className="flex items-center justify-between p-2 bg-[#fafafa] border border-[#e8e8e8] rounded-[3px]">
                  <span className="font-body text-sm text-[#1a1a1a]">{i.name}</span>
                  <button onClick={() => removeInterest(i.id)} className="font-body text-[11px] text-[#991b1b] font-bold uppercase cursor-pointer bg-transparent border-none">×</button>
                </div>
              ))}
            </div>
          </div>
        )
      })}
      {interests.length === 0 && <p className="font-body text-sm text-[#b8b8b8] text-center py-6">No interests added yet.</p>}
    </div>
  )
}

function PricingStep({ pricing, onChange }: { pricing: Pricing; onChange: (v: Pricing) => void }) {
  const update = (key: keyof Pricing, value: string) => onChange({ ...pricing, [key]: value })
  return (
    <div>
      <h2 className="font-heading text-xl font-bold mb-1">Access Tier Pricing</h2>
      <p className="font-body text-sm text-[#767676] mb-6">Set your per-query prices. You earn 90% — Search Star takes 10%.</p>
      <div className="space-y-5">
        <PriceInput icon="🌐" tier="Public" color="#1a3a6b" desc="Open to all platforms. Identity, skills, interests, Presence headline."
          suggested="$0.01 – $0.10" value={pricing.publicPrice} onChange={v => update('publicPrice', v)} unit="per query" />
        <PriceInput icon="🔐" tier="Private" color="#166534" desc="Platforms you approve. Full profile — financials, Presence breakdown, advertising, media."
          suggested="$0.10 – $2.00" value={pricing.privatePrice} onChange={v => update('privatePrice', v)} unit="per query" />
        <PriceInput icon="📨" tier="Marketing" color="#92400e" desc="Anyone can message you. Recruiters, brands, dates. No refunds."
          suggested="$1.00 – $25.00" value={pricing.marketingPrice} onChange={v => update('marketingPrice', v)} unit="per message" />
      </div>
    </div>
  )
}

function ManualReviewStep({ identity, financial, presence, skills, interests, pricing }: {
  identity: Identity; financial: Financial; presence: PresenceScores; skills: Skill[]; interests: Interest[]; pricing: Pricing
}) {
  const composite = Math.round((presence.rizz + presence.vibe + presence.drip) / 3)
  return (
    <div>
      <h2 className="font-heading text-xl font-bold mb-1">Review your profile</h2>
      <p className="font-body text-sm text-[#767676] mb-6">Confirm everything before registering.</p>
      <div className="space-y-3">
        <ReviewSection title="Identity">
          <ReviewRow label="Name" value={identity.displayName || '—'} />
          <ReviewRow label="Handle" value={identity.handle || '—'} />
          <ReviewRow label="Tagline" value={identity.tagline || '—'} />
          <ReviewRow label="Location" value={identity.location || '—'} />
          <ReviewRow label="Age" value={identity.age || '—'} />
        </ReviewSection>
        <ReviewSection title="Financial">
          <ReviewRow label="Cohort" value={financial.ageCohort || '—'} />
          <ReviewRow label="Net Worth" value={`${financial.netWorth}th percentile`} />
          <ReviewRow label="Income" value={`${financial.income}th percentile`} />
        </ReviewSection>
        <ReviewSection title="Presence">
          <ReviewRow label="Composite" value={`${composite} (after discount: ${Math.round(composite * 0.85)})`} />
          <ReviewRow label="Rizz / Vibe / Drip" value={`${presence.rizz} / ${presence.vibe} / ${presence.drip}`} />
        </ReviewSection>
        <ReviewSection title="Skills & Interests">
          <ReviewRow label="Skills" value={skills.length > 0 ? skills.map(s => s.name).join(', ') : '—'} />
          <ReviewRow label="Interests" value={interests.length > 0 ? interests.map(i => i.name).join(', ') : '—'} />
        </ReviewSection>
        <ReviewSection title="Pricing">
          <ReviewRow label="Public" value={`$${pricing.publicPrice}/query`} />
          <ReviewRow label="Private" value={`$${pricing.privatePrice}/query`} />
          <ReviewRow label="Marketing" value={`$${pricing.marketingPrice}/message`} />
        </ReviewSection>
      </div>
      <div className="mt-4 p-3 bg-[#eef2f8] border-l-[3px] border-[#1a3a6b] rounded-[3px]">
        <p className="font-body text-[12px] text-[#5a5a5a] m-0">
          After registration, download your profile JSON-LD from your Account page and{' '}
          <a href="/setup.html" target="_blank" className="text-[#1a3a6b] font-bold no-underline hover:underline">host it yourself</a>
          {' '}for full data sovereignty.
        </p>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════
// SHARED REUSABLE COMPONENTS
// ═══════════════════════════════════════════════════════════════════

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-body text-[11px] text-[#767676]">{label}: </span>
      <span className="font-body text-[13px] font-medium text-[#1a1a1a]">{value}</span>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean
}) {
  return (
    <div>
      <label className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] block mb-1.5">
        {label}{required && <span className="text-[#991b1b]"> *</span>}
      </label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required}
        className="w-full px-3 py-2.5 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#1a3a6b] transition-colors" />
    </div>
  )
}

function PercentileSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] block mb-1.5">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2.5 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#1a3a6b] bg-white">
        {PERCENTILE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function SliderField({ label, sublabel, value, onChange }: {
  label: string; sublabel: string; value: number; onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <label className="font-body text-sm font-bold text-[#1a1a1a]">{label}</label>
        <span className="font-mono text-sm font-bold text-[#1a3a6b]">{value}</span>
      </div>
      <p className="font-body text-[11px] text-[#767676] mb-2">{sublabel}</p>
      <input type="range" min={0} max={100} value={value} onChange={e => onChange(parseInt(e.target.value))} className="w-full accent-[#1a3a6b]" />
    </div>
  )
}

function PriceInput({ icon, tier, color, desc, suggested, value, onChange, unit }: {
  icon: string; tier: string; color: string; desc: string; suggested: string; value: string; onChange: (v: string) => void; unit: string
}) {
  return (
    <div className="p-5 border border-[#d4d4d4] rounded-[3px]">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className="font-body text-sm font-bold" style={{ color }}>{tier}</span>
      </div>
      <p className="font-body text-[12px] text-[#767676] mb-3">{desc}</p>
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm text-[#767676]">$</span>
        <input type="number" step="0.01" min="0" value={value} onChange={e => onChange(e.target.value)}
          className="w-24 px-3 py-2 border border-[#d4d4d4] rounded-[3px] font-mono text-sm outline-none focus:border-[#1a3a6b]" />
        <span className="font-body text-[11px] text-[#b8b8b8]">{unit}</span>
      </div>
      <div className="font-mono text-[11px] mt-2" style={{ color }}>Suggested: {suggested}</div>
    </div>
  )
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 bg-[#fafafa] border border-[#e8e8e8] rounded-[3px]">
      <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-2">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="font-body text-[13px] text-[#767676]">{label}</span>
      <span className="font-body text-[13px] text-[#1a1a1a] font-medium text-right max-w-[60%]">{value}</span>
    </div>
  )
}
