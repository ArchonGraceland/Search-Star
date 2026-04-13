import PublicHeader from '@/components/public-header'
import PublicFooter from '@/components/public-footer'
import Link from 'next/link'

export const metadata = {
  title: 'Why Search Star Exists — Manifesto',
  description: 'The philosophical case for Search Star: formation vs. performance, conscientiousness as signal, and trust as action.',
}

export default function ManifestoPage() {
  return (
    <>
      <PublicHeader />
      <main>

        {/* ── Hero ── */}
        <section style={{
          position: 'relative',
          borderBottom: '3px solid #112a4f',
          backgroundImage: 'url(/images/hero/manifesto-01-rowers.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 40%',
          backgroundRepeat: 'no-repeat',
        }} className="py-36 px-6">
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(10,25,50,0.82) 0%, rgba(17,42,79,0.88) 100%)',
          }} />
          <div className="max-w-2xl mx-auto text-center" style={{ position: 'relative', zIndex: 1 }}>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '16px' }}>
              Manifesto
            </p>
            <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', color: '#ffffff', lineHeight: 1.1, fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 700, marginBottom: '20px' }}>
              Why Search Star Exists
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '18px', lineHeight: 1.65 }}>
              The philosophical case. Garbage culture, formation, conscientiousness, and what trust actually is.
            </p>
          </div>
        </section>

        {/* ── Part I: The Garbage Culture Problem ── */}
        <section className="py-20 px-6" style={{ background: '#ffffff' }}>
          <div className="max-w-2xl mx-auto">
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#1a3a6b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '16px' }}>
              I.
            </p>
            <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '40px', fontWeight: 700, color: '#1a1a1a', marginBottom: '28px', lineHeight: 1.15 }}>
              The Garbage Culture Problem
            </h2>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.8, marginBottom: '22px' }}>
              We live in an era of unprecedented access to instruction. You can find a world-class tutorial on almost any skill within five minutes. The bottleneck is no longer information. It is formation — the long, private, unglamorous process of actually becoming someone who can do something well.
            </p>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.8, marginBottom: '22px' }}>
              The platforms we've built our social lives around are not neutral with respect to formation. They are actively hostile to it. Their core mechanic — post something, receive feedback, post again — is an engagement loop, not a growth loop. Engagement loops optimize for the things that generate reactions: novelty, controversy, spectacle, emotional extremity. Formation optimizes for the things that build skill and character: repetition, patience, private practice, willingness to be bad at something for a long time before you're good at it.
            </p>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.8, marginBottom: '22px' }}>
              These are not compatible architectures. When you build your practice on a platform that rewards performance over formation, you eventually learn to optimize for the platform. The metric corrupts the thing being measured. You become not a better practitioner but a better performer of practice.
            </p>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.8 }}>
              This is what we mean by garbage culture: a culture where the dominant media environment systematically rewards the appearance of virtue over its substance, the aesthetic of discipline over its practice, the signal of growth over growth itself. The problem isn't that platforms are evil. The problem is that their incentive structures are pointed in the wrong direction, and over time, the people living inside those incentive structures learn to follow them.
            </p>
          </div>
        </section>

        {/* ── Part II: Formation vs. Performance ── */}
        <section className="py-20 px-6" style={{ background: '#eef2f8' }}>
          <div className="max-w-2xl mx-auto">
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#1a3a6b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '16px' }}>
              II.
            </p>
            <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '40px', fontWeight: 700, color: '#1a1a1a', marginBottom: '28px', lineHeight: 1.15 }}>
              Formation vs. Performance
            </h2>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.8, marginBottom: '22px' }}>
              Instagram fitness culture is the clearest illustration of the failure mode. The metric is how your body looks in a photo. Not whether you can deadlift your bodyweight. Not whether you can run a 5K without stopping. Not whether your resting heart rate has come down, or your bone density has improved, or your flexibility has increased, or your sleep has gotten better. These things are invisible on the platform. What is visible is the photograph.
            </p>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.8, marginBottom: '22px' }}>
              So practitioners optimize for the photograph. They learn the lighting, the angles, the timing, the editing. They learn which poses show leanness most favorably. They time their carbohydrate intake to look best at a specific hour of the specific day they plan to shoot. This is not fitness. It is photography skill. But the platform can't tell the difference, and over time neither can the practitioner.
            </p>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.8, marginBottom: '22px' }}>
              This pattern replicates across every domain the platforms touch. The musician who optimizes for clips rather than technique. The writer who optimizes for threads rather than books. The artist who optimizes for the aesthetic of process rather than its depth. The investor who optimizes for public conviction rather than actual research.
            </p>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.8 }}>
              Formation is different from performance in a specific and irreducible way: it happens whether or not anyone is watching. Practice that requires an audience is performance. Practice that happens alone, in private, because you have committed to it — that is formation. The architecture has to be built to support the thing that doesn't need an audience, because that thing is what is actually valuable.
            </p>

            <div style={{ borderLeft: '3px solid #1a3a6b', paddingLeft: '28px', marginTop: '36px' }}>
              <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '22px', fontStyle: 'italic', color: '#1a1a1a', lineHeight: 1.5 }}>
                Practice that requires an audience is performance. Practice that happens alone, in private, because you have committed to it — that is formation.
              </p>
            </div>
          </div>
        </section>

        {/* ── Part III: Conscientiousness as Signal ── */}
        <section className="py-20 px-6" style={{ background: '#ffffff' }}>
          <div className="max-w-2xl mx-auto">
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#1a3a6b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '16px' }}>
              III.
            </p>
            <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '40px', fontWeight: 700, color: '#1a1a1a', marginBottom: '28px', lineHeight: 1.15 }}>
              Conscientiousness as Signal
            </h2>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.8, marginBottom: '22px' }}>
              The personality research is consistent across decades and cultures: conscientiousness is the strongest Big Five predictor of long-term life outcomes. More than openness, more than extraversion, more than agreeableness or emotional stability. The conscientious person — organized, persistent, reliable, self-disciplined — performs better across a wide range of domains: career outcomes, health outcomes, relationship stability, civic participation.
            </p>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.8, marginBottom: '22px' }}>
              The problem is that conscientiousness is nearly impossible to verify from the outside. You can tell someone you are disciplined. You can post about your morning routine. You can describe your systems, your habits, your track record. None of this is evidence. It is testimony — and testimony about your own virtues is the weakest possible form of evidence, because the people with the least of a virtue are often the most eager to claim it.
            </p>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.8, marginBottom: '22px' }}>
              What would it look like to actually verify conscientiousness? It would look like a record of repeated behavior, over time, confirmed by people with stakes in the accuracy of their confirmation, in a context where the behavior had real costs — time, effort, the risk of public failure.
            </p>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.8 }}>
              That is a description of what Search Star is trying to build. Not a self-report. Not a credential from an institution that has an incentive to credential everyone who pays them. A record of action, confirmed by witnesses, over time. The Trust record is an attempt to make the most important and least visible human quality into something that can be seen.
            </p>
          </div>
        </section>

        {/* ── Part IV: Trust as Action ── */}
        <section className="py-20 px-6" style={{ background: '#eef2f8' }}>
          <div className="max-w-2xl mx-auto">
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#1a3a6b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '16px' }}>
              IV.
            </p>
            <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '40px', fontWeight: 700, color: '#1a1a1a', marginBottom: '28px', lineHeight: 1.15 }}>
              Trust as Action
            </h2>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.8, marginBottom: '22px' }}>
              Trust, in the Search Star model, is not a feeling. It is not a vibe or an impression or a gut read. It is an act. When a validator confirms a session, they are performing an act of trust — staking their own credibility on the claim that the work was real. When a sponsor pledges money against a commitment, they are performing an act of trust — putting skin in the game on their belief in the practitioner. When a mentor takes on a mentee, their contribution income is tied to that mentee's success — which means their financial incentive is aligned with genuine formation, not with flattery or retention.
            </p>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.8, marginBottom: '22px' }}>
              This is vouching with stakes. The validator who confirms a session has put their relationship and their reputation on the line. The sponsor who pledges has put money on the line. These are not costless gestures. They are commitments. And the accumulation of those commitments, over time, is what a Trust record actually is: a ledger of people who were willing to stake something on their belief in you.
            </p>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.8 }}>
              The convergence principle, which is the philosophical core of the whole system, is this: because the Trust record can only be built through actual behavior confirmed by people with stakes, the only reliable strategy for building a good Trust record is to actually be the kind of person it describes. You cannot optimize your way into a Mature Trust stage. You can only practice your way there. Which means that as the system grows, the people at the highest trust stages will, reliably, be the people who have done the most actual work over the most actual time, confirmed by the most actual witnesses.
            </p>
          </div>
        </section>

        {/* ── Convergence Callout ── */}
        <section className="py-20 px-6" style={{ background: '#1a3a6b' }}>
          <div className="max-w-2xl mx-auto text-center">
            <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '32px', fontStyle: 'italic', color: '#ffffff', lineHeight: 1.5, marginBottom: '32px' }}>
              &ldquo;The only way to advance your Trust is to actually be the kind of person your Trust record describes. Gaming the metric produces the virtue.&rdquo;
            </p>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: '40px' }}>
              The Convergence Principle — Search Star Spec v3.0, §2.4
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link
                href="/signup"
                style={{ background: '#ffffff', color: '#1a3a6b', fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', padding: '14px 32px', borderRadius: '3px', textDecoration: 'none', textTransform: 'uppercase' }}
              >
                Start Practicing
              </Link>
              <Link
                href="/spec"
                style={{ border: '1px solid rgba(255,255,255,0.35)', color: 'rgba(255,255,255,0.85)', fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', padding: '14px 32px', borderRadius: '3px', textDecoration: 'none', textTransform: 'uppercase' }}
              >
                Read the Spec
              </Link>
            </div>
          </div>
        </section>

      </main>
      <PublicFooter />
    </>
  )
}
