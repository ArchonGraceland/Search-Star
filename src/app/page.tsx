import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-[#f5f5f5]">

      {/* ── Header ── */}
      <header className="bg-[#1a3a6b] border-b-[3px] border-[#112a4f] py-9 px-8">
        <div className="max-w-[1120px] mx-auto">
          <div className="flex items-center justify-between mb-8">
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
              <span className="font-body text-xs font-medium tracking-[0.2em] uppercase text-white/60">Search Star</span>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/login" className="font-body text-[11px] font-bold tracking-[0.1em] uppercase px-4 py-[7px] border border-white/25 text-white/70 rounded-[3px] no-underline transition-all hover:bg-white/10 hover:text-white">
                Sign In
              </Link>
              <Link href="/signup" className="font-body text-[11px] font-bold tracking-[0.1em] uppercase px-4 py-[7px] bg-white text-[#1a3a6b] rounded-[3px] no-underline transition-all hover:bg-white/90">
                Sign Up
              </Link>
            </div>
          </div>

          {/* Hero */}
          <div className="max-w-[720px]">
            <h1 className="font-heading font-bold text-white text-[clamp(2rem,5vw,3.25rem)] leading-[1.1] mb-4">
              Your profile is built from what you do,<br className="hidden md:block" /> not what you claim.
            </h1>
            <p className="font-body text-base text-white/75 max-w-[580px] leading-relaxed mb-8">
              Commit to a habit. Post your progress for 40 days. The people who watch you do it become your trust network. Platforms pay to query the result.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/commitment" className="font-body text-[11px] font-bold tracking-[0.1em] uppercase px-6 py-3 bg-white text-[#1a3a6b] rounded-[3px] no-underline transition-all hover:bg-white/90">
                Make a commitment →
              </Link>
              <Link href="/onboarding" className="font-body text-[11px] font-bold tracking-[0.1em] uppercase px-6 py-3 border border-white/25 text-white/70 rounded-[3px] no-underline transition-all hover:bg-white/10 hover:text-white">
                How it works
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[860px] mx-auto px-8 py-12 space-y-6">

        {/* ── The 40-day arc ── */}
        <div className="bg-white border border-[#d4d4d4] rounded-[3px] shadow-sm p-12">
          <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-3">The commitment</div>
          <h2 className="font-heading text-[28px] font-bold mb-4">40 days. One habit. Public.</h2>
          <p className="font-body text-sm text-[#5a5a5a] leading-relaxed max-w-[580px] mb-8">
            You name a habit in your own words. No categories, no templates. Then you post your practice — image, text, anything — one day at a time. Each square is a day you showed up.
          </p>

          {/* Arc demo */}
          <div className="mb-3">
            <div className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-2">Example — day 23 of 40</div>
            <div className="flex flex-wrap gap-[3px]">
              {Array.from({ length: 40 }).map((_, i) => (
                <div
                  key={i}
                  style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0 }}
                  className={i < 23 ? 'bg-[#639922] border border-[#3B6D11]' : i === 23 ? 'bg-[#3B6D11] border border-[#27500A]' : 'bg-[#f5f5f5] border border-[#d4d4d4]'}
                />
              ))}
            </div>
          </div>
          <p className="font-body text-xs text-[#767676]">Gaps stay visible. Day 41 it becomes a streak with no end.</p>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { role: 'Witness', color: 'bg-[#F1EFE8] text-[#444441]', desc: 'Follows your posts. Sees every day you show up.' },
              { role: 'Co-practice', color: 'bg-[#E6F1FB] text-[#185FA5]', desc: 'Commits the same habit alongside you. Streaks linked.' },
              { role: 'Stakeholder', color: 'bg-[#EAF3DE] text-[#3B6D11]', desc: 'Stakes money on you completing day 40. Returned on success.' },
            ].map(({ role, color, desc }) => (
              <div key={role}>
                <span className={`font-body text-[10px] font-bold tracking-[0.08em] uppercase px-2.5 py-1 rounded-full ${color} inline-block mb-2`}>{role}</span>
                <p className="font-body text-sm text-[#5a5a5a] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Trust earned, not claimed ── */}
        <div className="bg-white border border-[#d4d4d4] rounded-[3px] shadow-sm p-12">
          <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-3">The trust score</div>
          <h2 className="font-heading text-[28px] font-bold mb-4">Trust is earned during the hard part.</h2>
          <p className="font-body text-sm text-[#5a5a5a] leading-relaxed max-w-[580px] mb-8">
            In every other system, trust is validated after success — a credential earned, then endorsed. Here, trust is built while you struggle. A stakeholder who watched you fail on day 17 and restart on day 18 has witnessed something no certificate can replicate.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 bg-[#eef2f8] border-l-[3px] border-[#1a3a6b] rounded-[3px]">
              <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#1a3a6b] mb-1">Practice Depth</div>
              <p className="font-body text-sm text-[#5a5a5a] leading-relaxed m-0">Completed commitments, days logged, discipline over time. Cannot be faked — server-timestamped, append-only, gaps visible.</p>
            </div>
            <div className="p-5 bg-[#f0fdf4] border-l-[3px] border-[#166534] rounded-[3px]">
              <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#166534] mb-1">Epistemic Honesty</div>
              <p className="font-body text-sm text-[#5a5a5a] leading-relaxed m-0">Public belief updates. Gap acknowledgments. Open questions. Updating your views increases your score. Never updating decreases it.</p>
            </div>
          </div>
          <div className="mt-6 p-4 bg-[#f5f5f5] rounded-[3px]">
            <p className="font-body text-sm text-[#5a5a5a] leading-relaxed m-0">
              <strong className="text-[#1a1a1a]">The convergence principle:</strong> The only way to maximize your Trust Score is to genuinely practice, genuinely update, and build relationships with people who watch you do both. Gaming the metric produces the virtue.
            </p>
          </div>
        </div>

        {/* ── Sovereign data economy ── */}
        <div className="bg-white border border-[#d4d4d4] rounded-[3px] shadow-sm p-12">
          <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-3">The economy</div>
          <h2 className="font-heading text-[28px] font-bold mb-4">Platforms pay for your practice record.</h2>
          <p className="font-body text-sm text-[#5a5a5a] leading-relaxed max-w-[580px] mb-8">
            A 400-day reading streak co-signed by two validators is a different kind of signal than a credential. Recruiters, dating apps, research collaborations — any platform that needs to know whether someone actually does what they say they do can query your profile. You set the price. You keep 90%.
          </p>
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { tier: 'Public', desc: 'Practice record, habit history, trust score', color: 'bg-[#eef2f8] text-[#1a3a6b]' },
              { tier: 'Private', desc: 'Full commitment data, belief changelog, reading trail', color: 'bg-[#f5f5f5] text-[#1a1a1a]' },
              { tier: 'Marketing', desc: 'Pay to message you. No refunds.', color: 'bg-[#fffbeb] text-[#92400e]' },
            ].map(({ tier, desc, color }) => (
              <div key={tier} className={`p-4 rounded-[3px] ${color.split(' ')[0]}`}>
                <div className={`font-body text-[10px] font-bold tracking-[0.1em] uppercase mb-1.5 ${color.split(' ')[1]}`}>{tier}</div>
                <p className="font-body text-xs text-[#5a5a5a] leading-relaxed m-0">{desc}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/commitment" className="btn-primary inline-block no-underline">Start your first commitment →</Link>
            <Link href="/onboarding/estimate" className="btn-secondary inline-block no-underline">Estimate earnings</Link>
          </div>
        </div>

        {/* ── Platform CTA ── */}
        <div className="bg-[#f0fdfa] border border-[#0d9488]/20 rounded-[3px] p-8 flex items-center justify-between">
          <div>
            <h3 className="font-heading text-xl font-bold mb-1">Are you a platform?</h3>
            <p className="font-body text-sm text-[#5a5a5a] m-0">Recruiters, dating apps, research tools — query sovereign practice profiles via the Platform Portal.</p>
          </div>
          <Link href="/platform-signup" className="btn-platform inline-block no-underline flex-shrink-0 ml-6">For Platforms</Link>
        </div>

        {/* ── Video ── */}
        <div className="bg-white border border-[#d4d4d4] rounded-[3px] shadow-sm p-10">
          <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-2">Watch</div>
          <h2 className="font-heading text-[24px] font-bold mb-2">Trust as Validation</h2>
          <p className="font-body text-sm text-[#5a5a5a] leading-relaxed mb-6 max-w-[600px]">
            How communities built on sustained effort create networks of people willing to vouch for each other — and why that destroys garbage culture.
          </p>
          <div className="rounded-[3px] overflow-hidden border border-[#d4d4d4] bg-black">
            <video controls preload="metadata" className="w-full block" style={{ aspectRatio: '16/9' }}>
              <source src="/SearchStar_Trust_as_Validation.mp4" type="video/mp4" />
            </video>
          </div>
          <p className="font-body text-xs text-[#767676] mt-3 text-center">10 minutes · Sovereign data · Trust scoring · Habit commitment · Anti-garbage architecture</p>
        </div>

      </main>

      {/* ── Footer ── */}
      <footer className="bg-[#1a1a1a] text-white/55 py-8">
        <div className="max-w-[1120px] mx-auto px-8">
          <div className="font-body text-xs flex justify-between flex-wrap gap-4">
            <div><strong className="text-white/80">Search Star</strong> — Specification v1.5.0-draft · MIT License</div>
            <div className="flex gap-6 flex-wrap">
              <Link href="/spec.html" className="text-white/50 no-underline font-medium tracking-[0.1em] uppercase hover:text-white/80">Spec</Link>
              <Link href="/roadmap.html" className="text-white/50 no-underline font-medium tracking-[0.1em] uppercase hover:text-white/80">Roadmap</Link>
              <Link href="/manifesto" className="text-white/50 no-underline font-medium tracking-[0.1em] uppercase hover:text-white/80">Manifesto</Link>
              <Link href="/projections" className="text-white/50 no-underline font-medium tracking-[0.1em] uppercase hover:text-white/80">Projections</Link>
              <a href="https://github.com/ArchonGraceland/Search-Star" className="text-white/50 no-underline font-medium tracking-[0.1em] uppercase hover:text-white/80">GitHub</a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}
