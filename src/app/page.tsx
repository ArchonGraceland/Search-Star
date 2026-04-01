import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      {/* Header */}
      <header className="bg-[#1a3a6b] border-b-[3px] border-[#112a4f] py-9 px-8">
        <div className="max-w-[1120px] mx-auto">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2.5">
              <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" className="w-[22px] h-[22px]">
                <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8"/>
                <polygon points="32,6 36,24 32,20 28,24" fill="#fff"/>
                <polygon points="32,6 36,24 32,28 28,24" fill="rgba(255,255,255,0.6)"/>
                <polygon points="58,32 40,28 44,32 40,36" fill="#fff" opacity="0.6"/>
                <polygon points="32,58 28,40 32,44 36,40" fill="#fff" opacity="0.6"/>
                <polygon points="6,32 24,36 20,32 24,28" fill="#fff" opacity="0.6"/>
                <circle cx="32" cy="32" r="3" fill="#fff"/>
              </svg>
              <span className="font-body text-xs font-medium tracking-[0.2em] uppercase text-white/60">
                Search Star
              </span>
            </div>
            <Link
              href="/login"
              className="font-body text-[11px] font-bold tracking-[0.1em] uppercase px-4 py-[7px] border border-white/25 text-white/70 rounded-[3px] no-underline transition-all hover:bg-white/10 hover:text-white"
            >
              Sign In
            </Link>
          </div>
          <h1 className="font-heading font-bold text-white text-[clamp(1.75rem,4vw,2.5rem)] leading-[1.15] mb-1.5">
            Own your data. Set your price.
          </h1>
          <p className="font-body text-sm text-white/70 max-w-[640px] leading-relaxed">
            The sovereign personal data standard. You host your profile, platforms query your API, and you get paid per query.
          </p>
          <div className="flex flex-wrap gap-2 mt-5">
            <Link
              href="/signup"
              className="font-body text-[11px] font-bold tracking-[0.1em] uppercase px-4 py-[7px] bg-white text-[#1a3a6b] rounded-[3px] no-underline transition-all hover:bg-white/90"
            >
              Create Profile
            </Link>
            <Link
              href="/onboarding/estimate"
              className="font-body text-[11px] font-bold tracking-[0.1em] uppercase px-4 py-[7px] border border-white/25 text-white/70 rounded-[3px] no-underline transition-all hover:bg-white/10 hover:text-white"
            >
              Estimate Earnings
            </Link>
          </div>
        </div>
      </header>

      {/* Value Proposition */}
      <main className="max-w-[860px] mx-auto px-8 py-12">
        <div className="bg-white border border-[#d4d4d4] rounded-[3px] shadow-sm p-14">
          <h2 className="font-heading text-[28px] font-bold mb-3 pb-2 border-b-2 border-[#e8e8e8]">
            How it works
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
            <div>
              <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-2">Step 1</div>
              <h3 className="font-heading text-xl font-bold mb-2">Build your profile</h3>
              <p className="font-body text-sm text-[#5a5a5a] leading-relaxed">
                Use AI to create your sovereign data profile — financial standing, skills, interests, and presence. All verified, all yours.
              </p>
            </div>
            <div>
              <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-2">Step 2</div>
              <h3 className="font-heading text-xl font-bold mb-2">Set your price</h3>
              <p className="font-body text-sm text-[#5a5a5a] leading-relaxed">
                Choose what platforms pay to query your data. Public tier for discovery, private tier for the full picture, marketing tier for your attention.
              </p>
            </div>
            <div>
              <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-2">Step 3</div>
              <h3 className="font-heading text-xl font-bold mb-2">Get paid</h3>
              <p className="font-body text-sm text-[#5a5a5a] leading-relaxed">
                Every query earns you money. Weekly settlement to your bank account. Full audit log. Revoke any access, block any sender.
              </p>
            </div>
          </div>

          <div className="mt-10 p-4 bg-[#eef2f8] border-l-[3px] border-[#1a3a6b] rounded-[3px]">
            <p className="font-body text-sm text-[#5a5a5a] leading-relaxed m-0">
              <strong className="text-[#1a1a1a]">Search Star inverts the data economy.</strong> Instead of platforms harvesting your data for free and selling it to advertisers, you own, host, price, and monetize your own data directly.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <Link
              href="/onboarding"
              className="btn-secondary inline-block no-underline"
            >
              Learn More
            </Link>
            <Link
              href="/onboarding/estimate"
              className="btn-primary inline-block no-underline"
            >
              Estimate Your Earnings
            </Link>
          </div>
        </div>
      </main>

      {/* For Platforms CTA */}
      <section className="max-w-[860px] mx-auto px-8 pb-6">
        <div className="bg-[#f0fdfa] border border-[#0d9488]/20 rounded-[3px] p-8 flex items-center justify-between">
          <div>
            <h3 className="font-heading text-xl font-bold mb-1">Are you a platform?</h3>
            <p className="font-body text-sm text-[#5a5a5a] m-0">
              Recruiters, dating apps, brands — query sovereign profiles and send marketing messages via the Platform Portal.
            </p>
          </div>
          <Link
            href="/platform-signup"
            className="btn-platform inline-block no-underline flex-shrink-0 ml-6"
          >
            For Platforms
          </Link>
        </div>
      </section>

      {/* Trust as Validation Video */}
      <section className="max-w-[860px] mx-auto px-8 pb-12">
        <div className="bg-white border border-[#d4d4d4] rounded-[3px] shadow-sm p-10">
          <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-2">
            Watch
          </div>
          <h2 className="font-heading text-[24px] font-bold mb-2">
            Trust as Validation
          </h2>
          <p className="font-body text-sm text-[#5a5a5a] leading-relaxed mb-6 max-w-[600px]">
            How communities built on sustained effort create networks of people willing to vouch for each other — and why that destroys garbage culture.
          </p>
          <div className="rounded-[3px] overflow-hidden border border-[#d4d4d4] bg-black">
            <video
              controls
              preload="metadata"
              className="w-full block"
              poster=""
              style={{ aspectRatio: '16/9' }}
            >
              <source src="/SearchStar_Trust_as_Validation.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
          <p className="font-body text-xs text-[#767676] mt-3 text-center">
            10 minutes · Sovereign data · Trust scoring · Affiliate growth · Anti-garbage architecture
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1a1a1a] text-white/55 py-8">
        <div className="max-w-[1120px] mx-auto px-8">
          <div className="font-body text-xs flex justify-between">
            <div><strong className="text-white/80">Search Star</strong> — Specification v0.9 · MIT License</div>
            <div className="flex gap-6">
              <Link href="/spec.html" className="text-white/50 no-underline font-medium tracking-[0.1em] uppercase hover:text-white/80">Spec</Link>
              <a href="https://github.com/ArchonGraceland/Search-Star" className="text-white/50 no-underline font-medium tracking-[0.1em] uppercase hover:text-white/80">GitHub</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
