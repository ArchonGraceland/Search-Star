import Link from 'next/link'

export const metadata = {
  title: 'Search Star — Manifesto & Philosophy',
  description: 'Garbage culture vs. high-effort culture. Trust as Love: the core philosophy of Search Star. In a post-scarcity world, the scarce resource is authentic human relationship.',
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

      {/* ═══════════ PART I: THE MANIFESTO ═══════════ */}
      <section className="max-w-[960px] mx-auto px-8 pt-16 pb-12">
        <p
          className="font-body text-xs font-bold tracking-[0.25em] uppercase mb-4"
          style={{ color: '#8B0000' }}
        >
          Part I — The Search Star Movement
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

        {/* Video Player — Manifesto */}
        <div className="rounded-[3px] overflow-hidden mb-16" style={{ border: '1px solid #1E293B' }}>
          <video
            controls
            preload="metadata"
            className="w-full block"
            style={{ background: '#000' }}
          >
            <source src="/seven-feeds-of-death.mp4" type="video/mp4" />
            Your browser does not support the video element.
          </video>
        </div>
      </section>

      {/* Manifesto Text */}
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
      </section>

      {/* ═══════════ DIVIDER ═══════════ */}
      <div className="max-w-[960px] mx-auto px-8">
        <div className="flex items-center gap-6">
          <div className="flex-1 h-[1px]" style={{ background: '#1E293B' }} />
          <span className="font-heading text-2xl" style={{ color: '#C5A55A' }}>✦</span>
          <div className="flex-1 h-[1px]" style={{ background: '#1E293B' }} />
        </div>
      </div>

      {/* ═══════════ PART II: TRUST AS LOVE ═══════════ */}
      <section id="philosophy" className="max-w-[960px] mx-auto px-8 pt-20 pb-12">
        <p
          className="font-body text-xs font-bold tracking-[0.25em] uppercase mb-4"
          style={{ color: '#0D9488' }}
        >
          Part II — Core Philosophy
        </p>
        <h1
          className="font-heading text-5xl font-bold leading-tight mb-3"
          style={{ color: '#F5F0E8' }}
        >
          Trust as Love
        </h1>
        <p
          className="font-body text-lg mb-10"
          style={{ color: '#94A3B8' }}
        >
          The only scarce resource in a post-scarcity world
        </p>

        {/* Video Player — Trust as Love */}
        <div className="rounded-[3px] overflow-hidden mb-16" style={{ border: '1px solid #1E293B' }}>
          <video
            controls
            preload="metadata"
            className="w-full block"
            style={{ background: '#000' }}
          >
            <source src="/trust-as-love.mp4" type="video/mp4" />
            Your browser does not support the video element.
          </video>
        </div>
      </section>

      {/* Philosophy Text */}
      <section className="max-w-[720px] mx-auto px-8 pb-20">
        <div className="h-[1px] mb-16" style={{ background: '#1E293B' }} />

        <h2
          className="font-heading text-3xl font-bold mb-8"
          style={{ color: '#C5A55A' }}
        >
          The Philosophy
        </h2>

        <div className="space-y-6 font-body text-base leading-relaxed" style={{ color: '#CBD5E1' }}>

          {/* The Trust Crisis */}
          <h3
            className="font-heading text-xl font-bold mt-10 mb-2"
            style={{ color: '#F5F0E8' }}
          >
            The Trust Crisis
          </h3>
          <p>
            Every form of garbage culture is an unverified claim with no one willing to vouch for it.
            AI slop claims authorship it doesn&apos;t have. Influencers claim lifestyles never lived. Clickbait
            claims value it can&apos;t deliver. In every case, no human is willing to stake their reputation
            on the claim&apos;s accuracy.
          </p>
          <p>
            Search Star&apos;s defense is architectural, not editorial. Every meaningful claim on a profile
            can be validated by a real person willing to put their name on it. The cost of garbage
            isn&apos;t just monetary — it&apos;s reputational, because someone real had to vouch for it.
          </p>

          {/* What Trust Measures */}
          <h3
            className="font-heading text-xl font-bold mt-10 mb-2"
            style={{ color: '#F5F0E8' }}
          >
            What Trust Actually Measures
          </h3>
          <p>
            Validation of factual claims is only the first layer. The deeper question is: what makes a
            person&apos;s validation meaningful? The answer is relationship. You cannot vouch for someone you
            don&apos;t know. You cannot know someone without spending sustained time with them — in shared
            meals, shared labor, shared worship, shared play.
          </p>
          <p>
            What the Trust Score actually measures, at bottom, is not the accuracy of data fields. It
            measures the <span style={{ color: '#F5F0E8', fontWeight: 600 }}>depth, breadth, and
            durability</span> of a person&apos;s real human relationships. A profile backed by six
            validators who have known the owner for a decade, who vouch for each other as well as for
            the owner, and who come from independent communities — that profile is not just
            &ldquo;verified.&rdquo; It is a portrait of a person embedded in a web of reciprocal love.
          </p>

          {/* Love as Economic Primitive */}
          <h3
            className="font-heading text-xl font-bold mt-10 mb-2"
            style={{ color: '#F5F0E8' }}
          >
            Love as the Scarce Resource
          </h3>
          <p>
            We use the word <span style={{ color: '#0D9488', fontWeight: 600 }}>love</span> deliberately
            and in the full Aristotelian-Thomistic sense: not merely erotic attraction, but the whole
            spectrum of human affection — erotic, romantic, filial, and fraternal. Love in this tradition
            is not a feeling. It is an act of the will directed toward the genuine good of another person.
            It is inherently particular: you love <em>this</em> person, not persons in general.
          </p>
          <p>
            And it is structurally rivalrous in a way that attention is not. You can watch a celebrity&apos;s
            content alongside millions of others. You cannot be someone&apos;s friend alongside millions
            of others. Friendship, family devotion, and genuine community require reciprocity, time,
            presence, and exclusivity. They do not scale — and that is precisely what makes them
            economically meaningful in a world where everything else scales infinitely.
          </p>

          {/* Callout */}
          <div
            className="rounded-[3px] px-6 py-5 my-8"
            style={{ background: '#1E293B', borderLeft: '3px solid #0D9488' }}
          >
            <p className="font-body text-sm leading-relaxed m-0" style={{ color: '#CBD5E1' }}>
              In a world where AI-driven automation makes material production nearly free, the scarce
              resource is authentic human relationship. Search Star is infrastructure for an economy
              organized around the cultivation of human bonds — not data licensing, not attention
              brokerage, not celebrity worship.{' '}
              <span style={{ color: '#C5A55A', fontWeight: 600 }}>
                The Trust Score is the price signal for love.
              </span>
            </p>
          </div>

          {/* Against Social Credit */}
          <h3
            className="font-heading text-xl font-bold mt-10 mb-2"
            style={{ color: '#F5F0E8' }}
          >
            Against Social Credit
          </h3>
          <p>
            Search Star&apos;s trust model is the structural inverse of top-down social credit systems.
            In a social credit regime — whether governmental or corporate — a central authority defines
            acceptable behavior, scores compliance, and punishes deviation. Celebrity and influencer
            culture operate on the same logic at a cultural level: a small number of people accumulate
            enormous visibility, and their followers&apos; identities are defined by parasocial attachment
            to figures who cannot love them back. Both systems produce idolatry — the elevation of an
            image over a person.
          </p>
          <p>
            Search Star rejects this entirely. No central authority defines who is trustworthy. The people
            who actually know you make that determination through their sustained, voluntary association
            with you. Vouching is mutual: I vouch for you and you vouch for me, and both of us stake our
            reputation on the claim. The system is bottom-up, peer-to-peer, and resistant to coercion in
            a way that any top-down system cannot be.
          </p>

          {/* Enemy declaration */}
          <div
            className="rounded-[3px] px-6 py-5 my-8"
            style={{ background: '#1E293B', borderLeft: '3px solid #8B0000' }}
          >
            <p className="font-body text-sm leading-relaxed m-0" style={{ color: '#CBD5E1' }}>
              <span style={{ color: '#F5F0E8', fontWeight: 600 }}>Search Star&apos;s enemies are
              explicit:</span> top-down social credit systems that score compliance, celebrity economies
              that manufacture parasocial attachment, and platform architectures that harvest data without
              consent or compensation. These systems treat people as inputs. Search Star treats people
              as ends.
            </p>
          </div>

          {/* The Convergence Principle */}
          <h3
            className="font-heading text-xl font-bold mt-10 mb-2"
            style={{ color: '#F5F0E8' }}
          >
            The Convergence Principle
          </h3>
          <p>
            The deepest design insight of the trust architecture is that gaming the system produces the
            behavior the system exists to reward. Most economic systems have a gap between what is
            incentivized and what is good. Financial markets reward extraction alongside creation.
            Social media rewards provocation alongside connection. Credential systems reward signaling
            alongside learning. Search Star is designed so that gap closes.
          </p>
          <p>
            The only way to increase your Trust Score is to maintain long, mutual, sustained relationships
            with real people across independent communities — people who genuinely vouch for you because
            they genuinely know you. Someone who sets out to &ldquo;game&rdquo; the system by strategically
            investing in deep friendships, showing up to their communities year after year, and building a
            reputation worth staking money on has simply… built a life of genuine human connection. The
            manipulation and the virtue converge.
          </p>
          <p>
            This is a direct application of the Aristotelian insight that habituation precedes and eventually
            produces genuine character. The person who acts virtuously in order to gain an advantage will,
            over enough time and repetition, become genuinely virtuous. You act your way into virtue before
            you feel your way into it.
          </p>

          {/* The Game callout */}
          <div
            className="rounded-[3px] px-6 py-5 my-8"
            style={{ background: '#1E293B', borderLeft: '3px solid #C5A55A' }}
          >
            <p className="font-body text-sm leading-relaxed m-0" style={{ color: '#CBD5E1' }}>
              <span style={{ color: '#C5A55A', fontWeight: 600 }}>We want people to game this
              system.</span> The game is the point. The only way to win is to pursue love in the full
              Aristotelian-Thomistic sense — sustained, reciprocal, particular devotion to real people in
              real communities. If everyone plays this game as hard as they can, the result is a society
              of people embedded in deep, genuine, loving relationships. That is not a side effect. It is
              the design objective.
            </p>
          </div>

          {/* Closing */}
          <p className="mt-10">
            Own your data. Own your relationships. Own your future.
          </p>
          <p style={{ color: '#C5A55A', fontStyle: 'italic' }}>
            The Trust Score is the price signal for love.
          </p>
        </div>

        {/* CTA */}
        <div className="mt-16 flex gap-4 justify-center flex-wrap">
          <Link
            href="/spec.html#trustphilosophy"
            className="inline-block no-underline font-body text-sm font-bold tracking-[0.15em] uppercase px-8 py-3 rounded-[3px] transition-all"
            style={{
              background: 'transparent',
              color: '#C5A55A',
              border: '1px solid #C5A55A',
            }}
          >
            Read the Spec
          </Link>
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
