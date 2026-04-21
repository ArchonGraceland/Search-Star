# B/C/D Arc — Multi-Session Plan

*Working document for the six-session arc completing Options (B), (C), and (D)
from the Phase 2 walkthrough handoff. Written 2026-04-21 following commit 406dd95
(public narrative cleanup). Updated at the end of each session.*

---

## The arc at a glance

Six sessions, roughly 2–3 hours each, in this order:

| # | Phase | Deliverable |
|---|---|---|
| 1 | B-1 | Milestone Companion lib function + admin-triggered endpoint |
| 2 | B-2 | Daily cron — day 30/60/90 auto-milestones + day-90 auto-completion |
| 3 | C-1 | Move session-mark Companion response to after() + Realtime |
| 4 | C-2 | Realtime across all message types, optional token streaming |
| 5 | D-1 | Audit deep links; decide per-route fate for 9 dead files |
| 6 | D-2 | Execute the D-1 plan, build + deploy verification |

**Order rationale.** B first (highest product value). C second (C-1 benefits from
having more Companion traffic to test Realtime against, which B's milestones
will produce). D last (repo hygiene, good wind-down work).

**Parallelizability.** D doesn't depend on B or C; if a B/C session stalls, D
is always available. The six phases can be reordered freely — only dependencies
are B-2 on B-1, C-2 on C-1, D-2 on D-1.

**Per-session discipline.**
- Read this file + docs/v4-decisions.md + docs/chat-room-plan.md at session
  start
- Fresh `git clone --depth 1` from main
- `npx tsc --noEmit` clean before commit
- `git restore package.json package-lock.json` after any `npm install`
- Author: dverchere@gmail.com (required for Vercel)
- Push to main, verify deploy READY, fetch the changed surface in production
- Update "Session completion log" below at session end

---

## Session 1 — B-1: Milestone infrastructure

**Goal.** Server can generate a Companion milestone message for any active
commitment. Manually-triggered only.

**Scope.**
- `generateCompanionRoomMilestone({ roomId, commitmentId, dayNumber })` in
  `src/lib/companion/room.ts`, twinned with `generateCompanionRoomWelcome`
- System prompt: three candidates, dry-runs at day 30/60/90, rationale in
  a new `docs/chat-room-plan.md §6.5`
- Day-90 variant is a short framing message, not the summary itself —
  link/reference `day90.ts` output
- `POST /api/admin/companion/milestone` admin-auth gated, non-idempotent
- Test against commitment `f6c2a97c-b8d7-45aa-984c-2e062834638e`

**Done when.** Admin endpoint takes `{commitment_id, day_number}` and produces
a `companion_milestone` row in `room_messages`. Prompt is calibrated. Day-90
hook wired but not automatic.

**Out of scope.** Cron (Session 2). Changes to `day90.ts`. Real-time delivery.

---

## Session 2 — B-2: Cron automation

**Goal.** Daily cron automatically drops milestones into rooms hitting day
30/60/90. Day 90 transitions status to `completed`.

**Scope.**
- `app/api/cron/companion-milestones/route.ts`, authed via CRON_SECRET
- Query: active commitments where `floor((now - started_at) / 1 day) IN
  (30, 60, 90)`
- Idempotency: check for existing `companion_milestone` at this day number
  before inserting (cron retries + DST-adjacent days)
- Day 90: insert milestone → compute day90 summary if missing → status →
  `completed`. Status transition is load-bearing; summary fallback is fine
- Register in `vercel.json`, daily at 09:00 UTC
- Manual trigger in production with CRON_SECRET to verify

**Done when.** Cron runs daily in production. Auto-milestones appear. Day 90
auto-completes.

**Out of scope.** Anything beyond 30/60/90. Sponsor notifications on milestone
events (separate feature).

---

## Session 3 — C-1: Async session-mark Companion response

**Goal.** Session-mark POST returns in <200ms. Companion response streams in
via Realtime.

**Scope.**
- Current synchronous path in `POST /api/rooms/[id]/messages` (calls
  `generateCompanionRoomResponse` before returning) moved to Next.js
  `after()`
- RLS audit: verify `room_messages` SELECT policy streams correctly to
  active room members via Realtime (Realtime uses user JWT, takes different
  code path than direct SELECTs — worth explicit verification)
- Client: subscribe to `room_messages` INSERT filtered on room_id. Simplest
  approach is a thin client wrapper around the server-rendered room page
- **Two test cases, both explicitly verified:**
  1. Sponsor's JWT receives their own room's new messages
  2. Sponsor's JWT does NOT receive a different room's new messages

