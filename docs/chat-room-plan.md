# Search Star — Chat Room Plan

*A phased plan for the Search Star room: the persistent social surface where small groups of friends, family, and colleagues do high-effort cultural practice together, witnessed by sponsors and stewarded by an AI Companion.*

*Drafted April 2026, second version. Operationalizes `docs/v4-decisions.md` decision #8. Sits alongside `docs/v4-decisions.md` and `docs/v4-build-plan.md` as a third source-of-truth document. Fully supersedes `docs/next-session-companion-v2.md` (see §10).*

---

## 1. The thesis

The room is the primary surface of Search Star. It is a small, persistent, invitation-only group — a friend circle, a family, a professional cohort, or any combination of these — that does high-effort cultural practice together over time. Commitments happen *inside* rooms; the rooms outlast individual commitments and constitute the social continuity of the platform.

The room does three things at once:

**It is the formation community.** A small group that has chosen to be present for each other's practice over months and years. Members move through three states — active practitioners (currently committed to a 90-day streak), active sponsors (witnessing one or more practitioners through completion), lingering members (between commitments, or recent arrivals). The ideal state is everyone occupying both the practitioner and sponsor states at once: everyone is doing the work and everyone is backing someone else's work.

**It is the chat surface.** A chronological message stream where practitioners post sessions, sponsors offer encouragement, and the Companion stewards the conversation. No engagement metrics, no algorithmic curation, no public visibility — just the room and its members. The architecture matches the social structure: small enough to be intimate, persistent enough to feel like a place.

**It is the witnessed therapeutic surface.** Inside a room, the Companion's role is **group chat moderator first, individual accompanier second**. It welcomes new members, surfaces patterns across the group's commitments, marks milestones, gently nudges lingering members toward new practice. When a specific practitioner is mid-commitment and posting sessions, the Companion shifts into a more individual register — substantive responses to what they shared, occasional CBT-adjacent prompts that surface avoidance or redirect from affect to behavior. The friend group provides the primary social pressure; the Companion provides the structure and the accompaniment.

Two principles govern every product decision in the room:

- **The room is the social unit; commitments happen inside it.** No surface in Search Star sits outside some room. No commitment exists without a room around it. No sponsor backs a practitioner without being a member of the room.
- **Membership is invitation-only and persistent.** New members arrive only because existing members invited them. Once in, members remain in until they choose to exit. Rooms grow by social proof, not by discovery.

### Why this supersedes the prior chat-room plan and `next-session-companion-v2.md`

The first chat-room plan (drafted earlier in this conversation, never committed) assumed one commitment per room — a chat surface that opened at launch-period day 1 and closed at day 90. That framing was right about the chat-room idea but wrong about the social unit. The room as a persistent friend group, not a per-commitment witness circle, is the correct shape — captured formally in v4-decisions.md decision #8.

The earlier `docs/next-session-companion-v2.md` (April 18) made the case for "conversation-first, not video-first" and identified three Stage A gaps in the existing surface. Both pieces of that work survive — conversation-first is correct, the gaps are real — but their framing assumed a practitioner-centric Companion as the primary surface, with sponsors as eventual readers. This plan replaces that framing with the room model where sponsors are active participants in a persistent multi-member chat.

---

## 2. The room model

### Membership states

| State | What it means | How entered | How exited |
|---|---|---|---|
| Active practitioner | Currently inside a 90-day commitment in this room | Declares a commitment as a room member | Streak completes (release), is vetoed, or is voluntarily abandoned |
| Active sponsor | Has pledged to one or more practitioners in this room and is currently witnessing them through completion | Pledges to a specific practitioner via Stripe; pledge holds funds | All sponsored streaks complete (release or veto); sponsor returns to lingering state |
| Lingering | A member of the room but not currently in a practitioner or sponsor role | Default state for new arrivals; default state for members between commitments | Re-enters practitioner state by declaring a commitment, or re-enters sponsor state by pledging to someone else's |

A member can occupy multiple states simultaneously. A practitioner who is also sponsoring two other room members is in all three categories at once; this is the desired pattern, not an exception.

### Room lifecycle

| Phase | What happens |
|---|---|
| Founding | A first-time practitioner declares a commitment. The room is auto-created around them; they don't see "create a room" as a step. The streak begins immediately at declaration. They can invite their first sponsor from day 1 forward. |
| Active | At least one commitment is currently within its 90-day window. The room has at least one practitioner; may have zero or more sponsors. New members can be invited by any current member. New commitments can be declared by any member. |
| Dormant | No commitments are active and the dormancy grace period (deferred for now — likely 60–90 days) has elapsed since the last completed or vetoed commitment. Room becomes archive-only; messages preserved, no new posts allowed. |
| Revived | Any member of a dormant room declares a new commitment. The room reactivates. |

