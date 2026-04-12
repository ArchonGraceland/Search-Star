import PublicHeader from '@/components/public-header'
import PublicFooter from '@/components/public-footer'
import Link from 'next/link'

export default function OnboardingPage() {
  return (
    <>
      <PublicHeader />
      <main>
        <section style={{ background: '#1a3a6b', borderBottom: '3px solid #112a4f' }} className="py-16 px-6">
          <div className="max-w-2xl mx-auto text-center">
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '12px' }}>
              How It Works
            </p>
            <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', color: '#ffffff', lineHeight: 1.15, fontSize: '40px', fontWeight: 700, marginBottom: '16px' }}>
              Practice before profile.
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '18px' }}>
              You arrive as a practitioner. Identity emerges from what you do.
            </p>
          </div>
        </section>

        <section className="py-16 px-6" style={{ background: '#f5f5f5' }}>
          <div className="max-w-2xl mx-auto">
            {[
              {
                n: '01',
                title: 'Define your practice.',
                body: 'Name what you want to build — a skill, craft, or pursuit. Choose a category. This is the first thing you do on Search Star, before anything else.',
              },
              {
                n: '02',
                title: 'Invite your first validator.',
                body: 'A validator is someone who knows you well enough to vouch for your genuine effort. They witness your sessions and confirm the work is real.',
              },
              {
                n: '03',
                title: 'Set your visibility.',
                body: 'Private by default. Your practice record is visible only to your validator circle until you choose to share it — with a specific person, your network, or publicly.',
              },
              {
                n: '04',
                title: 'Declare a 90-day commitment.',
                body: 'The sponsorable unit of practice. Share it during the 14-day launch window. Perform the start ritual. Log sessions. Complete the streak. Sponsors pay out.',
              },
            ].map((step) => (
              <div
                key={step.n}
                style={{ display: 'flex', gap: '24px', marginBottom: '32px', background: '#ffffff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '28px' }}
              >
                <div style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', fontWeight: 700, color: '#1a3a6b', opacity: 0.5, letterSpacing: '0.05em', flexShrink: 0, paddingTop: '4px' }}>
                  {step.n}
                </div>
                <div>
                  <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>{step.title}</p>
                  <p style={{ fontSize: '16px', color: '#5a5a5a', lineHeight: 1.6 }}>{step.body}</p>
                </div>
              </div>
            ))}

            <div className="text-center mt-8">
              <Link
                href="/signup"
                style={{
                  background: '#1a3a6b', color: '#ffffff',
                  fontFamily: 'Roboto, sans-serif', fontSize: '13px', fontWeight: 700,
                  letterSpacing: '0.08em', padding: '14px 36px', borderRadius: '3px',
                  textDecoration: 'none', textTransform: 'uppercase',
                }}
              >
                Begin
              </Link>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  )
}
