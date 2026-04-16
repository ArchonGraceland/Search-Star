# Search Star v4 — Decisions

*Source document for the v4.0 spec rewrite and every subsequent v4 coding session.*
*Written April 2026 following the Tom conversation.*

---

## Why this change was needed

The v3 spec separates two roles: the **sponsor**, who puts money behind a practitioner's 90-day commitment, and the **validator**, a trusted person invited to witness and confirm sessions. On paper these were distinct and complementary. In practice they collapse — and the collapse matters.

The realization surfaced in a conversation with Tom, a friend of fifty years. Asking Tom to be a sponsor feels natural: it is reciprocal, proportional to the relationship, and something friends do for each other without strain. Asking Tom to be a validator feels like the wrong ask. It turns a friend into an evaluator. It places them in judgment of the practitioner's effort, week after week for ninety days, in a role that doesn't belong to friendship and that most friends don't actually want.

The deeper problem: **the validator role asks friends to do the work money is supposed to do.** A validator is being asked to stake their reputation on the practitioner's conscientiousness, session by session, for free. That is what a sponsor does — and what they do naturally when they've put money behind the commitment. Splitting the roles introduces an unreciprocated burden on the friend and duplicates a function money already performs cleanly.

From the v3 spec, the load-bearing language now being retired:

> "Trust in the Search Star model is not a rating or a status. It is an action: the willingness to stake one's own reputation on someone else's claim. When a validator confirms a practice session, they are not clicking a button — they are putting their name behind a statement about another person's character and genuine effort."

> "Validators are people who know the practitioner in real life — friends, family members, coaches, collaborators, teachers. They are the witnesses to genuine practice. Without them the Trust Record means nothing; with them it means everything, because their attestation carries the weight of real relationship and real knowledge."

The instinct behind these passages is correct. The mistake was assigning that weight to a separate validator role rather than recognizing that the sponsor already carries it — and carries it more honestly, because they have put something real on the line.

---

## The structural decisions

### 1. The validator role is retired entirely

Not renamed. Not folded in. Gone.

Sponsors are the witnesses. The only people with standing to assess whether a 90-day commitment was real are the people who put money behind it. Their continued confidence through the 90 days is the attestation. The separate validator invitation, the validator feed, the token-based validator URL, the quality-note-on-confirmation flow — all of it is retired.

This means the v3 terminology "validator," "validator circle," "validator feed," "validation" no longer exists in v4. The sponsor replaces all of them. The session feed becomes the sponsor feed. Where the v3 spec says "validated practice," v4 says "sponsored practice." Where v3 says "validator confirmation," v4 says "sponsor payment release."

### 2. AI becomes a Practice Companion — present in every commitment, without authority

Search Star introduces an AI Companion alongside the two human roles. Its purpose is twofold:

- **Accompany the practitioner through formation.** Ask questions a good teacher would ask, notice patterns across sessions, help with documentation when the practitioner wants help, reflect on progress. This is the daily presence. The Companion is the teacher, the coach, and the one who is actually watching the work develop.
- **Help sponsors assess at day 90.** When a commitment reaches completion, the Companion produces a summary of the practice record — what was done, how it developed, where the effort showed. Sponsors use this to decide whether to release payment. The summary is a reading aid, not a verdict.

The Companion holds **no authority over the Trust Record.** It cannot confirm practice, advance a Trust Stage, or determine completion. Its role is descriptive and supportive. All consequential attestation flows through sponsors.

The Companion is one of potentially several AI surfaces the platform will expose over time — future surfaces might address specific needs like domain tutoring, commitment framing help, or sponsor onboarding. These are all AI, all without authority over the Trust Record, and all subordinate to the two human roles. When the spec or product copy refers to "the AI" it means whichever surface is relevant to that moment; "the Companion" is the name for the default, practitioner-facing surface.

Deferred for later resolution:

- Naming (Companion vs. other options)
- Memory architecture: what does the Companion remember across sessions, across commitments, across years
- Exact format and prompting of the day-90 sponsor summary
- Whether and how the Companion surfaces to sponsors during the 90 days versus only at completion
- What other AI surfaces exist alongside the Companion, and when each is active