Founding is implicit (the practitioner doesn't think about creating a room). All other lifecycle transitions are observable to the room — when a commitment starts (declaration), completes, or is vetoed, the Companion posts a system message marking the event.

A commitment's status simplifies: there is no `launch` state. A commitment is `active` from declaration through day 90, then either `completed` (release) or `vetoed` (veto) or `abandoned` (practitioner-initiated). Sponsors can pledge at any point while a commitment is `active`.

### What sits inside the room versus outside

**Inside the room (this plan's scope):** the chat surface itself, all message types, the Companion's moderator and accompaniment behaviors, member visibility, room-level invitation, declaring a commitment from within the room.

**Outside the room (separate flows, this plan inherits whatever Phases 1–6 of `docs/v4-build-plan.md` produce):**
- The veto action — happens through a deliberate flow with the no-escape-hatch language; appears in the room as a system message after execution but is never a room-native button.
- The release action at day 90 — happens through a completion flow that includes the Companion's day-90 summary and the donation prompt.
- Stripe payment authorization at pledge time, capture at release.
- The personal account / settings / Trust Record dashboard — the practitioner's individual surfaces aggregating across all their rooms.

### What the home surface looks like

When a user is in exactly one room — which all current users are and will be for some time — the room itself is the post-login home. There is no rooms-list intermediate page in v1. The user opens the app and is in their room. When the second-room case eventually arises (a real future event, not a v1 concern), a rooms-list home appears as a navigation layer above individual rooms; the shape of that surface is deferred.

---

## 3. What the Companion does in the room

The Companion is a room-level entity. Its memory and context span all the commitments that have happened in the room, the relationships among the members, and the ongoing arc of the group's work over time. This is meaningfully richer than per-commitment context, and it shapes the Companion's voice fundamentally.

### Two modes, one voice

**Moderator mode (default, baseline).** The Companion stewards the room's social functioning. It welcomes new members, posts arrival summaries when sponsors return after time away, marks milestones (a commitment completing, a member transitioning from lingering back to practicing), gently nudges lingering members toward new commitments or new sponsorships, reframes sponsor messages that drift toward evaluation. This mode runs continuously in the background of the room. Most days, this is what the Companion does and the room rarely "feels" Companion-led — it feels like a chat among friends with a thoughtful host present.

**Accompaniment mode (activated, situational).** When a specific practitioner posts a session, when a practitioner appears to be struggling, when a practitioner has been silent for several days mid-commitment — the Companion shifts into a more focused, individual register. Substantive responses to session content (engaging with what was said or shown), occasional CBT-adjacent prompts (surfacing avoidance, redirecting from affect to behavior, asking "what's your next session, when?"), affirming real work. The accompaniment mode is visible to the whole room — the practitioner's witnesses see the conversation happen — which is exactly what makes the therapeutic register safe to deploy: the friend group prevents the conversation from collapsing into self-indulgent loops.

The two modes are the same Companion, the same voice, the same system prompt. What shifts is which behaviors activate in response to which room events. The system prompt teaches the Companion to recognize the situation and respond appropriately.

### Specific behaviors in v1

The Companion in v1 does:

- **Welcomes new members.** When a sponsor or practitioner joins a room, the Companion posts a brief, specific welcome — names the practitioner(s) currently active, names the practice each is on, indicates day number. Does this work for the room rather than the practitioner having to do it.
- **Responds substantively to practitioner session posts.** Engages specifically with what the practitioner posted — paraphrases or quotes specifically, asks a focused follow-up question if appropriate, affirms real work when present. Triggered by `is_session = true` on a message.
- **Gently surfaces the question of whom to invite when the practitioner is alone.** When a practitioner is in their room with no sponsors (the founding-moment case, or any stretch where sponsors haven't yet joined), the Companion's messages include gentle acknowledgment that sponsors are what activate the Trust Record, and occasionally nudge toward the invitation act. Not pushy — acknowledging the reality without making the practitioner feel inadequate.
- **Posts system messages at lifecycle events.** Commitment declared (day 1), day 30 / 60 / 90 milestones, commitment completed (release), commitment vetoed (read-only marker), member transitions from lingering to practitioner (declared a new commitment).

The Companion in v1 does NOT yet do (deferred to Phase 5):

- Arrival summaries when a sponsor returns after time away (requires session-state tracking)
- Silence-detection check-ins (requires scheduled invocation infrastructure)
- Reframing of sponsor-drift messages (subtle to do well; needs Phase 3 observation to know what drift actually looks like)
- Day-90 summary (its own substantial design; deferred)
- Lingering-member nudges toward new commitments (requires specific calibration; deferred)

Adding behaviors progressively is the right discipline. Start with the baseline that's always-on (welcomes, session responses, system messages) and layer the situational behaviors on after Phase 3 observation reveals what's actually needed.

### What the Companion never does

- **Confirm a session.** That belongs to the retired validator role. There is no per-session confirmation in v4.
- **Determine streak completion.** Completion is the sponsors' decision via release at day 90.
- **Advance a Trust Stage.** Trust computation runs in a separate process from completed sponsored streaks; Companion has no input.
- **Communicate outside the room.** No DMs, no email, no notifications generated by the Companion — its presence is room-internal.
- **Speak in different registers to different audiences.** The Companion sounds the same to the practitioner as it does to the sponsors as it does to the lingering observer. Anything it says to a specific practitioner is said in front of the whole room. This consistency is a feature: it keeps the voice dignified and prevents the kind of weirdly-private register AI relationships can develop.

---

## 4. Why the architecture is decoupled from the voice

The hardest problem in this entire effort is the Companion's voice — the moderator/accompanier register, when each mode activates, the specific tonal calibration. That problem is almost entirely a system-prompt problem, not an architectural one. This distinction is what makes the whole plan feasible to ship incrementally.

**Durable architectural bets** (expensive to change, made with high confidence):

- One room per friend group, persistent across commitments
- Three participant types (practitioner / sponsor / Companion) with distinct roles and styling
- Chronological message stream, no curation
- `room_messages` table with `room_id`, optional `commitment_id`, and `message_type` enum
- Membership via `room_memberships` table with state per user-room pair
- Room-scoped RLS read access on messages
- Companion responds server-side to specific events; response is just another row
- Veto and release flows live outside the room

**Iterable tonal bets** (cheap to change, will iterate continuously):

- The Companion's welcome message tone
- How substantive accompaniment-mode responses are
- When the Companion asks vs. affirms vs. stays quiet
- The therapeutic register inside accompaniment mode (warmer / more direct / more Socratic)
- How the Companion handles silence, avoidance, rationalization
- How the Companion stewards the room (more active moderator vs. lighter touch)

The architecture is designed to be stable across many revisions of the voice. The voice is designed to be changed by editing a string, not by touching schema or RLS.

This is what makes production testing safe: the expensive parts are the ones with the highest confidence; the uncertain parts are the ones cheapest to change.

---

## 5. Phasing

The plan has five phases. Phase 1 is a conversation exercise (no code). Phase 2 ships the minimum room to production. Phase 3 is a self-pilot. Phase 4 iterates on the prompt. Phase 5 adds deferred features once real data is in.

### Phase 1 — Prompt design (no code)

**Goal:** Produce a chosen Companion system prompt with written rationale, tested against realistic room scenarios, before any code is committed.

**Why first:** The Companion's voice is the single highest-risk, highest-leverage piece of the product. It now has to handle the moderator/accompanier dual register, work in a multi-member group context, and remain dignified while the whole room reads every message. Getting this wrong ships a chatbot or, worse, a chirpy assistant that all the members tune out. Getting it right ships a steward that humans actually want present in their group.

**What's different from a single-commitment Companion prompt:** The Companion now needs to know which mode to be in based on what just happened in the room. A practitioner posting a session triggers accompaniment mode. A sponsor joining triggers welcome behavior. A commitment completing triggers a milestone moderation message. The system prompt has to teach the Companion to recognize these situations and respond appropriately, which is a meaningfully harder prompt than "respond when the practitioner posts."

**Deliverable:** §6 of this document, filled in with:
- Three candidate registers, each fully drafted as a system prompt that handles both moderator and accompaniment modes
- Eight dry-run scenarios covering the room's main event types, each with all three candidates' likely responses
- Written rationale for the chosen register
- The chosen prompt, committed as a string ready to drop into `src/lib/anthropic.ts`

**This phase is complete when:** David reads the chosen prompt, reads what it does in the dry-run scenarios, and is willing to deploy it to production for the self-pilot in Phase 3. Not "looks perfect" — "willing to live with this voice in my room for 30 days and see what it does."

### Phase 2 — Minimum room (code)

**Goal:** Ship the room surface to production. The first user (David) has one room with one commitment inside it. Sponsors he invites arrive into that room. The post-login home surface is the room itself.

**Scope — what's in:**

1. **Schema migration.** Per decision #8 code-and-schema section:
   - Create `rooms` table (id, creator user_id, created_at, name nullable, dormancy status enum)
   - Create `room_memberships` table (room_id, user_id, state enum, joined_at)
   - Rename `commitment_posts` to `room_messages`
   - Add required `room_id` to `room_messages`
   - Make `commitment_id` on `room_messages` nullable
   - Add `message_type` enum to `room_messages` (values: `practitioner_post`, `companion_response`, `companion_welcome`, `companion_milestone`, `companion_moderation`, `sponsor_message`, `system`). Note: `practitioner_post` replaces the previous draft's `session_post` — whether a message *is* a session is now a separate boolean on the row (see next bullet), not a message type.
   - Add `is_session` boolean column to `room_messages` (default false; only settable to true on the practitioner's own messages; enforced via RLS or application logic that a practitioner cannot have more than one `is_session = true` message per calendar day).
   - Add required `room_id` to `commitments`
   - Drop `launch_ends_at` column from `commitments`. Migrate existing `commitments.status` rows with `launch` value to `active`. Rename `streak_starts_at` to `started_at` for clarity (streak begins at declaration now).
   - Create `message_affirmations` table (id, message_id, sponsor_user_id, affirmed_at). Constraints: message must have `is_session = true`; sponsor must be an active sponsor of the commitment the message belongs to; one row per sponsor-message pair (toggle removes and re-adds).
   - Backfill: for the existing user, create one room per existing commitment, populate `room_memberships` with the practitioner and any current sponsors, populate `room_id` on all existing `commitments` and `room_messages` (with `commitment_id` retained as not-null on backfilled rows). Mark the three existing "Sentensese" posts as `is_session = true` so the Trust Record computation has valid session data when the new schema goes live.
   - Verify migration via `Supabase:execute_sql` on `information_schema.columns` and `pg_policies`.

2. **RLS.** Rewrite `room_messages` SELECT policy from "sponsors of the commitment" to "members of the room." Verify writes are still scoped: practitioners can insert `practitioner_post` on their own behalf, and can set `is_session` to true on their own messages (with the one-per-day constraint); sponsors can insert `sponsor_message` only if they're active members of the room; sponsors can insert rows into `message_affirmations` only if they're active sponsors of the commitment the affirmed message belongs to AND the message has `is_session = true`; only the server can insert Companion message types and `system` messages. Add similar room-membership read access policy on `commitments` and `sponsorships`. Drop the launch-period-gated sponsorship insert policy — the new policy is simply "insert while commitment status is active."

3. **Room creation flow (founding case, implicit).** When a first-time practitioner declares a commitment via the existing `/commit` flow, the server creates a `rooms` row, creates a `room_memberships` row for the practitioner, assigns the new room_id to the commitment, and sets the commitment's `started_at` to now — the streak begins immediately. The user-facing flow does not change — they don't see "create a room" as a step, and they don't see a separate "start ritual" event. Declaring the commitment *is* the start. The Companion inserts a welcome message into the new room, acknowledging that the practitioner is alone so far and gently flagging the sponsor-invitation affordance.

4. **Room joining flow (explicit).** A new endpoint `/api/rooms/[id]/invite` lets any current room member invite a new person via email. Invitation email is framed as "back [Practitioner]'s 90-day commitment" — the entry framing is sponsorship-first per decision #8. The invitation lands the new person on a sponsor-onboarding page where they accept, create or sign into their account, and arrive in the room. Their first room view is the chronological room stream with the current state visible.

5. **The room page.** Single route, replacing `/commit/[id]` as the primary post-commit surface. Probably `/room/[id]` or simply `/` (the post-login home for one-room users). Renders the chronological stream of all messages in the room. Author-distinct styling per `message_type`:
   - Practitioner `practitioner_post` (session or not): full-width, white background, media rendered inline. If `is_session = true`, a small visual marker (a colored dot, a small "Session" label, or a left-border accent — final design is a visual-design call).
   - Companion (`companion_response`, `companion_welcome`, etc.): left-aligned, muted accent color, distinct avatar glyph
   - Sponsor `sponsor_message`: right-aligned, named with sponsor's display name
   - System messages (`system`): centered, small, gray
   - Day markers (computed, not stored): subtle horizontal rules between days

6. **Composer with session-mark toggle.** Bottom of the room. For practitioners (any active practitioner in the room): text field, camera button, gallery button, an explicit "mark this as today's session" toggle, send button. The session-mark toggle is off by default; when the practitioner has already marked a session today, the toggle is disabled with a small hint ("already marked today's session — tap your earlier message to change which one"). Tapping an already-marked session un-marks it so the practitioner can re-mark a different message. For sponsors and lingering members: text field, send button. The composer respects the user's current state in the room — a lingering member sees only the text field; an active practitioner sees the media buttons and session-mark toggle.

7. **Sponsor affirmation UI.** On any practitioner message with `is_session = true`, sponsors see a small affirmation button (probably a simple icon with "Affirm" label — visual design to be determined). Tapping it inserts a row in `message_affirmations`. Below the message, a small indicator shows which sponsors have affirmed — names, no count beyond "Tom and Sarah affirmed this." Sponsors can un-affirm by tapping again. Non-sponsor room members (other practitioners, lingering members) do not see the affirm button; affirmation is a sponsor-specific gesture.

8. **Transparent pledge visibility.** Every room member's profile-stub in the members roster shows their current pledges: "Tom — sponsor ($100 backing David's woodworking)." Practitioners see their own sponsors' amounts; sponsors see each other's amounts; lingering members see everyone's amounts. This is a change from the previous draft's asymmetry and reflects the call to make pledge amounts transparent.

9. **Companion invocation paths.** Server-side triggers:
   - On `room_messages` insert with `is_session = true`: load recent room history (last ~50 messages), load room metadata (active practitioners, current commitment day numbers, commitment statements), invoke Claude with the chosen Phase 1 system prompt. Insert response as `companion_response` row. Do *not* invoke the Companion for non-session practitioner posts — those are chat, not session events.
   - On `room_memberships` insert (new member joining): generate `companion_welcome` message tailored to the room's current state.
   - On commitment lifecycle events (declaration — the new "start" event; day 30/60/90 milestones; completion; veto): generate `companion_milestone` message.

10. **Welcome on first room access.** When the founding practitioner first lands in their newly-created room, the Companion has already inserted a welcome message generated from the chosen Phase 1 prompt. The message acknowledges the founding moment, names the practitioner's declared practice, notes that the streak begins today, and gently mentions that inviting sponsors is the next meaningful step. The room is never empty.

**Scope — what's out (deliberately, per §7):**

- The full deferred Companion behaviors (silence detection, sponsor-drift moderation, lingering nudges, day-90 summary)
- Notification changes beyond what already exists
- Rooms-list home surface (not needed for one-room users)
- Multi-room navigation
- Companion private sidebar
- Read receipts, typing indicators, presence indicators
- Threading, reply chains, reactions
- Streaming Companion responses (can add in Phase 5)
- Voice-input on the composer
- Room admin / moderation authority surfaces
- Voluntary room exit

**This phase is complete when:** David opens the app on his phone, lands directly in his room, posts a session with optional video, sees a Companion response appear within 15 seconds, can invite a sponsor whose acceptance lands them in the room, and the whole thing feels like one coherent surface. No orphaned references to the old `/commit/[id]` per-commitment view; no "log a session" button leading somewhere different from "open the chat."

**Estimated effort:** 5–8 hours of focused work, possibly across two sessions. The migration itself is non-trivial because it changes the primary message table; the rest is consolidating existing pieces under a new UI metaphor and adding the room creation/joining endpoints.

### Phase 3 — Self-pilot (no code)

**Goal:** Run a real 30-day partial streak (or a full 90-day commitment) in David's actual room with real invited sponsors, observing the Companion's behavior in practice.

**Setup:**
- David declares a real commitment. Not a test commitment — a real one.
- Real sponsor roster: Tom, maybe family members, maybe one or two others who know they're in a working beta. Real pledge amounts (even if small).
- Daily use: post sessions the way a normal practitioner would. Have real avoidance days. Don't "test" the Companion — live with it.

**What to observe, with notes kept in a running journal:**

1. **Does the Companion's accompaniment mode surface avoidance accurately?** When David skips a session, does the next Companion response find the honest reason or accept the surface explanation? Both outcomes matter — log which and how it felt.

2. **Does the moderator mode work in the background?** Welcomes, milestone markers, system messages — do they land naturally or feel intrusive? Are they too frequent, too rare, in the wrong tone?

3. **Do sponsors change what David says?** Central hypothesis of the chat-room model. Does knowing Tom will read the Companion's follow-up change how David responds? In which direction — more honest, more performed, both? Watch for the failure mode where David delivers "therapeutic-sounding" sentences for the audience rather than processing anything real.

4. **Do sponsors write in the room?** At all? How often? What kind of messages? If they never write, the room is functionally practitioner + Companion + spectators, which is a different product than the room model promises. This shapes Phase 5 moderation design and possibly Phase 4 prompt iteration toward more sponsor-engaging Companion behavior.

5. **What does the Companion get wrong?** Specific moments where its response misses. Screenshot and note the exchange and what the better response would have been. This is the raw material for Phase 4.

6. **What's the right rhythm?** How often should the Companion speak? After every post? After every session but not every short reply? Only when directly addressed? Find the cadence by feel.

7. **How does the whole thing feel on mobile?** The room is a mobile-first surface. Test it on real phones in real moments (after a run, in the workshop). Friction points — composer awkwardness, keyboard covering the stream, media upload hiccups — go in the journal.

**This phase runs for at least 30 days.** Shorter is not enough to see patterns. The Companion's room-level memory across the chain of events is one of the things that has to be observed over enough real time to judge.

**This phase is complete when:** 30+ days of daily use have produced a written journal with specific observations. The journal becomes the input to Phase 4.

### Phase 4 — Prompt iteration (minimal code)

**Goal:** Revise the Companion system prompt based on Phase 3 observations. Do not revise architecture.

**What this phase is not:** a ground-up redesign. The architecture is stable by design (§4). If the architecture genuinely needs to change in response to Phase 3 findings, that's a Phase 5+ question, not a Phase 4 one.

**What this phase produces:**
- A revised system prompt, with rationale for each significant change from Phase 1
- A short diff of prompt-level interventions tried (warmer/cooler, more-probing/less-probing, more/less moderator activity, etc.)
- A documented understanding of what the Companion's voice actually does in live use
- An updated §6 of this document reflecting the revised prompt as the current production prompt

**Expected iteration count:** 3–5 rounds of prompt changes over the course of Phase 3, each deployed to production immediately and tested in live use.

**This phase is complete when:** David would describe the Companion's voice as "right" or "close enough that the remaining issues need different solutions than prompt edits."

### Phase 5 — Moderation, milestones, deferred features (code)

**Goal:** Layer on the features deliberately deferred from Phase 2, now that real data informs their shape.

**Likely scope (order may change based on Phase 3 findings):**

1. **Day-90 summary.** Scheduled Companion message at day 90 summarizing the 90-day arc for sponsors to read before releasing payment. Its shape depends heavily on what Phase 3 shows is actually useful to sponsors — not speculated shape.

2. **Silence detection + Companion check-ins.** If the practitioner hasn't posted in N days, Companion visibly asks. Specific N and tone calibrated from Phase 3 observations.

3. **Sponsor arrival summaries.** When a sponsor returns to the room after time away, a "since you were last here" summary at the top.

4. **Lingering-member nudges.** Companion gently surfaces to lingering members when they might be ready for a new practice or a new sponsorship. Specific tone calibrated carefully — this is the behavior most at risk of feeling like a sales pitch.

5. **Sponsor-drift moderation.** If real sponsor messages in Phase 3 drift toward evaluation, moderation prompt becomes necessary. If they don't drift, this is skipped.

6. **Streaming Companion responses.** If mobile latency feels bad enough in Phase 3 to matter. Likely does.

7. **Voice-in for the composer.** Web Speech API for text entry; existing Whisper pipeline for video transcription remains.

8. **Room admin / moderation authority.** First time a room contains a member who needs to be removed, this becomes urgent. Until then, deferred per decision #8's deferred questions.

Each item in this phase is a small follow-on build, not a major rewrite. Phases 1–4 are the load-bearing work.

---

## 6. Phase 1 artifact: prompt design exercise

*This section is currently a scaffolded template. It gets filled in during the Phase 1 session (the next active working session). The structure below is the durable outline; the content under each heading is the work itself.*

### 6.1 Three candidate registers

Three candidate system prompts, each taking a distinct approach to the moderator/accompanier dual role. Each candidate is a complete, deployable string covering both modes — not sketches.

**Candidate A — Steward and friend.** Tone closer to a wise host who happens to know something about practice. Moderator mode is warm and personal — welcomes name people specifically, milestone markers feel celebratory, lingering members get gentle invitations rather than prompts. Accompaniment mode leans on warmth and specific noticing; presses on avoidance by asking rather than challenging. Risk: too soft in both modes, room feels like a fan club rather than a place where work happens.

**Candidate B — Direct guide.** Tone closer to a respected coach who treats every member of the room as someone worth being honest with. Moderator mode is brisk and substantive — welcomes are quick, milestones are matter-of-fact, lingering members hear directly that the room is for practice. Accompaniment mode leans on specificity and behavioral redirection; presses on avoidance by naming it plainly. Risk: too sharp, sponsors feel scolded rather than welcomed, practitioners get defensive.

**Candidate C — Quiet steward.** Tone closer to a careful host who speaks rarely but well. Moderator mode is minimal — short welcomes, brief milestone markers, no nudges at all unless asked. Accompaniment mode is Socratic — questions over statements, reflects patterns back rather than pointing them out. Risk: too indirect, room feels under-stewarded, practitioners and sponsors don't know what the Companion is for.

*To be drafted in the Phase 1 session. Each candidate gets a full system prompt — probably 400–700 words to cover both modes — including: what the Companion is, its awareness of the room context, mode-switching guidance (when to be moderator vs. accompanier), specific guidance on welcoming new members, responding to session posts, marking milestones, handling silence, tone constraints, and what it never does (confirm sessions, attest to completion, communicate outside the room).*

### 6.2 Dry-run scenarios

Eight scenarios, each representing a distinct moment in a room's life. Each candidate gets dry-run against all eight — by actually calling Claude with each candidate prompt and the scenario as user turn.

**Scenario 1 — Founding moment, day 1.** The room was just created. David has declared his first commitment ("I'm committing to 90 days of woodworking. I want to build real skill with my hands.") and has not yet invited any sponsors. The streak starts today. The room contains him alone. The Companion's first message — welcoming him into the room, acknowledging the founding moment, gently flagging the sponsor-invitation affordance without nagging.

**Scenario 2 — First sponsor joins, day 4.** David has been alone in his room for three days. He has marked one session so far. Tom accepted David's invitation to back the commitment. The room now has two members. The Companion's welcome to Tom, naming David's practice and the fact that Tom is joining three days in.

**Scenario 3 — Day 17, session post, concrete.** David posts a 45-second video of himself at a lathe, narrating: "First bowl off the lathe. Still rough but the shape came out closer to what I was aiming for." He marks it as his session for today. Three sponsors are now in the room. The Companion's substantive response to what he actually showed and said.

**Scenario 4 — Day 31, first missed session-marks, thin explanation.** David has not marked a session in two days. He posts (not marking it as a session): "Didn't get to the shop Tuesday or Wednesday. Work has been busy." No media. The Companion's response — noting the gap, engaging with the reason, redirecting toward the next session.

**Scenario 5 — Day 45, rationalizing pivot.** David posts and marks as a session: "I've been thinking that maybe this particular technique isn't the right direction for my practice. I might switch to focusing on hand tools instead of the lathe. It would be more authentic to what I want to build." (The pattern: David is nine days into struggling with lathe technique and is rationalizing a pivot.)

**Scenario 6 — Sponsor-drift moment.** Sponsor Mike writes into the room (non-session, just a sponsor_message): "David, this session post doesn't look like as much effort as your day 30 stuff. Are you slowing down?" David hasn't yet responded. The Companion is about to post. (For v1 we're deliberately not yet building reframing behavior, but this scenario tests whether the candidate prompts handle it gracefully or awkwardly when it arises naturally.)

**Scenario 7 — Day 90, completion.** David has just marked his final session. The Companion's message marking the completion to the whole room (separate from the day-90 summary itself, which is for sponsors). The transition from active practitioner back toward lingering or next-commitment state.

**Scenario 8 — Lingering member, three weeks later.** Sarah joined as a sponsor for David's woodworking commitment. That commitment has now completed (released two weeks ago). David is between commitments. Sarah has been a member of the room for ~6 weeks, has not pledged to anyone since, and has not declared a commitment of her own. The Companion considers whether and how to gently surface to Sarah the question of what she might want to start. (For v1 we're deliberately not yet building lingering nudges, but this scenario reveals what the candidate prompts would do when the behavior is enabled in Phase 5.)

*Each scenario is filled in with what each candidate's Companion likely says. Real API calls make the comparison cleaner than simulation. Capture the responses verbatim — the sample responses are the artifact.*

### 6.3 Rationale for chosen register

*A 400–700 word written argument for which candidate (or which hybrid) is going to production. What does the chosen register do well in moderator mode? What does it do well in accompaniment mode? What does it sacrifice in each? Why is that sacrifice worth it? What kind of practitioner does it serve well? What kind does it serve less well? How does it feel reading the responses as a sponsor vs. as the practitioner vs. as a lingering observer?*

*The rationale is as important as the prompt itself, because the rationale is what makes future revisions coherent. "We moved warmer in moderator mode" is meaningful only if there's a documented starting point to move from.*

### 6.4 Chosen prompt

*The final system prompt, exactly as it will be committed to `src/lib/anthropic.ts` as a new exported constant. Probably `COMPANION_ROOM_SYSTEM_PROMPT`. Version it in a comment: `// v1 — Phase 1, 2026-MM-DD, rationale in docs/chat-room-plan.md §6.3`.*

---

## 7. Deliberately out of scope for v1

Listed explicitly so they don't sneak in by omission. Each of these is tempting, each has a real argument for inclusion, and each is being deferred because including it now either (a) bakes in an assumption not yet tested, or (b) multiplies the surface area Phase 3's self-pilot has to evaluate.

**Rooms-list home surface.** Not needed when all users have one room. Defer until the second-room case actually arises, then design from real need.

**Multi-room navigation.** Same reason. No user has multiple rooms in v1.

**Read receipts and presence indicators.** Changes the social dynamic. Adding visible "Tom read this" creates pressure and obligation that don't fit the witness model. If the self-pilot reveals a genuine need for presence signaling, v2 addresses it.

**Typing indicators.** Same reason. Small UI convenience with outsize effect on the room's social tone.

**Message threading and reply chains.** A flat chronological stream is good enough to test the hypothesis. Threading can be bolted on later; reversing out of threading is harder than adding it.

**Notifications.** No email, push, or in-app notification infrastructure in v1. The room is a surface users visit; we don't push them there. If read rates turn out to be too low for the room to be functional, we'll know from Phase 3 and revisit. Notifications historically have low utility (users mostly ignore them) and high design cost (what to notify, at what cadence, with what controls), so deferring is the right default.

**Message reactions (emoji or otherwise) beyond sponsor affirmation.** The sponsor affirmation mechanic is a defined exception (see §2, and decision #8 code-and-schema) — scoped to session-marked messages, available only to sponsors, visible only in the small room, with no aggregation or ranking. Anything broader than this (emoji reactions, general likes, "bookmark" functionality) remains forbidden by v4's no-engagement-metric architecture.

**DMs between members.** Fragments the room — everything said in a room should be visible to every room member, or the room's coherence is broken. If someone wants a private conversation, they can use their phone.

**Private practitioner ↔ Companion sidebar.** Tempting because it would let the practitioner think out loud before posting. But it introduces a second surface for the Companion to develop a voice in — and the two voices will interact in ways that are hard to predict. Defer to Phase 5 if Phase 3 reveals a genuine need.

**Silence-detection and Companion check-ins.** Needs scheduling infrastructure (cron or similar) and a specific tone calibrated to Phase 3 observations. Deferred.

**Lingering-member nudges.** Most at-risk Companion behavior for feeling like a sales pitch. Deferred until Phase 3 reveals what kind of nudge is welcome vs. annoying.

**Sponsor arrival summaries.** Needs session-state tracking (what the sponsor has seen vs. not seen) that isn't trivial to build. Deferred.

**Sponsor-drift moderation.** Depends on Phase 3 showing real sponsor drift. May not happen in a small room of careful invitees.

**Day-90 summary.** Big enough to be its own Phase 5 item. Not needed for the first 30 days of pilot.

**Streaming Companion responses.** Mobile-latency nice-to-have. Fine to ship without; add in Phase 5 if needed.

**Voice input on the composer.** Web Speech API integration has its own UX subtleties. The existing video-with-Whisper pipeline handles voice cases for now.

**Room admin / moderation authority surfaces.** Won't matter until a room has a member that needs to be removed. Deferred per decision #8's deferred questions.

**Room dormancy mechanics.** Won't matter for many months. Deferred.

**Room naming / room-configuration UI.** Rooms can be unnamed in v1. The founding practitioner doesn't even see "create a room" as a step. Naming, room avatars, room-level settings — all deferred.

**Voluntary room exit.** Won't matter until someone wants to leave. Deferred per decision #8's deferred questions.

**Multi-practitioner rooms.** Yes, this is technically deferred for v1 in usage, not in architecture. The room model supports it from Phase 2 — the schema, RLS, and Companion behaviors are all designed to handle N practitioners — but in practice the first room (David's) will have one practitioner for the foreseeable future. The second-practitioner case becomes real when someone in his room declares their own commitment, which may happen during or after the self-pilot. Phase 3's observation deliberately includes watching for this transition.

**Structural changes to veto and release flows.** Both live outside the room and stay as they are. Whatever Phases 1–6 of the v4 build plan shipped or will ship for those flows is what the room inherits.

**Changes to onboarding for the founding case.** The founding flow (declare a commitment, name the practice, invite a first sponsor) is preserved as it is. The room is auto-created in the background. No new onboarding work for the founding case. The joining case is a new flow, but it's much simpler — accept invitation, sign in / sign up, land in the room.

**Mentor / coach / community builder concepts in any form.** Retired in v4. Not returning.

---

## 8. Known integration points with v4 build plan

This plan supersedes Phase 7 of `docs/v4-build-plan.md` ("Companion v1 surface present in every active commitment") and substantially expands its scope.

**Depends on (must be shipped first):**

- v4 Phase 1 — role-excision migration; sponsor RLS on what was `commitment_posts` (now `room_messages`)
- v4 Phase 2 — sponsor state machine (invite, pledge, release, veto flows all working at the commitment level; this plan layers room-membership above them)
- v4 Phase 3 — onboarding producing a live commitment (the room then auto-creates around it)

**Does not depend on:**

- v4 Phase 4 / 5 — Stripe payment capture (the room works regardless of payment state)
- v4 Phase 6 — Trust Record rebuild (the room is the surface; Trust computation is a separate endpoint and now reads from the room-aware schema)
- v4 Phase 8 / 9 — narrative rewrite (public copy, not product surface)

**Supersedes:**

- v4 Phase 7 as originally scoped in `docs/v4-build-plan.md`. That phase's goal was "Companion v1 surface present in every active commitment." This plan is how that goal gets realized — in the room model, with the Companion as a room-level entity stewarding the persistent group rather than as a per-commitment assistant.

**Flags for `docs/v4-build-plan.md`:**

- The build plan still references `v4` as the deploy target branch. Production has actually moved to `main` (the `v4` branch is retired — see deprecation note in `docs/next-session-companion-v2.md`). Build plan doc needs a sweep to correct this. Not this plan's job, but noting it here.
- The build plan's Phase 7 needs reworking to match this plan's Phases 1–5. Likely renamed to "Phase 7: room surface v1 with persistent membership." Subsequent phase numbering may shift.
- The build plan's Phase 6 (Trust Record rebuild) should be re-examined in light of decision #8's social-graph distance refinement to the diversity dimension. The compute logic now operates on room-aware sponsor relationships.

**Flags for `public/spec.html` (the v4 spec):**

- Spec §4 (the 90-day commitment) describes commitments as the primary unit. This needs revision to describe rooms as the primary surface and commitments as units inside them.
- Spec §5 (practice and skills) is largely intact but should mention that practices happen in the context of a room.
- Spec §7 (sponsorship) needs revision to describe sponsors as room members rather than as discrete commitment-witnesses.
- Spec rewrite is downstream of this plan settling. Don't start it until the chat-room plan is committed and the Phase 1 prompt design exercise is complete.

---

## 9. Open questions to resolve during Phase 1–3

Items that don't block Phase 2 but need answers as they surface in practice:

1. **Alone-practitioner vs. populated-room Companion register.** The Companion's voice may need to adapt depending on whether the practitioner is alone in their room or has sponsors present. In the alone case, the Companion is the only other "voice" in the room — which makes its role closer to a solo companion than a group moderator. In the populated case, the Companion's moderator role becomes real. Phase 1 makes a call on whether one prompt handles both or whether the prompt teaches the Companion to recognize room-size and adapt mode-switching accordingly. My lean: one voice, context-aware.

2. **The Companion's memory architecture in practice.** For Phase 2: "last ~50 messages in the room, plus active commitment metadata, plus member roster." That's naive but defensible. Phase 3 will reveal whether the Companion feels like it remembers appropriately or feels disconnected from deeper room history.

3. **The first sponsor's role in the founding moment.** When the room has only David and one sponsor (Tom, say), the social dynamic of a "group chat" is barely operative. Two-person rooms may need different Companion behavior than four-or-more rooms. Phase 3 observes the dyad case directly and Phase 4 may produce a register that handles small rooms better.

4. **Inviting a fellow practitioner directly.** The current invitation flow brings new members in as prospective sponsors (per decision #8's sponsorship-first entry framing). The path for "I want this person in my room because they should be doing this work too" needs a UX answer in Phase 5 if it doesn't naturally emerge from the existing flow. The architectural support exists (any room member can declare a commitment), but the invitation framing might eventually need to acknowledge "invite them as a fellow practitioner" as a distinct intent.

5. **Session-mark edge cases.** What if the practitioner marks a session at 11:50pm on day 15 and then has what they genuinely consider a "better session" at 1:00am on day 16? Phase 3 reveals whether the one-session-per-calendar-day constraint feels right or whether the constraint needs adjustment (rolling 24-hour window? timezone sensitivity? ability to re-mark retroactively within 24h?). The v1 rule is calendar-day-strict; Phase 3 tells us if that's too rigid.

6. **Sponsor affirmation cadence.** If a sponsor affirms every session, does the affirmation lose meaning? Does the Companion's system prompt need to care about affirmation patterns (e.g., noticing when a particular sponsor has stopped affirming recent sessions)? Phase 3 observes actual sponsor affirmation behavior and Phase 4 may calibrate the Companion's awareness accordingly.

---

## 10. Fate of `docs/next-session-companion-v2.md`

This plan fully supersedes `docs/next-session-companion-v2.md`. Specifically:

- The "conversation-first, not video-first" thesis is retained and becomes part of the room model's composer design (§2, §5 Phase 2)
- Stages A, B, C as framed in that document are retired — they assumed the Companion was a practitioner-solo surface, which the room model replaces with a multi-member room surface
- The tactical details (file paths, RLS workarounds, Cloudinary preset requirements, `companion_rate_limit` notes, SSR→service-client gotchas) remain useful as build-time reference during Phase 2, but are consumed-as-reference rather than followed-as-instructions
- That document should be updated with a deprecation header at the top pointing here, or removed entirely and its durable tactical notes migrated into a shorter "build gotchas" appendix of this document

Recommended action on next touch: add a header to `docs/next-session-companion-v2.md` reading:

> **Deprecated 2026-04-20. Superseded by `docs/chat-room-plan.md`. Retain for tactical reference (file paths, Cloudinary preset, SSR client patterns) only.**

Then don't re-read that document in future sessions unless hunting for a specific tactical detail.

---

## 11. Session template for Phase 1 (next working session)

The next session should open with a prompt like:

```
Search Star — Chat Room Plan, Phase 1 (prompt design exercise)

Source of truth documents (read in this order):
1. docs/v4-decisions.md — structural decisions for v4, including decision #8 (rooms are primary)
2. docs/chat-room-plan.md — this plan (sections 1–6 especially)
3. public/spec.html — v4 spec (note: still describes commitments as primary; spec rewrite for rooms is downstream)
4. Optionally docs/next-session-companion-v2.md for tactical reference only (deprecated strategically)

Current state: Phase 1 not yet done. §6 of the chat-room plan is scaffolded but empty.

This session goal: Complete §6 of docs/chat-room-plan.md.
  - Draft three candidate system prompts (Steward / Direct guide / Quiet steward) in full,
    each handling both moderator and accompaniment modes
  - Run the eight dry-run scenarios against each candidate (real Claude API calls preferred)
  - Write the rationale for the chosen register
  - Commit the chosen prompt as the production system prompt

No architectural code changes this session. This is a drafting and deliberation session;
the output is §6 filled in and committed to the repo.

Stack, credentials, branch info: per the standing v4 build plan session template.
Deploy target is main (not v4 — v4 branch is retired).
```

This keeps Phase 1 self-contained and produces a durable artifact.
