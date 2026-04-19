import PublicHeader from '@/components/public-header'
import Link from 'next/link'

export const metadata = {
  title: 'Search Star — What do you want to practice?',
  description: '90-day practice commitments. Private by default. Sponsors who believe in what you\'re building. An AI Companion that pays attention. Trust earned through action, not performance.',
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
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(17,42,79,0.72) 0%, rgba(26,58,107,0.78) 100%)',
          }} />
          <div className="max-w-3xl mx-auto text-center" style={{ position: 'relative', zIndex: 1 }}>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '20px' }}>
              Search Star — v4.0
            </p>
            <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', color: '#ffffff', lineHeight: 1.1, fontSize: 'clamp(40px, 6vw, 64px)', fontWeight: 700, marginBottom: '24px' }}>
              What do you want to practice?
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '20px', maxWidth: '620px', lineHeight: 1.65, margin: '0 auto 36px' }}>
              Declare a 90-day commitment. Invite sponsors who put something behind their belief in you.
              An AI Companion walks alongside the practice. A record of real work, witnessed by real people.
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
              Platforms reward performance, not formation.
            </h2>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75, marginBottom: '20px' }}>
              The social platforms are engagement loops: post something, get reactions, post again. That architecture rewards novelty, spectacle, and the aesthetic of discipline. It does not reward the long private work of actually getting better at anything. When you build your practice on a platform that rewards performance, you learn to optimize for the platform. The metric corrupts the thing being measured. You become a better performer of practice, not a better practitioner.
            </p>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75 }}>
              This pattern replicates across domains. The musician optimizes for clips rather than technique. The writer optimizes for threads rather than books. The athlete optimizes for photographs rather than strength. The investor optimizes for public conviction rather than actual research. Search Star is built on a different architecture — one where practice is private by default, witnessed by people who know you, and recognized only once the work is done. <Link href="/manifesto" style={{ color: '#1a3a6b', fontWeight: 600, textDecoration: 'underline', textDecorationColor: 'rgba(26,58,107,0.3)' }}>Read the full argument →</Link>
            </p>
          </div>
        </section>

        {/* ── The Four Presences ── */}
        <section className="py-20 px-6" style={{ background: '#eef2f8' }}>
          <div className="max-w-4xl mx-auto">
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#1a3a6b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '16px', textAlign: 'center' }}>
              The Architecture
            </p>
            <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '36px', fontWeight: 700, color: '#1a1a1a', marginBottom: '16px', lineHeight: 1.2, textAlign: 'center' }}>
              Four presences. One commitment.
            </h2>
            <p style={{ fontSize: '16px', color: '#5a5a5a', lineHeight: 1.65, marginBottom: '44px', textAlign: 'center', maxWidth: '560px', margin: '0 auto 44px' }}>
              Every 90-day practice commitment on Search Star involves four parties. Three are people; one is software. Each has a different role, and none can do the others&apos; job.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              {[
                {
                  label: 'Practitioner',
                  role: 'Does the work',
                  body: 'You declare a 90-day commitment, show up to practice it, and post the record of each session to a small circle of witnesses. The work is the thing. Everything else on the platform exists to support it.',
                },
                {
                  label: 'Sponsor',
                  role: 'Holds the stake',
                  body: 'Sponsors pledge money against your commitment during the 14-day launch window. They can veto at any time if they stop believing. They can release the pledge at day 90 if the work was real. Their continued presence through the 90 days is the attestation — not their opinion of you, their willingness to keep their stake in.',
                },
                {
                  label: 'Companion',
                  role: 'Pays attention',
                  body: 'An AI Companion is present in every commitment. It reads what you post, remembers what you said last session, asks the questions a good teacher would ask, and notices patterns you might miss. It holds no authority over the Trust record. It does not grade your work, score your form, or vote on completion. It is the steady witness who has been paying attention — nothing more, and nothing less.',
                },
                {
                  label: 'Institution',
                  role: 'Reads the record',
                  body: 'Schools, programs, and employers that want to evaluate genuine formation rather than self-reported credentials can read a practitioner\'s Trust record with their consent. The record is a third-party-attested ledger of sustained practice, backed by sponsors who stayed present. It is hard to manufacture and impossible to fake.',
                },
              ].map((role) => (
                <div key={role.label} style={{ background: '#ffffff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '28px 30px' }}>
                  <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '10px', fontWeight: 700, color: '#1a3a6b', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '4px', opacity: 0.6 }}>
                    {role.role}
                  </p>
                  <h3 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '24px', fontWeight: 700, color: '#1a1a1a', marginBottom: '12px', lineHeight: 1.2 }}>
                    {role.label}
                  </h3>
                  <p style={{ fontSize: '15px', color: '#3a3a3a', lineHeight: 1.7 }}>{role.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How It Works ── */}
        <section className="py-20 px-6" style={{ background: '#ffffff' }}>
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
                { n: '02', title: 'Declare a 90-day commitment.', body: 'The sponsorable unit of practice. Write what you\'re committing to and what a successful streak looks like. This opens the 14-day launch window.' },
                { n: '03', title: 'Invite sponsors.', body: 'Sponsors put something behind their belief in you. They pledge money against your 90 days, can veto any time during the streak, and release the pledge at day 90 if the work was real. Continued presence is the attestation.' },
                { n: '04', title: 'Gather more sponsors during launch.', body: 'During the 14-day launch window, share your commitment with friends, family, and anyone who believes in what you\'re building. Additional sponsors can join mid-streak too — once in, they\'re bound by the same veto-or-release mechanic.' },
                { n: '05', title: 'Perform the start ritual.', body: 'A written statement of intent, timestamped. This is the moment the streak begins. Day 1 of 90.' },
                { n: '06', title: 'Log sessions. Talk to the Companion.', body: 'Each session becomes a post visible only to your sponsors. Text, photos, or short voice-annotated videos — narrate what you did while you filmed it, and the transcript becomes part of the record. The Companion reads each session and can ask a good question or notice something worth noticing. No public feed, no likes, no follower counts.' },
                { n: '07', title: 'Complete the streak. Sponsors release.', body: 'At day 90, each sponsor chooses to release their pledge. You receive the full pledged amount — nothing is deducted. A separate, optional 5% voluntary contribution prompts you to support Search Star; it is removable in one click and never taken from your payout.' },
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
        <section className="py-20 px-6" style={{ background: '#eef2f8' }}>
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
                  body: 'Your session posts are visible only to your sponsors and your Companion. There is no public feed, no like count, no follower metric. Visibility is something you extend deliberately — to a specific person, to your network, to the public — and you can retract it. The default assumption is that practice is private, witnessed by people who know you, not performed for an audience of strangers.',
                },
                {
                  principle: 'Recognition flows through others.',
                  body: 'You cannot vouch for yourself on Search Star. Your Trust record exists because sponsors pledged real money against your commitment and stayed present through the 90 days. Every consequential signal in the system is someone else\'s assertion about you — which means it means something. Gaming the metric produces the virtue.',
                },
              ].map((p) => (
                <div key={p.principle} style={{ background: '#ffffff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '32px' }}>
                  <h3 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '22px', fontWeight: 700, color: '#1a3a6b', marginBottom: '14px', lineHeight: 1.25 }}>{p.principle}</h3>
                  <p style={{ fontSize: '15px', color: '#3a3a3a', lineHeight: 1.7 }}>{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── The Trust Record ── */}
        <section className="py-20 px-6" style={{ background: '#ffffff' }}>
          <div className="max-w-2xl mx-auto">
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#1a3a6b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '16px' }}>
              The Trust Record
            </p>
            <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '36px', fontWeight: 700, color: '#1a1a1a', marginBottom: '20px', lineHeight: 1.2 }}>
              A credential you can&apos;t perform into existence.
            </h2>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75, marginBottom: '28px' }}>
              Your Trust record is a portable credential built from completed sponsored streaks. It tracks three things: depth (the volume and quality of sessions within a practice), breadth (the range of practices you&apos;ve committed to across categories), and durability (how long your track record extends). These combine into a growth stage — Seedling, Rooting, Growing, Established, Mature — that describes where you are in your formation as a practitioner.
            </p>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75, marginBottom: '32px' }}>
              The stage is never a number and never a score. It can&apos;t be bought, boosted, or gamed. The only way to advance is to actually do the work, over time, witnessed by real people who kept their stake in. That is the design. An institution that sees a Mature Trust record knows something specific and verifiable about the person behind it — not what they say about themselves, but what others have confirmed about them across multiple completed streaks.
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

        {/* ── CTA ── */}
        <section className="py-24 px-6" style={{ background: '#1a3a6b' }}>
          <div className="max-w-2xl mx-auto text-center">
            <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '44px', fontWeight: 700, color: '#ffffff', marginBottom: '20px', lineHeight: 1.15 }}>
              Ready to begin?
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '18px', marginBottom: '36px', lineHeight: 1.65 }}>
              Name your practice. Invite your first sponsor. Declare your first commitment.
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
