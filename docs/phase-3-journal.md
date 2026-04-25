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

### Day 1 — YYYY-MM-DD

**What I posted today:** *(brief — what was the session, was it
session-marked, any media)*

**What the Companion said back:** *(quote or paraphrase)*

**What I felt about the exchange:** *(one or two sentences)*

**Observation prompts touched today:** *(which of 1–7 above this day's
entry feeds into)*

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

- *(empty — fill in if interim changes are made)*

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
