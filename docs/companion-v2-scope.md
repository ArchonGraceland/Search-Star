# Companion v2 / Phase 10 — Scope Reconciliation

*Drafted 2026-04-26. Reconciles the five-item roadmap inherited from
`docs/next-session-companion-v2.md` (deprecated 2026-04-20) and CLAUDE.md
against the post-Decision-#8 schema and the post-B/C/D-arc code.
Planning document only — no code changes proposed in this pass.*

## TL;DR

Of the five inherited items, **two are already shipped**, **two survive
intact and need only fresh framing**, and **one (persisted threads) was
written for a surface that no longer exists** and must be re-cast or
dropped. A sixth item — the multi-practitioner addressee bug logged in
`docs/bcd-arc.md` lines 1498–1597 — is the most concrete piece of
production evidence we have for what "Companion v2" actually has to
solve, and should anchor the phase rather than sit as a footnote.

| # | Inherited item | Survives #8? | Status today |
|---|---|---|---|
| 1 | Chat UI on room (continuing conversation) | Yes — but absorbed by Phase 2 | **Shipped** at v1; addressee-aware behavior is the open V2 work |
| 2 | Streaming responses | Yes | Deferred per `chat-room-plan.md` §6.6 Decision C — open |
| 3 | Voice input (MediaRecorder / Web Speech) | Yes | Not started — composer is text + media only |
| 4 | Persisted threads | **No, not as written** | Surface no longer exists; must be re-cast |
| 5 | Companion responds to fresh video uploads | Partially | Conflicts with Decision #7 — re-cast as "narrated session" pattern |

The recommended Phase 10 scope, distilled from these five plus the V2
addressee bug, is at the bottom of this doc (§7).

---

## 1. Chat UI on the room (continuing conversation)

**Survives Decision #8?** Yes, in spirit, but the item as written is
already done.

**Where it lives now.** The chat UI shipped in Phase 2 of
`docs/chat-room-plan.md`. The relevant code:

- `src/app/room/[id]/page.tsx` — SSR room page, post-login home for
  every current user.
- `src/app/room/[id]/realtime-messages.tsx` — Supabase Realtime
  subscription on `room_messages` (and `message_affirmations` since
  Session 4B), with the bounded-retry + visibility-refresh fallback
  from Session 3.5 / 4.3.
- `src/app/room/[id]/room-composer.tsx` — text + Cloudinary media,
  session-mark toggle (one per calendar day per practitioner, enforced
  by the unique partial index from `20260420_v4_rooms_and_messages.sql`
  and by the `messages/[msg_id]/toggle-session/route.ts` endpoint).
- `src/app/room/[id]/room-message.tsx` — per-message rendering, with
  affirmation UI for sponsors on session-marked messages.
- `src/app/api/rooms/[id]/messages/route.ts` — POST handler whose
  `after()` block fires the Companion on either `triggerKind: 'session'`
  (when `is_session = true`) or `triggerKind: 'followup'` (when the last
  `companion_*` body has a `?` in its final 200 chars).

**Tables touched.** `rooms`, `room_memberships`, `room_messages`,
`message_affirmations` — all created and policed by
`20260420_v4_rooms_and_messages.sql`,
`20260420_v4_rooms_repair_tail.sql`,
`20260421_v4_message_affirmations_realtime.sql`,
`20260421_v4_message_affirmations_replica_identity.sql`,
`20260421_v4_room_messages_realtime.sql`, and
`20260421_v4_simplify_room_memberships_select_policy.sql` (the
non-recursive RLS fix that finally made delivery work).

**Corrected scope for V2.** The continuing-conversation work is
*shipped* at v1 fidelity. What remains under this heading is the open
V2 problem: **the Companion is not addressee-aware in
multi-practitioner rooms.** Production evidence is in `docs/bcd-arc.md`
lines 1498–1597 (the Rick / David / Companion exchange on 2026-04-22).
The followup heuristic at `src/app/api/rooms/[id]/messages/route.ts:228–285`
fires whenever any practitioner posts a non-session message after a
Companion question, with no notion of who the question was for; the
followup envelope at `src/lib/companion/room.ts:369–380` then assumes
the trigger user is the addressee. This is benign in a one-practitioner
room and visibly broken the moment a second practitioner appears.