**Done when.** Practitioner session-marks, sees immediate acknowledgment,
Companion response arrives a few seconds later without refresh.

**Out of scope.** Token streaming (Session 4). Sponsor-message Realtime
(Session 4). UI redesign.

---

## Session 4 — C-2: Full Realtime + optional streaming

**Goal.** Every room message arrives via Realtime. Optional token-streamed
Companion responses.

**Scope.**
- Extend Realtime subscription to all `room_messages` inserts, not just
  Companion responses
- Decision point: token streaming on Companion responses? Pros: feels alive.
  Cons: partial renders, reconnection edge cases, final-message
  persistence. If yes, implement. If no, mark roadmap Phase 10 as partial
- Reconnection handling after network drop (Supabase SDK handles most, verify)
- Tab-backgrounded-then-returning refetch from cursor on focus
- Test with two browsers: your session + walkthrough sponsor
  (`dverchere+sponsor-walkthrough-1@gmail.com` if that account still exists)

**Done when.** Side-by-side browsers show messages appearing live in both
directions.

**Out of scope.** Typing indicators, read receipts, presence (Phase 10+).

---

## Session 5 — D-1: Audit + per-file policy

**Goal.** For each of the 9 dead files, know whether to delete, convert to
router, or fix copy. No deletions yet.

**Dead files inventory (verified 2026-04-21):**
1. `src/app/log/client.tsx` — obsolete session-logging form
2. `src/app/start/launch/[id]/page.tsx` — Decision #8 retired launch
3. `src/app/start/ritual/[id]/page.tsx` — Decision #8 retired ritual
4. `src/app/start/active/[id]/page.tsx` — transitively dead via #3
5. `src/app/start/sponsor/page.tsx` — former step 4
6. `src/app/start/sponsor/sponsor-step-form.tsx` — former step 4
7. `src/app/start/companion/page.tsx` — former step 5
8. `src/app/start/companion/companion-continue-button.tsx` — former step 5
9. `src/app/api/profiles/sponsor-step-seen/route.ts` — former step 4 API
10. `src/app/api/profiles/companion-step-seen/route.ts` — former step 5 API

Plus: one stale comment in `src/lib/media.ts` referencing #1.

(Note: the inventory lists 10 files under the heading "9 dead files" — the
heading was written before the final survey. Ten is correct.)

**Scope.**
- Grep every Resend email template for inbound links to `/log`,
  `/start/launch`, `/start/ritual`, `/start/active`, `/start/sponsor`,
  `/start/companion`
- Check Vercel runtime logs (last 30 days) for real traffic to these paths
- Per-file decision: delete / convert to thin router / fix copy
- Fix the `src/lib/media.ts` comment (only live code change this session)

**Done when.** Written decision table committed as this section's "D-1
outcome" subsection below.

**Out of scope.** Actual deletions.

---

## Session 6 — D-2: Execute

**Goal.** Dead files deleted or converted per D-1 plan.

**Scope.**
- Execute decisions from D-1
- Typecheck in batches of 2–3 file changes, not all at once
- Simplify `src/lib/stage.ts` if its comment-flagged "Retired: step 4/5/6"
  branches can go
- Full build (`npm run build`), not just typecheck — surfaces turbopack
  boundary bugs tsc misses (cf. commit 19ac621)
- Post-deploy verification: fetch every retired path in production,
  confirm clean redirect or 404 per plan

**Done when.** `src/app/start/` contains only live routes. `src/app/log/`
is just `page.tsx` + `layout.tsx`. Build is clean. No retired routes leak
through in production.

**Out of scope.** Scope expansion. If you find more dead code while
cleaning, note it in "Known follow-ups" below — don't expand mid-session.

---

## Session completion log

Append to this log at the end of each session. Format:

```
### Session N (YYYY-MM-DD) — <phase>
- Shipped: <commits, with SHAs>
- Deployed: <dpl_ ID, state>
- Deferred: <anything from scope that didn't ship, and why>
- State for next session: <anything the next session needs to know>
```

*(Log empty until Session 1 completes.)*

---

### Session 1 (2026-04-21) — B-1: milestone infrastructure

**Shipped** (commit `3f9107f`):
- `generateCompanionRoomMilestone({ roomId, commitmentId, dayNumber })` in
  `src/lib/companion/room.ts` — third entry point, twinned with
  `generateCompanionRoomWelcome`, reuses `loadRoomContext` +
  `loadRoomHistory`. Guards against commitment/room mismatch.