### 3. Any single sponsor can veto a streak at any time

Streak completion requires **unanimous continued confidence from every sponsor who has pledged.** One sponsor vetoing ends the streak. There is no majority rule, no weighted voting, no arbitration body, no appeals process, no partial credit.

A sponsor expresses continued confidence passively — by staying present and releasing payment at day 90. A sponsor expresses veto actively — one button, at any point during the 90 days. Both actions are final in their respective directions: a released payment cannot be un-released, a veto cannot be un-vetoed.

**Sponsors can join a commitment at any time during the 90 days — not only during the launch period.** The launch period is the runway for the initial roster; after the start ritual, additional sponsors can still be invited and pledge. But **once a sponsor is in, they are in** — bound by the same veto-or-release mechanic as everyone else. A sponsor who pledges on day 40 is in for the remaining fifty days, and their veto on day 41 ends the streak exactly as if they had pledged on day 1. This is the right asymmetry: adding belief mid-stream is welcome; losing belief mid-stream is final.

**Sponsors are invited only by the practitioner or via the practitioner's sponsor link.** There is no public directory of commitments needing sponsorship. There is no sponsor-side discovery surface where someone could browse practitioners to back. The practitioner owns the invitation entirely — they either email someone directly through the platform, or they share a link the platform generated for them. A sponsor who arrives via either path is someone the practitioner chose to bring in. This keeps the peer-sponsorship model honest and forecloses an entire category of attention-seeking behavior that a sponsor marketplace would produce.

This is deliberately asymmetric in favor of veto. A single doubt, honestly held by one person who put money on the line, is enough to end a streak. That is the right default. It means the practitioner must earn continued belief from every sponsor across the whole window, which is much closer to what genuine character actually requires than a mechanical session-count threshold.

### 4. Institutional sponsorship cannot stand alone

An institution — an employer, a foundation, a university — cannot be the sole sponsor of a commitment. Institutional sponsorship must ride alongside personal sponsorship. A commitment backed only by an employer's wellness budget, with no friend or family member on the pledge list, does not qualify as a sponsored streak.

The standing principle: **personal stake must precede institutional stake.** The practitioner demonstrates that real people who know them are willing to back the commitment, and institutional money joins that pledge rather than substituting for it.

Exact mechanics are deferred:

- Minimum number of personal sponsors required before institutional pledges can attach
- Ordering rules (do personal sponsors have to pledge first in time, or merely be present in the final roster)
- Whether personal sponsors can be family members or must include non-family
- How this interacts with institutional-only deployments (employee benefit programs) — which may need a different product surface entirely
- Ratio requirements if any

These are left open because the answers depend on data we don't have yet. The principle is firm; the mechanics wait.

### 5. The Mentor role — and the Mentor economy — is retired

There are two human roles on Search Star: **Practitioner** and **Sponsor.** The Companion is AI and has no authority. Everything else that v3 described as a role — Mentor, Coach, Community Builder, Practice Leader — is retired.

The whole Mentor economy goes with it:

- The 23.75% × 4 contribution split
- The 1:100 mentor-to-practitioner ratio
- The living-wage-at-scale table
- The Mentor / Coach / Community Builder / Practice Leader progression
- The platform-stage vocabulary (Early / Growing / Established / Scaling / Mature / At Scale) derived from the mentor economy headcount math
- The Institutional Placement pathway positioning Practice Leaders as paid facilitators
- The mentor-matching onboarding step

This is a significant excision. The v3 spec built an entire economic narrative around living wages for community leadership, and that narrative is gone. The justification is the same one that produced decision #2: for the skill categories Search Star supports, a well-designed AI Companion is a better teacher than a human mentor who shows up weekly. Paying humans to do what AI does better is not a model Search Star wants to build its economics on.

**The revenue model simplifies to a single voluntary donation — the GoFundMe pattern.** At the payout moment, sponsors see a prompt offering an optional Search Star donation. The suggested default is **5% of the pledge amount**, fully editable by the sponsor and removable in one action. There is no split, no mentor pool, no community pool, no four-way allocation. One recipient (Search Star), one suggested percentage, one click to change or remove it. The practitioner receives the full pledged amount cleanly — the donation is on top of and separate from the pledge, paid by the sponsor, never deducted from what was promised.

