'use client'

import Link from 'next/link'
import { useState, useMemo } from 'react'
import { PublicHeader } from '@/components/public-header'
import { PublicFooter } from '@/components/public-footer'

// Earnings model based on spec data:
// Public tier: $0.01-$0.10/query, high volume
// Private tier: $0.10-$2.00/query, moderate volume  
// Marketing tier: $1.00-$25.00/message, low volume
// 90% goes to owner after Search Star's 10% cut

type AgeRange = '18-24' | '25-29' | '30-34' | '35-39' | '40-44' | '45-49' | '50-54' | '55-64' | '65+'
type IncomeLevel = 'below-median' | 'median' | 'above-median' | 'top-quartile' | 'top-decile'

interface EstimateInputs {
  ageRange: AgeRange | ''
  incomeLevel: IncomeLevel | ''
  interestCount: number
  hasSkills: boolean
  enableDating: boolean
  enableAdvertising: boolean
}

// Volume multipliers based on profile attractiveness
function calculateEstimate(inputs: EstimateInputs) {
  if (!inputs.ageRange || !inputs.incomeLevel) return null

  // Base query volumes per month (industry averages from spec comps)
  // Public queries: recruiters, data enrichment platforms
  let publicQueries = 500
  // Private queries: dating apps, investors, premium recruiters
  let privateQueries = 200
  // Marketing messages: recruiters, brands, dating intros
  let marketingMessages = 5

  // Age multiplier — dating/recruiting sweet spot is 25-44
  const ageMultipliers: Record<AgeRange, number> = {
    '18-24': 0.6, '25-29': 1.2, '30-34': 1.4, '35-39': 1.3,
    '40-44': 1.1, '45-49': 0.9, '50-54': 0.7, '55-64': 0.5, '65+': 0.3
  }
  const ageMult = ageMultipliers[inputs.ageRange as AgeRange]

  // Income multiplier — higher income = more platform interest
  const incomeMultipliers: Record<IncomeLevel, number> = {
    'below-median': 0.5, 'median': 0.8, 'above-median': 1.2,
    'top-quartile': 1.8, 'top-decile': 3.0
  }
  const incomeMult = incomeMultipliers[inputs.incomeLevel as IncomeLevel]

  // Interest count boosts discoverability
  const interestMult = 0.7 + (inputs.interestCount * 0.1) // 0.7 to 1.7

  // Skills boost public tier significantly
  if (inputs.hasSkills) {
    publicQueries *= 1.8
  }

  // Dating opens private tier and marketing substantially
  if (inputs.enableDating) {
    privateQueries *= 2.5
    marketingMessages *= 4
  }

  // Advertising profile boosts marketing tier
  if (inputs.enableAdvertising) {
    publicQueries *= 1.3
    marketingMessages *= 2
  }

  // Apply multipliers
  publicQueries = Math.round(publicQueries * ageMult * incomeMult * interestMult)
  privateQueries = Math.round(privateQueries * ageMult * incomeMult)
  marketingMessages = Math.round(marketingMessages * ageMult * incomeMult)

  // Pricing (use mid-range defaults from spec)
  const publicPrice = 0.02
  const privatePrice = 0.50
  const marketingPrice = 5.00

  // Revenue (90% to owner)
  const publicRevenue = publicQueries * publicPrice * 0.9
  const privateRevenue = privateQueries * privatePrice * 0.9
  const marketingRevenue = marketingMessages * marketingPrice * 0.9

  const totalMonthly = publicRevenue + privateRevenue + marketingRevenue

  // Range: -30% to +50% for low/high estimates
  const lowEstimate = totalMonthly * 0.7
  const highEstimate = totalMonthly * 1.5

  return {
    publicQueries, privateQueries, marketingMessages,
    publicPrice, privatePrice, marketingPrice,
    publicRevenue, privateRevenue, marketingRevenue,
    totalMonthly, lowEstimate, highEstimate
  }
}

