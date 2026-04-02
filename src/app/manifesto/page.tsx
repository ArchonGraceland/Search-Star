import Link from 'next/link'

export const metadata = {
  title: 'The Seven Feeds of Death — Search Star Manifesto',
  description: 'Garbage culture makes you stupid, anxious, and angry. High-effort culture makes you smarter, more confident, and courageous. The Search Star movement.',
}

export default function ManifestoPage() {
  return (
    <div className="min-h-screen" style={{ background: '#0A1220' }}>

      {/* Header */}
      <header className="border-b" style={{ borderColor: '#1E293B' }}>
        <div className="max-w-[960px] mx-auto px-8 py-6 flex justify-between items-center">
          <Link href="/" className="no-underline" style={{ color: '#C5A55A' }}>
            <span className="font-heading text-xl font-bold tracking-wide">SEARCH STAR</span>
          </Link>
          <Link
            href="/"
            className="no-underline font-body text-xs font-medium tracking-[0.1em] uppercase"
            style={{ color: '#94A3B8' }}
          >
            ← Back to Home
          </Link>
        </div>
      </header>

      {/* Gold accent line */}
      <div className="h-[3px]" style={{ background: '#C5A55A' }} />

      {/* Video Section */}
      <section className="max-w-[960px] mx-auto px-8 pt-16 pb-12">
        <p
          className="font-body text-xs font-bold tracking-[0.25em] uppercase mb-4"
          style={{ color: '#8B0000' }}
        >
          The Search Star Movement
        </p>
        <h1
          className="font-heading text-5xl font-bold leading-tight mb-3"
          style={{ color: '#F5F0E8' }}
        >
          The Seven Feeds of Death
        </h1>
        <p
          className="font-body text-lg mb-10"
          style={{ color: '#94A3B8' }}
        >
          Garbage Culture vs. High-Effort Culture
        </p>

        {/* Video Player */}
        <div className="rounded-[3px] overflow-hidden mb-16" style={{ border: '1px solid #1E293B' }}>
          <video
            controls
            preload="metadata"
            className="w-full block"
            style={{ background: '#000' }}
            poster=""
          >
            <source src="/seven-feeds-of-death.mp4" type="video/mp4" />
            Your browser does not support the video element.
          </video>
        </div>
      </section>

      {/* Manifesto */}
      <section className="max-w-[720px] mx-auto px-8 pb-20">
        <div className="h-[1px] mb-16" style={{ background: '#1E293B' }} />

        <h2
          className="font-heading text-3xl font-bold mb-8"
          style={{ color: '#C5A55A' }}
        >
          The Manifesto
        </h2>

        <div className="space-y-6 font-body text-base leading-relaxed" style={{ color: '#CBD5E1' }}>
          <p>
            Social media is a false god. It demands your time, your attention, and your identity
            as sacrifice — and gives you nothing in return but anxiety, envy, and rage. This is
            not a side effect. It is the business model.
          </p>

          <p>
            Every feed refresh is engineered to trigger at least one of the seven deadly sins.
            Lust through dopamine hijacking. Gluttony through bottomless content. Greed through
            data extraction. Sloth through algorithmic thinking. Wrath through outrage amplification.
            Envy through curated highlight reels. Pride through follower counts and verification badges.
            The platforms didn&apos;t break. They were built this way.
          </p>

          <p>
            We call this <span style={{ color: '#F5F0E8', fontWeight: 600 }}>garbage culture</span>.
            It makes you stupid, anxious, and angry — by design, at scale, for profit.
          </p>

          <p>
            Search Star exists to replace it with something better:&nbsp;
            <span style={{ color: '#0D9488', fontWeight: 600 }}>high-effort culture</span>.
            A world where you own your data, set your own price, and get paid when platforms
            access your profile. Where every interaction costs real money — which means every
            interaction is intentional. Where there are no algorithms deciding what you see,
            no feeds engineered to keep you scrolling, and no engagement metrics rewarding
            the loudest voice in the room.
          </p>

          <p>
            High-effort culture structurally enforces the seven virtues that garbage culture
            destroys. Chastity of attention — nothing is pushed, you choose what you seek.
            Temperance of consumption — real cost creates real intentionality. Charity of
            value — earnings flow to the individual and the institution, not the platform.
            Diligence of identity — your profile requires effort, and rewards self-cultivation.
            Patience of discourse — monetary cost filters bad-faith actors. Kindness of
            comparison — percentiles replace raw figures, eliminating toxic competition.
            Humility of taste — brand-blind scoring means you cannot buy status.
          </p>

          <p>
            This is not hustle culture. This is sovereignty. Own your data. Own your identity.
            Own your future.
          </p>

          <p style={{ color: '#C5A55A', fontStyle: 'italic' }}>
            Choose your altar.
          </p>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <Link
            href="/"
            className="inline-block no-underline font-body text-sm font-bold tracking-[0.15em] uppercase px-8 py-3 rounded-[3px] transition-all"
            style={{
              background: '#0D9488',
              color: '#F5F0E8',
              border: '1px solid #0D9488',
            }}
          >
            Explore Search Star
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8" style={{ borderTop: '1px solid #1E293B' }}>
        <div className="max-w-[960px] mx-auto px-8">
          <div className="font-body text-xs flex justify-between" style={{ color: 'rgba(255,255,255,0.35)' }}>
            <div>
              <strong style={{ color: 'rgba(255,255,255,0.6)' }}>Search Star</strong> — The Sovereign Personal Data Standard
            </div>
            <div className="flex gap-6">
              <Link href="/spec.html" className="no-underline font-medium tracking-[0.1em] uppercase" style={{ color: 'rgba(255,255,255,0.35)' }}>Spec</Link>
              <Link href="/roadmap.html" className="no-underline font-medium tracking-[0.1em] uppercase" style={{ color: 'rgba(255,255,255,0.35)' }}>Roadmap</Link>
              <a href="https://github.com/ArchonGraceland/Search-Star" className="no-underline font-medium tracking-[0.1em] uppercase" style={{ color: 'rgba(255,255,255,0.35)' }}>GitHub</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