This produces a dramatically simpler economic picture:

- Sponsors pledge, e.g., $2,500 toward a 90-day commitment
- On completion, the practitioner receives $2,500
- Separately, the sponsor is prompted to add an optional ~$125 (5%) Search Star donation
- The sponsor can change that to 0%, 20%, or anything in between with a single interaction
- Search Star's revenue is the aggregate of these voluntary donations

Five percent mirrors GoFundMe's tip ask and maps cleanly to the social norm of an optional tip on top of a committed price. At the target $2,500 payout and two streaks per year, a practitioner generates ~$5,000 in sponsor flow annually; a 5% donation on that is $250 per practitioner if every sponsor tips at the suggested rate. The realistic number is lower, but at platform scale that is a reasonable operating budget for infrastructure and Companion inference — and crucially, the model stops claiming to fund human livelihoods it can no longer fund.

What this forecloses, cleanly:

- The "recognition earned through forming others" story no longer produces a leadership hierarchy. It produces nothing, because there are no leadership roles above Practitioner. Recognition on Search Star is earned by completing sponsored streaks, full stop.
- The "mentee development as a Trust input" mechanic is gone. A practitioner's Trust comes from their own completed sponsored streaks, not from anyone else's growth.
- The Institutional Portal stops offering Practice Leader placement as a paid facilitation role. What an institutional deployment looks like without that pathway is one of the deferred institutional questions.
- The living-wage-at-scale narrative is gone, not just transitional. The platform scale stages table (Early → At Scale) is retired along with it.

### 6. Trust is earned through sponsors who deliver