export default function EarningsEstimator() {
  const [inputs, setInputs] = useState<EstimateInputs>({
    ageRange: '',
    incomeLevel: '',
    interestCount: 5,
    hasSkills: true,
    enableDating: false,
    enableAdvertising: false,
  })

  const estimate = useMemo(() => calculateEstimate(inputs), [inputs])

  const update = <K extends keyof EstimateInputs>(key: K, value: EstimateInputs[K]) => {
    setInputs(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col">
      <PublicHeader />

      {/* Hero */}
      <div className="bg-[#1a3a6b] px-8 pt-8 pb-14">
        <div className="max-w-[860px] mx-auto text-center">
          <div className="font-body text-[11px] font-bold tracking-[0.2em] uppercase text-white/40 mb-3">
            Earnings Estimator
          </div>
          <h1 className="font-heading font-bold text-white text-[clamp(1.75rem,4vw,2.5rem)] leading-[1.15] mb-3">
            What could your data earn?
          </h1>
          <p className="font-body text-sm text-white/60 max-w-[580px] mx-auto leading-relaxed">
            Answer a few questions to see projected monthly earnings from your Search Star profile. These estimates are based on market data from comparable platforms.
          </p>
        </div>
      </div>

      <main className="max-w-[860px] mx-auto px-8 py-10 flex-1 -mt-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Input Form */}
          <div className="lg:col-span-3">
            <div className="bg-white border border-[#d4d4d4] rounded-[3px] shadow-sm p-8">
              <h2 className="font-heading text-xl font-bold mb-6">Your profile</h2>

              {/* Age Range */}
              <div className="mb-6">
                <label className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] block mb-2">
                  Age Range
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ['18-24', '18–24'], ['25-29', '25–29'], ['30-34', '30–34'],
                    ['35-39', '35–39'], ['40-44', '40–44'], ['45-49', '45–49'],
                    ['50-54', '50–54'], ['55-64', '55–64'], ['65+', '65+'],
                  ] as [AgeRange, string][]).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => update('ageRange', value)}
                      className={`py-2 px-3 rounded-[3px] border font-body text-sm transition-all cursor-pointer ${
                        inputs.ageRange === value
                          ? 'bg-[#1a3a6b] text-white border-[#1a3a6b]'
                          : 'bg-white text-[#5a5a5a] border-[#d4d4d4] hover:border-[#1a3a6b]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Income Level */}
              <div className="mb-6">
                <label className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] block mb-2">
                  Income Bracket (relative to your age group)
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {([
                    ['below-median', 'Below median for my age', 'Bottom 50th percentile'],
                    ['median', 'Around median', '40th–60th percentile'],
                    ['above-median', 'Above median', '60th–75th percentile'],
                    ['top-quartile', 'Top quartile', '75th–90th percentile'],
                    ['top-decile', 'Top 10%', '90th+ percentile'],
                  ] as [IncomeLevel, string, string][]).map(([value, label, sub]) => (
                    <button
                      key={value}
                      onClick={() => update('incomeLevel', value)}
                      className={`py-2.5 px-4 rounded-[3px] border font-body text-sm text-left transition-all cursor-pointer ${
                        inputs.incomeLevel === value
                          ? 'bg-[#1a3a6b] text-white border-[#1a3a6b]'
                          : 'bg-white text-[#5a5a5a] border-[#d4d4d4] hover:border-[#1a3a6b]'
                      }`}
                    >
                      <span className="font-medium">{label}</span>
                      <span className={`ml-2 text-[11px] ${inputs.incomeLevel === value ? 'text-white/60' : 'text-[#b8b8b8]'}`}>
                        {sub}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Interests slider */}
              <div className="mb-6">
                <label className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] block mb-2">
                  Number of Interests (athletic, social, intellectual)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={inputs.interestCount}
                    onChange={e => update('interestCount', parseInt(e.target.value))}
                    className="flex-1 accent-[#1a3a6b]"
                  />
                  <span className="font-mono text-sm text-[#1a3a6b] font-bold w-6 text-center">{inputs.interestCount}</span>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3">
                <Toggle
                  label="Professional skills & credentials"
                  sublabel="Makes you discoverable to recruiters and professional platforms"
                  checked={inputs.hasSkills}
                  onChange={v => update('hasSkills', v)}
                />
                <Toggle
                  label="Enable dating profile"
                  sublabel="Opens Private tier to dating apps — significantly increases query volume and marketing messages"
                  checked={inputs.enableDating}
                  onChange={v => update('enableDating', v)}
                />
                <Toggle
                  label="Enable advertising profile"
                  sublabel="Approve high-value targeting signals for brands — boosts marketing revenue"
                  checked={inputs.enableAdvertising}
                  onChange={v => update('enableAdvertising', v)}
                />
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="lg:col-span-2">
            <div className="bg-white border border-[#d4d4d4] rounded-[3px] shadow-sm p-8 sticky top-6">
              <h2 className="font-heading text-xl font-bold mb-4">Projected earnings</h2>

              {estimate ? (
                <>
                  {/* Total */}
                  <div className="mb-6 pb-5 border-b-2 border-[#e8e8e8]">
                    <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">
                      Monthly estimate
                    </div>
                    <div className="font-heading text-[36px] font-bold text-[#166534] leading-tight">
                      ${estimate.lowEstimate.toFixed(0)} – ${estimate.highEstimate.toFixed(0)}
                    </div>
                    <div className="font-mono text-[11px] text-[#b8b8b8] mt-1">
                      midpoint: ${estimate.totalMonthly.toFixed(0)}/mo · ${(estimate.totalMonthly * 12).toFixed(0)}/yr
                    </div>
                  </div>

                  {/* Breakdown */}
                  <div className="space-y-4">
                    <RevenueRow
                      tier="Public"
                      icon="🌐"
                      color="#1a3a6b"
                      queries={estimate.publicQueries}
                      price={estimate.publicPrice}
                      revenue={estimate.publicRevenue}
                      unit="queries"
                    />
                    <RevenueRow
                      tier="Private"
                      icon="🔐"
                      color="#166534"
                      queries={estimate.privateQueries}
                      price={estimate.privatePrice}
                      revenue={estimate.privateRevenue}
                      unit="queries"
                    />
                    <RevenueRow
                      tier="Marketing"
                      icon="📨"
                      color="#92400e"
                      queries={estimate.marketingMessages}
                      price={estimate.marketingPrice}
                      revenue={estimate.marketingRevenue}
                      unit="messages"
                    />
                  </div>

                  {/* Notes */}
                  <div className="mt-5 p-3 bg-[#eef2f8] border-l-[3px] border-[#1a3a6b] rounded-[3px]">
                    <p className="font-body text-[11px] text-[#5a5a5a] leading-relaxed m-0">
                      Estimates assume default pricing. You set your own prices — higher prices mean fewer queries but more revenue per query. Revenue shown is after Search Star&apos;s 10% marketplace fee.
                    </p>
                  </div>

                  <Link
                    href="/signup"
                    className="btn-primary w-full text-center mt-5 inline-block no-underline"
                  >
                    Create Your Profile
                  </Link>
                </>
              ) : (
                <div className="text-center py-10">
                  <p className="font-body text-sm text-[#b8b8b8] mb-2">Select your age range and income level to see your estimate.</p>
                  <p className="font-body text-[11px] text-[#d4d4d4]">All data stays in your browser.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* How this works callout */}
        <div className="mt-8 bg-white border border-[#d4d4d4] rounded-[3px] shadow-sm p-8">
          <h3 className="font-heading text-lg font-bold mb-3">How this estimate works</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">Query volume</div>
              <p className="font-body text-[13px] text-[#5a5a5a] leading-relaxed m-0">
                Based on comparable platform usage — ZoomInfo, LinkedIn API, Raya, Hinge, and recruiting platforms — scaled to your profile attributes.
              </p>
            </div>
            <div>
              <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">Pricing</div>
              <p className="font-body text-[13px] text-[#5a5a5a] leading-relaxed m-0">
                Uses mid-range defaults: $0.02/public query, $0.50/private query, $5.00/marketing message. You can set any price you want.
              </p>
            </div>
            <div>
              <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">Your cut</div>
              <p className="font-body text-[13px] text-[#5a5a5a] leading-relaxed m-0">
                You keep 90% of every query. Search Star takes a 10% marketplace fee. Weekly settlement to your bank via Stripe Connect.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center py-8">
          <Link
            href="/onboarding"
            className="btn-secondary inline-block no-underline mr-3"
          >
            How It Works
          </Link>
          <Link
            href="/signup"
            className="btn-primary inline-block no-underline"
          >
            Create Your Profile
          </Link>
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}

function Toggle({ label, sublabel, checked, onChange }: {
  label: string; sublabel: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-full flex items-start gap-3 p-3 rounded-[3px] border text-left transition-all cursor-pointer ${
        checked ? 'bg-[#f0fdf4] border-[#166534]/30' : 'bg-white border-[#d4d4d4]'
      }`}
    >
      <div className={`w-5 h-5 rounded-[3px] border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
        checked ? 'bg-[#166534] border-[#166534]' : 'border-[#d4d4d4]'
      }`}>
        {checked && (
          <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 6l3 3 5-5" />
          </svg>
        )}
      </div>
      <div>
        <div className="font-body text-sm font-medium text-[#1a1a1a]">{label}</div>
        <div className="font-body text-[11px] text-[#767676] mt-0.5">{sublabel}</div>
      </div>
    </button>
  )
}

function RevenueRow({ tier, icon, color, queries, price, revenue, unit }: {
  tier: string; icon: string; color: string; queries: number; price: number; revenue: number; unit: string
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-sm">{icon}</span>
        <span className="font-body text-[11px] font-bold tracking-[0.1em] uppercase" style={{ color }}>{tier}</span>
      </div>
      <div className="flex justify-between items-baseline">
        <span className="font-body text-[13px] text-[#5a5a5a]">
          {queries.toLocaleString()} {unit} × ${price.toFixed(2)}
        </span>
        <span className="font-mono text-sm font-bold" style={{ color }}>
          ${revenue.toFixed(0)}
        </span>
      </div>
    </div>
  )
}
