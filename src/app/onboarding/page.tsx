import Link from 'next/link'
import { PublicHeader } from '@/components/public-header'
import { PublicFooter } from '@/components/public-footer'

export default function Onboarding() {
  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col">
      <PublicHeader />

      {/* Hero */}
      <div className="bg-[#1a3a6b] px-8 pt-8 pb-14">
        <div className="max-w-[860px] mx-auto text-center">
          <div className="font-body text-[11px] font-bold tracking-[0.2em] uppercase text-white/40 mb-3">
            How Search Star Works
          </div>
          <h1 className="font-heading font-bold text-white text-[clamp(1.75rem,4vw,2.5rem)] leading-[1.15] mb-3">
            Own your data. Set your price. Get paid.
          </h1>
          <p className="font-body text-sm text-white/60 max-w-[580px] mx-auto leading-relaxed">
            Search Star inverts the data economy. Instead of platforms harvesting your data for free, you host your own profile and earn every time someone queries it.
          </p>
        </div>
      </div>

      <main className="max-w-[860px] mx-auto px-8 py-10 flex-1 -mt-6">
        {/* Featured: Activate (recommended path) */}
        <div className="bg-white border-2 border-[#166534] rounded-[3px] shadow-sm p-10 mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-[#166534] text-white font-body text-[10px] font-bold tracking-[0.1em] uppercase px-3 py-1 rounded-bl-[3px]">
            Recommended · Shipped v1.3.0
          </div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-[#166534] rounded-[3px] flex items-center justify-center font-body text-sm font-bold text-white shrink-0">★</div>
            <h2 className="font-heading text-[22px] font-bold m-0">Start with Activate</h2>
          </div>
          <p className="font-body text-sm text-[#5a5a5a] leading-relaxed mb-4">
            Already have a digital footprint? Activate finds your existing public data — GitHub, Google Scholar, LinkedIn, professional directories, race results, conference talks — and assembles a draft profile in minutes. You review what was found, correct anything wrong, add what&apos;s missing, and publish.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
            <div className="p-3 bg-[#f0fdf4] border-l-[3px] border-[#166534] rounded-[3px]">
              <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#166534] mb-1">Discover</div>
              <p className="font-body text-[13px] text-[#5a5a5a] m-0">Six sources run in parallel. You provide a name and 2–3 disambiguating details.</p>
            </div>
            <div className="p-3 bg-[#f0fdf4] border-l-[3px] border-[#166534] rounded-[3px]">
              <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#166534] mb-1">Review</div>
              <p className="font-body text-[13px] text-[#5a5a5a] m-0">Confirm, correct, or remove each field. Provenance and confidence shown inline.</p>
            </div>
            <div className="p-3 bg-[#f0fdf4] border-l-[3px] border-[#166534] rounded-[3px]">
              <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#166534] mb-1">Publish</div>
              <p className="font-body text-[13px] text-[#5a5a5a] m-0">Download your JSON-LD + HTML, host on your domain, register with Search Star.</p>
            </div>
          </div>
          <Link
            href="/activate"
            className="inline-block font-body text-[11px] font-bold tracking-[0.1em] uppercase px-5 py-2.5 bg-[#166534] text-white rounded-[3px] no-underline hover:bg-[#14532d]"
          >
            Start Activate →
          </Link>
        </div>

        <div className="text-center mb-6">
          <p className="font-body text-xs text-[#767676] tracking-[0.05em]">— or build your profile manually using the steps below —</p>
        </div>

        {/* Step 1: Build Your Profile */}
        <div className="bg-white border border-[#d4d4d4] rounded-[3px] shadow-sm p-10 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-[#1a3a6b] rounded-[3px] flex items-center justify-center font-body text-sm font-bold text-white shrink-0">1</div>
            <h2 className="font-heading text-[22px] font-bold m-0">Build your profile</h2>
          </div>
          <p className="font-body text-sm text-[#5a5a5a] leading-relaxed mb-5">
            Use AI to create a sovereign data profile from your existing data — emails, financial exports, fitness apps, photos. The AI runs locally in your conversation and never sends data to Search Star servers.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ProfileSection
              icon="📊"
              title="Financial Standing"
              desc="Net worth, income, savings rate, and credit — expressed as age-cohort percentiles. A 28-year-old at the 90th percentile and a 55-year-old at the 90th percentile are directly comparable. No dollar amounts ever leave your profile."
            />
            <ProfileSection
              icon="✨"
              title="Presence Composite"
              desc="Three dimensions: Rizz (interpersonal magnetism), Vibe (aesthetic taste), and Drip (visual style). Scoring is brand-blind — visible logos are penalized, originality is rewarded."
            />
            <ProfileSection
              icon="🔧"
              title="Skills & Credentials"
              desc="Professional skills with W3C Verifiable Credentials. Certifications, GitHub repos, portfolio links — all machine-readable and independently verifiable."
            />
            <ProfileSection
              icon="🎯"
              title="Interests & Advertising"
              desc="Athletic, social, and intellectual interests plus high-value advertising signals you explicitly approve. You control every targeting signal."
            />
          </div>
        </div>

        {/* Step 2: Three Access Tiers */}
        <div className="bg-white border border-[#d4d4d4] rounded-[3px] shadow-sm p-10 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-[#1a3a6b] rounded-[3px] flex items-center justify-center font-body text-sm font-bold text-white shrink-0">2</div>
            <h2 className="font-heading text-[22px] font-bold m-0">Set your price across three tiers</h2>
          </div>
          <p className="font-body text-sm text-[#5a5a5a] leading-relaxed mb-5">
            Every query to your profile is paid. You set the price for each tier independently. No subscriptions, no flat rates, no free tiers.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <TierCard
              icon="🌐"
              name="Public"
              access="Open to all platforms"
              fields="Identity, skills, interests, headline Presence score"
              pricing="Per query, you set the price"
              suggested="$0.01 – $0.10"
              color="#1a3a6b"
            />
            <TierCard
              icon="🔐"
              name="Private"
              access="Platforms you approve only"
              fields="Full profile — financials, Presence breakdown, advertising, media"
              pricing="Per query, you set the price"
              suggested="$0.10 – $2.00"
              color="#166534"
            />
            <TierCard
              icon="📨"
              name="Marketing"
              access="Open to all senders"
              fields="Messaging inbox — recruiters, brands, dates"
              pricing="Per message, no refunds"
              suggested="$1.00 – $25.00"
              color="#92400e"
            />
          </div>
        </div>

        {/* Step 3: Get Paid */}
        <div className="bg-white border border-[#d4d4d4] rounded-[3px] shadow-sm p-10 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-[#1a3a6b] rounded-[3px] flex items-center justify-center font-body text-sm font-bold text-white shrink-0">3</div>
            <h2 className="font-heading text-[22px] font-bold m-0">Get paid every week</h2>
          </div>
          <p className="font-body text-sm text-[#5a5a5a] leading-relaxed mb-5">
            Platforms deposit prepaid credits and query profiles automatically. Every query debits the platform and credits your earnings ledger. Settlement happens every Monday via Stripe Connect.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <PaymentStep
              step="Platforms fund"
              desc="Dating apps, recruiters, and brands deposit credits into their Search Star account. Queries draw down the balance automatically."
            />
            <PaymentStep
              step="You earn 90%"
              desc="Each query splits: 90% to your earnings ledger, 10% to Search Star. No hidden fees, no ad revenue sharing."
            />
            <PaymentStep
              step="Weekly payout"
              desc="Every Monday, accumulated earnings settle to your bank account via Stripe. Minimum payout: $1.00. Full audit log."
            />
          </div>
        </div>

        {/* Content Feed */}
        <div className="bg-white border border-[#d4d4d4] rounded-[3px] shadow-sm p-10 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-[#1a3a6b] rounded-[3px] flex items-center justify-center font-body text-sm font-bold text-white shrink-0">4</div>
            <h2 className="font-heading text-[22px] font-bold m-0">Your unified feed</h2>
          </div>
          <p className="font-body text-sm text-[#5a5a5a] leading-relaxed mb-5">
            Marketing messages from platforms, content from subscriptions you choose, and system notifications all arrive in one place. Block any sender instantly. Every message in your Marketing inbox was paid for.
          </p>
          <div className="p-4 bg-[#eef2f8] border-l-[3px] border-[#1a3a6b] rounded-[3px]">
            <p className="font-body text-sm text-[#5a5a5a] leading-relaxed m-0">
              <strong className="text-[#1a1a1a]">Your attention has a price.</strong> The Marketing tier acts as a spam filter backed by money. A recruiter who pays $5 to message you is serious. A brand paying $25 for your attention values you. No refunds — the price is the filter.
            </p>
          </div>
        </div>

        {/* Sovereign Hosting */}
        <div className="bg-white border border-[#d4d4d4] rounded-[3px] shadow-sm p-10 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-[#1a3a6b] rounded-[3px] flex items-center justify-center font-body text-sm font-bold text-white shrink-0">5</div>
            <h2 className="font-heading text-[22px] font-bold m-0">You host everything</h2>
          </div>
          <p className="font-body text-sm text-[#5a5a5a] leading-relaxed mb-5">
            Search Star is a directory and payment layer — not a hosting platform. Your profile lives at a domain you control, served as JSON-LD. If Search Star disappeared tomorrow, your profile would still exist at your URL.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-[#f0fdf4] border-l-[3px] border-[#166534] rounded-[3px]">
              <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#166534] mb-1">What Search Star stores</div>
              <p className="font-body text-sm text-[#5a5a5a] m-0">Directory index (profile number, handle, pricing, trust score), earnings ledger, and validation layer. That&apos;s it.</p>
            </div>
            <div className="p-4 bg-[#eef2f8] border-l-[3px] border-[#1a3a6b] rounded-[3px]">
              <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#1a3a6b] mb-1">What you host</div>
              <p className="font-body text-sm text-[#5a5a5a] m-0">Your complete profile JSON-LD, photos, media, and any extension content — all on your own infrastructure.</p>
            </div>
          </div>
        </div>

        {/* Validation / Trust */}
        <div className="bg-white border border-[#d4d4d4] rounded-[3px] shadow-sm p-10 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-[#1a3a6b] rounded-[3px] flex items-center justify-center font-body text-sm font-bold text-white shrink-0">6</div>
            <h2 className="font-heading text-[22px] font-bold m-0">Backed by real money</h2>
          </div>
          <p className="font-body text-sm text-[#5a5a5a] leading-relaxed mb-3">
            Anyone can claim to be in the 95th percentile. Search Star profiles are different — trusted validators stake their own money that your claims are accurate. If claims are proven false, their stakes are forfeited. The more money staked, the higher your trust score, and the more you can charge.
          </p>
          <p className="font-body text-sm text-[#5a5a5a] leading-relaxed m-0">
            Automated checks run continuously: credit score attestations, income verification, financial monitoring, endpoint health checks, and cross-reference scans.
          </p>
        </div>

        {/* CTA */}
        <div className="text-center py-6">
          <Link
            href="/activate"
            className="btn-primary inline-block no-underline mr-3"
          >
            Start with Activate
          </Link>
          <Link
            href="/onboarding/estimate"
            className="btn-secondary inline-block no-underline mr-3"
          >
            Estimate Your Earnings
          </Link>
          <Link
            href="/signup"
            className="btn-secondary inline-block no-underline"
          >
            Build From Scratch
          </Link>
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}

function ProfileSection({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="p-4 bg-[#fafafa] border border-[#e8e8e8] rounded-[3px]">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <div className="font-body text-sm font-bold text-[#1a1a1a]">{title}</div>
      </div>
      <p className="font-body text-[13px] text-[#5a5a5a] leading-relaxed m-0">{desc}</p>
    </div>
  )
}

function TierCard({ icon, name, access, fields, pricing, suggested, color }: {
  icon: string; name: string; access: string; fields: string; pricing: string; suggested: string; color: string
}) {
  return (
    <div className="p-5 border border-[#d4d4d4] rounded-[3px]">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <div className="font-body text-sm font-bold" style={{ color }}>{name}</div>
      </div>
      <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">Access</div>
      <p className="font-body text-[13px] text-[#5a5a5a] mb-3">{access}</p>
      <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">Fields</div>
      <p className="font-body text-[13px] text-[#5a5a5a] mb-3">{fields}</p>
      <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">Pricing</div>
      <p className="font-body text-[13px] text-[#5a5a5a] mb-2">{pricing}</p>
      <div className="font-mono text-[11px] font-medium" style={{ color }}>Suggested: {suggested}</div>
    </div>
  )
}

function PaymentStep({ step, desc }: { step: string; desc: string }) {
  return (
    <div>
      <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-2">{step}</div>
      <p className="font-body text-sm text-[#5a5a5a] leading-relaxed m-0">{desc}</p>
    </div>
  )
}
