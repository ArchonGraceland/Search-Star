import PublicHeader from '@/components/public-header'
import Link from 'next/link'

export const metadata = {
  title: 'How It Works — Search Star',
  description: 'The four presences of a Search Star commitment: the practitioner who does the work, the sponsors who hold the stake, the Companion who pays attention, and the institutions who read the record. The 90-day mechanic in full.',
}

export default function OnboardingPage() {
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
          backgroundPosition: 'center 60%',
          backgroundRepeat: 'no-repeat',
        }} className="py-32 px-6">
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(17,42,79,0.78) 0%, rgba(26,58,107,0.85) 100%)',
          }} />
          <div className="max-w-2xl mx-auto text-center" style={{ position: 'relative', zIndex: 1 }}>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '16px' }}>
              How It Works
            </p>
            <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', color: '#ffffff', lineHeight: 1.15, fontSize: 'clamp(34px, 5vw, 52px)', fontWeight: 700, marginBottom: '20px' }}>
              Practice before profile.
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: '18px', lineHeight: 1.65 }}>
              You arrive as a practitioner. Identity emerges from what you do. This page explains the system in full —
              the four presences that make up a commitment, the 90-day mechanic, how sponsors work, and what a Trust record means.
            </p>
          </div>
        </section>

        {/* ── Section 01: Why Search Star exists ── */}
        <section className="py-20 px-6" style={{ background: '#ffffff' }}>
          <div className="max-w-2xl mx-auto">
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#1a3a6b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '16px' }}>
              Section 01 — The Problem
            </p>
            <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '38px', fontWeight: 700, color: '#1a1a1a', marginBottom: '24px', lineHeight: 1.2 }}>
              Platforms reward performance, not formation.
            </h2>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75, marginBottom: '20px' }}>
              The social platforms are engagement loops: post something, get reactions, post again. That architecture rewards novelty, spectacle, and the aesthetic of discipline. It does not reward the long private work of actually getting better at anything. When you build your practice on a platform that rewards performance, you learn to optimize for the platform. The metric corrupts the thing being measured. You become a better performer of practice, not a better practitioner.
            </p>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75, marginBottom: '20px' }}>
              This pattern replicates across domains. The musician optimizes for clips rather than technique. The writer optimizes for threads rather than books. The athlete optimizes for photographs rather than strength. The investor optimizes for public conviction rather than actual research. In each case the incentive structure does its quiet work: the thing that looks like the practice starts to displace the practice itself.
            </p>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75 }}>
              Search Star is built on a different architecture — one where practice is private by default, witnessed by people who know you, and recognized only once the work is done. The rest of this page explains how. <Link href="/manifesto" style={{ color: '#1a3a6b', fontWeight: 600, textDecoration: 'underline', textDecorationColor: 'rgba(26,58,107,0.3)' }}>Read the full argument →</Link>
            </p>
          </div>
        </section>

        {/* ── Section 02: The Four Presences (intro) ── */}
        <section className="py-20 px-6" style={{ background: '#eef2f8' }}>
          <div className="max-w-2xl mx-auto">
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#1a3a6b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '16px' }}>
              Section 02 — The Architecture
            </p>
            <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '38px', fontWeight: 700, color: '#1a1a1a', marginBottom: '24px', lineHeight: 1.2 }}>
              Four presences. One commitment.
            </h2>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75, marginBottom: '20px' }}>
              Every 90-day practice commitment on Search Star involves four parties. Three are people; one is software. Each has a different role, and none can do the others&apos; job. The rest of this explainer walks through each in turn — what they do, what they don&apos;t do, and why the architecture holds together.
            </p>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75 }}>
              The order matters. The <strong>practitioner</strong> is the person who does the work. The <strong>sponsors</strong> are the people who put something behind their belief in that work. The <strong>Companion</strong> is the AI presence that walks alongside the practice day by day. The <strong>institutions</strong> are the schools, programs, and employers who read the Trust record that accumulates. Each role is kept narrow on purpose. Authority over what counts as real practice lives with the sponsors, and only with the sponsors.
            </p>
          </div>
        </section>

        {/* ── Section 03: The Practitioner ── */}
        <section className="py-20 px-6" style={{ background: '#ffffff' }}>
          <div className="max-w-2xl mx-auto">
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#1a3a6b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '16px' }}>
              Section 03 — The Practitioner
            </p>
            <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '38px', fontWeight: 700, color: '#1a1a1a', marginBottom: '24px', lineHeight: 1.2 }}>
              Does the work.
            </h2>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75, marginBottom: '20px' }}>
              The practitioner is the person at the center of the commitment — you, if you sign up. The first thing you do on Search Star is declare what you want to practice. A skill, a craft, a pursuit: something real you want to build over time. Everything else on the platform exists to support that work.
            </p>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75, marginBottom: '20px' }}>
              The atomic unit of the platform is the <strong>90-day commitment</strong>. A commitment is a declaration that you will practice a specific thing for 90 consecutive days, with a defined minimum session frequency, backed by people who know you. Why 90 days? Because it&apos;s long enough to show that something real is happening — that this isn&apos;t a burst of motivation that dissolves after three weeks — but short enough to be sponsorable. Two streaks fit in a year. That&apos;s the cadence: two serious, witnessed, sponsored periods of sustained practice, with space between them for reflection and recovery.
            </p>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75 }}>
              The 90-day streak doesn&apos;t begin the moment you declare it. First there&apos;s a launch period, and then a start ritual. Both are deliberate.
            </p>

            <div style={{ background: '#eef2f8', border: '1px solid #c8d4e8', borderRadius: '3px', padding: '28px 32px', marginTop: '32px' }}>
              <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1a3a6b', marginBottom: '12px' }}>
                The 14-Day Launch Period
              </p>
              <p style={{ fontSize: '15px', color: '#3a3a3a', lineHeight: 1.7 }}>
                When you declare a commitment, a 14-day window opens before the streak begins. This is when you share your commitment with people who know you — friends, family, colleagues, anyone in your network who wants to back you. They follow a link, enter their name and pledge amount, and commit to paying out if you complete the 90 days. Sponsors can continue to join mid-streak as well, but the launch period is the time to do the initial work of sharing. At the end of the launch window, you perform the start ritual and the streak begins.
              </p>
            </div>

            <div style={{ background: '#eef2f8', border: '1px solid #c8d4e8', borderRadius: '3px', padding: '28px 32px', marginTop: '16px' }}>
              <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1a3a6b', marginBottom: '12px' }}>
                The Start Ritual
              </p>
              <p style={{ fontSize: '15px', color: '#3a3a3a', lineHeight: 1.7 }}>
                The start ritual is a written statement of intent, timestamped. You write what you are committing to, what you expect the work to require, and what completing this streak will mean to you. This statement becomes the first post your sponsors see. It is the moment the 90-day clock begins. The ritual matters because it creates a clear before and after — an act of declaration that is visible to your sponsors and permanent in your record.
              </p>
            </div>

            <div style={{ background: '#eef2f8', border: '1px solid #c8d4e8', borderRadius: '3px', padding: '28px 32px', marginTop: '16px' }}>
              <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1a3a6b', marginBottom: '12px' }}>
                Logging Sessions
              </p>
              <p style={{ fontSize: '15px', color: '#3a3a3a', lineHeight: 1.7 }}>
                Each day you practice, you log a session: a short post visible only to your sponsors and your Companion. Text, photos, or voice-annotated video — you narrate what you&apos;re doing while filming it, and the transcript becomes part of the record. There is no public feed, no likes, no follower counts. The feed is a private channel between you and the people you brought in to witness.
              </p>
            </div>
          </div>
        </section>

        {/* ── Section 04: The Sponsor ── */}
        <section className="py-20 px-6" style={{ background: '#f5f5f5' }}>
          <div className="max-w-2xl mx-auto">
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#1a3a6b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '16px' }}>
              Section 04 — The Sponsor
            </p>
            <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '38px', fontWeight: 700, color: '#1a1a1a', marginBottom: '24px', lineHeight: 1.2 }}>
              Holds the stake.
            </h2>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75, marginBottom: '20px' }}>
              A sponsor is someone who puts something behind their belief in you. They pledge money against your 90-day commitment, and during those ninety days they have two options and only two: release the payment at day 90, or end the streak at any point with a veto. There is no partial credit, no negotiation, no arbitration body. Continued presence is the attestation.
            </p>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75, marginBottom: '20px' }}>
              This is a deliberate replacement for something simpler-sounding that didn&apos;t work. An earlier version of Search Star separated the sponsor role from a separate &ldquo;validator&rdquo; role — people who would confirm individual sessions for free. The separation collapsed on inspection. Asking a friend to confirm sessions, session by session, for ninety days, turns them into an evaluator and burdens the relationship with work that doesn&apos;t belong to friendship. Sponsors already do that work, and they do it more honestly because they have money on the line. One role, one form of attestation, no unreciprocated favors.
            </p>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75, marginBottom: '20px' }}>
              Any sponsor can veto at any time during the 90 days. One doubt, honestly held by one person who put money on the line, is enough to end a streak. That is the right default: it means you have to earn continued belief from every sponsor across the whole window, which is closer to what genuine character actually requires than a mechanical session count. Sponsors can also join mid-streak — once in, they&apos;re bound by the same veto-or-release mechanic as everyone else.
            </p>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75 }}>
              Sponsors don&apos;t need a Search Star account. They follow a link you send them, enter their name, email, and pledge amount, and pledge. They gain access to a private feed of your session posts for that commitment. The feed is not social — no likes, no strangers, no follower counts. It is a channel between you and the people you chose to bring in.
            </p>

            <div style={{ background: '#ffffff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '28px 32px', marginTop: '32px' }}>
              <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '19px', fontWeight: 700, color: '#1a1a1a', marginBottom: '10px' }}>
                If a sponsor leaves, the streak ends.
              </p>
              <p style={{ fontSize: '15px', color: '#3a3a3a', lineHeight: 1.7 }}>
                There is no substitution, no appeals process, no partial credit. If a sponsor vetoes, goes silent, or withdraws mid-streak for any reason, the streak ends and you restart from a new launch period with a new roster. The platform does not mediate sponsor relationships. Maintaining them across ninety days is part of the practice — arguably the most important part, because it&apos;s the part that&apos;s hardest to fake.
              </p>
            </div>

            <h3 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '24px', fontWeight: 700, color: '#1a1a1a', marginTop: '40px', marginBottom: '16px', lineHeight: 1.25 }}>
              The target payout and the sponsor mix.
            </h3>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75, marginBottom: '20px' }}>
              The target payout for a completed 90-day streak is <strong>$2,500</strong> — spread across however many sponsors the practitioner gathered. Some practitioners will hit that in five pledges. Some in twenty. Any dollar amount from a real person in your life counts: a grandmother&apos;s $5 signals as strongly as a senior engineer&apos;s $500. The credibility signal is the number of sponsors who stayed present through the 90 days, not the total dollars. The scale differs; the structure is identical.
            </p>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75 }}>
              Three kinds of sponsor can pledge, and the rules on how they combine are deliberate.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '24px' }}>
              {[
                { label: 'Personal', body: 'Friends, family, anyone who knows the practitioner and believes in them. Personal sponsors are the foundation — every commitment requires them.' },
                { label: 'Institutional', body: 'Schools, programs, or organizations sponsoring a practitioner in their community. Institutional pledges ride alongside personal sponsorship.' },
                { label: 'Brand', body: 'Companies whose products or mission align with the practitioner\u2019s area of practice. Brand sponsorship follows the same structural rules as institutional.' },
              ].map((type) => (
                <div key={type.label} style={{ background: '#ffffff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '24px' }}>
                  <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1a3a6b', marginBottom: '8px' }}>{type.label}</p>
                  <p style={{ fontSize: '14px', color: '#5a5a5a', lineHeight: 1.65 }}>{type.body}</p>
                </div>
              ))}
            </div>

            <div style={{ background: '#fffbeb', border: '1px solid #f3d8a8', borderRadius: '3px', padding: '28px 32px', marginTop: '24px' }}>
              <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#92400e', marginBottom: '12px' }}>
                Institutional sponsorship cannot stand alone
              </p>
              <p style={{ fontSize: '15px', color: '#3a3a3a', lineHeight: 1.7 }}>
                An institution — an employer, a foundation, a university — cannot be the sole sponsor of a commitment. Institutional pledges must ride alongside personal ones. A commitment backed only by an employer&apos;s wellness budget, with no friend or family member on the pledge list, does not qualify as a sponsored streak. The principle is that personal stake must precede institutional stake. Real people who know you have to believe in the work first. Institutional money joins that belief; it does not substitute for it.
              </p>
            </div>
          </div>
        </section>

        {/* ── Section 05: The Companion ── */}
        <section className="py-20 px-6" style={{ background: '#ffffff' }}>
          <div className="max-w-2xl mx-auto">
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#1a3a6b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '16px' }}>
              Section 05 — The Companion
            </p>
            <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '38px', fontWeight: 700, color: '#1a1a1a', marginBottom: '24px', lineHeight: 1.2 }}>
              Pays attention.
            </h2>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75, marginBottom: '20px' }}>
              An AI Companion is present in every commitment. It reads what you post, remembers what you said last session, asks the questions a good teacher would ask, and notices patterns you might miss. If you mentioned last Tuesday that your form was breaking down on the last two reps and the same thing happens again on Thursday, the Companion can ask about it. If you said you&apos;d revisit a chapter and you haven&apos;t, it can notice. Over ninety days of sessions, that kind of steady attention accumulates into something no single turn can convey.
            </p>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75, marginBottom: '20px' }}>
              The Companion is the teacher and the daily accompaniment. At day 90 it also produces a summary for your sponsors — a reading aid that helps them see the arc of the work as they decide whether to release their pledges. The summary is descriptive, not evaluative. It describes what happened; it does not declare whether the commitment succeeded.
            </p>

            <div style={{ background: '#fef2f2', border: '1px solid #f3c4c4', borderRadius: '3px', padding: '28px 32px', marginTop: '24px' }}>
              <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#991b1b', marginBottom: '12px' }}>
                What the Companion does not do
              </p>
              <p style={{ fontSize: '15px', color: '#3a3a3a', lineHeight: 1.7 }}>
                The Companion does not grade your work, score your form, critique your technique from video, or cast a vote on whether your streak should complete. It holds <strong>no authority over the Trust record.</strong> Attestation belongs entirely to the sponsors who put money on the line. An AI that produced authoritative-sounding verdicts on the quality of someone&apos;s squats or the correctness of their joinery would corrode the whole model. The Companion&apos;s value comes from being a different kind of presence entirely — the one who has been watching and remembering, not the one who evaluates.
              </p>
            </div>

            <h3 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '24px', fontWeight: 700, color: '#1a1a1a', marginTop: '40px', marginBottom: '16px', lineHeight: 1.25 }}>
              Voice-annotated video for visual practices.
            </h3>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75, marginBottom: '20px' }}>
              For practices where video is the natural medium — gym training, woodworking, cooking, instrument practice, running form, any physical craft — the default documentation pattern is <strong>voice-annotated video</strong>. You narrate what you&apos;re doing while filming it. The audio is transcribed, and your own description becomes the record the Companion reads.
            </p>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75 }}>
              A gym example: &ldquo;Squat, 8 at 225, last two reps felt heavy, my knee tracked okay&rdquo; said into the camera mid-set is richer, more accurate data than any vision model could extract from foreshortened phone-camera footage. It plays to what language models are good at — making sense of natural-language descriptions accumulated over many sessions — and sidesteps what they&apos;re bad at: estimating load from camera angles, counting reps across jump cuts, or offering form critique that would be either too vague to be useful or too confident to be honest. A running commentary of your own work, thirty seconds a day for ninety days, produces a dataset the Companion can engage with meaningfully, and that a sponsor can read at day 90 to see the arc of the work.
            </p>
          </div>
        </section>

        {/* ── Section 06: The Institution ── */}
        <section className="py-20 px-6" style={{ background: '#f5f5f5' }}>
          <div className="max-w-2xl mx-auto">
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#1a3a6b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '16px' }}>
              Section 06 — The Institution
            </p>
            <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '38px', fontWeight: 700, color: '#1a1a1a', marginBottom: '24px', lineHeight: 1.2 }}>
              Reads the record.
            </h2>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75, marginBottom: '20px' }}>
              Schools, programs, and employers that want to evaluate genuine formation rather than self-reported credentials can read a practitioner&apos;s Trust record with their consent. The record is a third-party-attested ledger of sustained practice, backed by sponsors who stayed present through the work. It is hard to manufacture and impossible to fake. A resume can embellish; a Trust record cannot, because the signal comes from people outside the practitioner who put money behind their confidence and kept it there for ninety days at a time.
            </p>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75, marginBottom: '20px' }}>
              Institutions read. They do not rate. The Trust record surfaces what happened; the institution draws its own conclusions about what that means for an admissions decision, a hiring decision, a scholarship allocation. The platform doesn&apos;t assert that a given Trust stage corresponds to a given level of qualification — only that the record is what it says it is.
            </p>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75 }}>
              Institutions can also be sponsors, subject to the rule above: institutional sponsorship must ride alongside personal sponsorship. An employer supporting an employee&apos;s professional development practice, a foundation backing a grantee&apos;s reading cohort, a trade program sponsoring its apprentices — all welcome, all structurally required to come in alongside the practitioner&apos;s personal roster rather than instead of it.
            </p>
          </div>
        </section>

        {/* ── Section 07: Voluntary Contribution ── */}
        <section className="py-20 px-6" style={{ background: '#ffffff' }}>
          <div className="max-w-2xl mx-auto">
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#1a3a6b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '16px' }}>
              Section 07 — The Business Model
            </p>
            <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '38px', fontWeight: 700, color: '#1a1a1a', marginBottom: '24px', lineHeight: 1.2 }}>
              The voluntary contribution.
            </h2>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75, marginBottom: '20px' }}>
              When a streak completes and sponsors release their pledges, the practitioner receives the full pledged amount. Nothing is deducted from the payout. Separately, each sponsor is offered an optional 5% contribution to Search Star — prompted once, at the moment of release, removable in a single click. There is no pressure, no dark pattern, no penalty for declining.
            </p>
            <p style={{ fontSize: '17px', color: '#3a3a3a', lineHeight: 1.75, marginBottom: '28px' }}>
              This is the whole business model. No subscriptions, no paid tiers, no ad revenue, no data sales. The contribution is how the platform is funded — at a rate that covers operations and Companion inference without turning the product into something that needs to extract value from practitioners to survive. If voluntary contributions at 5% don&apos;t sustain the platform at scale, that&apos;s a signal the platform isn&apos;t providing enough value, and the answer is to be more valuable — not to add mandatory fees.
            </p>

            <div style={{ background: '#1a3a6b', borderRadius: '3px', padding: '32px' }}>
              <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: '16px' }}>
                Where the contribution goes
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>Search Star</span>
                  <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginLeft: '10px' }}>Platform operations</span>
                </div>
                <span style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '24px', fontWeight: 700, color: '#ffffff' }}>5%</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 08: Trust Record ── */}
        <section className="py-20 px-6" style={{ background: '#eef2f8' }}>
          <div className="max-w-2xl mx-auto">
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#1a3a6b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '16px' }}>
              Section 08 — The Trust Record
            </p>
            <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '38px', fontWeight: 700, color: '#1a1a1a', marginBottom: '24px', lineHeight: 1.2 }}>
              A credential you can&apos;t perform into existence.
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
                  body: 'The volume and quality of your sponsored practice within a category. Depth grows with completed sponsored streaks, weighted by the count and diversity of sponsors who stayed present through each one. A high-depth practitioner has shown up repeatedly and had their work witnessed by sponsors who released their pledges at day 90.',
                },
                {
                  dim: 'Breadth',
                  body: 'The range of practices you\u2019ve committed to, measured by distinct skill categories across completed sponsored streaks. A practitioner with breadth has proven their formation extends across multiple domains — not just a single skill pursued once, but a demonstrated pattern of commitment to growth in different areas over time.',
                },
                {
                  dim: 'Durability',
                  body: 'The age and continuity of your track record — the oldest unbroken pattern of completed sponsored streaks. Durability is the dimension that can\u2019t be rushed. A practitioner with a two-year record has something that a practitioner with a two-month record simply doesn\u2019t, regardless of the intensity of recent work. Time is the irreducible variable.',
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
    </>
  )
}
