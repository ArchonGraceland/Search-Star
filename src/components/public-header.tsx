import Link from 'next/link'

export function PublicHeader() {
  return (
    <header className="bg-[#1a3a6b] border-b-[3px] border-[#112a4f] py-6 px-8">
      <div className="max-w-[1120px] mx-auto flex items-center justify-between">
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
          <Link href="/" className="font-body text-xs font-medium tracking-[0.2em] uppercase text-white/60 no-underline hover:text-white/80">
            Search Star
          </Link>
        </div>
        <nav className="flex items-center gap-4">
          <Link
            href="/onboarding"
            className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-white/50 no-underline hover:text-white/80 transition-colors"
          >
            How It Works
          </Link>
          <Link
            href="/onboarding/estimate"
            className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-white/50 no-underline hover:text-white/80 transition-colors"
          >
            Estimate Earnings
          </Link>
          <Link
            href="/login"
            className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-white/50 no-underline hover:text-white/80 transition-colors"
          >
            Sign In
          </Link>
        </nav>
      </div>
    </header>
  )
}