With the validator role retired (decision #1) and the Mentor role retired (decision #5), Trust has no input source left from the v3 model. v4 defines it cleanly:

**A practitioner's Trust Record is built from completed sponsored streaks.** "Completed" means every sponsor who pledged at any point in the commitment released payment at day 90. A streak that ended via veto, sponsor withdrawal, or sponsor going silent contributes nothing.

Two meta-considerations apply to each completed streak:

- **Sponsor count and diversity.** A streak completed with one sponsor carries less weight than a streak completed with five. A streak where all sponsors are immediate family carries less weight than one with sponsors across multiple social circles. The credibility signal is that multiple real people, across multiple relationships, stayed convinced through 90 days.
- **Sponsor reliability — sponsors who deliver.** A sponsor who has backed and released payment on multiple practitioners' streaks is a more credible witness than someone who has never done so. Their continued presence on a new practitioner's streak carries more signal. Over time, a subpopulation of sponsors emerges who have a track record of delivering — backing real practitioners, staying present, releasing payment when the work was real, vetoing when it wasn't. Their participation in a streak adds more to the practitioner's Trust Record than a first-time sponsor's.

This produces a clean recursion: Trust is earned by completing streaks under the witness of sponsors who themselves have a track record of witnessing well. Nothing in the system can be gamed by performance, recruitment, or documentation volume. The only path to a mature Trust Record is to do real work and attract real witnesses over time.

Depth, Breadth, Durability remain as the three dimensions of the Trust Record, but their inputs are:

- **Depth:** completed sponsored streaks within a single skill category, weighted by sponsor count, diversity, and reliability
- **Breadth:** distinct skill categories across completed sponsored streaks
- **Durability:** elapsed calendar time across completed sponsored streaks — the oldest unbroken pattern of completion

Trust Stage thresholds (Seedling → Rooting → Growing → Established → Mature) remain notional until enough completions exist to calibrate against. Because the single live user is the practitioner building the platform, the existing `trust_records` data is disposable — the v4 computation can be redesigned from scratch without migrating anything.

---

## The no-escape-hatch principle

This is philosophically load-bearing and deserves its own statement.

**If a practitioner loses a sponsor mid-streak for any reason — honest disagreement, personal falling-out, the sponsor going silent, the sponsor changing their mind — the streak ends and the practitioner must bail and restart.**

Not paused. Not partially credited. Not arbitrated. Ended. The practitioner restarts from the launch period with a new roster of sponsors.

A clarifying note: bringing in *additional* sponsors during the 90 days is permitted and normal (decision #3). Replacing a lost one is not. If sponsor A vetoes on day 40, the streak ends — even if sponsor B joined on day 30 and is still fully on board. The principle is about the integrity of a single committed roster, not about the total count of supporters.

**The platform does not mediate sponsor relationships and does not provide a safety net for them breaking down.** Maintaining those relationships across ninety days is part of the practice. It is arguably the most important part, because it is the part that is hardest to fake: staying on good terms with someone who has put money behind your word, for three months, while you do the work they are watching.

This rule is the single most important piece of product copy. The practitioner must see it prominently during the launch period, before the start ritual, and must understand it. Every piece of UI that touches sponsor relationships — the launch dashboard, the start ritual screen, any sponsor invitation flow — should communicate it plainly.

Three consequences follow directly:

- **The Trust Record is built from completed sponsored streaks only.** "Completed" means every sponsor who pledged at any point during the commitment — whether at launch or mid-stream — was still present and released payment at day 90. A streak that ended via veto or sponsor withdrawal contributes nothing to the Trust Record. Practitioners who complete many streaks are demonstrating, among other things, that they can maintain committed relationships under stress.
- **There is no such thing as a partial Trust credit for partial effort.** The session count at which a veto occurs is irrelevant — day 3 or day 89, the result is the same. This is what makes the rule clean. It removes any temptation for the platform to quantify near-misses or award effort points.
- **Practitioners develop a strong interest in sponsor selection.** Because losing one sponsor means losing the whole streak, practitioners think carefully about who they invite. A sponsor who is likely to go silent or lose interest is a liability from day one. The invitation decision is consequential — not a social nicety but a genuine act of discernment about whose continued belief the practitioner can earn across ninety days.

---

## Cascading implications

### The sponsor feed replaces the validator feed

The private session feed — previously visible to the validator circle at `/validate/[commitment_id]/[token]` — is now visible to the sponsor circle at an equivalent sponsor URL. The structure carries over: token-based access, no account required for sponsors, server-side token lookup, no engagement metrics. What changes:

- The "Confirm this session" button is retired. There is no per-session confirmation action.
- The "Release payment" action replaces it, but appears only at day 90 in the completion flow.
- The "Veto streak" action is available throughout the 90 days but is positioned as a serious, standalone choice — not an inline per-post action.

### Payment release is the attestation

In v3, validation and payment were separate: validators confirmed sessions for free, sponsors paid at completion based on validator confirmations. In v4, they collapse. A sponsor releasing payment at day 90 is saying "I saw the work, I stayed convinced, I am paying what I pledged." A sponsor vetoing or going silent is saying the opposite. No additional attestation layer is required because the money is the attestation.

### Any dollar amount of personal sponsorship is valid

The v3 spec implied sponsor amounts should be proportional — small for friends, large for institutions — but never codified what qualified as a valid personal sponsor pledge. v4 states it explicitly: **any dollar amount a real person in the practitioner's life is willing to pledge counts as a personal sponsorship.** A grandmother's $5 signals as strongly as a senior engineer's $500. The credibility signal is the **count of sponsors** who stayed present through the 90 days, not the total dollars.

This matters for the institutional-cannot-stand-alone rule: the bar for a valid personal sponsor is low, which keeps the principle generous. A practitioner doesn't have to find wealthy friends to qualify.

### Trust Records are built from completed sponsored streaks

The v3 Depth / Breadth / Durability dimensions survive in name. Their inputs are rebuilt around whole sponsored streaks rather than individual sessions or validator confirmations. The full treatment is in decision #6. The granularity shift — from sessions to streaks — is what makes the new Trust computation resistant to gaming: the unit of genuine formation is a completed 90-day commitment witnessed by real people with money on the line, not a sum of confirmed session rows.

### The cast of roles, in full

| Role | Type | What they do | Authority over Trust Record |
|---|---|---|---|
| **Practitioner** | Human | Declares the commitment, does the work | Owns their record |
| **Sponsor** | Human | Pledges money, witnesses the 90 days, releases payment or vetoes | The only attestation authority |
| **Companion** | AI | Accompanies the practitioner daily; summarizes for sponsors at day 90 | None |

Two human roles, one AI role. No mentors, no coaches, no community builders, no practice leaders. Other AI surfaces may exist alongside the Companion over time — decision #2 describes that openness — but none will hold authority over the Trust Record either.

The retired v3 roles and the retired v3 Mentor economy are described in decision #5. The spec rewrite will remove those sections rather than marking them transitional.

### API surface changes

Retired:

- `/api/validate/accept/[token]`
- `/api/validate/[commitment_id]/accept`
- `/api/validate/[commitment_id]/info`
- `/api/validate/[commitment_id]/posts/[post_id]/confirm`
- `/api/commitments/[id]/validators`
- `/api/confirmations/*` (entire namespace)
- `/api/validators/invite`
- `/api/mentors/*` (entire namespace — `invite`, `mine`)
- `/api/mentoring/mentees`
- `/api/profiles/mentor-step-seen`

Introduced:

- `/api/sponsors/invite` — practitioner invites a sponsor by email (valid at any time during launch or active commitment)
- `/api/sponsors/pledge` — sponsor pledges (and becomes the person with standing to veto or release)
- `/api/sponsors/release` — at day 90, sponsor releases payment
- `/api/sponsors/veto` — at any time during active commitment, sponsor ends the streak
- `/api/companion/*` — AI Companion endpoints (exact shape deferred)

The existing `/api/sponsorships/pledge` endpoint is the right foundation for the new sponsor flow, but its RLS policy and business logic will need rework (see Known code impact).

---

## Deferred questions

Carried forward explicitly so they don't get lost:

1. **Institutional-to-personal ratios and ordering rules.** How many personal sponsors, in what configuration, must be present before institutional pledges can attach? Do personal sponsors need to pledge first in calendar time, or merely be present in the final roster? How does this interact with an institutional benefits deployment where the employer *is* the program — and does such a deployment even make sense anymore now that Practice Leader placement is retired (decision #5)?

2. **AI Companion specifics.** Name. Memory architecture (per-commitment, per-practitioner, cross-practitioner). Exact role in sponsor communication during the 90 days versus only at day 90. Prompting strategy for the day-90 summary. Privacy boundary between what the Companion sees and what sponsors see. What other AI surfaces exist alongside the Companion.

3. **Anti-collusion rules for reciprocal peer sponsorship.** At scale, two practitioners could sponsor each other for trivial amounts to farm completed streaks with no real stakes. What structural or detection mechanism addresses this without killing genuine peer sponsorship among practice communities? Candidates: minimum aggregate pledge amount, minimum sponsor count, relationship-graph analysis, hold periods between reciprocal pledges — all deferred pending real data. The "sponsor reliability" dimension in decision #6 provides some natural resistance (first-time sponsors carry less weight than proven ones) but is not a complete answer.

4. **Trust Stage thresholds and computation specifics.** How many completed sponsored streaks move a practitioner from Seedling to Rooting to Growing and onward? How are sponsor count, diversity, and reliability weighted inside Depth? Decision #6 defines the inputs; calibration waits on real completions. With only one live user, this is cheap to iterate on later.

5. **Mid-streak veto UX.** What exactly happens in the UI on day 40 when a sponsor clicks veto? What does the practitioner see? What do the other sponsors see? What is the notification tone? This is a product-design question that needs careful handling because the moment is emotionally significant and the copy will shape how the no-escape-hatch principle actually lands with users.

6. **Sponsor-joins-late UX.** Sponsors can pledge any time during the 90 days (decision #3). The product surface for this is not yet designed — how a practitioner invites a new sponsor on day 40, what the new sponsor sees on arrival (the already-accumulated session feed), how the Companion's summary at day 90 handles sponsors who only saw the last fifty days of the work.

7. **What the Institutional Portal becomes without Practice Leader placement.** The v3 Institutional Portal offered employers and foundations a deployment path that included human facilitators matched through the platform. With that role retired, the portal needs a new shape — or needs to be rethought as a simpler institutional-sponsor flow rather than a cohort-management product. Deferred until the sponsor flow for individual practitioners is stable.

---

## Known code impact

A survey of the v3 codebase turned up several places where a v4 change will have concrete consequences. Captured here so the first v4 build session doesn't walk into them cold.

- **Trust Record computation is built on validator confirmations.** `src/app/api/trust/compute/route.ts` counts rows in `post_confirmations` weighted by `quality_note` presence, and its stage thresholds (10, 30, 75, 150) are calibrated to that scale. v4 has no per-session confirmations, so the whole compute function is replaced, not patched. The single-user-is-the-founder situation makes this easy: the live `trust_records` row is disposable.
- **Sponsorships RLS policy hardcodes launch-period-only pledging.** The `"sponsorships: anyone can insert during launch"` policy in `20260413_v3_schema.sql` restricts inserts to commitments with `status = 'launch'` and `launch_ends_at > now()`. Decision #3 requires sponsors to be able to pledge during active commitments too — the RLS policy needs to be rewritten or every post-start-ritual pledge silently fails.
- **Stage resolver reads the `validators` table to decide step 3 is complete.** `src/lib/stage.ts` queries `validators` at step 3 and `profiles.mentor_step_seen` at step 4. Both queries will return empty forever in v4. The resolver needs new logic: step 3 becomes sponsor invitation; step 4 becomes something Companion-related or is removed.
- **Validator RLS reach-through.** RLS policies on `commitments` and `commitment_posts` (lines 108, 140 of the schema) grant validators read access. When the `validators` table goes away, sponsors need equivalent read access through a parallel path — probably joining through `sponsorships`. RLS rewrite and frontend rewrite have to happen atomically or the app partially breaks.
- **Mentor economy columns in `contributions`.** The table has `mentor_share`, `coach_share`, `cb_share`, `pl_share` as NOT NULL columns alongside `ss_share` and `contribution_rate`. With decision #5 simplifying the donation to a single Search Star recipient at a 5% default, the four mentor-share columns go away. The replacement is a single donation row with `amount`, `rate` (defaulting to 0.05), and a reference to the sponsorship. Migration: drop the four columns and rename/repurpose the table toward the simpler shape.
- **Validator scope in the codebase.** Roughly 288 validator references across 50 files. The excision isn't mechanical — references are split across DB identifiers, URL paths, UI copy, and the role concept. Each category takes a different treatment. Plan to handle it as a phase, not a single commit.
- **Mentor-related tables, pages, and API routes.** `mentor_relationships` table; `/api/mentors/*`, `/api/mentoring/*`, `/api/profiles/mentor-step-seen`; `src/app/(dashboard)/mentors/`, `src/app/(dashboard)/mentoring/`, `src/app/start/mentor/`; references in `trust_records.mentees_formed`. All retired. Migration is a drop, not a rename.
- **Admin page exposes retired columns.** `src/app/admin/users/[id]/page.tsx` reads `active_validators` and `mentees_formed` from `trust_records`. These columns will either return stale zeros or need to be dropped; the admin page needs to be updated regardless.

---

## What remains unchanged from v3

Most of the platform thesis is untouched. Retained verbatim or nearly so:

- Practice-first onboarding, private-by-default documentation, no public feed
- 90-day commitment as the atomic sponsorable unit, two per year standard
- Skill categories and the twelve-category taxonomy
- Trust expressed as a Trust Stage, never a number
- Depth / Breadth / Durability as the three dimensions of the Trust Record (with rebuilt inputs per decision #6)
- Beauty, grace, and truth as the telos of practice
- The garbage-culture problem and conscientiousness-as-signal theses
- No-public-feed, private-by-default as architectural constraints
- The $2,500 target payout for a 90-day commitment
- The voluntary donation mechanic itself — one prompt at payout, fully optional, removable in one action — is retained; only the split and the recipients change (decision #5)

The v4 change is structural surgery on attestation and on the role model, not a reset of the platform thesis. Everything the platform is *for* is the same. What has changed is the honest answer to the question: *who has standing to say the 90 days were real, and on what basis?* That standing now belongs only to the people who put money on the line — and the teaching and accompaniment that were going to be humans' work are the Companion's instead.
