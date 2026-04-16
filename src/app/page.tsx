import PublicHeader from '@/components/public-header'
import Link from 'next/link'

export const metadata = {
  title: 'Search Star — What do you want to practice?',
  description: '90-day practice commitments. A private validator circle. Sponsors who believe in what you\'re building. Trust earned through action, not performance.',
}

export default function HomePage() {
  return (
    <>
      <PublicHeader />
      <main>

        {/* ── Hero ── */}
        <section style={{
          position: 'relative',
          borderBottom: '3px solid #112a4f',
          backgroundImage: 'url(/images/hero/table-v2-wider.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 40%',
          backgroundRepeat: 'no-repeat',
        }} className="py-32 px-6">
          {/* Navy overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(17,42,79,0.72) 0%, rgba(26,58,107,0.78) 100%)',
          }} />
          <div className="max-w-3xl mx-auto text-center" style={{ position: 'relative', zIndex: 1 }}>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '20px' }}>
              Search Star — v3.0
            </p>
            <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', color: '#ffffff', lineHeight: 1.1, fontSize: 'clamp(40px, 6vw, 64px)', fontWeight: 700, marginBottom: '24px' }}>
              What do you want to practice?
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '20px', maxWidth: '600px', lineHeight: 1.65, margin: '0 auto 36px' }}>
              Declare a 90-day commitment. Invite people who know you to witness it.
              Earn support from friends, family, and sponsors who believe in what you&apos;re building.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link
                href="/signup"
                style={{ background: '#ffffff', color: '#1a3a6b', fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', padding: '14px 32px', borderRadius: '3px', textDecoration: 'none', textTransform: 'uppercase' }}
              >
                Start Practicing
              </Link>
              <Link
                href="/onboarding"
                style={{ border: '1px solid rgba(255,255,255,0.45)', color: 'rgba(255,255,255,0.9)', fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', padding: '14px 32px', borderRadius: '3px', textDecoration: 'none', textTransform: 'uppercase' }}
              >
                How It Works
              </Link>
            </div>
          </div>
        </section>

        {/* ── The Problem ── */}
        <section className="py-20 px-6" style={{ background: '#ffffff' }}>
          <div className="max-w-2xl mx-auto">
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#1a3a6b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '16px' }}>
              The Problem
            </p>
            <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '36px', fontWeight: 700, color: '#1a1a1a', marginBottom: '20px', lineHeight: 1.2 }}>
              The platforms reward performance, not formation.
            </h2>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75 }}>
              Instagram fitness culture is the clearest example: the metric is how your body looks in a photo, not whether you can deadlift your bodyweight or run a 5K without stopping. The platform optimizes for images, so practitioners learn to optimize for images. Discipline gets replaced by its aesthetic. Conscientiousness — the actual trait that predicts long-term growth — is invisible on every major platform, because it can't be liked, followed, or clipped into a reel. Search Star is built on the premise that this is the wrong architecture. Formation is private, slow, and witnessed by people who know you. That's what we're building infrastructure for.
            </p>
          </div>
        </section>

        {/* ── The Core Loop ── */}
        <section className="py-20 px-6" style={{ background: '#eef2f8' }}>
          <div className="max-w-3xl mx-auto">
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#1a3a6b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '16px', textAlign: 'center' }}>
              How It Works
            </p>
            <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '36px', fontWeight: 700, color: '#1a1a1a', marginBottom: '40px', lineHeight: 1.2, textAlign: 'center' }}>
              Seven steps from declaration to recognition.
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                { n: '01', title: 'Name your practice.', body: 'A skill, craft, or pursuit. Something real you want to build over time. This is the first thing you do on Search Star — before any profile, any feed, any discovery.' },
                { n: '02', title: 'Invite your validator circle.', body: 'Validators are people who know you well enough to verify the work is real. They see your session posts. They confirm your effort with a note. Their attestation is the foundation of your Trust record.' },
                { n: '03', title: 'Declare a 90-day commitment.', body: 'The sponsorable unit of practice. Write what you\'re committing to and what a successful streak looks like. This opens the 14-day launch window.' },
                { n: '04', title: 'Gather sponsors.', body: 'During the 14-day launch period, share your commitment with friends, family, and anyone who believes in what you\'re building. Sponsors pledge an amount against your completion.' },
                { n: '05', title: 'Perform the start ritual.', body: 'A written statement of intent, timestamped. This is the moment the streak begins. Day 1 of 90.' },
                { n: '06', title: 'Log sessions. Post to your circle.', body: 'Each session becomes a post visible only to your validators. No public feed. No likes. No follower counts. Just the record of work witnessed by the people you invited.' },
                { n: '07', title: 'Complete the streak. Sponsors pay out.', body: 'When validators have confirmed enough sessions and 90 days are up, the pledge triggers. Sponsors pay. You receive the funds. A voluntary contribution prompt asks if you\'d like to share a portion with the mentor economy.' },
              ].map((step) => (
                <div key={step.n} style={{ display: 'flex', gap: '24px', background: '#ffffff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '28px 32px' }}>
                  <div style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700, color: '#1a3a6b', opacity: 0.45, letterSpacing: '0.08em', flexShrink: 0, paddingTop: '4px', minWidth: '28px' }}>
                    {step.n}
                  </div>
                  <div>
                    <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '21px', fontWeight: 700, marginBottom: '8px', color: '#1a1a1a' }}>{step.title}</p>
                    <p style={{ fontSize: '15px', color: '#5a5a5a', lineHeight: 1.65 }}>{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: '36px' }}>
              <Link
                href="/onboarding"
                style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1a3a6b', textDecoration: 'none', borderBottom: '2px solid #1a3a6b', paddingBottom: '2px' }}
              >
                Read the full explainer →
              </Link>
            </div>
          </div>
        </section>

        {/* ── Three Principles ── */}
        <section className="py-20 px-6" style={{ background: '#ffffff' }}>
          <div className="max-w-3xl mx-auto">
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#1a3a6b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '16px', textAlign: 'center' }}>
              What We Believe
            </p>
            <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '36px', fontWeight: 700, color: '#1a1a1a', marginBottom: '48px', lineHeight: 1.2, textAlign: 'center' }}>
              Three principles, not five values.
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
              {[
                {
                  principle: 'Practice before profile.',
                  body: 'On Search Star, you don\'t build a profile and then find a practice to attach to it. You declare a practice first. Your profile is what accumulates from the record of that work over time. This is the architectural decision that makes everything else possible — it means your presence here is grounded in something real before it\'s visible to anyone.',
                },
                {
                  principle: 'Private by default.',
                  body: 'Your session posts are visible only to your validator circle. There is no public feed, no like count, no follower metric. Visibility is something you extend deliberately — to a specific person, to your network, to the public — and you can retract it. The default assumption is that practice is private, witnessed by people who know you, not performed for an audience of strangers.',
                },
                {
                  principle: 'Recognition flows through others.',
                  body: 'You cannot vouch for yourself on Search Star. Your Trust record exists because validators confirmed your sessions, because sponsors pledged real money against your commitment, because a mentor\'s reputation is staked to yours. Every signal in the system is someone else\'s assertion about you — which means it means something. Gaming the metric produces the virtue.',
                },
              ].map((p) => (
                <div key={p.principle} style={{ background: '#f5f5f5', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '32px' }}>
                  <h3 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '22px', fontWeight: 700, color: '#1a3a6b', marginBottom: '14px', lineHeight: 1.25 }}>{p.principle}</h3>
                  <p style={{ fontSize: '15px', color: '#3a3a3a', lineHeight: 1.7 }}>{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── The Trust Record ── */}
        <section className="py-20 px-6" style={{ background: '#eef2f8' }}>
          <div className="max-w-2xl mx-auto">
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#1a3a6b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '16px' }}>
              The Trust Record
            </p>
            <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '36px', fontWeight: 700, color: '#1a1a1a', marginBottom: '20px', lineHeight: 1.2 }}>
              A credential you can't perform into existence.
            </h2>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75, marginBottom: '28px' }}>
              Your Trust record is a portable credential built from validated practice over time. It tracks three things: depth (the quality and volume of sessions, as confirmed by validators), breadth (the range of practices you've committed to across categories), and durability (how long your track record extends). These combine into a growth stage — Seedling, Rooting, Growing, Established, Mature — that describes where you are in your formation as a practitioner.
            </p>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75, marginBottom: '32px' }}>
              The stage is never a number and it's never a score. It can't be bought, boosted, or gamed. The only way to advance is to actually do the work, over time, witnessed by real people. That's the design. An institution that sees a Mature Trust record knows something specific and verifiable about the person behind it — not what they say about themselves, but what others have confirmed about them across multiple completed streaks.
            </p>
            <div style={{ background: '#1a3a6b', borderRadius: '3px', padding: '24px 32px', display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
              {['Seedling', 'Rooting', 'Growing', 'Established', 'Mature'].map((stage, i) => (
                <div key={stage} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '18px', fontWeight: 700, color: i === 0 ? 'rgba(255,255,255,0.5)' : '#ffffff' }}>{stage}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Who It's For ── */}
        <section className="py-20 px-6" style={{ background: '#ffffff' }}>
          <div className="max-w-3xl mx-auto">
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#1a3a6b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '16px', textAlign: 'center' }}>
              Who It&apos;s For
            </p>
            <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '36px', fontWeight: 700, color: '#1a1a1a', marginBottom: '48px', lineHeight: 1.2, textAlign: 'center' }}>
              Three roles. One system.
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {[
                {
                  label: 'Practitioners',
                  body: 'Anyone who wants to build a skill, craft, or pursuit with accountability and skin in the game. You don\'t need an audience. You need witnesses. Search Star gives you the infrastructure to declare something, work on it for 90 days, have that work confirmed by people who know you, and earn support from people who believe in what you\'re building. The record of that work belongs to you and travels with you.',
                },
                {
                  label: 'Sponsors',
                  body: 'People who believe in a practitioner and want to back them financially. Sponsoring is as simple as following a link during the 14-day launch window and pledging an amount. You don\'t need a Search Star account. When the practitioner completes their 90-day streak, your pledge pays out. If they don\'t complete it, nothing is charged. Your money is a signal of belief, not a donation.',
                },
                {
                  label: 'Institutions',
                  body: 'Schools, programs, employers, and communities that want a way to evaluate genuine formation rather than self-reported credentials. A verified Trust record from Search Star is not a résumé line. It is a third-party-confirmed record of sustained practice, across real time, witnessed by a real validator circle. The growth stage gives you a signal that is hard to manufacture and impossible to fake.',
                },
              ].map((role) => (
                <div key={role.label} style={{ display: 'flex', gap: '28px', background: '#f5f5f5', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '28px 32px', alignItems: 'flex-start' }}>
                  <div style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, color: '#1a3a6b', letterSpacing: '0.12em', textTransform: 'uppercase', flexShrink: 0, paddingTop: '5px', minWidth: '96px' }}>
                    {role.label}
                  </div>
                  <p style={{ fontSize: '15px', color: '#3a3a3a', lineHeight: 1.7 }}>{role.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Narration ── */}
        <section className="py-20 px-6" style={{ background: '#f5f5f5', borderTop: '1px solid #d4d4d4' }}>
          <div className="max-w-3xl mx-auto">
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#1a3a6b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '16px', textAlign: 'center' }}>
              Hear It Explained
            </p>
            <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '36px', fontWeight: 700, color: '#1a1a1a', marginBottom: '12px', lineHeight: 1.2, textAlign: 'center' }}>
              Three narrations.
            </h2>
            <p style={{ fontSize: '16px', color: '#5a5a5a', lineHeight: 1.7, textAlign: 'center', marginBottom: '48px', maxWidth: '560px', margin: '0 auto 48px' }}>
              Written and recorded explanations of how Search Star works, why it exists, and how the economics are designed.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {[
                {
                  slug: 'video-01-90-day-commitment',
                  title: 'What Is a 90-Day Commitment?',
                  duration: '3:00',
                  description: 'The commitment mechanic, the 14-day launch period, the start ritual, how validators work, and why 90 days.',
                },
                {
                  slug: 'video-02-sponsorship-model',
                  title: 'How the Sponsorship Model Works',
                  duration: '3:12',
                  description: 'Sponsors pledge during the launch window. You keep 100% of what you earn. Voluntary contributions fund the mentor economy.',
                },
                {
                  slug: 'video-03-why-search-star',
                  title: 'Why Search Star Exists',
                  duration: '4:28',
                  description: 'The garbage culture problem, formation versus performance, conscientiousness as the most important unverifiable trait, and trust as an action.',
                },
              ].map((item) => (
                <div key={item.slug} style={{ background: '#ffffff', border: '1px solid #d4d4d4', borderRadius: '3px', overflow: 'hidden' }}>
                  <video
                    controls
                    preload="metadata"
                    style={{ width: '100%', display: 'block', background: '#1a3a6b', maxHeight: '480px' }}
                    src={`/video/${item.slug}.mp4`}
                  />
                  <div style={{ padding: '24px 28px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
                      <h3 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '21px', fontWeight: 700, color: '#1a1a1a', lineHeight: 1.2 }}>
                        {item.title}
                      </h3>
                      <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: '#767676', flexShrink: 0, paddingTop: '3px' }}>
                        {item.duration}
                      </span>
                    </div>
                    <p style={{ fontSize: '15px', color: '#5a5a5a', lineHeight: 1.65, margin: 0 }}>
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="py-24 px-6" style={{ background: '#1a3a6b' }}>
          <div className="max-w-2xl mx-auto text-center">
            <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '44px', fontWeight: 700, color: '#ffffff', marginBottom: '20px', lineHeight: 1.15 }}>
              Ready to begin?
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '18px', marginBottom: '36px', lineHeight: 1.65 }}>
              Name your practice. Invite your first validator. Declare your first commitment.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link
                href="/signup"
                style={{ background: '#ffffff', color: '#1a3a6b', fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', padding: '15px 36px', borderRadius: '3px', textDecoration: 'none', textTransform: 'uppercase' }}
              >
                Start Practicing
              </Link>
              <Link
                href="/onboarding"
                style={{ border: '1px solid rgba(255,255,255,0.35)', color: 'rgba(255,255,255,0.85)', fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', padding: '15px 36px', borderRadius: '3px', textDecoration: 'none', textTransform: 'uppercase' }}
              >
                Read the Full Explainer
              </Link>
            </div>
          </div>
        </section>

      </main>
    </>
  )
}
