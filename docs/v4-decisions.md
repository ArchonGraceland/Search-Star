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

**Sponsors can join a commitment at any time during the 90 days.** Once the streak begins, additional sponsors can still be invited and pledge. But **once a sponsor is in, they are in** — bound by the same veto-or-release mechanic as everyone else. A sponsor who pledges on day 40 is in for the remaining fifty days, and their veto on day 41 ends the streak exactly as if they had pledged on day 1. This is the right asymmetry: adding belief mid-stream is welcome; losing belief mid-stream is final.

**Sponsors are invited by the practitioner or — within an existing room — by any current room member** (see decision #8). There is no public directory of commitments needing sponsorship. There is no sponsor-side discovery surface where someone could browse practitioners to back. A sponsor who arrives is always someone an existing room member chose to bring in. This keeps the peer-sponsorship model honest and forecloses an entire category of attention-seeking behavior that a sponsor marketplace would produce.

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

### 7. The Companion is a witness, not a referee — and voice-annotated video is the default pattern for visual practices

Decision #2 established the Companion as the teacher and daily accompaniment. This decision fills in what that means — and, importantly, what it does not mean — for practices where video is natural input.

**The Companion's job is to be the steady witness who has been paying attention.** What that means concretely: noticing patterns across weeks, remembering what the practitioner said last session, catching promises that haven't been followed up on, hearing the same complaint three sessions in a row and asking a question about it, asking about the work in language that makes the practitioner think. This is what a language-model-with-memory is uniquely good at — accumulating small attentions over many sessions into a coherent presence that a practitioner cannot get from any other source.

**The Companion's job is not to be the referee who grades each set.** The platform-wide prohibition on verdict-forming (from the system prompt: no praise, no prediction of completion, no verdict on whether the work was real) comes from the same principle as the no-escape-hatch rule above: the only party with standing to judge whether a commitment was real is the sponsor who put money behind it. The Companion cannot bypass that standing by producing authoritative-sounding analysis of the practitioner's work. Attempting to do so — whether on a squat's form, on the quality of a woodworking joint, on a pronunciation's accuracy — would corrode the whole model. The Companion's value comes from being a different kind of presence entirely: the one who has been watching and remembering, not the one who evaluates.

**For practices where video is the natural input — gym training, woodworking, cooking, instrument practice, running form, any physical craft — the default documentation pattern is voice-annotated video.** The practitioner narrates what they're doing while filming it. Whisper transcribes the voice, the Companion reads the transcript as part of the session body, and the practitioner's own description becomes the record. Practical example: "Squat, 8 at 225, last two reps felt heavy, my knee tracked okay" said into the camera mid-set is richer, more accurate data than any vision model could extract from the footage itself, and it requires no infrastructure beyond what already exists (audio extraction via Cloudinary, Whisper transcription via Groq, both shipped).

This pattern plays to what language models do well — making sense of natural-language descriptions accumulated over many sessions — and sidesteps what they do poorly: estimating load from foreshortened phone-camera angles, counting reps across jump cuts, or offering form critique that would be either too vague to be useful or too confident to be honest. A running commentary of one's own work, thirty seconds a day for ninety days, produces a dataset the Companion can engage with in ways no purely visual pipeline could.

**Visual analysis is Layer 2 and is deferred until the pattern demands it.** A cheap next step exists: Cloudinary can extract still frames from a video URL the same way it extracts audio (the audio extraction already shipped in `buildAudioTranscodeUrl`). Sampling first-rep, middle-rep, last-rep frames and including them as images in the Companion's input would let it notice visible context — "you're training alone today," "the bar seems to bend a little on rep 8, which is real load" — without claiming precision it cannot deliver. This is worth building when the video volume and practice mix make it pay off. It is not worth building speculatively.

**Domain-specific form analysis — pose estimation, joint-angle timeseries, per-exercise failure-pattern detection — is Layer 3 and is a separable product decision.** Tools exist (MediaPipe, MoveNet, commercial velocity-based training apps), and a dedicated "form check" surface could invoke them alongside the Companion. This is a meaningful product bet, not a small feature, and commits the platform to a kind of analysis the Companion itself should not do. It makes sense to consider it only once there is concrete evidence that gym or technique-heavy practitioners are a major Search Star use case. Until then, Layers 1 and 2 carry the work and the Companion stays in its lane.

The principle this decision encodes: **the Companion earns its value by doing one thing well over long time horizons — attention, memory, questions — and does not reach for authority that belongs elsewhere.** Over ninety days of sessions, noticing that squat volume plateaued six weeks ago and asking the practitioner what they think about that is more valuable than any single video-frame form critique could be. Over a Trust Record built from many streaks, the pattern of a practitioner's own words about their work, witnessed and reflected back, becomes part of what a sponsor can read to decide whether the commitment was real.

### 8. Rooms are the primary surface. Commitments happen inside rooms.

Decisions #1 through #7 define a coherent model for a single commitment: one practitioner, their sponsors, the Companion, a 90-day window, a veto-or-release binary at the end. Applied to real friend groups, that model fragments. A running club of six people has each member's commitment living in its own sponsor circle. Sponsors witnessing more than one member stand in disjoint rooms watching disjoint feeds. Every new commitment requires re-inviting sponsors, re-explaining the practice, re-establishing the social frame — a cold start each time. Friends who have happily sponsored before have to be re-approached as if for the first time. And there is no place for the honest in-between state: the friend who would be willing to witness and eventually support a practice but isn't yet sure they want to pledge. The product offers in-or-out and nothing else.

The deeper observation is that formation has always happened in persistent small groups, not in individual serialized efforts. AA meetings, CrossFit boxes, writing cohorts, guilds, monastic communities — every durable formation tradition operates as a continuing group where individual commitments are made, completed, and followed by the next one, inside the same social unit. v4 as originally specified tried to recreate formation without the persistent group. This decision corrects that.

**A room is a small, persistent, invitation-only social group** — friends, family, colleagues, or any combination — that does high-effort cultural practice together over time. The room is the unit of social continuity on Search Star. Commitments happen *inside* rooms; they are not themselves rooms. Every practitioner's 90-day commitment plays out in a room. Every sponsor's pledge is made from within a room. Every message in the product lives in a room. There is no surface in Search Star that is not inside some room.

**Who is in a room.** A room contains some mix of three membership states, and the mix changes over time: active practitioners currently on a 90-day commitment, active sponsors currently witnessing one or more practitioners through completion, and lingering members — former practitioners between commitments, former sponsors whose practitioner's streak has completed, or members who joined via sponsorship invitation and haven't yet pledged to anyone. Any member can be in more than one state at once. The ideal state of a mature room is every member both practicing and sponsoring: everyone has someone they're backing and someone backing them. The lingering state is transitional.

**The room's lifecycle is tied to commitments keeping happening.** A room is created when a first-time practitioner declares a commitment; the streak begins immediately at declaration — there is no separate launch period or pre-streak window. The practitioner invites their first sponsor during the streak, and any sponsors can join at any point between day 1 and day 90. Over time, either member invites more people. The room persists as long as commitments keep happening inside it. When no one is currently committed and no new commitment starts within a grace period (likely 60–90 days, deferred to calibration), the room goes dormant — archive-only, messages preserved, revivable when any member declares a new commitment.

**Rooms are relationships, not demographics.** A room can be a friend group, a family, an extended family, a professional circle, a hybrid, or a single dyad. The product does not require rooms to be "friend groups" in any specific sense. What rooms require is mutual invitation-gated membership — everyone was brought in by someone already in it. Rooms grow through member-invitation only; there is no directory, no discovery, no marketplace. A room can also start with a single practitioner alone — the founding moment of any first-time practitioner who has not yet invited anyone. A practitioner alone runs a streak with no witnesses; their Trust Record does not advance from such a streak because decision #6 makes completion conditional on sponsor release. They are not prohibited from practicing alone; they simply cannot build Trust without sponsors eventually joining.

**One person can be in multiple rooms.** A practitioner's life may contain multiple distinct social circles — college friends, running buddies, extended family, professional cohort. Each can be its own room. Rooms are deliberately disjoint: what happens in room A is not visible to members of room B, even if the practitioner is in both. A person's Trust Record aggregates across all rooms they've practiced in, but any single room only contains the commitments that happened inside it.

**A sponsor must be in a room to back a practitioner.** There is no cross-room sponsorship. If Tom wants to sponsor Karen's commitment, Tom must be a member of the room where Karen's commitment is happening. This keeps sponsorship honest: always an act within a relationship context, not a transactional pledge made across strangers. It also keeps rooms coherent — membership means something, because the economic relationships that define sponsorship are always room-internal.

**Entry paths are asymmetric by design.** A first-time practitioner does not think about creating a room as a separate step. They declare a commitment, and the room is auto-created around them as a side effect. The streak starts at declaration. The first sponsor invitation is framed as "invite Tom to back you," not "invite Tom to your room." The room exists in the database from the moment of declaration but is not surfaced as a discrete object the founder has to configure. Once the room has multiple members, all subsequent entries are explicit room-level invitations — any current member can invite a new person, and the invitation is named as sponsorship of a specific practitioner. Arrivals can then pledge, declare their own commitment, or linger. The product's framing is that **sponsorship is the entry path, and practice often emerges from it** — like someone who joins a church first by contributing and later discovers they are being formed by the community themselves. That is the expected arc for most members: arrive as sponsor, become practitioner over time.

**How this interacts with earlier decisions.** The Companion (decision #2, decision #7) becomes a room-level entity. Its memory and attention span all commitments that have happened in the room, the relationships among members, and the ongoing arc of the group's work. Its role shifts accordingly: **group chat moderator first, individual accompanier second.** In moderator mode (the default baseline), it welcomes new members, marks milestones, surfaces patterns across the room's commitments. In accompaniment mode (activated when a practitioner posts a session or appears to be struggling), it shifts into the focused individual register of decision #7 — attention, memory, questions, no refereeing. Decision #7's witness-not-referee principle is unchanged; the room model simply extends the Companion's scope from single-commitment to room-level.

Decision #3's principle — sponsors can join at any time during the commitment; once in, bound by veto-or-release — survives but its scope widens: any current room member can invite new sponsors, not only the practitioner. The load-bearing protection against a sponsor marketplace (no public discovery) is preserved: new members still arrive only by existing-member invitation. Decision #4's institutional-cannot-stand-alone principle is strengthened — institutional sponsors attach to rooms where personal sponsorship is already structurally present, never to empty rooms. Decision #6's sponsor-diversity signal sharpens into **social-graph distance between sponsors**: five sponsors from one room are less diverse than five sponsors across three distinct rooms. Decision #5 (mentor role retired) is unaffected; the room provides a structural home for the informal mentorship that naturally emerges in persistent groups, without reintroducing mentorship as a role with compensation or authority.

**The no-escape-hatch principle is hardened, not softened.** When a sponsor vetoes mid-streak, the room watches it happen. The practitioner's restart — a new commitment — takes place inside the same room, with the same members available to sponsor or not. In the single-commitment model, a vetoed practitioner started fresh in a new witness circle. In the room model, they must face the same people to declare the next commitment. This is the right asymmetry: social continuity across the failure is structural, not optional.

**Two mechanics support the room-as-chat surface.** The session-mark: practitioners can one-click mark any of their own messages as "this is my session for today," resolving what-counts-as-a-session in continuous conversation — the practitioner decides, per-message. One session per calendar day maximum. And the sponsor affirmation: sponsors can click a light-weight "good job" acknowledgment on session-marked messages, visible to the room with no count aggregation. This is not a verdict (decision #7 still holds — no refereeing), not a confirmation (validator role is retired), not an engagement metric in any meaningful sense. In a closed room of ~8 people, an affirmation is categorically different from a like on a public feed: a relational gesture from a specific witness to a specific practitioner, never aggregated across practitioners, never used for ranking or amplification. Keeping the mechanic small — names visible, no counts, sponsors only, session-marks only — prevents drift into the engagement-metric failure mode that v4 explicitly forbids.

**Pledge amounts are visible to all room members.** Earlier v4 kept pledge amounts asymmetric — the practitioner saw everyone's amounts, sponsors did not see each other's. This asymmetry is removed. Every room member sees every sponsorship's amount. The room's egalitarianism extends to transparency: a grandmother's $5 and a senior engineer's $500 are both visibly real contributions, both labeled "sponsor," and both visible to everyone. Any dollar amount from a real person the practitioner is in a room with counts as a valid personal sponsorship (consistent with decision #6's established position).

**What this forecloses.** Anonymous sponsorship is gone — every sponsor is visible to every other member of the room they joined. Individual-to-individual sponsorship as the marketing frame is replaced with "we're a community doing this together, and inside that community I back specific people." The "practitioner invites a witness circle that is theirs alone" framing is retired.

**What this enables.** Persistent Companion memory across years of a group's practice — a meaningful continuity no per-commitment assistant could have. On-ramps for new members via the lingering state — prospective sponsors and prospective practitioners can be in a room without yet being economically committed. A natural institutional-sponsor proposition: institutions sponsor rooms where members are already committed to each other, providing matching funds or broader visibility, with marketing value proportional to the room's sustained activity. Graceful failure: a vetoed streak ends the commitment but not the room; the practitioner restarts inside the community that watched them fail. A lifetime arc rather than serialized streaks — a practitioner's record becomes the chain of their commitments inside one or more rooms over years, a readable narrative of formation rather than a list of disjoint 90-day events.

Most of v4's architecture is untouched. The three roles, the 90-day unit, the veto mechanic, the no-escape-hatch principle, the 5% voluntary donation, Depth/Breadth/Durability as the Trust dimensions, private-by-default and no-engagement-metric — all survive. This decision extends v4 into a richer social architecture without altering any load-bearing principle. What changes is the surface on which everything happens: from per-commitment witness circles to persistent relationship-based groups that are the durable unit of the platform.

---

## The no-escape-hatch principle

This is philosophically load-bearing and deserves its own statement.

**If a practitioner loses a sponsor mid-streak for any reason — honest disagreement, personal falling-out, the sponsor going silent, the sponsor changing their mind — the streak ends and the practitioner must bail and restart.**

Not paused. Not partially credited. Not arbitrated. Ended. The practitioner restarts from a new commitment with a new roster of sponsors.

A clarifying note: bringing in *additional* sponsors during the 90 days is permitted and normal (decision #3). Replacing a lost one is not. If sponsor A vetoes on day 40, the streak ends — even if sponsor B joined on day 30 and is still fully on board. The principle is about the integrity of a single committed roster, not about the total count of supporters.

**The platform does not mediate sponsor relationships and does not provide a safety net for them breaking down.** Maintaining those relationships across ninety days is part of the practice. It is arguably the most important part, because it is the part that is hardest to fake: staying on good terms with someone who has put money behind your word, for three months, while you do the work they are watching.

This rule is the single most important piece of product copy. The practitioner must see it prominently before declaring a commitment and must understand it. Every piece of UI that touches sponsor relationships — the commitment declaration flow, the sponsor invitation flow, the room surface itself — should communicate it plainly.

Three consequences follow directly:

- **The Trust Record is built from completed sponsored streaks only.** "Completed" means every sponsor who pledged at any point during the commitment was still present and released payment at day 90. A streak that ended via veto or sponsor withdrawal contributes nothing to the Trust Record. Practitioners who complete many streaks are demonstrating, among other things, that they can maintain committed relationships under stress.
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

8. **Room size floor and ceiling behavior.** Below two members a room is a solo practitioner with no witnesses (legal per decision #8, but the Trust Record does not advance). Above roughly 12 members the social coherence degrades. The product likely wants soft defaults — recommended sizes, gentle nudges when a room is getting large — rather than hard limits. Specific thresholds wait on real data.

9. **Room dormancy and revival.** How long is the grace period after the last active commitment before a room goes dormant? What does dormancy look like in the product — archived, hidden, read-only? How does a dormant room get revived? Probably some member posting a new commitment reactivates it, but edge cases (all members quiet for a year; one member wants to revive; do the others get re-prompted?) need attention.

10. **Moderation authority when the Companion isn't enough.** If a room member behaves badly — harasses another member, spams the room, uses it for unrelated purposes — what happens? The Companion soft-moderates; what's the escalation path? In a persistent-group product this is a real question. Probably the room's creator or a designated admin has removal authority. The product is not trying to become a content moderation platform, so this wants careful handling.

11. **Voluntary room exit.** A member can stop practicing and stop sponsoring but is still a room member. Can they voluntarily exit? What happens to their Trust Record contributions from that room? Probably voluntary exit is allowed and historical record is preserved, but they no longer receive room activity. Needs specification.

12. **Anti-collusion refinement for the room model.** Decision #6's anti-collusion framing (reciprocal peer sponsorship for trivial amounts) becomes more detectable in the room model — the pattern of a room whose members all sponsor each other with no external sponsors is structurally legible. What weighting (low diversity, low sponsor-reliability) handles this without killing genuine peer sponsorship? Deferred pending real data; the room model makes this easier to address than the single-commitment model did.

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

**Additional impact from decision #8 (rooms are primary):**

- **New tables: `rooms` and `room_memberships`.** Rooms hold id, creator user_id, created_at, name (optional), dormancy status. Room memberships link users to rooms with state enum (active/lingering/exited) and joined_at. A user can have many membership rows for different rooms.
- **`commitment_posts` is renamed to `room_messages` and refactored.** Add required `room_id` column; make `commitment_id` nullable (some messages are room-level, not commitment-tied); add `message_type` enum (`practitioner_post`, `companion_response`, `companion_welcome`, `companion_milestone`, `companion_moderation`, `sponsor_message`, `system`); add `is_session` boolean defaulting to false (only the practitioner can set to true on their own messages; enforced one-per-calendar-day). For existing single-user data, the migration creates one room per existing commitment, populates memberships accordingly, and sets `is_session` true on the three existing posts so the Trust compute has valid session data.
- **`commitments` schema simplifies.** Add required `room_id` column. Drop `launch_ends_at`. Migrate any remaining rows with `status = 'launch'` to `status = 'active'`. Rename `streak_starts_at` to `started_at` for clarity (the streak begins at declaration; there is no pre-streak window).
- **New table: `message_affirmations`.** Links sponsor user_id to a `room_messages.id` with timestamp. Constraints: the affirmed message must have `is_session = true`; the sponsor must be an active sponsor of the commitment the message belongs to; unique on (sponsor_user_id, message_id) so toggle removes and re-adds.
- **Sponsorships RLS rewrite.** The existing v3/v4 "pledge during launch" policy becomes simply "pledge during active commitment." Any point between day 1 and day 90, any room member can pledge.
- **RLS on `room_messages` shifts from "sponsors of this commitment can read" to "members of this room can read."** Broader read scope, still strictly invitation-gated. Writes remain scoped by role: practitioners can insert `practitioner_post` and toggle `is_session` on their own messages; sponsors can insert `sponsor_message` and insert `message_affirmations` for session-marked messages of commitments they sponsor; only the server inserts Companion message types and `system` messages.
- **Onboarding does NOT fork.** First-time practitioners see the same simple flow — declare a commitment, name the practice, invite a first sponsor. The room auto-creates in the background. The user never sees a "create a room" step. Subsequent invitations into the existing room use a new `/api/rooms/[id]/invite` endpoint, framed as sponsorship of a specific practitioner.
- **Post-login home surface is the room itself when the user is in exactly one room.** No rooms-list intermediate page exists in v1 because no user has multiple rooms in v1. When the second-room case arises, a rooms-list home appears as a navigation layer above individual rooms; shape deferred.
- **The Companion's context construction shifts from per-commitment to room-level.** It pulls from recent room history across all commitments in the room, plus member roster, plus active commitment metadata. Meaningfully larger context per invocation.
- **Spec §4.2 and §4.3 deletion.** `public/spec.html` §4.2 ("The 14-Day Launch Period") and §4.3 ("The Start Ritual") are deleted in the spec rewrite. §4.1 (Why 90 Days) survives with light edits. Broader spec rewrite for the room model is a larger downstream task (see `docs/chat-room-plan.md` §8 for sequencing).
- **`docs/chat-room-plan.md` exists as the third source-of-truth document.** Alongside this file and `docs/v4-build-plan.md`. It operationalizes decision #8 into a phased build plan. `docs/next-session-companion-v2.md` is deprecated as of the same commit and should be read for tactical reference only.

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