- `POST /api/admin/companion/milestone` — cookie client for auth
  (`profiles.role === 'admin'`), service client for the write. Derives
  `room_id` from the commitment server-side. Non-idempotent by design.
- `docs/chat-room-plan.md §6.5` — three envelope candidates dry-run at
  day 30/60/90 via live `claude-sonnet-4-6` calls against the real
  commitment. Candidate B (context-named, with explicit day-90
  disambiguation) chosen and adopted verbatim.

**Deployed**: `dpl_DmYxZevCWNoPxcHuonERjRvRvYLC`, state READY, aliased
to `searchstar.com`. Production smoke: `POST /api/admin/companion/milestone`
without auth returns `401 {"error":"Unauthorized"}` as designed — proves
the route is mounted, auth layer runs, body-parse gate is reached only
after auth. DB contract end-to-end verified via MCP-inserted
`companion_milestone` row (correct enum, FKs, RLS bypass under
postgres); scrubbed immediately so production is clean.

**Deferred**:
- **The real authenticated end-to-end test** (POST with an admin
  session cookie producing a row via the live Anthropic call). This
  container cannot acquire an admin cookie; leaving to David to run
  in-browser or via curl with a captured session cookie. Three-line
  recipe at the bottom of this entry.

**Key design finding from §6.5 worth carrying forward.** The day-90
milestone is *not* the completion marker. They are distinct events
with distinct copy contracts:
  - **Milestone marker** (this session): triggered by the calendar
    reaching day 30/60/90. Copy: `"Day N."` Nothing else.
  - **Final-session-on-day-90 event**: triggered when the practitioner
    marks a session on day 90. Handled by existing
    `generateCompanionRoomResponse` path. Copy includes the
    "Tom, Sarah, Mike — the record is in front of you" handoff.
  - **Day-90 sponsor summary**: triggered when status moves to
    `completed`. Produced by `summarizeCommitment` in `day90.ts`.
    Rendered on the completion page, not posted into the room.

Dry-run against candidate A at day 90 wrongly produced the completion
handoff addressed *to the practitioner*; candidate C produced it
addressed to the sponsor. Only candidate B (with the explicit "this
is the milestone-day marker, not the completion marker"
disambiguation) produced the correct bare `"Day ninety."` B is what
shipped. Session 2's cron will fire all three of these in sequence on
the same tick at day 90: milestone marker first, summary second,
status flip third. Spelled out in §6.5 so Session 2 doesn't
re-deliberate.

**State for next session (B-2, cron)**:
- `companion_milestone` is already in the `room_messages_message_type_check`
  constraint — no migration needed.
- The new lib function is `async`, returns `Promise<string | null>`,
  and is safe to call from a cron handler that treats `null` as "no
  row written, move on." Idempotency guard needs to live in the cron
  caller, not the lib function — check for an existing `companion_milestone`
  row on `(commitment_id, day_number)` before calling. The day_number
  isn't on the row, so the guard needs to compute it from `posted_at`
  relative to `commitments.started_at`, or the cron can just query by
  `commitment_id + message_type='companion_milestone'` and check
  whether the count matches the expected number of milestones so far.
  The latter is simpler.
- Day 90 in the cron: milestone first, then `summarizeCommitment`
  (idempotent by nature — it reads the record, doesn't write), then
  status flip to `completed`. The flip is the load-bearing action; if
  the Anthropic call for the summary fails, that's tolerable (fallback
  is the sponsor reads the record themselves). If the flip fails the
  cron must retry next day.

**Stale memory detected during the session**:
- `userMemories` references a `SUMMARY_MODEL` constant as separate
  from `COMPANION_MODEL` in `src/lib/anthropic.ts`. That constant
  does not exist — `grep -rn "SUMMARY_MODEL" src/` returns nothing.
  Only `COMPANION_MODEL` (= `'claude-sonnet-4-6'`) exists; `day90.ts`
  uses it for the summary. If separate model selection is ever
  wanted, introducing `SUMMARY_MODEL` is a mechanical change. Not
  worth doing until there's a reason.

**Three-line recipe for David's authenticated smoke test** (any session,
while logged in as admin at `https://www.searchstar.com`):

```
# In browser devtools on any searchstar.com tab (logged in as admin):
fetch('/api/admin/companion/milestone', {
  method: 'POST',
  headers: {'content-type': 'application/json'},
  body: JSON.stringify({commitment_id: 'f6c2a97c-b8d7-45aa-984c-2e062834638e', day_number: 30})
}).then(r => r.json()).then(console.log)
# Expected: {ok: true, message_id: "<uuid>", commitment_id: "f6c2a97c...", room_id: "29b52264...", day_number: 30, commitment_status: "active"}
# Then eyeball https://www.searchstar.com/room/29b52264-50be-411e-8294-2091ee28e8fb — "Day thirty." should appear.
# Delete the row via admin UI or SQL if you want to leave production clean before Session 2's cron fires.
```

