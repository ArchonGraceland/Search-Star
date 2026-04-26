# Companion v2 / Phase 10 — Plan

*Drafted 2026-04-26. Successor to `docs/companion-v2-scope.md` (which
reconciled the inherited five-item roadmap against post-Decision-#8
schema). The scope doc identified what to keep, drop, and re-cast;
this doc sequences and scopes the keepers, with conversation-aware
participation promoted to the architectural centerpiece on the
strength of two production traces (`bcd-arc.md` 2026-04-22 and
2026-04-26). Restructured 2026-04-26 to make multi-agent architecture
a first-class organizing lens. Read this together with
`docs/chat-room-plan.md` §§3, 6, 7 — those define the Companion's
voice and event-by-event behavior; this doc defines how Companion v2
changes when and whether that voice speaks, and which agents produce
what.*

## TL;DR

Phase 10 is four sub-phases in serial order. The first began 2026-04-26.

| Phase | Scope | State | Blocks on |
|---|---|---|---|
| 10A | Foundations: doc cleanup + cross-commitment memory (schema, Memory Curator writer agent, read path) | Open | A completed commitment in self-pilot to exercise the writer end-to-end (no current blocker; schema and read path can ship now) |
| 10B | Conversation-aware participation (architectural rewrite of the Response Companion's trigger model) | Open | 10A landed; one week of self-pilot under the addressee fix to confirm it isn't masking unrelated issues |
| 10C | Composer affordance: voice input via Whisper | Open | 10B landed and stable; independent code-wise, but the composer's role in the room should be settled before adding affordances |
| 10D | Streaming Companion responses | Deferred | Explicit self-pilot signal that the 3–5s latency is felt as the pain |

A separate cross-cutting concern — the multi-agent architecture
itself — is inventoried in §2. New agents added in future phases
register there; they do not become new phase letters.

The two commits shipped 2026-04-26 — the implicit-addressee gate
(`79ad074`) and the explicit `addressee_user_id` column with parser
(`73a93ae`) — are tactical bridges, not Phase 10 endpoints. They stop
the V1 trigger model from mis-firing in multi-practitioner rooms.
They do not, and were not designed to, give the Companion the inverse
capability of engaging substantive non-session chat. 10B is what
provides that.

---

## 1. The architectural choice driving this plan

The V1 Companion is a reactive function of a single triggering message
plus a hardcoded triggerKind enum (`session` or `followup`). The two
production traces in `bcd-arc.md` show this shape failing in two
opposite directions in the same room:

- **Over-engagement (2026-04-22, Rick/David).** A Companion question
  to Rick was followed by side-chat from David. The followup path
  fired against David's message and produced a meta-correction.
  Patched 2026-04-26 with the addressee gate.
- **Under-engagement (2026-04-26, David's "Italian sentences" post).**
  After a Companion reply ended in a period (closing the loop with
  Rick), David posted substantive non-session material about his own
  commitment. The followup path correctly skipped (no `?` in the prior
  Companion message), and the Companion stayed silent. The patch from
  the morning does not address this; the architecture cannot see
  "David has spoken substantively and could be engaged" because there
  is no trigger that asks the question.

Adding more trigger types — a fourth branch for "substantive chat,"
a fifth for "video upload" (`companion-v2-scope.md` §5), a sixth for
"silence detection," etc. — compounds the architectural problem
rather than resolving it. Each new branch is another piece of static
gating that has to be right in isolation and that interacts in
hard-to-reason-about ways with the others.

The conversation-aware model proposed as option 3 in the 2026-04-22
bcd-arc entry inverts this: every practitioner message becomes input
to a single decision — "should I speak now, and if so, what?" — that
the model itself makes against the recent stream. The triggerKind enum
disappears. The followup heuristic disappears. Session-mark contracts
remain explicit for the affordance reasons given in §4.2, but
everything else collapses into one decision shape.

Phase 10B is the work to implement that. Phase 10A is the
cross-commitment memory infrastructure — schema, writer agent, read
path — that 10B leans on. Phases 10C and 10D are independent
ergonomic and latency work that follow once 10B is stable. The agents
that produce all of this — Response Companion, Memory Curator, and a
few deferred ones — are inventoried in §2 next.

---

## 2. Agents in the v2 system

The Companion is not one identity; it is a multi-agent system whose
agents share a voice, a discipline, and the bans from
`chat-room-plan.md` §6, but differ in role, prompt, cadence, and what
they read. Naming the agents up front lets the per-phase work below
describe what *changes* about each agent rather than what each phase
invents from scratch. New agents added in future phases register
here; existing agents that change get an updated entry.

### 2.1 The agents, today and planned

| Agent | Role | Cadence | Status |
|---|---|---|---|
| Response Companion | The voice the room hears in real time. Replies to session marks; replies to followups (under the addressee gate from `73a93ae`); produces welcomes and milestones. | Per session-marked practitioner_post (always); per non-session practitioner_post when followup conditions match (today). Per practitioner_post unconditionally after 10B. | Shipped v1; rewritten in 10B |
| Memory Curator | Writes durable summaries of completed commitments for the Response Companion's future memory. The agent that fills `commitments.completion_summary`. | Per commitment completion. | Designed and shipped in 10A |
| Participation Decider | A cheap gate that decides whether the Response Companion should speak on a given non-session message, before any body generation runs. Splits 10B's single call into a pair. | Per non-session practitioner_post. | Deferred; revisit if 10B's per-message cost or latency becomes a real constraint |
| Response Generator | The other half of the Decider/Generator split. Runs only when the Decider says speak. | Per Decider yes-decision. | Deferred per above |
| Critic | Reads the Response Companion's drafts for ban-list violations (no praise, no prediction, no verdict, no recommendation, no critique-from-video, no sponsor-corroboration) before they ship. | Per Response Companion draft on the engaged path. | Deferred; revisit only if the Response Companion drifts in production |
| Sponsor Shadow | Read-only reader that simulates how a sponsor would experience the room and surfaces drift toward Companion-as-co-sponsor. Observability, not product. | Periodic (daily or weekly). | Deferred; not Phase 10 |

### 2.2 Why the agent framing matters

Each agent could be implemented as "a function in `room.ts` that
calls Anthropic with a different prompt." That is what each is
mechanically. The agent framing matters because it forces three
disciplines that the function framing makes optional:

- **A separate prompt with its own dry-run discipline.** Agents have
  differentiated voices. The Curator's voice is descriptive and
  retrospective, closer to the day-90 sponsor summary than to the
  per-response Companion. The Decider's prompt, when it ships, is a
  near-binary judgment with a structured output. Treating them as
  the same Companion's "modes" blurs that. Treating them as distinct
  agents forces a fresh prompt design pass per agent.
- **Defined inputs and outputs, typed in the schema.** The Curator's
  output IS the `commitments.completion_summary` column; the
  Response Companion reads that column without needing to know how
  it was produced. The interface is the column. Future agent
  additions follow the same shape: each agent's outputs are typed
  artifacts other agents consume at near-zero context cost.
- **A cadence story.** Each agent has its own firing rule and its
  own failure-mode story. A Curator failure does not block any room
  interaction; a Response Companion failure delays a session
  reflection; a Decider failure (when shipped) defaults to silence
  and is invisible. Naming the cadence separately keeps reasoning
  clear about cost, latency, and where to put the safety net.

### 2.3 What does NOT count as an agent here

Distinct prompts for distinct events fired by the Response Companion
(welcome envelope, session envelope, milestone envelope) are not
separate agents. They are the same agent — the Response Companion —
running on the same per-practitioner-post or per-event cadence with
the same system prompt, only differing in the user-turn envelope.
Treating those as separate agents would fragment the single voice
that `chat-room-plan.md` §6 spent an entire dry-run exercise
constructing. The agent boundary is drawn at "different system
prompt + different cadence," not at "different envelope on the same
call."

This is also why per-practice domain-specialized Companions (one for
Italian, one for pullups) are not in §2.1 today: same prompt, same
cadence, only the room context differs. If a future signal indicates
domain voices would do better than the unified one, that becomes a
separate agent — but not premature.

---

## 3. Phase 10A — Foundations

Three pieces of work, all coupled to the cross-commitment-memory
feature plus a small doc cleanup. Bundle into one or two adjacent
sessions.

### 3.1 Doc cleanup — drop "persisted threads"

The phrase has no concrete referent under Decision #8 (see scope doc
§4). It still appears in:

- `CLAUDE.md` lines 66–67 — listed as roadmap item 4 under "Companion
  v2 / Phase 10 — current target."
- `docs/next-session-companion-v2.md` — the deprecated source. Already
  flagged DEPRECATED in CLAUDE.md but the file still exists and a
  future session might mistakenly anchor on it.

Action: edit CLAUDE.md to replace the five-item roadmap with a pointer
to this plan doc. Either delete `docs/next-session-companion-v2.md`
outright or move it to `docs/_archive/` with a one-line preface
explaining its status. Recommend delete — the scope doc and this plan
doc together carry every piece of context worth keeping from it.

Estimated work: 15 minutes.

### 3.2 Cross-commitment memory: storage and read path

The Companion's working memory today is the most recent 50 messages
in the room (`MAX_ROOM_HISTORY` in `src/lib/companion/room.ts`). When
a practitioner completes a 90-day commitment and starts a new one in
the same room, the prior commitment falls out of context as soon as
50 newer messages accumulate. That is wrong for a steward whose value
is supposed to come from long-arc continuity (`v4-decisions.md` §§7–8).

This sub-section defines the schema and the read path the Response
Companion uses. The writer that fills the schema is the Memory
Curator agent, defined in §3.3.

**Schema delta.** New nullable column on `commitments`:

```sql
ALTER TABLE commitments ADD COLUMN completion_summary text;
```

**Read path delta.** `loadRoomHistory` becomes a thin orchestrator:

```text
return [
  ...completion_summaries_for_completed_commitments_in_this_room (oldest first),
  ...most_recent_MAX_ROOM_HISTORY_raw_messages,
]
```

The completion summaries get a clear envelope ("Earlier in this room,
{practitioner} completed {practice}: {summary}.") so the model knows
they are summaries of past arcs, not present chat.

**Edge cases.**
- Zero completed commitments in this room (current state): the
  injection produces nothing; behavior is identical to today.
- Commitment completed without a summary written (legacy or failed
  Curator generation): skip silently. Don't fall back to "this
  commitment completed but I have no record of it" because that adds
  noise the model will reach for.
- Many completed commitments in one room (years out): cap at the most
  recent N completion summaries to keep the prompt bounded. N=5
  comfortably; revisit when any room actually accumulates that many.

### 3.3 The Memory Curator agent

The writer that fills `commitments.completion_summary` (the column
from §3.2). One of the agents inventoried in §2.1. This sub-section
defines its trigger, prompt design, and dry-run discipline.

**Trigger.** A commitment's `status` flips from `'active'` to
`'completed'`. There is no such code path today (no commitment has
completed); 10A wires both the completion-detection trigger and the
Curator invocation. The trigger fires the Curator in an `after()`
block so it never affects the synchronous request path.

**Inputs.** The full message history of the completed commitment —
all `room_messages` rows where `commitment_id` matches, plus their
video transcripts. The Curator does not read the rest of the room.

**Output.** A few sentences in the Companion's voice, scoped to "what
this practitioner was doing and what shape the 90 days took" — for
the Response Companion's future memory, not for any human reader.
Written into `commitments.completion_summary`. Distinct from
`DAY90_SUMMARY_SYSTEM_PROMPT` in `src/lib/anthropic.ts`, which is
written for sponsors about to release payment.

**Prompt design.** Fresh design problem, not a tweak of the existing
room prompt. The summary should:

- Reference specific sessions when those sessions illustrate
  something about the arc, not as recap.
- Name where the work was strong and where it faltered, plainly,
  without praising or condemning either.
- Not predict what the practitioner will do next, not recommend what
  the next commitment should be, not re-litigate whether the work
  was real.
- Sit at a length the Response Companion can carry in its context
  budget — target 200–400 words, hard cap at ~600.

**Dry-run discipline.** Apply chat-room-plan §6.2-style treatment:
2–3 candidate prompts × 5–6 synthetic 90-day commitment histories
(strong all the way through; thin first half, strong second;
abandoned middle and recovery; even effort with a clear pivot
mid-arc; ninety days that mostly didn't happen). Pick the prompt
that produces summaries the Response Companion can usefully reference
six months later.

**Cost.** Bounded. One Anthropic call per commitment completion.
Negligible at any plausible scale.

**Failure mode.** A Curator failure does not affect any synchronous
room interaction. The room continues to function; the missing summary
just doesn't get injected into future context, and the Response
Companion behaves as it does today on commitments without a summary.

**Out of scope for the first ship.**

- *Mid-commitment rolling memos.* A "what this practitioner is about"
  memo updated as the active commitment progresses would give the
  Response Companion stronger working memory. Requires harder design
  choices (when does it refresh? what triggers an update? how does
  it interact with raw recent history?) and lacks the bounded clarity
  the completion summary has. Defer until the completion-summary
  path is shipped and the Curator pattern has at least one
  production example.
- *Per-room memos.* A memo for the room itself, distinct from any
  one practitioner. Premature; rooms today are practitioner-anchored
  per Decision #8, and the right-shape room-level memory is not
  obvious yet.
- *Critic/self-review on the Curator's output.* Adds cost without
  evidence the writer drifts. Revisit only if the first few
  production summaries read poorly.

### 3.4 Estimated work and exit criteria for 10A

**Estimated work.** One to two sessions. Migration + completion-
detection trigger + `loadRoomHistory` change + Curator prompt design
and dry-run + one synthetic test against a manually inserted summary
value. The schema/read-path work and the Curator dry-run can run in
parallel if scoped to two sessions.

**Exit criteria.**

- One commitment in this codebase reaches `status = 'completed'`,
  the Curator runs successfully, the resulting `completion_summary`
  is readable to David and accurately describes the arc.
- The Response Companion's first response in a new commitment
  declared in the same room makes a contextually-appropriate (not
  forced) reference to the prior arc when prompted by the
  practitioner's own content.
- The summary length is bounded and the read-path injection does not
  produce prompt-bloat artifacts.
- The Curator's failure does not affect any synchronous room
  interaction — verified by deliberately simulating a Curator
  failure during the test commitment's completion and confirming
  the room continues to function.
- No regression: rooms with no completed commitments behave
  identically to today.

---

## 4. Phase 10B — Conversation-aware participation

The architectural rewrite. The single largest unit of v2 work. The
agent rewritten here is the Response Companion (per §2.1).

### 4.1 Target architecture

Today, `src/app/api/rooms/[id]/messages/route.ts` after-block branches
on triggerKind and calls `generateCompanionRoomResponse` with that
kind. After 10B:

```text
session-marked practitioner_post:
    → guaranteed Response Companion fire (current contract preserved)
    → calls generateCompanionRoomResponse with kind 'session'
non-session practitioner_post:
    → call new generateCompanionParticipation
    → returns either null (silence) or { body, addressee_user_id }
sponsor_message:
    → no Response Companion engagement (current behavior)
    → exception: sponsor-drift moderation, currently deferred
       per chat-room-plan §3, surfaces as a future Phase 10E
```

The followup heuristic at `route.ts:237-275` is removed. The addressee
gate from today's commits becomes dead code on this path and is also
removed; the addressee column itself stays, because the new
generator writes it directly.

### 4.2 Why session marks remain a guaranteed-fire

The session mark is a deliberate user action with a long-standing
contract: marking a message gets the Response Companion's reflection.
Removing that contract — making session marks subject to the same
"should I speak?" decision as anything else — would silently change
practitioner behavior. Practitioners who mark sessions specifically
to elicit Response Companion attention would suddenly get silence
sometimes, and the affordance would lose its signal value. The
simpler design preserves the contract and lets the new participation
logic operate on the remainder.

### 4.3 The participation decision

A single Anthropic call per non-session practitioner_post. The
envelope is the same shape as today's `buildUserContent` — roster,
recent history (now including any Memory Curator summaries from §3),
the triggering message — but the system prompt is amended (or, more
cleanly, a new system prompt branched from the existing one) to
instruct the Response Companion that:

- Most messages do not need a Companion response. Speaking when
  silence would have served better is a failure mode worth being
  conservative about.
- When choosing to speak, name the addressee at the start of the
  message (the addressing discipline already in the prompt as of
  commit `73a93ae`).
- When choosing not to speak, return the literal token `[silence]`
  as the entire response — nothing else.

Parsing: the route checks for `[silence]` as the first non-whitespace
characters of the response. If present, no row is written. Otherwise,
the response is inserted as a `companion_response` row with the
addressee parsed by the existing `parseAddresseeUserId`.

**Alternative considered: structured tool use.** The cleaner shape is
to model the decision as a tool call — `speak({ body, addressee })`
or `remain_silent({})`. Anthropic SDK tool use is well-supported.
This adds one model-side concept (tool definitions) but removes the
fragility of token-string parsing. Decide between sentinel-token and
tool-use during the dry-run round; both are viable.

### 4.4 Cost considerations and the Decider/Generator split

At self-pilot scale (one or two practitioners, a few messages per
day), every non-session practitioner post triggering a Sonnet call is
trivial — well under $1/month. At hypothetical scale (100 active
rooms × 10 messages/day × $0.01/call), it is ~$10/day, $300/month.
Same order of magnitude as the existing per-session Companion cost.

If the per-message cost or latency becomes a real constraint, the
natural next step is the Decider + Generator agent split inventoried
in §2.1: a Haiku Decider runs first as a cheap silence-or-speak gate;
a Sonnet Generator runs only when the Decider says speak. Two-call
structure, half the cost on silence (which should be the majority
case), and each prompt becomes tunable independently. Premature now
because the single-call shape doesn't yet exist in production to
optimize against; reasonable revisit in a future phase.

A cheap rule-based pre-gate (skip messages under N characters with no
media; skip messages within K seconds of a Response Companion reply)
is the only optimization worth designing before the agent split.

### 4.5 Dry-run discipline

This phase requires the chat-room-plan §6.2 dry-run treatment in
full. The prompt change is what makes the architecture work or
not — getting it wrong produces either a chatty Response Companion
that ruins the room or a silent one that produces no value over
today's behavior.

Plan the dry-run with at least 10 scenarios covering both the speak
and silence cases:

1. Substantive non-session post about own practice (the David
   "Italian sentences" case from 2026-04-26 — Companion should engage
   with a question)
2. Side-chat between two practitioners about each other's work (the
   Rick/David case from 2026-04-22 — Companion should stay silent)
3. Practitioner asks the Companion a direct question ("what should I
   focus on?") — Companion should engage
4. Casual one-line chat ("tired tonight") — Companion should stay
   silent
5. Practitioner names a struggle without session-marking ("running
   out of energy this week") — Companion should engage briefly,
   probably with one question
6. Sponsor sends an evaluative message into the room — Companion
   should still stay silent on the participation path; sponsor-drift
   moderation is a separate (deferred) trigger
7. Multi-practitioner room where one is mid-streak and the other is
   between commitments and chatting — Companion should know who's
   in active practice
8. Practitioner posts the same kind of thing for the third day in a
   row — Companion may name the pattern (per existing prompt) but
   should not over-engage on the third instance just because there
   were two prior
9. Returning lingering member after a long silence — Companion
   should engage on what they said, not on the silence
10. Practitioner answers a Companion question via session-mark
    instead of chat — the session path fires guaranteed; the
    participation path should not also fire on the same row

Each scenario produces a target answer ("speak with X" or "stay
silent"). Run each through 2–3 candidate prompts. Pick the one that
gets the speak/silence judgment right most often AND produces good
content when it speaks.

Build out the candidate prompts and the scenarios in
`docs/chat-room-plan.md` §6.x as a new section so the rationale is
co-located with the existing voice-design rationale.

### 4.6 Schema deltas

None required. The `addressee_user_id` column from `73a93ae` already
covers everything 10B writes. Optional additions worth considering
but not required:

- `companion_decision text` on `room_messages` for Companion rows —
  records the model's brief reason for speaking (or null for the
  guaranteed session-mark path). Useful for auditing the
  speak/silence decisions in production.
- `companion_trigger_kind text` on `room_messages` — records what
  fired ('session' | 'participation'). Useful for analytics.

Recommend adding both at the same migration if 10B ships; they are
write-only from the Companion path and cheap to carry. Defer if the
migration adds friction.

### 4.7 Exit criteria

- One full week of self-pilot use (David and at least one other
  practitioner posting under realistic conditions) with no instances
  of the Response Companion mis-engaging side-chat AND no instances
  of failing to engage substantive non-session material that in
  retrospect should have been engaged.
- The two production traces from `bcd-arc.md` (2026-04-22 Rick/David
  over-engagement and 2026-04-26 David "Italian sentences"
  under-engagement) are demonstrably resolved when re-played as
  scenarios against the new architecture.
- The followup heuristic and the addressee fallback gate are removed
  from `route.ts`; the new participation path is the only non-session
  Response Companion entry.

---

## 5. Phase 10C — Composer affordance: voice input

Already well-scoped in `companion-v2-scope.md` §3. Repeating the
scoped recommendation here for consolidation:

- Whisper option B (Groq `whisper-large-v3`, reusing the pipeline
  in `src/lib/companion/media.ts`).
- Voice-to-text only; not voice-as-message.
- New route: `src/app/api/rooms/[id]/transcribe`, POST audio blob,
  return transcribed text.
- Composer change: mic button next to camera/gallery in
  `src/app/room/[id]/room-composer.tsx`. Recording UI, "stop"
  affordance, transcribed text lands in the textarea as if typed.
- Mobile-first ergonomics — the keyboard pain on iOS is where this
  affordance is most likely to actually get used.

Independent of 10B code-wise. Sequence after 10B for the reason given
in the scope doc: the composer's role in the room should be settled
before adding affordances. If 10B reshapes how the Companion engages
chat — and it will — voice input added before 10B may need re-tuning
when 10B ships.

Estimated work: one session. Whisper integration is straightforward
because the transcription pipeline already exists.

Exit criteria: a self-pilot session where David sends at least three
voice-transcribed messages from a phone without re-typing.

---

## 6. Phase 10D — Streaming Companion responses

Stays explicitly deferred. From `companion-v2-scope.md` §2: "park
until real use of the v1 followup path makes the 3–5s latency feel
dead." That has not happened. The trigger to revisit is a self-pilot
report from David that the latency is the felt pain point, after at
least one full week under the post-10B Response Companion.

Architecture sketch from the scope doc remains valid: SSE route,
placeholder row pattern, `REPLICA IDENTITY FULL` on `room_messages`,
publication update, reconnection handling. None of that is current
work.

---

## 7. Cross-cutting decisions

### 7.1 Self-pilot pause points

Each phase ends with at least one week of self-pilot observation
before the next phase begins. The pause is not optional; the value of
the plan is that it forecasts what is worth building, and the
forecast is worth more when each step's outcome can shape the next.
Concretely:

- **10A → 10B pause:** at least one week. Watch whether the
  cross-commitment memory infrastructure changes the Response
  Companion's behavior in noticeable ways even when no commitment
  has completed (it shouldn't; verify it doesn't). Also leaves the
  addressee fix from today's commits enough air to expose any
  unrelated regressions.
- **10B → 10C pause:** at least one week, with the explicit checks
  in §4.7. This is the longest pause because 10B is the most likely
  phase to need a follow-up adjustment.
- **10C → 10D pause:** indefinite, gated on the latency-pain signal.

### 7.2 Dry-run discipline

Yes for prompt-shaped work, no for code-shaped work. Concretely:
- 10A's Memory Curator gets a dry-run round (§3.3).
- 10B's participation prompt gets a dry-run round (§4.5).
- 10A's schema/read-path work and 10C's Whisper integration do not.

The chat-room-plan §6.2 process of running candidate prompts against
a fixed scenario set is expensive (an afternoon of API calls and
careful reading) but reliably catches voice-level failures that code
review cannot. Apply where the failure mode is "the Companion sounds
wrong"; skip where the failure mode is "the code throws."

### 7.3 The two commits from 2026-04-26

Stay shipped. The implicit-addressee gate (`79ad074`) is correct and
costs nothing to keep; the explicit `addressee_user_id` column with
parser (`73a93ae`) is correct and is reused by 10B's new generator.
Neither needs revisiting. The followup-path code that the addressee
gate guards is what 10B removes; the gate goes with it.

### 7.4 Adding new agents in future phases

When a new agent is added (e.g., the Decider/Generator split, the
Critic, sponsor-drift moderation), it registers in §2.1 with role,
cadence, and status. It does not become a new phase letter. Phase
letters track work units against the four-phase backbone; agent
additions are smaller-grain decisions that may happen inside a phase
or as a deferred-then-promoted item. This keeps the plan's top-level
structure stable as the agent inventory grows.

### 7.5 What gets cited from this plan

When making a decision during a Phase 10 session — "should we add
this trigger? should we ship this prompt change? should we pause
here?" — the reasoning trail is:

- This plan doc, primarily.
- `docs/companion-v2-scope.md` for the scope-survival reasoning that
  produced the items in the first place.
- `docs/bcd-arc.md` Known-follow-ups entries dated 2026-04-22 and
  2026-04-26 for the two production traces that drove the
  conversation-aware-participation choice.
- `docs/chat-room-plan.md` §§3, 6, 7 for voice and event-by-event
  behavior — the part that does not change in Phase 10.

When this plan disagrees with the older ones, this plan wins for
Phase 10 work specifically.

---

## 8. Deliberately out of scope

- **Sponsor-drift moderation as a Companion behavior.** Listed as a
  deferred Companion behavior in `chat-room-plan.md` §3 and §7.
  Probably surfaces as a future Phase 10E once 10B is stable and
  the participation decision can be extended to cover sponsor
  messages too. Not in this plan.
- **Day-90 sponsor summary persistence.** Tracked separately in
  `bcd-arc.md` as a deferred item with a clear trigger condition
  (first real sponsor or Anthropic billing line item). Not Phase 10.
- **Silence-detection check-ins, lingering-member nudges, room
  dormancy.** Listed as deferred in `chat-room-plan.md` §3 and §7.
  Phase 10B's participation decision will likely subsume some of
  these (the model can detect a long silence and decide to ask),
  but explicitly designing them as separate triggers re-introduces
  the trigger-proliferation failure mode. Defer.
- **Multi-room navigation, rooms-list home, room admin authority.**
  All deferred per `chat-room-plan.md` §7. Out of Phase 10 scope.
- **Visual analysis layers 2 and 3.** Per `v4-decisions.md` §7,
  frame extraction and pose estimation are separable product bets
  that wait on demand. Not Phase 10.
- **Companion responding to fresh video uploads.** Re-cast in scope
  doc §5 as the "is this the session?" nudge; that nudge is itself
  folded into 10B's participation decision (a substantive media post
  without a session mark is precisely the kind of thing 10B's
  decision will reach for). Not a separate trigger in this plan.
- **Critic and Sponsor Shadow agents.** Inventoried in §2.1 as
  deferred. Both are observability/quality plays, not v2 product
  work; revisit when the Response Companion or sponsor-side surface
  produces concrete drift evidence that warrants them.

---

## 9. Forecast invalidation

This plan is a forecast. The self-pilot is allowed to invalidate it.
Specifically:

- If 10A's cross-commitment memory turns out to be unused (no
  commitments complete in the self-pilot window) but 10B is ready
  to ship, do 10B first against a Curator-less context envelope.
  The phases are not strictly ordered if reality forces a re-shuffle.
- If 10B's dry-run reveals that conversation-aware participation
  produces a Response Companion that reads badly across most
  scenarios, the plan reverts to "patch the trigger model further"
  and 10B becomes a research note rather than a shipped phase.
- If self-pilot accumulates a third architectural failure trace
  (after 2026-04-22 and 2026-04-26) that is not in the conversation-
  aware-participation shape, the plan is wrong about the diagnosis
  and needs a fresh pass.
- If a new agent is needed mid-phase (e.g., the Critic becomes
  necessary because the Response Companion drifts), add it to §2.1
  and decide whether it ships inside the current phase or as a
  separate small ship. Do not mint a new phase letter just for an
  agent addition — see §7.4.

When any of those happen, edit this doc directly. The plan is
under-specified for any Phase 10 session that opens more than two
weeks from this draft.
