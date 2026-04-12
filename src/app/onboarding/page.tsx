import PublicHeader from '@/components/public-header'
import PublicFooter from '@/components/public-footer'
import Link from 'next/link'

export const metadata = {
  title: 'How It Works — Search Star',
  description: 'The 90-day commitment, the validator circle, the sponsorship model, the Trust record. How Search Star actually works.',
}

export default function OnboardingPage() {
  return (
    <>
      <PublicHeader />
      <main>

        {/* ── Hero ── */}
        <section style={{ background: '#1a3a6b', borderBottom: '3px solid #112a4f' }} className="py-20 px-6">
          <div className="max-w-2xl mx-auto text-center">
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '16px' }}>
              How It Works
            </p>
            <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', color: '#ffffff', lineHeight: 1.15, fontSize: '48px', fontWeight: 700, marginBottom: '20px' }}>
              Practice before profile.
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '18px', lineHeight: 1.65 }}>
              You arrive as a practitioner. Identity emerges from what you do.
              This page explains the system in full — what a commitment is, how validators work,
              why sponsors pay out, and what a Trust record means.
            </p>
          </div>
        </section>

        {/* ── The 90-Day Commitment ── */}
        <section className="py-20 px-6" style={{ background: '#f5f5f5' }}>
          <div className="max-w-2xl mx-auto">
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#1a3a6b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '16px' }}>
              Section 01
            </p>
            <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '38px', fontWeight: 700, color: '#1a1a1a', marginBottom: '24px', lineHeight: 1.2 }}>
              The 90-day commitment.
            </h2>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75, marginBottom: '20px' }}>
              The commitment is the atomic unit of Search Star. Everything else — validators, sponsors, Trust records, mentor income — is built around it. A commitment is a declaration that you will practice a specific thing for 90 consecutive days, with a defined minimum session frequency, confirmed by people who know you.
            </p>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75, marginBottom: '20px' }}>
              Why 90 days? Because it's long enough to show that something real is happening — that this isn't a burst of motivation that dissolves after three weeks — but short enough to be sponsorable. Two streaks fit in a year. That's the cadence: two serious, witnessed, sponsored periods of sustained practice, with space between them for reflection and recovery.
            </p>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75 }}>
              The 90-day streak doesn't begin immediately. First there's the launch period.
            </p>

            <div style={{ background: '#eef2f8', border: '1px solid #c8d4e8', borderRadius: '3px', padding: '28px 32px', marginTop: '32px' }}>
              <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1a3a6b', marginBottom: '12px' }}>
                The 14-Day Launch Period
              </p>
              <p style={{ fontSize: '15px', color: '#3a3a3a', lineHeight: 1.7 }}>
                When you declare a commitment, a 14-day window opens before the streak begins. This is the period when sponsors can pledge. You share your commitment with people who know you — friends, family, colleagues, anyone in your network who wants to back you. They follow a link, enter their name and pledge amount, and commit to paying out if you complete the 90 days. At the end of the launch window, the window closes, and no new sponsors can join. You then perform the start ritual.
              </p>
            </div>

            <div style={{ background: '#eef2f8', border: '1px solid #c8d4e8', borderRadius: '3px', padding: '28px 32px', marginTop: '16px' }}>
              <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1a3a6b', marginBottom: '12px' }}>
                The Start Ritual
              </p>
              <p style={{ fontSize: '15px', color: '#3a3a3a', lineHeight: 1.7 }}>
                The start ritual is a written statement of intent, timestamped. You write what you are committing to, what you expect the work to require, and what completing this streak will mean to you. This statement becomes the first post in your validator feed. It is the moment the 90-day clock begins. The ritual matters because it creates a clear before and after — an act of declaration that is public to your validator circle and permanent in your record.
              </p>
            </div>
          </div>
        </section>

        {/* ── Validators ── */}
        <section className="py-20 px-6" style={{ background: '#ffffff' }}>
          <div className="max-w-2xl mx-auto">
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#1a3a6b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '16px' }}>
              Section 02
            </p>
            <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '38px', fontWeight: 700, color: '#1a1a1a', marginBottom: '24px', lineHeight: 1.2 }}>
              The validator relationship.
            </h2>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75, marginBottom: '20px' }}>
              A validator is someone who knows you well enough to verify that your sessions are real. Not to grade your work, not to judge your progress — to confirm that you showed up, did the thing, and the effort was genuine. Validators are invited, not discovered. You choose them, they accept, and they gain access to a private feed of your session posts for that commitment.
            </p>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75, marginBottom: '20px' }}>
              After each session, you log a post to your validator feed: what you worked on, how the session went, any evidence. Validators can confirm the session with a quality note — a brief qualitative attestation. Confirmed sessions accumulate into your Trust record's depth score. Unconfirmed sessions still count toward the streak, but confirmed sessions carry more weight.
            </p>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75 }}>
              The validator feed is not a social feed. There are no likes, no comments from strangers, no follower counts. It is a private channel between you and the people you invited. The only people who can see it are the validators you chose.
            </p>

            <div style={{ background: '#f5f5f5', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '28px 32px', marginTop: '32px' }}>
              <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '19px', fontWeight: 700, color: '#1a1a1a', marginBottom: '10px' }}>
                Why their attestation matters.
              </p>
              <p style={{ fontSize: '15px', color: '#3a3a3a', lineHeight: 1.7 }}>
                The validator confirmation is a social act, not a technical one. When a validator confirms your session, they are staking their own credibility — their relationship with you, their reputation in the system — on the claim that your work was real. This is different from an automated check. It is a person saying: I know this individual, I have seen this work, and I am willing to confirm it. The weight of the attestation comes from the relationship, not the algorithm.
              </p>
            </div>
          </div>
        </section>

        {/* ── Sponsorship ── */}
        <section className="py-20 px-6" style={{ background: '#eef2f8' }}>
          <div className="max-w-2xl mx-auto">
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#1a3a6b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '16px' }}>
              Section 03
            </p>
            <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '38px', fontWeight: 700, color: '#1a1a1a', marginBottom: '24px', lineHeight: 1.2 }}>
              The sponsorship model.
            </h2>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75, marginBottom: '20px' }}>
              Sponsoring on Search Star is a wager on a person. During the 14-day launch period, sponsors pledge an amount against the practitioner's completion of the 90-day streak. If the practitioner completes the streak — confirmed by validators, with sessions logged — the pledge pays out. If not, nothing is charged.
            </p>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75, marginBottom: '20px' }}>
              Sponsors don't need a Search Star account. They follow a link, enter their name, email, and pledge amount, and pledge. They receive updates during the streak. When the streak completes, they're notified and charged. The target payout per streak is $2,500 — spread across however many sponsors the practitioner has gathered during launch. Some practitioners will gather that in five pledges. Some in twenty. The launch period is the time to do the work of sharing.
            </p>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75 }}>
              Institutional and brand sponsors follow the same model, with additional context provided at pledge. The type of sponsor is noted in the record but doesn't change the mechanics.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '32px' }}>
              {[
                { label: 'Personal', body: 'Friends, family, anyone who knows the practitioner and believes in them.' },
                { label: 'Institutional', body: 'Schools, programs, or organizations sponsoring a practitioner in their community.' },
                { label: 'Brand', body: 'Companies whose products or mission align with the practitioner\'s area of practice.' },
              ].map((type) => (
                <div key={type.label} style={{ background: '#ffffff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '24px' }}>
                  <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1a3a6b', marginBottom: '8px' }}>{type.label}</p>
                  <p style={{ fontSize: '14px', color: '#5a5a5a', lineHeight: 1.65 }}>{type.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Voluntary Contribution ── */}
        <section className="py-20 px-6" style={{ background: '#ffffff' }}>
          <div className="max-w-2xl mx-auto">
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#1a3a6b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '16px' }}>
              Section 04
            </p>
            <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '38px', fontWeight: 700, color: '#1a1a1a', marginBottom: '24px', lineHeight: 1.2 }}>
              The voluntary contribution.
            </h2>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75, marginBottom: '20px' }}>
              When a streak pays out, Search Star presents a voluntary contribution prompt. The suggested contribution is 50% of the payout — but it is genuinely optional. You can reduce it to any amount, or remove it entirely with a single click. There is no pressure, no dark pattern, no penalty for removing it.
            </p>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75, marginBottom: '28px' }}>
              Roughly 90% of practitioners contribute at the suggested rate. That number comes from opt-in behavior, not obligation — which is why it means something.
            </p>

            <div style={{ background: '#1a3a6b', borderRadius: '3px', padding: '32px' }}>
              <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: '16px' }}>
                How the contribution splits
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { role: 'Search Star', pct: '5%', note: 'Platform operations' },
                  { role: 'Mentor', pct: '23.75%', note: 'Your direct mentor' },
                  { role: 'Coach Pool', pct: '23.75%', note: 'Coaches in your practice area' },
                  { role: 'Community Builder Pool', pct: '23.75%', note: 'Community builders in your area' },
                  { role: 'Practice Leader Pool', pct: '23.75%', note: 'Practice leaders in your category' },
                ].map((row) => (
                  <div key={row.role} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                    <div>
                      <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>{row.role}</span>
                      <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginLeft: '10px' }}>{row.note}</span>
                    </div>
                    <span style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#ffffff' }}>{row.pct}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Trust Record ── */}
        <section className="py-20 px-6" style={{ background: '#eef2f8' }}>
          <div className="max-w-2xl mx-auto">
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#1a3a6b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '16px' }}>
              Section 05
            </p>
            <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '38px', fontWeight: 700, color: '#1a1a1a', marginBottom: '24px', lineHeight: 1.2 }}>
              The Trust record.
            </h2>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75, marginBottom: '20px' }}>
              Your Trust record is the cumulative output of everything you do on Search Star. It is not a score. It does not appear as a number. It is expressed as a growth stage — one of five positions on a continuum from Seedling to Mature — that describes where you are in your formation as a practitioner.
            </p>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75, marginBottom: '32px' }}>
              The record is built from three dimensions:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
              {[
                {
                  dim: 'Depth',
                  body: 'The quality and volume of your validated sessions across all commitments. Depth is the product of how many sessions you\'ve logged and how consistently validators have confirmed them. A high-depth practitioner has shown up repeatedly, had their work witnessed, and earned genuine attestation from their circle.',
                },
                {
                  dim: 'Breadth',
                  body: 'The range of practices you\'ve committed to, measured by distinct categories. A practitioner with breadth has proven their formation extends across multiple domains — not just a single skill pursued once, but a demonstrated pattern of commitment to growth in different areas over time.',
                },
                {
                  dim: 'Durability',
                  body: 'The age and continuity of your track record. Durability is the dimension that can\'t be rushed. A practitioner with a two-year record of validated commitments has something that a practitioner with a two-month record simply doesn\'t, regardless of the intensity of the recent work. Time is the irreducible variable.',
                },
              ].map((d) => (
                <div key={d.dim} style={{ background: '#ffffff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '28px 32px' }}>
                  <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1a3a6b', marginBottom: '10px' }}>{d.dim}</p>
                  <p style={{ fontSize: '15px', color: '#3a3a3a', lineHeight: 1.7 }}>{d.body}</p>
                </div>
              ))}
            </div>

            <div style={{ background: '#1a3a6b', borderRadius: '3px', padding: '32px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '20px' }}>
                Growth stages
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '20px', marginBottom: '24px' }}>
                {[
                  { stage: 'Seedling', desc: 'First commitment declared' },
                  { stage: 'Rooting', desc: 'First streak completed' },
                  { stage: 'Growing', desc: 'Multiple streaks, growing breadth' },
                  { stage: 'Established', desc: 'Sustained practice across domains' },
                  { stage: 'Mature', desc: 'Deep record, years of duration' },
                ].map((s) => (
                  <div key={s.stage} style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>{s.stage}</div>
                    <div style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{s.desc}</div>
                  </div>
                ))}
              </div>
              <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '18px', fontStyle: 'italic', color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
                &ldquo;The only way to advance your Trust is to actually be the kind of person your Trust record describes.
                Gaming the metric produces the virtue.&rdquo;
              </p>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="py-20 px-6" style={{ background: '#1a3a6b' }}>
          <div className="max-w-xl mx-auto text-center">
            <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '40px', fontWeight: 700, color: '#ffffff', marginBottom: '16px', lineHeight: 1.2 }}>
              Understood the system. Ready to begin.
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '17px', marginBottom: '32px', lineHeight: 1.65 }}>
              Your first step is naming your practice. Everything else follows from that.
            </p>
            <Link
              href="/signup"
              style={{ background: '#ffffff', color: '#1a3a6b', fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', padding: '15px 40px', borderRadius: '3px', textDecoration: 'none', textTransform: 'uppercase', display: 'inline-block' }}
            >
              Start Practicing
            </Link>
          </div>
        </section>

      </main>
      <PublicFooter />
    </>
  )
}