---

### Session 2 (2026-04-21) — B-2: cron automation

**Shipped** (commit `5c62d4d`):
- `src/app/api/cron/companion-milestones/route.ts` — GET handler,
  `Authorization: Bearer $CRON_SECRET` auth, `?dry_run=1` supported.
  Scans all `status='active'` commitments, computes day-number as
  `floor((now - started_at) / 86400s)`, filters to 30/60/90. For each
  candidate: runs the milestone-row count idempotency guard, fires
  `generateCompanionRoomMilestone` if needed, and at day 90
  additionally calls `summarizeCommitment` (result discarded — see
  "State for next session" below) and flips status to `'completed'`
  via `UPDATE ... WHERE id=? AND status='active'` (the status-flip
  idempotency guard, independent of the milestone-row guard because
  the Session 1 admin endpoint is non-idempotent and can create a
  milestone row without flipping status).
- `vercel.json` — added `crons` array with
  `/api/cron/companion-milestones` at `0 9 * * *` (daily 09:00 UTC
  = 2am PST / 5am EST). No other crons defined in v4; the legacy
  `/api/cron/deep-mode` stub-route is still in the tree (see
  "Known follow-ups" below) but was intentionally NOT re-registered
  in `vercel.json`.

**Deployed**: `dpl_21RZ9taQNMApEBifEy4zAY8hSwDc`, state READY in ~22s
(buildingAt → ready: 1776769918077 → 1776769940252), aliased to
`searchstar.com`, `www.searchstar.com`, and the standard Vercel
project aliases. Turbopack bundler; `npx tsc --noEmit` and full
`npm run build` both clean pre-push.

**Production smoke test**: unauthenticated GET to
`https://www.searchstar.com/api/cron/companion-milestones?dry_run=1`
returns `401 {"error":"Unauthorized"}` with
`x-matched-path: /api/cron/companion-milestones` in the response
headers. Proves the route is mounted, the auth gate runs before any
DB access, and `dry_run=1` is parsed (doesn't break anything pre-
auth). Same 401 shape as Session 1's smoke test on the admin
endpoint — same interpretation.

**Deferred**:
- **The real authenticated end-to-end test** (valid
  `Bearer $CRON_SECRET` producing a dry-run response body). This
  container does not have the production `CRON_SECRET` value.
  Leaving to David to run once from a machine where the secret is
  available:
  ```bash
  curl -s -H "Authorization: Bearer $CRON_SECRET" \
    "https://www.searchstar.com/api/cron/companion-milestones?dry_run=1" | jq
  # Expected: {ok:true, dry_run:true, processed:[], candidate_count:0,
  #           total_active:N, checked_at:"..."}
  # At session time commitment f6c2a97c started 2026-04-19, so it's
  # ~day 2 — nothing in {30,60,90}, processed[] should be empty.
  ```
  Then once confident, fire without `?dry_run=1` to exercise the
  write path. On the null-result case this is a no-op — which is
  exactly what verifies that a zero-work cron tick is safe.
- **First automatic cron invocation at 09:00 UTC tomorrow
  (2026-04-22).** Will land on an empty candidate set. The first
  non-empty tick is not until a real commitment hits day 30.
  Commitment `f6c2a97c` (started 2026-04-19) will hit day 30 around
  2026-05-19, so that's the first natural end-to-end exercise of
  the cron — until then, manual `?dry_run=1` is the only way to
  observe real behavior.

**Key design corrections during implementation**:

1. *Initial instinct was to wrap the three day-90 steps in a
   transaction.* Correctly rejected per the Session 1 handoff: the
   Anthropic calls in steps 1 and 2 cannot be rolled back, and step
   2 (`summarizeCommitment`) reads up to 400k characters of session
   record and calls Anthropic — which at a full commitment's posts
   could easily take 30+ seconds. A Postgres transaction held open
   for 30+ seconds on every day-90 cron tick is a bad pattern to
   establish. Each-step-independently-idempotent is genuinely the
   right shape, not a compromise. Reasoning captured inline at the
   top of the route file so Session 3+ doesn't re-deliberate.

