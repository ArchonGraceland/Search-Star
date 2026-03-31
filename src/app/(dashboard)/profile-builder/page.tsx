'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Step = 'url' | 'validate' | 'pricing' | 'confirm' | 'success'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProfileJSON = Record<string, any>

interface Pricing {
  publicPrice: string
  privatePrice: string
  marketingPrice: string
}

interface ExtractedData {
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

export default function ProfileBuilder() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('url')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validating, setValidating] = useState(false)

  // Data
  const [endpointUrl, setEndpointUrl] = useState('')
  const [profileJson, setProfileJson] = useState<ProfileJSON | null>(null)
  const [extracted, setExtracted] = useState<ExtractedData | null>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [profileNumber, setProfileNumber] = useState('')
  const [pricing, setPricing] = useState<Pricing>({
    publicPrice: '0.02', privatePrice: '0.50', marketingPrice: '5.00'
  })

  // Manual JSON paste fallback
  const [showManualPaste, setShowManualPaste] = useState(false)
  const [manualJson, setManualJson] = useState('')

  const generateProfileNumber = () => {
    const num = Math.floor(Math.random() * 999999) + 1
    return `SS-${num.toString().padStart(6, '0')}`
  }

  // Validate JSON-LD structure
  const validateProfileJSON = (json: ProfileJSON): string[] => {
    const errors: string[] = []
    if (!json['@context'] && !json.identity && !json.presenceComposite) {
      errors.push('This doesn\'t look like a Search Star profile. Expected @context, identity, or presenceComposite fields.')
      return errors
    }
    if (!json.identity?.displayName) errors.push('Missing identity.displayName (required)')
    return errors
  }

  // Extract directory metadata from JSON-LD
  const extractFromJSON = (json: ProfileJSON): ExtractedData => {
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
      age_cohort: id.ageCohort || fin.ageCohort || null,
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

  // Step 1: Fetch and validate from URL
  const handleFetchUrl = async () => {
    setError(null)
    setValidationErrors([])
    setValidating(true)

    try {
      // Try fetching the profile.json from the URL
      const res = await fetch(endpointUrl)
      if (!res.ok) {
        setError(`Could not fetch profile: ${res.status} ${res.statusText}. Make sure the URL is correct and the file is publicly accessible.`)
        setValidating(false)
        return
      }

      const json = await res.json()
      const errors = validateProfileJSON(json)
      if (errors.length > 0) {
        setValidationErrors(errors)
        setValidating(false)
        return
      }

      setProfileJson(json)
      const data = extractFromJSON(json)
      setExtracted(data)

      // Pre-fill pricing from JSON if available
      if (json.accessPolicy?.tiers) {
        const t = json.accessPolicy.tiers
        if (t.public?.pricePerQuery) setPricing(p => ({ ...p, publicPrice: String(t.public.pricePerQuery) }))
        if (t.private?.pricePerQuery) setPricing(p => ({ ...p, privatePrice: String(t.private.pricePerQuery) }))
        if (t.marketing?.pricePerMessage) setPricing(p => ({ ...p, marketingPrice: String(t.marketing.pricePerMessage) }))
      }

      setStep('validate')
    } catch (err) {
      // CORS will block most cross-origin fetches from the browser
      // Fall back to manual paste
      setError('Could not fetch the URL directly (this is normal — most hosts block cross-origin requests from browsers). Paste your profile.json contents below instead.')
      setShowManualPaste(true)
    } finally {
      setValidating(false)
    }
  }

  // Handle manual JSON paste
  const handleManualPaste = () => {
    setError(null)
    setValidationErrors([])
    try {
      const json = JSON.parse(manualJson.trim())
      const errors = validateProfileJSON(json)
      if (errors.length > 0) {
        setValidationErrors(errors)
        return
      }
      setProfileJson(json)
      const data = extractFromJSON(json)
      setExtracted(data)

      if (json.accessPolicy?.tiers) {
        const t = json.accessPolicy.tiers
        if (t.public?.pricePerQuery) setPricing(p => ({ ...p, publicPrice: String(t.public.pricePerQuery) }))
        if (t.private?.pricePerQuery) setPricing(p => ({ ...p, privatePrice: String(t.private.pricePerQuery) }))
        if (t.marketing?.pricePerMessage) setPricing(p => ({ ...p, marketingPrice: String(t.marketing.pricePerMessage) }))
      }

      setStep('validate')
    } catch {
      setError('Invalid JSON. Make sure you copied the complete profile.json contents.')
    }
  }

  // Save to Supabase
  const handleRegister = async () => {
    if (!extracted || !profileJson) return
    setSaving(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const pNum = generateProfileNumber()
      setProfileNumber(pNum)

      let domain: string | null = null
      if (endpointUrl) {
        try { domain = new URL(endpointUrl).hostname } catch { /* ignore */ }
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          profile_number: pNum,
          ...extracted,
          endpoint_url: endpointUrl || null,
          domain,
          trust_score: 50,
          price_public: parseFloat(pricing.publicPrice),
          price_private: parseFloat(pricing.privatePrice),
          price_marketing: parseFloat(pricing.marketingPrice),
          profile_json: profileJson,
          onboarding_completed: true,
          status: 'active',
        })
        .eq('user_id', user.id)

      if (updateError) throw updateError
      setStep('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register profile')
    } finally {
      setSaving(false)
    }
  }

  // ─── Step indicators ────────────────────────────────────
  const steps = [
    { key: 'url', label: 'Endpoint' },
    { key: 'validate', label: 'Review' },
    { key: 'pricing', label: 'Pricing' },
    { key: 'confirm', label: 'Register' },
  ]

  const stepIndex = steps.findIndex(s => s.key === step)

  // ─── Render ─────────────────────────────────────────────
  return (
    <div className="p-8 max-w-[720px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-heading text-[28px] font-bold mb-1">Register Your Profile</h1>
        <p className="font-body text-sm text-[#767676]">
          Connect your self-hosted profile to the Search Star directory.
        </p>
      </div>

      {/* Step indicator */}
      {step !== 'success' && (
        <div className="flex items-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-medium ${
                i < stepIndex ? 'bg-[#166534] text-white' :
                i === stepIndex ? 'bg-[#1a3a6b] text-white' :
                'bg-[#e8e8e8] text-[#767676]'
              }`}>
                {i < stepIndex ? '✓' : i + 1}
              </div>
              <span className={`font-body text-xs font-medium ${i === stepIndex ? 'text-[#1a3a6b]' : 'text-[#767676]'}`}>
                {s.label}
              </span>
              {i < steps.length - 1 && <div className="w-8 h-px bg-[#d4d4d4]" />}
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 p-3 bg-[#fef2f2] border-l-[3px] border-[#991b1b] rounded-[3px]">
          <p className="font-body text-sm text-[#991b1b] m-0">{error}</p>
        </div>
      )}

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div className="mb-6 p-3 bg-[#fffbeb] border-l-[3px] border-[#92400e] rounded-[3px]">
          {validationErrors.map((e, i) => (
            <p key={i} className="font-body text-sm text-[#92400e] m-0">{e}</p>
          ))}
        </div>
      )}

      {/* ═══ STEP 1: Endpoint URL ═══ */}
      {step === 'url' && (
        <div className="card-grace p-8">
          <h2 className="font-heading text-xl font-bold mb-2">Where is your profile hosted?</h2>
          <p className="font-body text-sm text-[#5a5a5a] mb-6">
            Enter the URL of your <code className="font-mono text-xs bg-[#eef2f8] px-1.5 py-0.5 rounded-[3px]">profile.json</code> file. This is the endpoint Search Star will index and platforms will query through our API.
          </p>

          <div className="mb-4">
            <label className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] block mb-1.5">
              Profile Endpoint URL
            </label>
            <input
              type="url"
              value={endpointUrl}
              onChange={(e) => setEndpointUrl(e.target.value)}
              placeholder="https://yourname.com/profile.json"
              className="w-full px-3 py-2.5 border border-[#d4d4d4] rounded-[3px] font-mono text-sm outline-none focus:border-[#1a3a6b] transition-colors"
            />
          </div>

          <button
            onClick={handleFetchUrl}
            disabled={!endpointUrl || validating}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {validating ? 'Fetching...' : 'Fetch & Validate'}
          </button>

          {/* Manual paste fallback */}
          {showManualPaste && (
            <div className="mt-6 pt-6 border-t border-[#e8e8e8]">
              <h3 className="font-heading text-lg font-bold mb-2">Paste your profile.json</h3>
              <p className="font-body text-xs text-[#767676] mb-3">
                Open <code className="font-mono text-xs bg-[#eef2f8] px-1 py-0.5 rounded-[2px]">{endpointUrl || 'your profile.json URL'}</code> in your browser, copy the entire contents, and paste below.
              </p>
              <textarea
                value={manualJson}
                onChange={(e) => setManualJson(e.target.value)}
                rows={10}
                placeholder='{"@context": "https://schema.searchstar.org/v0.8", ...}'
                className="w-full px-3 py-2.5 border border-[#d4d4d4] rounded-[3px] font-mono text-xs outline-none focus:border-[#1a3a6b] resize-none mb-3"
              />
              <button
                onClick={handleManualPaste}
                disabled={!manualJson.trim()}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Validate JSON
              </button>
            </div>
          )}

          {!showManualPaste && (
            <button
              onClick={() => setShowManualPaste(true)}
              className="block mt-4 font-body text-xs text-[#1a3a6b] hover:underline cursor-pointer bg-transparent border-none p-0"
            >
              Or paste your profile.json manually →
            </button>
          )}

          {/* Help callout */}
          <div className="mt-8 p-4 bg-[#eef2f8] border-l-[3px] border-[#1a3a6b] rounded-[3px]">
            <p className="font-body text-sm text-[#5a5a5a] m-0">
              <strong className="text-[#1a1a1a]">Don&apos;t have a profile yet?</strong> Copy the AI prompt from{' '}
              <Link href="/create.html" className="text-[#1a3a6b] font-medium no-underline hover:underline">the Create &amp; Host page</Link>,
              paste it into Claude, ChatGPT, or Grok, and follow the conversation. The AI builds your profile.json and a personal HTML page.
              Then host both files on Cloudflare Pages (free, ~20 minutes) and come back here with your URL.
            </p>
          </div>
        </div>
      )}

      {/* ═══ STEP 2: Review extracted data ═══ */}
      {step === 'validate' && extracted && (
        <div className="card-grace p-8">
          <h2 className="font-heading text-xl font-bold mb-2">Review your directory listing</h2>
          <p className="font-body text-sm text-[#5a5a5a] mb-6">
            This is what Search Star extracted from your profile. This metadata is what platforms see when they search the directory.
          </p>

          <div className="space-y-4">
            {/* Identity */}
            <div className="p-4 bg-[#f5f5f5] rounded-[3px]">
              <div className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-2">Identity</div>
              <div className="font-heading text-lg font-bold">{extracted.display_name}</div>
              {extracted.handle && <div className="font-mono text-sm text-[#767676]">{extracted.handle}</div>}
              {extracted.tagline && <div className="font-body text-sm text-[#5a5a5a] mt-1">{extracted.tagline}</div>}
              <div className="font-body text-xs text-[#767676] mt-1">
                {[extracted.location, extracted.age_cohort].filter(Boolean).join(' · ') || 'No location or age set'}
              </div>
            </div>

            {/* Scores */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-[#f5f5f5] rounded-[3px]">
                <div className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">Presence Score</div>
                <div className="font-mono text-2xl font-medium text-[#1a3a6b]">{extracted.presence_score}</div>
              </div>
              <div className="p-4 bg-[#f5f5f5] rounded-[3px]">
                <div className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">Skills</div>
                <div className="font-mono text-2xl font-medium">{extracted.skills_count}</div>
              </div>
            </div>

            {/* Financial */}
            {extracted.has_financial && (
              <div className="p-4 bg-[#f0fdf4] rounded-[3px]">
                <div className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#166534] mb-1">Financial Data</div>
                <div className="font-body text-sm text-[#166534]">
                  {extracted.net_worth_percentile && `Net worth: ${extracted.net_worth_percentile}th percentile`}
                  {extracted.net_worth_percentile && extracted.income_percentile && ' · '}
                  {extracted.income_percentile && `Income: ${extracted.income_percentile}th percentile`}
                </div>
              </div>
            )}

            {/* Interests */}
            {extracted.interests_tags.length > 0 && (
              <div className="p-4 bg-[#f5f5f5] rounded-[3px]">
                <div className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-2">Interests</div>
                <div className="flex flex-wrap gap-1.5">
                  {extracted.interests_tags.map((tag, i) => (
                    <span key={i} className="font-body text-xs px-2 py-0.5 bg-[#eef2f8] text-[#1a3a6b] rounded-[2px]">{tag}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Data sections */}
            <div className="flex flex-wrap gap-2">
              {extracted.has_financial && <span className="font-body text-[10px] font-bold tracking-[0.08em] uppercase px-2 py-1 bg-[#f0fdf4] text-[#166534] rounded-[2px]">Financial ✓</span>}
              {extracted.has_dating && <span className="font-body text-[10px] font-bold tracking-[0.08em] uppercase px-2 py-1 bg-[#eef2f8] text-[#1a3a6b] rounded-[2px]">Dating ✓</span>}
              {extracted.has_advertising && <span className="font-body text-[10px] font-bold tracking-[0.08em] uppercase px-2 py-1 bg-[#fffbeb] text-[#92400e] rounded-[2px]">Advertising ✓</span>}
              {extracted.has_content_feed && <span className="font-body text-[10px] font-bold tracking-[0.08em] uppercase px-2 py-1 bg-[#f0fdfa] text-[#0d9488] rounded-[2px]">Content Feed ✓</span>}
            </div>

            {/* Endpoint */}
            {endpointUrl && (
              <div className="p-3 bg-[#1a1a1a] rounded-[3px]">
                <div className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-white/40 mb-1">Endpoint</div>
                <div className="font-mono text-xs text-[#5eead4] break-all">{endpointUrl}</div>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={() => { setStep('url'); setShowManualPaste(false) }} className="btn-secondary">
              ← Back
            </button>
            <button onClick={() => setStep('pricing')} className="btn-primary">
              Looks Good →
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 3: Pricing ═══ */}
      {step === 'pricing' && (
        <div className="card-grace p-8">
          <h2 className="font-heading text-xl font-bold mb-2">Set your access pricing</h2>
          <p className="font-body text-sm text-[#5a5a5a] mb-6">
            Choose what platforms pay to query your profile at each tier. You keep 90% of every query — Search Star takes a 10% marketplace fee.
          </p>

          <div className="space-y-5">
            {/* Public */}
            <div className="p-4 bg-[#eef2f8] rounded-[3px]">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#1a3a6b]">Public Tier</div>
                  <div className="font-body text-xs text-[#767676]">Identity, skills, interests, headline scores</div>
                </div>
                <div className="font-body text-[10px] text-[#767676]">Suggested: $0.01 – $0.10</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-[#767676]">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={pricing.publicPrice}
                  onChange={(e) => setPricing(p => ({ ...p, publicPrice: e.target.value }))}
                  className="w-32 px-3 py-2 border border-[#d4d4d4] rounded-[3px] font-mono text-sm outline-none focus:border-[#1a3a6b]"
                />
                <span className="font-body text-xs text-[#767676]">per query</span>
              </div>
            </div>

            {/* Private */}
            <div className="p-4 bg-[#f5f5f5] rounded-[3px]">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#1a1a1a]">Private Tier</div>
                  <div className="font-body text-xs text-[#767676]">Full profile — financials, Presence breakdown, all data</div>
                </div>
                <div className="font-body text-[10px] text-[#767676]">Suggested: $0.10 – $2.00</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-[#767676]">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={pricing.privatePrice}
                  onChange={(e) => setPricing(p => ({ ...p, privatePrice: e.target.value }))}
                  className="w-32 px-3 py-2 border border-[#d4d4d4] rounded-[3px] font-mono text-sm outline-none focus:border-[#1a3a6b]"
                />
                <span className="font-body text-xs text-[#767676]">per query</span>
              </div>
            </div>

            {/* Marketing */}
            <div className="p-4 bg-[#fffbeb] rounded-[3px]">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#92400e]">Marketing Tier</div>
                  <div className="font-body text-xs text-[#767676]">Pay to message you directly. No refunds.</div>
                </div>
                <div className="font-body text-[10px] text-[#767676]">Suggested: $1.00 – $50.00</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-[#767676]">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={pricing.marketingPrice}
                  onChange={(e) => setPricing(p => ({ ...p, marketingPrice: e.target.value }))}
                  className="w-32 px-3 py-2 border border-[#d4d4d4] rounded-[3px] font-mono text-sm outline-none focus:border-[#1a3a6b]"
                />
                <span className="font-body text-xs text-[#767676]">per message</span>
              </div>
            </div>
          </div>

          <div className="mt-6 p-3 bg-[#f0fdf4] border-l-[3px] border-[#166534] rounded-[3px]">
            <p className="font-body text-sm text-[#166534] m-0">
              <strong>Revenue split:</strong> You keep 90% of every query and message. On a $0.50 Private tier query, you earn $0.45.
            </p>
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={() => setStep('validate')} className="btn-secondary">← Back</button>
            <button onClick={() => setStep('confirm')} className="btn-primary">Set Pricing →</button>
          </div>
        </div>
      )}

      {/* ═══ STEP 4: Confirm & Register ═══ */}
      {step === 'confirm' && extracted && (
        <div className="card-grace p-8">
          <h2 className="font-heading text-xl font-bold mb-2">Confirm &amp; register</h2>
          <p className="font-body text-sm text-[#5a5a5a] mb-6">
            Review your directory listing before going live.
          </p>

          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-[#f0f0f0]">
              <span className="font-body text-sm text-[#767676]">Name</span>
              <span className="font-body text-sm font-medium">{extracted.display_name}</span>
            </div>
            {extracted.handle && (
              <div className="flex justify-between py-2 border-b border-[#f0f0f0]">
                <span className="font-body text-sm text-[#767676]">Handle</span>
                <span className="font-mono text-sm">{extracted.handle}</span>
              </div>
            )}
            {extracted.location && (
              <div className="flex justify-between py-2 border-b border-[#f0f0f0]">
                <span className="font-body text-sm text-[#767676]">Location</span>
                <span className="font-body text-sm">{extracted.location}</span>
              </div>
            )}
            <div className="flex justify-between py-2 border-b border-[#f0f0f0]">
              <span className="font-body text-sm text-[#767676]">Presence Score</span>
              <span className="font-mono text-sm font-medium text-[#1a3a6b]">{extracted.presence_score}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#f0f0f0]">
              <span className="font-body text-sm text-[#767676]">Skills</span>
              <span className="font-mono text-sm">{extracted.skills_count}</span>
            </div>
            {endpointUrl && (
              <div className="flex justify-between py-2 border-b border-[#f0f0f0]">
                <span className="font-body text-sm text-[#767676]">Endpoint</span>
                <span className="font-mono text-xs text-[#1a3a6b] break-all max-w-[300px] text-right">{endpointUrl}</span>
              </div>
            )}
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

          <div className="flex gap-3 mt-8">
            <button onClick={() => setStep('pricing')} className="btn-secondary">← Back</button>
            <button
              onClick={handleRegister}
              disabled={saving}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex-1"
            >
              {saving ? 'Registering...' : 'Register in Directory'}
            </button>
          </div>
        </div>
      )}

      {/* ═══ SUCCESS ═══ */}
      {step === 'success' && (
        <div className="card-grace p-8 text-center">
          <div className="text-4xl mb-4">🎉</div>
          <h2 className="font-heading text-[28px] font-bold mb-2">You&apos;re in the directory</h2>
          <div className="inline-block bg-[#1a3a6b] text-white font-mono text-xl font-medium px-6 py-3 rounded-[3px] mb-4">
            {profileNumber}
          </div>
          <p className="font-body text-sm text-[#5a5a5a] mb-6">
            Your profile is now discoverable by platforms. Queries will start generating earnings that settle weekly to your linked bank account.
          </p>
          {endpointUrl && (
            <div className="p-3 bg-[#f0fdf4] border-l-[3px] border-[#166534] rounded-[3px] text-left mb-6">
              <p className="font-body text-sm text-[#166534] m-0">
                <strong>Your endpoint:</strong> <code className="font-mono text-xs">{endpointUrl}</code><br/>
                Search Star will crawl this URL every 24 hours to keep your directory listing current.
              </p>
            </div>
          )}
          <button onClick={() => router.push('/dashboard')} className="btn-primary">
            Go to Dashboard
          </button>
        </div>
      )}
    </div>
  )
}