The right frame for V2 is the option-3 fix from that follow-up entry:
move from "react to one trigger message at a time" to
**conversation-aware participation** — the Companion sees the recent
stream and decides whether to speak, not whether to react. That is what
`chat-room-plan.md` §3 has always pointed at ("group chat moderator
first, individual accompanier second"); v1 just shipped a coarser
heuristic in the meantime.

**Recommendation.** Treat item 1 as the *spine* of Phase 10, not as
"build a chat UI." The chat UI exists. The work is making the
Companion's participation in it honest at multi-voice scale. This will
require a small schema change (probably an `addressee_user_id text |
null` column on `room_messages` for Companion-authored rows, so future
trigger gates can read intent rather than re-parse prose) and a system
prompt amendment requiring the Companion to name its addressee when
asking a question.

---

## 2. Streaming responses

**Survives Decision #8?** Yes, untouched. This is a UX-latency item, not
a structural one.

**Where it lives now.** Nowhere yet. `src/lib/companion/room.ts` calls
`getAnthropic().messages.create()` with no `stream: true`; the response
is written atomically to `room_messages` and delivered via Realtime
INSERT. End-to-end the practitioner experiences a 3–5s pause after
session-mark before the Companion's reply appears.

**Tables touched (if implemented).** None at the schema level. The
implementation surface is operational:

- A new SSE route (probably `src/app/api/rooms/[id]/messages/[msg_id]/companion-stream/route.ts`)
  that opens a `ReadableStream`, calls Anthropic with `stream: true`,
  and writes accumulated text back into a placeholder `room_messages`
  row as deltas arrive.
- A placeholder-row pattern: insert the `companion_*` row immediately
  with `body = ''` and a `streaming: true` flag (column or convention),
  then UPDATE on each token batch. This means the Realtime subscription
  must handle `room_messages` UPDATE events, not just INSERT — which
  in turn means `REPLICA IDENTITY FULL` on `room_messages` (today it
  is DEFAULT per Session 3 notes), and a publication update.
- Reconnection handling for tab-backgrounded mid-stream + a deterministic
  final-state once the stream completes.

**Corrected scope.** No correction needed. The decision rationale in
`chat-room-plan.md` §6.6 Decision C and the deferred-features list in
§7 still stand: park until real use of the v1 followup path makes the
3–5s latency feel dead. As of today (one active user, low-traffic
room), it does not. Recommend Phase 10 *contains* the streaming option
but does not commit to shipping it until two conditions hold: (a) the
addressee-aware Companion from §1 above is live and stable, and (b)
David has spent at least one full week of self-pilot use under that
v2 Companion and reports the latency as the felt pain point.

If/when shipped, the work is meaningfully larger than item 1 and should
be its own session per §6.6 Decision C.

---

## 3. Voice input (MediaRecorder / Web Speech)

**Survives Decision #8?** Yes, untouched. This is a composer affordance,
not a structural decision.

**Where it lives now.** Nowhere. Confirmed by grep — no `MediaRecorder`,
`webkitSpeechRecognition`, or `SpeechRecognition` references anywhere
in `src/`. The composer at `src/app/room/[id]/room-composer.tsx` exposes
a textarea, a camera button (file input, `capture`), and a gallery
button (file input). That is the entire input surface.

**Tables touched (if implemented).** None at the schema level. The
implementation surface is composer-side and lib-side:

- `room-composer.tsx` gains a microphone affordance. Two architectural
  choices, with different cost profiles:
  - **Option A — Web Speech API (`SpeechRecognition`).** Browser-native,
    free, lower latency, but Safari/iOS support is uneven and quality
    is poor for non-English. No backend cost.
  - **Option B — `MediaRecorder` → Groq Whisper.** Reuses the
    `whisper-large-v3` pipeline already wired up in
    `src/lib/companion/media.ts` for video transcription. Quality is
    consistently good across languages; cost is the same as a video
    transcription per minute of speech. Adds a small backend route to
    accept the audio blob and return text (probably
    `src/app/api/rooms/[id]/transcribe/route.ts`, mirroring
    `getOrFetchTranscript`).
- Either way, the transcribed text lands in the textarea as if typed,
  and the existing send path is unchanged. No `room_messages` schema
  change is required.

**Corrected scope.** The roadmap item is correctly framed but
under-specified. The right v1 of voice input is **option B (Whisper),
voice-to-text only — not voice messages.** Reasons: (a) the Companion's
context-assembly pipeline already reads transcripts inline (see
`src/lib/companion/room.ts` line 267 `transcriptNote` handling and
`media.ts:getOrFetchTranscript`), so voice-as-text drops cleanly into
the existing flow; (b) audio-first messages would need new render code
in `room-message.tsx`, new affirmation semantics, and a story for what
sponsors *see* when scrolling — all of which is out of scope for a
composer ergonomic; (c) Decision #7 already names "voice-annotated
video" as the canonical pattern for visual practices, which is a
different surface (camera + mic together) than text-composer voice
input.

Recommend deferring this item until §1 ships, then prototyping option
B as a single-session piece of work. Watch for the keyboard-on-mobile
ergonomics specifically — that is where this affordance is most likely
to actually get used.

---

## 4. Persisted threads

**Survives Decision #8?** **No, not as written.** This is the item
CLAUDE.md flagged. Worth being explicit about why.

**What "persisted threads" meant in the deprecated plan.** In
`docs/next-session-companion-v2.md` the Companion was a
practitioner-facing assistant living on the practitioner's own surface,
distinct from any sponsor surface. "Persisted threads" meant: a
conversation between one practitioner and the Companion that survives
across page loads, distinct from session posts to the validator/sponsor
feed. The mental model was practitioner ↔ Companion as a private
dialogue with its own scrollback.

**Why Decision #8 retires that.** Under #8 there is no
practitioner-only surface. Every Companion utterance is in the room and
visible to every member; the spec language is "you sound the same to
all of them" (`v4-decisions.md` decision #8, repeated in the chosen
system prompt at `chat-room-plan.md` §6.4). A private
practitioner ↔ Companion thread would re-open the
weirdly-private-AI-register failure mode that decision #8 explicitly
forecloses. And it is anyway redundant: the room already provides a
persistent, multi-message scrollback that survives reloads — that *is*
the thread.

