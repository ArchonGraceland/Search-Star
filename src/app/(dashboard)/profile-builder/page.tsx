'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// ─── Types ───────────────────────────────────────────────────────

type Step = 'identity' | 'financial' | 'presence' | 'skills' | 'interests' | 'pricing' | 'review'

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

// ─── Age cohorts from spec ───────────────────────────────────────
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

const STEPS: { key: Step; label: string; icon: string }[] = [
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
  const [currentStep, setCurrentStep] = useState<Step>('identity')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Form state
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

  const stepIndex = STEPS.findIndex(s => s.key === currentStep)

  const goNext = () => {
    if (stepIndex < STEPS.length - 1) setCurrentStep(STEPS[stepIndex + 1].key)
  }
  const goBack = () => {
    if (stepIndex > 0) setCurrentStep(STEPS[stepIndex - 1].key)
  }

  // Generate profile number SS-XXXXXX
  const generateProfileNumber = () => {
    const num = Math.floor(Math.random() * 999999) + 1
    return `SS-${num.toString().padStart(6, '0')}`
  }

  // Build JSON-LD from form data
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

  // Save profile to Supabase
  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const profileNumber = generateProfileNumber()
      const profileJson = buildProfileJSON()
      const presenceScore = Math.round((presence.rizz + presence.vibe + presence.drip) / 3)

      // Update the profiles table (auto-created on signup)
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

  if (success) {
    return (
      <div className="p-8">
        <div className="max-w-[640px] mx-auto text-center py-16">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="font-heading text-[32px] font-bold mb-2">Profile created!</h1>
          <p className="font-body text-sm text-[#767676]">
            Your Search Star profile is live. Redirecting to your dashboard...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="max-w-[800px]">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-heading text-[32px] font-bold mb-1">Build your profile</h1>
          <p className="font-body text-sm text-[#767676]">
            Complete each section to create your Search Star profile. You can always edit later.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex gap-1 mb-6">
          {STEPS.map((step, i) => (
            <button
              key={step.key}
              onClick={() => setCurrentStep(step.key)}
              className={`flex-1 py-2 px-2 rounded-[3px] font-body text-[11px] font-bold tracking-[0.05em] uppercase text-center transition-all cursor-pointer border ${
                i === stepIndex
                  ? 'bg-[#1a3a6b] text-white border-[#1a3a6b]'
                  : i < stepIndex
                  ? 'bg-[#f0fdf4] text-[#166534] border-[#166534]/20'
                  : 'bg-white text-[#b8b8b8] border-[#d4d4d4]'
              }`}
            >
              <span className="hidden md:inline">{step.icon} </span>{step.label}
            </button>
          ))}
        </div>

        {/* Form content */}
        <div className="bg-white border border-[#d4d4d4] rounded-[3px] shadow-sm p-8">
          {currentStep === 'identity' && (
            <IdentityStep identity={identity} onChange={setIdentity} />
          )}
          {currentStep === 'financial' && (
            <FinancialStep financial={financial} onChange={setFinancial} />
          )}
          {currentStep === 'presence' && (
            <PresenceStep presence={presence} onChange={setPresence} />
          )}
          {currentStep === 'skills' && (
            <SkillsStep skills={skills} onChange={setSkills} />
          )}
          {currentStep === 'interests' && (
            <InterestsStep interests={interests} onChange={setInterests} />
          )}
          {currentStep === 'pricing' && (
            <PricingStep pricing={pricing} onChange={setPricing} />
          )}
          {currentStep === 'review' && (
            <ReviewStep
              identity={identity}
              financial={financial}
              presence={presence}
              skills={skills}
              interests={interests}
              pricing={pricing}
            />
          )}

          {/* Error display */}
          {error && (
            <div className="mt-4 p-3 bg-[#fef2f2] border-l-[3px] border-[#991b1b] rounded-[3px]">
              <p className="font-body text-sm text-[#991b1b] m-0">{error}</p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t border-[#e8e8e8]">
            <button
              onClick={goBack}
              disabled={stepIndex === 0}
              className="btn-secondary disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Back
            </button>
            {currentStep === 'review' ? (
              <button
                onClick={handleSave}
                disabled={saving || !identity.displayName}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Creating profile...' : 'Create Profile'}
              </button>
            ) : (
              <button onClick={goNext} className="btn-primary">
                Continue
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Step Components ─────────────────────────────────────────────

function IdentityStep({ identity, onChange }: { identity: Identity; onChange: (v: Identity) => void }) {
  const update = (key: keyof Identity, value: string) => onChange({ ...identity, [key]: value })
  return (
    <div>
      <h2 className="font-heading text-xl font-bold mb-1">Identity</h2>
      <p className="font-body text-sm text-[#767676] mb-6">Basic information for your Search Star profile.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Display Name" required value={identity.displayName} onChange={v => update('displayName', v)} placeholder="Steve Smith" />
        <Field label="Handle" value={identity.handle} onChange={v => update('handle', v)} placeholder="stevesmith" />
        <Field label="Age" value={identity.age} onChange={v => update('age', v)} placeholder="32" className="md:col-span-1" />
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
          A 28-year-old at the 90th percentile and a 55-year-old at the 90th percentile are directly comparable. Choose the bracket that best describes you relative to your age group.
        </p>
      </div>
      <div className="mb-5">
        <label className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] block mb-1.5">Age Cohort</label>
        <select
          value={financial.ageCohort}
          onChange={e => update('ageCohort', e.target.value)}
          className="w-full px-3 py-2.5 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#1a3a6b] bg-white"
        >
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
      <p className="font-body text-sm text-[#767676] mb-2">
        Score yourself on three dimensions (0–100). Be honest — a confidence discount is applied for self-assessment.
      </p>
      <div className="p-3 bg-[#fffbeb] border-l-[3px] border-[#92400e] rounded-[3px] mb-6">
        <p className="font-body text-[12px] text-[#5a5a5a] m-0">
          Self-assessed scores get a 0.85 confidence discount. Adding photos and peer reviews later will remove the discount.
        </p>
      </div>
      <div className="space-y-6">
        <SliderField
          label="Rizz"
          sublabel="Interpersonal magnetism — wit, warmth, presence, confidence"
          value={presence.rizz}
          onChange={v => update('rizz', v)}
        />
        <SliderField
          label="Vibe"
          sublabel="Aesthetic taste & curation — cultural range, consistency, environment"
          value={presence.vibe}
          onChange={v => update('vibe', v)}
        />
        <SliderField
          label="Drip"
          sublabel="Visual style — fit & silhouette, color sense, originality, context match"
          value={presence.drip}
          onChange={v => update('drip', v)}
        />
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
      <p className="font-body text-sm text-[#767676] mb-6">Add your professional skills. These are discoverable by recruiters and platforms.</p>
      <div className="flex gap-2 mb-4">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addSkill()}
          placeholder="e.g. TypeScript, Product Strategy, Data Analysis"
          className="flex-1 px-3 py-2.5 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#1a3a6b]"
        />
        <select
          value={level}
          onChange={e => setLevel(e.target.value)}
          className="px-3 py-2.5 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#1a3a6b] bg-white"
        >
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
        <p className="font-body text-sm text-[#b8b8b8] text-center py-6">No skills added yet. Add your first skill above.</p>
      )}
    </div>
  )
}

function InterestsStep({ interests, onChange }: { interests: Interest[]; onChange: (v: Interest[]) => void }) {
  const [name, setName] = useState('')
  const [domain, setDomain] = useState<'athletic' | 'social' | 'intellectual'>('athletic')
  const [category, setCategory] = useState('')

  const addInterest = () => {
    if (!name.trim()) return
    onChange([...interests, { id: Date.now().toString(), name: name.trim(), category: category || name.trim(), domain }])
    setName('')
    setCategory('')
  }

  const removeInterest = (id: string) => onChange(interests.filter(i => i.id !== id))

  const domainLabels = { athletic: '🏃 Athletic', social: '🎭 Social', intellectual: '📚 Intellectual' }

  return (
    <div>
      <h2 className="font-heading text-xl font-bold mb-1">Interests</h2>
      <p className="font-body text-sm text-[#767676] mb-6">Add interests across three domains. These serve as discovery signals for platforms.</p>
      <div className="flex gap-2 mb-2">
        <select
          value={domain}
          onChange={e => setDomain(e.target.value as typeof domain)}
          className="px-3 py-2.5 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#1a3a6b] bg-white"
        >
          <option value="athletic">🏃 Athletic</option>
          <option value="social">🎭 Social</option>
          <option value="intellectual">📚 Intellectual</option>
        </select>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addInterest()}
          placeholder="e.g. Trail Running, Wine Tasting, Machine Learning"
          className="flex-1 px-3 py-2.5 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#1a3a6b]"
        />
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
      {interests.length === 0 && (
        <p className="font-body text-sm text-[#b8b8b8] text-center py-6">No interests added yet.</p>
      )}
    </div>
  )
}

function PricingStep({ pricing, onChange }: { pricing: Pricing; onChange: (v: Pricing) => void }) {
  const update = (key: keyof Pricing, value: string) => onChange({ ...pricing, [key]: value })

  return (
    <div>
      <h2 className="font-heading text-xl font-bold mb-1">Access Tier Pricing</h2>
      <p className="font-body text-sm text-[#767676] mb-6">Set your per-query prices. You earn 90% of every query — Search Star takes a 10% marketplace fee.</p>
      <div className="space-y-5">
        <PriceInput
          icon="🌐" tier="Public" color="#1a3a6b"
          desc="Open to all platforms. Identity, skills, interests, Presence headline."
          suggested="$0.01 – $0.10"
          value={pricing.publicPrice} onChange={v => update('publicPrice', v)}
          unit="per query"
        />
        <PriceInput
          icon="🔐" tier="Private" color="#166534"
          desc="Platforms you approve. Full profile — financials, Presence breakdown, advertising, media."
          suggested="$0.10 – $2.00"
          value={pricing.privatePrice} onChange={v => update('privatePrice', v)}
          unit="per query"
        />
        <PriceInput
          icon="📨" tier="Marketing" color="#92400e"
          desc="Anyone can message you. Recruiters, brands, dates. No refunds."
          suggested="$1.00 – $25.00"
          value={pricing.marketingPrice} onChange={v => update('marketingPrice', v)}
          unit="per message"
        />
      </div>
    </div>
  )
}

function ReviewStep({ identity, financial, presence, skills, interests, pricing }: {
  identity: Identity; financial: Financial; presence: PresenceScores; skills: Skill[]; interests: Interest[]; pricing: Pricing
}) {
  const composite = Math.round((presence.rizz + presence.vibe + presence.drip) / 3)
  return (
    <div>
      <h2 className="font-heading text-xl font-bold mb-1">Review your profile</h2>
      <p className="font-body text-sm text-[#767676] mb-6">Confirm everything looks right before creating your profile.</p>

      <div className="space-y-4">
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
    </div>
  )
}

// ─── Reusable Components ─────────────────────────────────────────

function Field({ label, value, onChange, placeholder, required, className }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean; className?: string
}) {
  return (
    <div className={className}>
      <label className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] block mb-1.5">
        {label}{required && <span className="text-[#991b1b]"> *</span>}
      </label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-2.5 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#1a3a6b] transition-colors"
      />
    </div>
  )
}

function PercentileSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] block mb-1.5">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2.5 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#1a3a6b] bg-white"
      >
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
      <input
        type="range" min={0} max={100} value={value}
        onChange={e => onChange(parseInt(e.target.value))}
        className="w-full accent-[#1a3a6b]"
      />
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
        <input
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-24 px-3 py-2 border border-[#d4d4d4] rounded-[3px] font-mono text-sm outline-none focus:border-[#1a3a6b]"
        />
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