2. *Two separate idempotency guards, not one.* The milestone-row
   guard branches on `count(message_type='companion_milestone')`
   for the commitment; the status-flip guard branches on
   `commitments.status='active'`. These need to be independent
   because Session 1's admin endpoint is explicitly non-idempotent
   and can create a duplicate milestone row without ever flipping
   status. Using "milestone row exists" as a proxy for "status is
   flipped" would wrongly skip the flip in exactly the recovery
   case the guards exist to handle. Each guard is scoped to the
   specific step it protects.

**State for next session (C-1, async session-mark + Realtime)**:
- **`summarizeCommitment` is read-only — the cron calls it and
  discards the result.** This is the most important piece of state
  Session 3 inherits. The sponsor completion page currently
  recomputes the day-90 summary on every view via
  `summarizeCommitment`, which re-runs the Anthropic call (up to
  2000 tokens output + full context) per page load. At current
  scale (one live user, handful of sponsors) this is tolerable.
  Once sponsor traffic to the completion page becomes non-trivial,
  the right fix is to persist the summary on first successful
  generation — likely from the cron path, since the cron is where
  the work is already being done idempotently. Possible shapes: a
  new `completion_summary` column on `commitments`, or a separate
  `commitment_summaries` table. Either is a small migration. Not
  worth doing until there's a reason. Flagged inline at the bottom
  of `src/app/api/cron/companion-milestones/route.ts`.
- **The cron's day-90 summary call is effectively diagnostic, not
  load-bearing.** If it fails, the cron logs it and proceeds to
  step 3. Sponsors still see a summary when they view the page
  (because the completion page recomputes independently). This is
  fine — it just means Session 3's observability should watch for
  repeated step-2 failures in Vercel runtime logs, which would
  indicate the Anthropic API is systematically rejecting the
  summary prompt for some commitments and the completion page is
  silently doing the same failing work on view.
- **Session 1's admin endpoint stays.** `POST
  /api/admin/companion/milestone` is the escape hatch for
  operator-triggered milestones (historical commitments, backfill,
  dry-run verification). The cron is additive, not a replacement.
- **Schema unchanged this session.** `companion_milestone` was
  already in the `room_messages_message_type_check` constraint
  from Session 1; the cron just uses it.

**Three-line recipe for David's authenticated cron test** (runs
from any machine with `CRON_SECRET` exported):

```bash
# Safe dry-run — writes nothing, reports what WOULD happen:
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "https://www.searchstar.com/api/cron/companion-milestones?dry_run=1" | jq
# Once confident, exercise the write path (no-op at session time
# because no commitment is at day 30/60/90 yet):
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "https://www.searchstar.com/api/cron/companion-milestones" | jq
# Expected at session time: candidate_count=0, processed=[].
# The first non-empty tick will be around 2026-05-19 when f6c2a97c hits day 30.
```

---

## Known follow-ups discovered during the arc

*(Add here anything discovered mid-session that's out of current scope but
shouldn't be lost. This is the "I noticed X but it's not today's work" list.)*

- **`/api/cron/deep-mode` route stub (from v3) is still in the tree.**
  `src/app/api/cron/deep-mode/route.ts` is a `GET → {ok:true,
  retired:true}` stub left over from v3's deep-mode cron registration.
  Its own header comment explains: Vercel's cron registry is
  populated from target:production deployments, and until a v4
  `vercel.json` (without the deep-mode cron) promotes to production,
  Vercel keeps invoking the path every minute. Session 2's deploy
  `dpl_21RZ9taQNMApEBifEy4zAY8hSwDc` is a target:production deploy
  whose `vercel.json` has NO `/api/cron/deep-mode` registration —
  only `/api/cron/companion-milestones`. So the registration should
  now be cleared by this deploy's promotion. **Verification step for
  next session:** check the Vercel cron dashboard ~24h after Session
  2 deploys. If `deep-mode` has disappeared from the registry, the
  stub route can be deleted in a one-line cleanup commit. If it's
  still there, leave the stub — its comment explains why. Either
  way, fold into D-2 (Session 6) as a cleanup candidate.
- **`summarizeCommitment` persistence decision.** See Session 2
  "State for next session" above. When sponsor traffic to the
  completion page matters, persist the summary. Small migration +
  small code change; not today's problem.

---

## After the arc

When Session 6 completes, the remaining pre-launch blockers from the roadmap
are:
- Phase 9.1 remainder: video recut (Companion v2 doc rewrite is
  deferred/deprecated per chat-room-plan §10)
- Phase 10: Companion v2 Stage B (streaming chat UI, voice input)

Neither depends on B/C/D. Both are independent follow-ups.