**What does survive, re-cast.** There are two real Companion-memory
problems hiding inside the original "persisted threads" framing, and
both are worth Phase 10 attention:

1. **Cross-commitment memory inside one room.** Today
   `loadRoomHistory` (in `src/lib/companion/room.ts`) fetches the most
   recent ~50 messages in the room, full stop. When a practitioner
   completes a 90-day commitment and starts a new one inside the same
   room, the Companion's working memory drops everything from the prior
   commitment as soon as 50 newer messages accumulate. That is the
   wrong shape for a steward whose value is supposed to come from
   long-arc continuity (per `v4-decisions.md` §7 and §8). Fix: extend
   context to include a bounded summary of each prior completed
   commitment in this room, plus the most recent N raw messages from
   the active commitment. The migration cost is small (a
   `commitments.completion_summary text` column already on the
   deferred-work list per `bcd-arc.md` post-arc cleanup), and the
   Companion-side change is in `loadRoomContext` and `buildUserContent`.

2. **Whose voice the Companion is replying to.** This is the §1 item
   above (addressee-awareness), and storing the addressee on
   Companion-authored rows is itself a form of persisted-thread state
   — just structured per-row rather than per-conversation.

**Recommendation.** Drop "persisted threads" from the roadmap as a
named item. Replace with two concrete sub-items: (a) cross-commitment
context in `loadRoomHistory`, and (b) per-row addressee tracking on
Companion messages (folded into §1 above). Both have clear schema
shapes and clear value; neither requires a new surface.

---

## 5. Companion responds to fresh video uploads

**Survives Decision #8?** Partially. The trigger is well-defined; the
implied behavior conflicts with Decision #7 and needs re-casting.

**Where it lives now.** Today the only Companion triggers in the
production code path are:

- `triggerKind: 'session'` — fires when a practitioner sets
  `is_session = true` on their own message
  (`src/app/api/rooms/[id]/messages/route.ts` after-block, primary
  branch).
- `triggerKind: 'followup'` — fires when a practitioner posts a
  non-session message and the most recent `companion_*` message ends
  with `?` in its last 200 chars (same after-block, secondary branch).

A bare video upload — practitioner attaches a video, does not toggle
the session mark — produces a `practitioner_post` row with
`is_session = false` and never invokes the Companion. The video gets
transcribed lazily by `getOrFetchTranscript` *if and when* the
Companion is ever called for some other reason on a context that
includes that row.

**Tables touched (if implemented as written).** None at the schema
level. The implementation surface is the after() block itself: a third
trigger branch keying on "post has media URLs and no session-mark
fired yet today."

**Why re-casting is needed.** The roadmap item presupposes that a
video upload is a Companion-worthy event in itself. Decision #7 says
the opposite: the value of a video session is the practitioner's voice
narrating it, not the pixels. The session-mark — set by the
practitioner — is the canonical signal that *this* is the moment to
engage, and the prompt at `chat-room-plan.md` §6.4 explicitly tells
the Companion not to critique execution from video. So a Companion
that fires on every uploaded video would either (a) reach for verdict
on visual content the prompt forbids it from judging, or (b) produce
content-free remarks because the practitioner has not yet told it what
the video is about.

The honest version of this item is therefore not "fire on video
upload." It is one of three smaller things, of which I recommend the
first:

- **Recommended: surface the unmarked-but-substantive post.** If a
  practitioner posts media + meaningful text (or media + a transcribed
  voice annotation) without marking it as the session, the Companion
  should ask, briefly, whether this was the session — *not* respond
  substantively to it. This is a one-line nudge, not a session-style
  reflection. Implementation: third after() branch, fires on
  `practitioner_post` rows with `media_urls non-empty AND is_session =
  false AND no session-marked post today`, with a third
  `triggerKind: 'is_this_the_session'`. Cheap, restraint-respecting,
  and aligned with the existing prompt's discipline.
