import PublicHeader from '@/components/public-header'
import PublicFooter from '@/components/public-footer'
import Link from 'next/link'

export default function HomePage() {
  return (
    <>
      <PublicHeader />
      <main>
        {/* Hero */}
        <section
          style={{ background: '#1a3a6b', borderBottom: '3px solid #112a4f' }}
          className="py-20 px-6"
        >
          <div className="max-w-3xl mx-auto text-center">
            <p
              style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.6)' }}
              className="uppercase font-bold mb-4"
            >
              Search Star — v3.0
            </p>
            <h1
              style={{ fontFamily: '"Crimson Text", Georgia, serif', color: '#ffffff', lineHeight: 1.15 }}
              className="text-5xl font-bold mb-6"
            >
              What do you want to practice?
            </h1>
            <p
              style={{ color: 'rgba(255,255,255,0.8)', fontSize: '20px', maxWidth: '580px' }}
              className="mx-auto mb-10 leading-relaxed"
            >
              Declare a 90-day commitment. Invite people who know you to witness it.
              Earn support from friends, family, and sponsors who believe in what you&apos;re building.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link
                href="/signup"
                style={{
                  background: '#ffffff',
                  color: '#1a3a6b',
                  fontFamily: 'Roboto, sans-serif',
                  fontSize: '13px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  padding: '14px 32px',
                  borderRadius: '3px',
                  textDecoration: 'none',
                  textTransform: 'uppercase',
                }}
              >
                Start Practicing
              </Link>
              <Link
                href="/login"
                style={{
                  border: '1px solid rgba(255,255,255,0.4)',
                  color: 'rgba(255,255,255,0.85)',
                  fontFamily: 'Roboto, sans-serif',
                  fontSize: '13px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  padding: '14px 32px',
                  borderRadius: '3px',
                  textDecoration: 'none',
                  textTransform: 'uppercase',
                }}
              >
                Sign In
              </Link>
            </div>
          </div>
        </section>

        {/* Three principles */}
        <section className="py-16 px-6" style={{ background: '#f5f5f5' }}>
          <div className="max-w-3xl mx-auto">
            <p
              style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#767676' }}
              className="uppercase font-bold mb-10 text-center"
            >
              Three principles
            </p>
            <div className="grid gap-8" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
              {[
                {
                  label: 'Practice before profile.',
                  body: 'You arrive as a practitioner, not a data subject. Identity emerges from what you do, not what you say about yourself.',
                },
                {
                  label: 'Private by default.',
                  body: 'Documentation flows to your validator circle — the people who actually know you. There is no public feed, no like button, no follower count.',
                },
                {
                  label: 'Recognition flows through others.',
                  body: 'The only path to leadership on Search Star is helping other people build genuine practices. You cannot perform your way to status.',
                },
              ].map((p) => (
                <div
                  key={p.label}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #d4d4d4',
                    borderRadius: '3px',
                    padding: '28px 24px',
                  }}
                >
                  <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '19px', fontWeight: 700, marginBottom: '10px' }}>
                    {p.label}
                  </p>
                  <p style={{ fontSize: '16px', color: '#5a5a5a', lineHeight: 1.6 }}>{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* The mechanic */}
        <section className="py-16 px-6" style={{ background: '#eef2f8', borderTop: '1px solid #d4d4d4', borderBottom: '1px solid #d4d4d4' }}>
          <div className="max-w-2xl mx-auto">
            <p
              style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#767676' }}
              className="uppercase font-bold mb-6 text-center"
            >
              The core loop
            </p>
            <ol style={{ fontSize: '17px', lineHeight: 1.7, paddingLeft: '24px' }}>
              {[
                'Declare a 90-day practice commitment.',
                'Share it with sponsors during a 14-day launch window.',
                'Perform the start ritual — the moment intention becomes action.',
                'Document sessions privately to your validator circle.',
                'Validators confirm genuine effort across 90 days.',
                'Sponsors pay out on completion.',
                'Your Trust record grows — a portable credential built from real practice.',
              ].map((step, i) => (
                <li key={i} style={{ marginBottom: '10px' }}>
                  <span style={{ color: '#1a3a6b', fontWeight: 700 }}>Step {i + 1}. </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 px-6 text-center" style={{ background: '#f5f5f5' }}>
          <div className="max-w-xl mx-auto">
            <h2
              style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '30px', fontWeight: 700, marginBottom: '12px' }}
            >
              Ready to begin?
            </h2>
            <p style={{ fontSize: '17px', color: '#5a5a5a', marginBottom: '28px' }}>
              Create an account and define your first practice in under two minutes.
              No feed. No followers. Just the work.
            </p>
            <Link
              href="/signup"
              style={{
                background: '#1a3a6b',
                color: '#ffffff',
                fontFamily: 'Roboto, sans-serif',
                fontSize: '13px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                padding: '14px 36px',
                borderRadius: '3px',
                textDecoration: 'none',
                textTransform: 'uppercase',
              }}
            >
              Create Account
            </Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  )
}
