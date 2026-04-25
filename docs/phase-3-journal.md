# Phase 3 — Self-pilot Journal

> Phase 3 of `docs/chat-room-plan.md`. Real 30-day-or-longer use of the
> production room with real sponsors, observing the deployed v1
> Companion prompt (`COMPANION_ROOM_SYSTEM_PROMPT`, `src/lib/anthropic.ts`).
> The output of this phase is this journal. The journal becomes the
> input to Phase 4 (prompt iteration).

**Started:** YYYY-MM-DD
**Practitioner:** David
**Room:** `29b52264-50be-411e-8294-2091ee28e8fb` *(or a new room if a fresh commitment is declared for the pilot)*
**Commitment:** *(name + day count target)*
**Sponsors at start:** *(names + pledge amounts)*
**Companion prompt baseline:** v1 from `docs/chat-room-plan.md` §6.4, deployed verbatim. Any prompt change during the pilot is itself a Phase 4 event and must be logged below.

---

## How to use this journal

Write daily — even one line. The point is the chain across days, not the
quality of any single entry. If a day is a no-op ("posted nothing,
Companion said nothing"), write that. The gaps and the silences are part
of the observation.

The seven-prompt structure below mirrors `chat-room-plan.md` §5 Phase 3
items 1–7. Use the prompts as headers when something happens that
relates to one of them. Don't force entries into all seven every day —
most days will only touch one or two. At the end of each week, write a
short retrospective using the §6 prompt.

When the Companion gets something wrong, screenshot the exchange and
paste the URL or paragraph here. Specific moments are worth more than
generalized observations — Phase 4 needs concrete material.

---

## Phase 3 observation prompts — the seven dimensions

### 1. Avoidance accuracy
*Does the Companion's accompaniment mode surface avoidance accurately?
When David skips a session, does the next Companion response find the
honest reason or accept the surface explanation? Both outcomes matter —
log which and how it felt.*

### 2. Moderator-mode rhythm
*Does the moderator mode work in the background? Welcomes, milestone
markers, system messages — do they land naturally or feel intrusive?
Are they too frequent, too rare, in the wrong tone?*

### 3. Sponsor effect on what David says
*Central hypothesis. Does knowing Tom (or another sponsor) will read the
Companion's follow-up change how David responds? In which direction?
Watch for the "therapeutic-sounding sentences for the audience" failure
mode.*

### 4. Sponsor writing in the room
*Do sponsors write in the room? At all? How often? What kind of
messages? If they never write, the room is functionally
practitioner + Companion + spectators, which is a different product
than the room model promises.*

### 5. Companion misses
*Specific moments where the Companion's response missed. The exchange,
what the better response would have been, why. This is the raw material
for Phase 4.*

### 6. Right rhythm
*How often should the Companion speak? After every post? After every
session but not every short reply? Only when directly addressed? Find
the cadence by feel.*

### 7. Mobile feel
*The room is a mobile-first surface. Friction points — composer
awkwardness, keyboard covering the stream, media upload hiccups — go
here.*

---

## Daily log

### Day 0 — Baseline (retrospective, written 2026-04-25)

**Why this entry is retrospective.** The pilot is being formalized on
2026-04-25 against a room that has been in real use since 2026-04-22.
The first three days predate the journal but are part of the pilot
window. This entry captures the starting state so Day 1 (below) can
just be the first daily entry written in real time.

**Room state as of 2026-04-25.**
- Room: `5574621b-e783-4627-8648-9d69c530bb63` (created 2026-04-22).
  This is the only room in production; the older B/C/D-arc test room
  (`29b52264-...`) is gone.
- Members (both `active`): David Verchere (creator), Rick Fisher
  (joined 2026-04-22 11:42).
- Active commitments (both day 3 of 90, both `status='active'`,
  `target_payout_amount = 2500`):
  - David — "Italian"
  - Rick — "Pullups"
- Sponsorships: one. Rick → David's "Italian" for $5, status
  `pledged`. David is not yet sponsoring Rick. The room is
  asymmetric.
- Messages (98 total over 3 days):
  - 1 `companion_welcome` (the founding message; fired correctly)
  - 47 `companion_response` (~16/day cadence)
  - 43 `practitioner_post` (chat, not session-marked)
  - 6 `practitioner_post` with `is_session = true` (across the 3 days
    × 2 practitioners = right at the per-day cap, well-behaved)
  - 1 `sponsor_message` (Rick, on Apr 22)
- Affirmations: **0**. Six session-marked messages, no sponsor has
  clicked "affirm" on any of them.

**Companion baseline.** v1 prompt from `docs/chat-room-plan.md` §6.4
deployed verbatim in `src/lib/anthropic.ts` as
`COMPANION_ROOM_SYSTEM_PROMPT` (verified byte-for-byte 2026-04-25).
Wired to all three room invocation paths (session response, milestone,
welcome) in `src/lib/companion/room.ts`. Model: `claude-sonnet-4-6`.

**Things to watch from Day 1 onward, beyond the seven standard
prompts:**

1. **F14 — Companion followup-path misfires in multi-practitioner
   rooms.** Documented in `docs/bcd-arc.md` lines 1498–1597. The bug:
   when the Companion asks Practitioner A a question and Practitioner B
   replies first (e.g., a side-chat reply to A), the followup path
   fires anyway and the Companion produces a meta-message correcting
   the addressee. The room currently has the exact conditions that
   trigger this (two practitioners, active question/reply patterns).
   The bug has fired in production at least once already (Rick's
   pullups thread, 2026-04-22 — see bcd-arc.md). Pass 3 disposition
   was "V2 absorbs the fix; do not patch V1." Phase 3 observation
   stance: log every misfire here under prompt #5 (Companion misses)
   with day number, screenshot the exchange, note what the better
   response would have been. The frequency and disruption level of
   F14 misfires across 30 days is itself useful input to the V2
   design.

2. **Cadence (~16 Companion responses/day at start).** Phase 3 prompt
   #6 (rhythm) is exactly this question. Watch whether this self-tunes
   down as conversation deepens or stays high. The C-2 followup path
   (commit `c0eadc1`, 2026-04-21) is what's driving most of those
   responses; F14 misfires inflate this count.

3. **Sponsor writing rate (1 message in 3 days).** Phase 3 prompt #4
   asks whether sponsors write at all. The data so far says: barely.
   Rick's one sponsor-message was on Apr 22 — none since. Worth
   watching whether this is a "still figuring out the surface" moment
   or a structural pattern.

4. **Room asymmetry (David sponsored, Rick not yet sponsored).** Per
   Decision #8, the ideal mature-room state is every member both
   practicing and sponsoring. Watch whether the asymmetry resolves,
   persists, or matters in practice.

5. **Affirmation usage (0 of 6 possible).** Could be (a) Rick hasn't
   seen the session-marked messages, (b) Rick has seen them but
   doesn't click affirm, (c) the affirmation UI is hard to find on
   mobile. Worth noting under prompt #7 (mobile feel) and prompt #4
   (sponsor writing).

**Cost note.** Back-of-envelope at current cadence and Sonnet 4.6
pricing: ~$0.04/Companion-call × ~16 calls/day ≈ $0.63/day,
roughly $20 over 30 days. F13 (no rate limit on the room Companion)
is a Pass 4 candidate but does not need a fix for the pilot at this
spend level.

---

### Day 1 — YYYY-MM-DD

**What I posted today:** *(brief — what was the session, was it
session-marked, any media)*

**What the Companion said back:** *(quote or paraphrase)*

**What I felt about the exchange:** *(one or two sentences)*

**Observation prompts touched today:** *(which of 1–7 above this day's
entry feeds into; if a Companion response missed, also note F14)*

---

### Day 2 — YYYY-MM-DD

**What I posted today:**

**What the Companion said back:**

**What I felt about the exchange:**

**Observation prompts touched today:**

---

*(Continue daily. When Day 7 is reached, drop in a Week 1
retrospective using the prompt below.)*

---

## Weekly retrospective template

### Week N retrospective (Day N×7) — YYYY-MM-DD

**Days posted / days session-marked this week:** *(e.g. 6 of 7 posted, 4 session-marked)*

**Strongest Companion moment this week:** *(the exchange that felt most
right — what made it work)*

**Worst Companion moment this week:** *(the exchange that missed — what
would have landed better)*

**Sponsor activity this week:** *(any messages from sponsors? any
affirmations? any silences worth noting?)*

**Phase-3-prompt updates:**
- Prompt 1 (avoidance): *(running observation across the week)*
- Prompt 2 (moderator): *(running observation)*
- Prompt 3 (sponsor effect on me): *(running observation)*
- Prompt 4 (sponsor writing): *(running observation)*
- Prompt 5 (Companion misses): *(running list, with day numbers)*
- Prompt 6 (rhythm): *(running observation)*
- Prompt 7 (mobile): *(running observation)*

**One sentence for the Phase 4 prompt designer:** *(if you had to ship
one prompt change next week, what would it be?)*

---

## Phase 4 candidate changes — running list

> Append here whenever an observation suggests a specific prompt change.
> Don't act on these until Phase 3 is done — the point of Phase 3 is
> patience, not iteration. But capture them as they occur so Phase 4
> doesn't start from a blank page.

- *(empty — fill in as observed)*

---

## Mid-pilot prompt changes (if any)

> Per `chat-room-plan.md` §5 Phase 4: "3–5 rounds of prompt changes over
> the course of Phase 3, each deployed to production immediately and
> tested in live use." If the pilot triggers an interim prompt change
> rather than waiting for Phase 4, log it here with the date,
> commit hash, and rationale.

- **2026-04-25, commit `25e2b88` — auto-scroll to latest on mount.**
  Not a prompt change; a UX change to the room render path
  (`src/app/room/[id]/realtime-messages.tsx`). Motivation: opening
  the room on mobile required scrolling all the way down past 90+
  messages to see the latest message and reach the composer.
  Mount-only `scrollIntoView({block:'end'})` lands the viewer at the
  bottom on first paint. Realtime appends do NOT auto-scroll —
  preserves "scroll up to read older context" as a stable behavior.
  Order is unchanged (still ascending-chronological per
  chat-room-plan §5 Phase 2 item 5). Watch in pilot: does the
  absence of "stick to bottom on append" feel right, or do new
  messages from Rick / the Companion get lost below the fold while
  scrolled up reading? If lost-below-fold is real, the next
  iteration is the Slack/iMessage "stick to bottom only when
  already near bottom" pattern (see Phase 4 candidate changes
  list above).

---

## Pilot-end summary

*(Fill in when ≥30 days of observations have accumulated.)*

**Total days:** *(N)*

**Days posted / session-marked:** *(X / Y)*

**Companion behaviors that worked:** *(list — these stay in v2)*

**Companion behaviors that need revision:** *(list — these are Phase 4
work)*

**Sponsor-side observations:** *(what sponsors did, didn't do, surprised
me, confirmed/refuted the hypothesis in prompt 3)*

**Mobile/UX observations affecting Phase 5 deferred features:** *(what
v1.5 should layer on first)*

**Decision: extend pilot or move to Phase 4?**

**Phase 4 input — top 3 prompt changes to test:**
1.
2.
3.