- *Alternative: do nothing.* Treat video uploads exactly like text
  posts. The practitioner who wants Companion attention marks the
  post. This is what ships today. Defensible.
- *Worse alternative: full substantive response on every video upload.*
  Re-introduces the verdict-from-video failure mode. Decline.

**Corrected scope.** Re-frame this item as "**Companion gently
prompts when a substantive post is missing its session mark**," with
the trigger and copy contract above. Do not frame it as "Companion
responds to video uploads."

---

## 6. New item — addressee-aware Companion (the V2 spine)

Not in the inherited roadmap; surfaced by production use on
2026-04-22 and logged in `docs/bcd-arc.md` lines 1498–1597. Should be
treated as the central item of Phase 10 because it is the one with
concrete production failure data.

**The bug, briefly.** In a multi-practitioner room, a Companion question
addressed to practitioner A followed by a chat reply from practitioner
B causes the Companion to fire its followup path against B's message,
producing a meta-correction ("That's David, not Rick — Rick is the one
answering about sets") that breaks the social frame.

**Why it is V2-shaped, not V1-patchable.** Quoting the bcd-arc entry's
own analysis: the V1 followup path is a unitary trigger that does not
distinguish between "the practitioner I asked is replying" and
"someone else is talking." The narrowest patch (string-match the
addressee against `profiles.display_name`) is brittle; the middle
patch (store addressee per row + reliable prompt instruction) is the
right v2 shape; the broadest fix (move to conversation-aware
participation) is the actual long-term direction. The recommended path
is the middle one as the v2 baseline, with the broadest fix as a
direction rather than a milestone.

**Surfaces / tables.** A small schema change on
`room_messages`: nullable `addressee_user_id uuid` column,
foreign-key to `profiles(user_id)`, settable only on Companion-authored
rows (RLS enforced). System prompt amended to require addressee
naming when asking a question, with the parsed addressee written by
the after()-block on insert. Followup trigger gates on
`addressee_user_id = trigger_user_id`.

**Why this should anchor Phase 10.** The other items (streaming, voice
input) are nice-to-have ergonomics; the addressee bug is a behavioral
defect that visibly breaks the room's social model the moment more
than one practitioner appears. The natural next room David adds — his
own as it onboards a second practitioner, or any future room with a
non-trivial member count — will hit it on day one.

---

## 7. Recommended Phase 10 scope

In priority order, smallest scope first:

1. **Drop or rename "persisted threads"** in any roadmap surface that
   carries it. The phrase has no concrete referent under Decision #8.
2. **Ship addressee-aware Companion** (item 6 above + the §1
   re-framing). Schema change, prompt amendment, trigger-gate change.
   Resolves the only Companion behavior that has produced a logged
   production complaint.
3. **Cross-commitment memory in `loadRoomHistory`** (item 4 re-cast,
   sub-item a). Adds the long-arc continuity that
   `v4-decisions.md` §7 and §8 keep promising the Companion has.
   Probably blocked on the deferred `commitments.completion_summary`
   column from `bcd-arc.md` post-arc cleanup; both can ship together.
4. **Voice input on the composer** (item 3). Single-session piece of
   work, Whisper-based, voice-to-text only. Wait for §2 and §3 above
   to land first so the composer's role in the room is stable when
   the affordance is added.
5. **"Is this the session?" nudge on unmarked substantive posts**
   (item 5 re-cast). A small after()-block addition. Useful, but only
   after the addressee-aware Companion is live — otherwise it
   compounds with the addressee bug.
6. **Streaming Companion responses** (item 2). Park until items 2–5
   above ship and at least one week of self-pilot use under the v2
   Companion has reported the 3–5s latency as a felt problem.

What this list is *not* is the Phase 10 of the deprecated companion-v2
doc. It is what the original five items become when read against the
post-Decision-#8 schema, the post-B/C/D-arc code, and the one piece of
real production failure data we have. The two items the original
roadmap missed (addressee-awareness, cross-commitment memory) are
the ones most worth the project's time.

---

## Appendix — items deliberately left out

- **Day-90 sponsor summary persistence.** Tracked separately in
  `bcd-arc.md` as a deferred item with a clear trigger condition
  (first real sponsor or Anthropic billing line item). Not Phase 10.
- **Silence-detection check-ins, lingering-member nudges,
  sponsor-drift moderation.** Listed as deferred Companion behaviors
  in `chat-room-plan.md` §3 and §7. They depend on Phase 3 self-pilot
  observation that has not yet accumulated; including them in Phase
  10 would be speculative.
- **Multi-room navigation, rooms-list home, room admin authority,
  room dormancy.** All deferred per `chat-room-plan.md` §7. Out of
  Phase 10 scope.
- **Visual analysis layers 2 and 3.** Per `v4-decisions.md` §7, frame
  extraction and pose estimation are separable product bets that wait
  on demand. Not Phase 10.
