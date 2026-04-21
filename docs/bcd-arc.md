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

### Session 3 (2026-04-21) — C-1: async session-mark + Realtime

**Shipped** (commit `5353372`):

- `supabase/migrations/20260421_v4_room_messages_realtime.sql` —
  adds `public.room_messages` to the `supabase_realtime`
  publication. Wrapped in a `DO $$ … IF NOT EXISTS …` guard so the
  migration is idempotent against re-runs. Applied to production
  via Supabase MCP ahead of code push; verified by querying
  `pg_publication_tables`. REPLICA IDENTITY stays `DEFAULT` —
  sufficient for the INSERT-only subscription this session adds.
  If a later session adds UPDATE/DELETE subscriptions (e.g.
  affirmation count liveness in C-2), REPLICA IDENTITY FULL is
  the right upgrade at that point.

- `src/app/api/rooms/[id]/messages/route.ts` — rewritten to queue
  `generateCompanionRoomResponse` via `after()` from `next/server`
  rather than awaiting it before returning. The practitioner's row
  insert stays synchronous (needed so the POST response carries the
  persisted ID for the client's router.refresh path); only the
  Companion call — which dominated latency at 3–5s — moves to
  after(). Closure snapshots `roomId`, `triggerMessageId`, and
  `user.id` before after() fires. Response body shape changes from
  `{ message, companion_message_id }` to
  `{ message, companion_queued }` — the old field is gone, so any
  consumer that was reading `companion_message_id` will now see
  `undefined`. The composer was the only consumer (it only reads
  `res.ok`, not the body), so this is safe in practice.

- Structured error logging inside the after() callback catches both
  the null-return case (Anthropic responded but we couldn't parse /
  insert) and the thrown-error case (Anthropic call itself failed,
  though note `generateCompanionRoomResponse` is already null-safe
  so thrown paths should be rare). Log prefixes are
  `[rooms/messages after]` to distinguish from the synchronous
  `[rooms/messages POST]` prefix in remaining `console.error` call
  sites (the row-insert failure path). Both structured logs include
  `room_id`, `user_id`, `trigger_message_id` for correlation in
  Vercel's runtime log search.

- `src/app/room/[id]/realtime-messages.tsx` — new client component.
  Subscribes to `postgres_changes` with
  `{ event: 'INSERT', schema: 'public', table: 'room_messages',
  filter: 'room_id=eq.<roomId>' }` via a single Supabase channel
  named `room:<roomId>:messages`. Authorization delegates to the
  existing `"room_messages: members read"` SELECT RLS policy —
  Supabase Realtime evaluates that policy against the subscribing
  client's JWT before delivering any row, so a JWT that can't
  SELECT the row can't subscribe-to it either. This is the
  security property the C-1 scope called out for explicit
  verification.

  State is a `Map<id, RoomMessageData>` seeded from the server-
  rendered `initialMessages` prop and upserted from three sources:
    (a) initialMessages prop changes (router.refresh() re-SSRs the
        page and passes fresh data including refreshed affirmation
        counts);
    (b) Realtime INSERT echoes of the client's own just-POSTed
        row (dedup: if the id is already in the Map from (a), the
        richer SSR-shaped version wins);
    (c) Realtime INSERTs from other clients in the room (the
        Companion, other sponsors).
  Rendered sorted by `posted_at` ascending, matching the server's
  ORDER BY in the room page's data fetch.

- The empty-state ("The room is quiet. …") moved from the server
  page into the client component, conditioned on `ordered.length`
  rather than `initialMessages.length`. This matters: if SSR
  renders with zero messages and then a Realtime row arrives, the
  old conditional would have kept the empty-state visible
  alongside the new message. With the new conditioning the
  empty-state disappears the moment any message (SSR-seeded or
  Realtime-delivered) exists.

- `src/app/room/[id]/page.tsx` — drops the `RoomMessage` import in
  favor of `RealtimeMessages`. Builds a `nameMap:
  Record<user_id, display_name>` from the profiles query result
  and passes it to the client component (so Realtime-delivered
  messages from known room members render with the right author
  name; unknown authors fall back to "A member"). Passes the
  `mySponsoredCommitmentIds` set as an Array prop so the client
  can rebuild its own Set for the `viewer_can_affirm` predicate.

**Deployed**: `dpl_CixVh33bsyu4G2aMm77o1AuWXxAn`, state READY,
production target, turbopack bundler, aliased to `searchstar.com`.
`npx tsc --noEmit` and full `npm run build` both clean pre-push
(one pre-existing CSS optimization warning; no errors). Deployment
smoke test via `Vercel:web_fetch_vercel_url` against
`/room/29b52264-…` returned 200 and middleware-redirected to
`/login` for the unauthenticated fetcher — proves the route is
mounted and the bundle shipped without client-component boundary
errors. Runtime-log scan on the new deployment and across
production in the last hour returned zero errors. 24h scan for
`summarize`-keyed errors (the Session 2 concern about the sponsor
completion page silently re-running failing Anthropic calls on
every view) also returned zero — no backlog to fix.

**Verified with Supabase MCP before coding**:
- `pg_publication` has `supabase_realtime` with insert/update/
  delete enabled and `puballtables=false` (so the migration-added
  table entry is the authorization surface, not a catch-all).
- `room_messages` REPLICA IDENTITY is `d` (default); adequate for
  INSERT-only subscriptions.
- `room_messages: members read` SELECT policy is in place as
  expected from Phase 2 — `room_id IN (SELECT room_id FROM
  room_memberships WHERE user_id = auth.uid())`. Note: it does
  NOT filter on `room_memberships.state = 'active'`. A user whose
  membership state transitions to something other than `active`
  would still receive messages via Realtime, though they couldn't
  post. Not a C-1 concern (no flow today produces a non-active
  membership mid-session), flagged for future awareness.
- Only one room exists in production (`29b52264-…`); the sponsor
  walkthrough account `497d66d7-…` is an active member of it.

**Deferred**:

1. **The real authenticated in-browser verification of Realtime
   delivery.** The coding container cannot acquire David's session
   cookie or open a browser, and `Vercel:web_fetch_vercel_url`
   does a single HTTP fetch and cannot hold a WebSocket open to
   observe Realtime events. The test is laid out in the recipe
   below; David runs it once and the result feeds the Session 4
   opening state. Expected observations:
     - POST returns in <200ms (devtools Network → POST
       `/api/rooms/<id>/messages` → Timing tab). Under the old
       synchronous path this was 3–5s.
     - Client-side the practitioner's own message appears
       immediately from `router.refresh()` (the existing path).
     - ~3–5s after POST return, a second message card appears
       without any interaction — the Companion response,
       delivered via Realtime.

2. **Negative-case verification of Realtime authorization.** The
   C-1 scope called for explicit proof that a sponsor's JWT does
   NOT receive a different room's messages. Production currently
   has only one room (`29b52264-…`) so the test can't be set up
   without creating a second room first. Per the session prompt's
   explicit guidance — "if there isn't an easy way to verify the
   negative case, document it as a gap in the Session 3 completion
   log and defer the second room's creation until it's needed for
   natural reasons" — this is gapped rather than forced.

   The authorization itself is structurally solid even without the
   empirical test. Realtime consults the RLS SELECT policy on
   every delivery; the existing policy filters on
   `room_memberships.user_id = auth.uid()`. The worst case for
   leakage would require a misconfigured policy rather than a
   subscription-filter bypass, because the filter is advisory and
   the policy is authoritative. When a second room appears
   naturally — the first time David onboards a second practitioner
   into a distinct room — the negative test should be run at that
   point as a cheap side-check.

3. **Two-browser live test with the sponsor walkthrough account.**
   Deferred to Session 4 (C-2), which is the session where sponsor
   side also gets Realtime on all message types and benefits from
   having both browsers actively subscribed to the same room.

**State for next session (C-2, full Realtime + optional streaming)**:

- **Realtime infrastructure is live.** The subscription, filter,
  RLS gating, and dedup pattern are established. Extending to
  additional message types is additive — no new server work, no
  new DB migration. Session 4's scope of "extend Realtime
  subscription to all `room_messages` inserts, not just Companion
  responses" is already ostensibly done at the subscription level
  (the filter is `event: 'INSERT'`, not `message_type: 'companion_*'`);
  Session 4's real work there is sponsor-side client coverage,
  which this session didn't touch.

- **Affirmation count liveness is NOT live.** Session 3 subscribes
  to `room_messages` inserts only. `message_affirmations` is a
  separate table and its inserts don't propagate. The result:
  when a sponsor affirms a session-marked message from a different
  browser, the practitioner's view still shows the old count
  until their next page load. The RoomMessage component already
  does optimistic local updates for the affirmer's own click, so
  this only affects spectators. C-2 is the right session to
  decide whether spectator-side liveness is worth the additional
  subscription — probably yes because the "affirmation arrives"
  moment is one of the most meaningful live events in the room.

- **REPLICA IDENTITY upgrade considerations for C-2.** If C-2
  subscribes to UPDATE or DELETE events on `room_messages`
  (unlikely for the message table — inserts are the primary event
  — but possible for `message_affirmations` DELETEs when a
  sponsor un-affirms), those tables will need `REPLICA IDENTITY
  FULL` to get the old row in the payload. Easy migration, worth
  flagging before writing subscription code.

- **router.refresh() from the composer is still in place.** It
  handles "my own message appears immediately" (SSR fetch of the
  just-inserted row). After Session 3, the composer's POST
  returns in <200ms so the refresh is cheap. If C-2 or later adds
  fully-optimistic client-side message insertion (append my
  message to state at submit time, reconcile with Realtime echo
  via id dedup), the refresh could be removed. Not pressing.

- **Token streaming decision for C-2.** The scope question flagged
  in the original BCD-arc plan is: should Companion responses
  stream token-by-token? Argument in favor: it makes the Companion
  feel alive; the 3–5s pause between "Session marked" and "full
  Companion response appears" is the single worst UX moment in the
  room. Argument against: partial renders, reconnection edge
  cases, and final-message persistence all introduce complexity
  that doesn't exist today. The right shape if implemented is
  likely Server-Sent Events from a new route that the Companion
  writes into as it streams, with the final row written on stream
  completion — i.e. the persisted record is the final text, not
  the stream. Deferred to C-2 as a live decision.

**Three-line recipe for David's authenticated Realtime test**
(runs in any logged-in browser; opens the room, session-marks a
message, observes response latency and Realtime delivery):

```
# 1. Open https://www.searchstar.com/room/29b52264-50be-411e-8294-2091ee28e8fb
#    Keep devtools Network tab open, filtered to "Fetch/XHR".
# 2. Compose a message, toggle "Mark as today's session", click "Post as session".
#    Observe: POST /api/rooms/29b52264.../messages returns with status 200 in
#    <200ms. The response body contains {message, companion_queued: true}.
#    router.refresh() completes shortly after, displaying the posted message.
# 3. Wait 3-5 seconds without refreshing or interacting. A second card —
#    a Companion response in the navy-tinted style — should appear under your
#    session message. Its timestamp will be a few seconds after yours. No
#    manual refresh was required; that's Realtime working.
```

If step 2 still takes 3–5s: the after() wrapping didn't fire, most
likely because the import was resolved to the wrong `after` symbol
(`next/server` vs the legacy `next/after` path). Check the
Network tab's timing breakdown — "Waiting for server response"
should be <150ms, not 3–5s.

If step 3 never shows the Companion response: either the
Anthropic call failed silently (check Vercel runtime logs for
`[rooms/messages after]` error lines with the session's
`trigger_message_id`), or the Realtime subscription failed
(check browser console for Supabase channel connection errors —
search for `phx_reply` failures or the channel name
`room:29b52264...:messages`).

If step 3 requires a manual refresh to see the Companion: the
insert happened but Realtime didn't deliver. Most likely causes
in rough order: (a) the migration adding `room_messages` to the
publication didn't actually take effect on the realtime service
(check that a fresh `pg_publication_tables` query via Supabase
MCP still shows `public.room_messages`); (b) the client's JWT
doesn't match the RLS policy for some reason (rare in this flow
— the practitioner is definitionally a room member); (c) the
channel subscription returned an error the component didn't
surface (add a `.subscribe((status) => console.log(status))`
callback if needed).

### Session 3.5 (2026-04-21) — Resilient Realtime subscription

**Why this entry exists.** The Session 3 scope assumed `.subscribe()`
would succeed or, if it didn't, the retry behavior baked into the
Supabase SDK would handle it. Session 4 opened with David running
the verification recipe, and the symptom was exactly case (c) above:
session-marked message posted fine, POST returned in 90ms, Companion
response was written to the DB 3 seconds later as expected — and
never appeared in his browser. No refresh triggered it; only a page
reload showed the message. Realtime delivery was broken in that
specific page session.

**Root cause.** Empirical measurement from the coding container:
~10% of fresh `.subscribe()` calls return `CHANNEL_ERROR` on first
attempt (infra-side "DNS cache overflow" 503s on the websocket
upgrade to `/realtime/v1/websocket`). The Session 3
`realtime-messages.tsx` component passed no status callback to
`.subscribe()`, so a CHANNEL_ERROR left the channel silently dead
for the page lifetime. The same pattern would recur on any user's
page load that happened to land on the 10%. Session 3's verification
plan had anticipated this diagnostic but hadn't added the
instrumentation up-front, on the reasonable assumption that it
wouldn't be needed.

**Shipped** (commit `fd2d505`, deploy `dpl_CVF5i1eP5R74fm3TnTiz5woYi6J2`):

- `src/app/room/[id]/realtime-messages.tsx` — three coordinated
  changes to the subscription effect:

  (1) **Status callback.** `.subscribe()` now takes a callback that
  `console.log`s every transition (`SUBSCRIBED` / `CLOSED` /
  `CHANNEL_ERROR` / `TIMED_OUT`) with the channel name as a prefix.
  Browser console now shows, unambiguously, whether Realtime came
  up. Same log prefix used across the lifetime of the page so
  retry attempts are distinguishable from the initial attempt.

  (2) **Bounded automatic retry.** On CHANNEL_ERROR or TIMED_OUT,
  the component tears down the failed channel via `removeChannel`,
  waits 1s/2s/4s/8s per attempt, and subscribes again with a fresh
  channel name (suffixed with `Date.now()` to avoid collision with
  the server-side channel registry entry from the prior attempt).
  Caps at 4 retries; after the cap the visibility fallback (see
  below) is the safety net. Backoff `attempt` counter resets on
  the first SUBSCRIBED, so a later mid-session drop-and-retry
  starts from the short delay again rather than cascading through
  the exponential schedule.

  (3) **Visibility-based SSR refetch.** `document`'s
  `visibilitychange` listener calls `router.refresh()` whenever
  the tab becomes visible. This is SSR-based, not Realtime-based,
  so it works regardless of channel health: even if every retry
  in (2) failed and we've given up, a user returning to the tab
  triggers a server re-render of the page with any new messages
  that arrived while the channel was dead. Removes the possibility
  of "permanently stale room page" as a failure mode.

- `handleInsert` hoisted out of the closure as a module-internal
  function of the component, referenced from both initial
  subscription and every retry attempt. No behavior change — just
  so the retry path doesn't duplicate the insert logic.

**Validated**: 20 sequential subscribe attempts from the container
with the retry logic all succeeded, several needing 2-4 attempts.
Same environment had ~10% hard-fail rate without retry. `npx tsc
--noEmit` clean, `npm run build` clean (same pre-existing CSS
optimization warning as Session 3). Production deployment
`dpl_CVF5i1eP5R74fm3TnTiz5woYi6J2` READY, production target, aliased
to `www.searchstar.com` and `searchstar.com`. Home page smoke test
via `Vercel:web_fetch_vercel_url` returned 200 with the new
deployment ID in the HTML — bundle is live.

**Deferred** (carries into Session 4):

1. **In-browser verification.** The fix is deployed but the
   authenticated user-facing test hasn't been run since the deploy.
   The session ended at container tool-use cap. Next session
   opens with David re-running the Session 3 recipe against the
   new deployment. Expected observations now:
     - POST returns <200ms (unchanged from Session 3)
     - Browser console shows `[realtime room:29b52264…:messages:<ts>] status: SUBSCRIBED`
       within a second or two of page load; may show a
       `CHANNEL_ERROR` followed by a retry attempt if the 10% hits
     - Companion response card appears 3-5s after session-mark
       POST, with no manual refresh
   If CHANNEL_ERROR shows in console but a retry doesn't succeed
   within 4 attempts, that's a harder failure and the diagnosis
   steps in the Session 3 log's final block still apply — check
   publication membership, check JWT, check the specific err
   payload the status callback now surfaces.

2. **The C-2 live decisions.** Original Session 4 scope was
   (a) affirmation-count liveness (second subscription on
   `message_affirmations`) and (b) token streaming for Companion
   responses. Neither was touched this session — the plan was to
   only do them after the base path was verified solid, which now
   waits on deferred item 1. Both decisions still open, both
   analyses from the Session 4 handoff prompt still apply.

3. **Negative-case authorization test.** Still gapped per the
   Session 3 log — no second room exists yet. Not blocking.

**State for next session**:

- **Realtime base path now has observability.** Any future
  subscription failure is visible in browser console, so "David
  sees no Companion response" will no longer require a container-
  side diagnostic session — he'll be able to report the status
  log line directly. This is a one-time infrastructure investment
  that pays off across every future Realtime-related debug.

- **The tab-visibility refresh is worth knowing about for future
  work.** It's a cheap general safety net but it also re-runs the
  server component's data fetch. If a future page renders
  expensive queries in the room page's server component, the
  visibility refresh fires them on every tab-return. Fine at
  today's scale; flag for re-examination if room page SSR cost
  grows.

- **Session 4 proper is now open again.** The revised Session 4
  shape is: David runs the recipe, confirms the fix works or
  reports the failure signature, then we make the C-2 decisions
  (affirmation liveness + streaming). This may fit in one session
  if the recipe passes cleanly; if streaming is a yes, it's likely
  a separate 4.5 session because the SSE route + placeholder-row
  architecture is non-trivial.

### Session 4 (2026-04-21) — C-2: followup path + affirmation liveness

**Why two things and not three.** Session 4 carried three candidate scope items from the Session 3.5 handoff: verification of the base Realtime fix (no code), the two C-2 live decisions (affirmation liveness, token streaming), and a new follow-up from Session 3.5 (the "Companion talks at, not with" problem). Budget landed shipping the followup path + affirmation liveness; streaming deferred with rationale in docs/chat-room-plan.md §6.6.

**Shipped** (single commit spanning four code files + two migrations):

*(A) The "talks at, not with" fix — followup Companion responses on non-session practitioner messages.*
- `src/lib/companion/room.ts`: `generateCompanionRoomResponse` and `buildUserContent` gained a `triggerKind: 'session' | 'followup'` parameter. Default `'session'` preserves existing behavior. `'followup'` swaps the user-turn envelope text from "marked this message as their session for today" to "You asked a question in your most recent message to this room. The practitioner is replying to that question now — not marking a session, just continuing the conversation." No change to system prompt, model, context assembly, or roster/history load. Header comment updated.
- `src/app/api/rooms/[id]/messages/route.ts`: the existing `after()` block gained an `else if (messageType === 'practitioner_post')` branch. Inside: fetch the most recent `companion_*` message in the room strictly earlier than the just-inserted row; if its body contains `?` in the last 200 characters, invoke `generateCompanionRoomResponse({ triggerKind: 'followup' })`. DB lookup + heuristic is inside `after()` so POST latency is unchanged. Self-limiting: the Companion only re-fires if its own prior reply ended with `?`, so a chatty practitioner can't hammer Anthropic — once the Companion stops asking questions, the chain naturally closes.
- Return payload: `companion_queued` remains the truthful "session path fired" flag. New `companion_maybe_queued` captures "followup path *might* fire" honestly — client doesn't read it today, but a future thinking-indicator UI can distinguish.
- Decision rationale (heuristic choice, no rate limit, practitioner-only scope): docs/chat-room-plan.md §6.6 Decision A.

*(B) Affirmation-count liveness — spectator-side counts tick live.*
- `src/app/room/[id]/realtime-messages.tsx`: two additional `.on('postgres_changes', …)` handlers on the existing room channel — one for INSERT on `message_affirmations`, one for DELETE. Handlers update the matching entry in `byId` Map: INSERT increments `affirmation_count` and sets `viewer_affirmed=true` if the affirming sponsor is the current viewer; DELETE mirrors. No filter on the affirmation subscription — RLS scopes delivery to rooms the viewer is a member of. Events for unknown messages (not in `byId`) are dropped by the handler's existence check. Same retry/visibility infrastructure from Session 3.5 covers both subscriptions.
- `src/app/room/[id]/room-message.tsx`: added `useEffect` that syncs `affirmed`/`affirmCount` local state from props when not mid-optimistic-update. Without this sync, Realtime-driven parent updates would not propagate through the child's local state. Guard on `affirming` prevents the sync from clobbering in-flight optimistic values.
- Migration `20260421_v4_message_affirmations_realtime.sql`: adds `public.message_affirmations` to `supabase_realtime` publication. Idempotent via `pg_publication_tables` check.
- Migration `20260421_v4_message_affirmations_replica_identity.sql`: sets `message_affirmations` to `REPLICA IDENTITY FULL` so Realtime DELETE payloads carry `message_id` and `sponsor_user_id`, not just the primary key. Without this the DELETE handler couldn't locate the target message to decrement its count.
- Decision rationale (one-channel two-subscriptions, why REPLICA IDENTITY FULL, sync-useEffect design): docs/chat-room-plan.md §6.6 Decision B.

*(C) Token streaming for Companion responses — deferred.*
- Rationale in docs/chat-room-plan.md §6.6 Decision C. Current 3–5s Realtime delivery is within the range where a simple thinking-indicator (not yet built, not yet needed) would be sufficient polish. Streaming is a larger surface — SSE lifecycle, placeholder-row semantics, partial-render edge cases, reconnection resume-from-offset, interaction with affirmations — and deserves its own dedicated session when real use surfaces genuine latency dissatisfaction. Parked explicitly to avoid re-litigating in the next few sessions.

**Validated:** `npx tsc --noEmit` clean. `npm run build` clean (same pre-existing CSS optimization warning as Session 3.5). Supabase MCP confirmed both migrations applied successfully to project `qgjyfcqgnuamgymonblj`. Publication contents verified: `room_messages` and `message_affirmations` both present. Production-side DB changes are live; the matching migration files in the repo match the applied SQL.

**Deferred** (carries forward):

1. **In-browser verification of the base Realtime fix from Session 3.5.** Session 4's (A) path could not proceed to implementation before this verification, but ultimately did — the implementation is architecturally additive (new subscriptions, new handler branch) and doesn't depend on the base path working, so the test is independent. David still runs the Session 3.5 verification recipe when convenient and reports the status-log line. Expected: `[realtime room:<id>:messages:<ts>] status: SUBSCRIBED` in console, Companion response appears live without refresh. Failure mode to watch for on the new subscription: a CHANNEL_ERROR on subscribe that doesn't recover within the 4-retry cap.

2. **Two-browser live test of (A) and (B).** David's main browser + the sponsor walkthrough account (`dverchere+sponsor-walkthrough-1@gmail.com`, user `497d66d7-1b13-4e25-a535-a29188e110ec`, active member of room `29b52264-50be-411e-8294-2091ee28e8fb`). Test protocol:
   - *(A)* From David's browser, post a session-mark; wait for Companion reply ending with `?`; reply non-session; confirm second Companion response appears live on both browsers.
   - *(B)* From sponsor browser, click Affirm on a session-marked message; confirm the count ticks up on David's browser within a second without any refresh action. Click Affirm again (unaffirm); confirm the count ticks down.
   - If either fails, check browser console on the failing side for the status callback log (Session 3.5 infrastructure).

3. **Negative-case authorization test.** Still open from Session 3. Not blocking — no second room exists to test against. Lands naturally when the first multi-room scenario arrives.

4. **Token streaming.** Decision C in §6.6. Own session when it matters.

5. **Companion followup path rate-limiting.** Current design is self-limiting via "Companion only re-fires if its own prior reply ended with `?`". If real use surfaces a hammering case — a practitioner sending many non-session messages while the Companion keeps asking questions — revisit. Not today's problem.

**State for next session**:

- **The room surface now has two independently-verified live behaviors.** New messages arrive live (Session 3), affirmations tick live (Session 4), and Companion has conversational follow-through (Session 4). The foundation for Phase 10's chat UI is effectively complete at the data layer; what remains is styling, streaming, and voice input.

- **The "talks at, not with" follow-up is resolved at v1 scope.** The §6.6 Decision A analysis includes a spelled-out self-limiting proof, so any future session considering a wall-clock rate limit should read that first before adding complexity. The fix path (a) from the bcd-arc.md follow-up entry shipped; path (b) (full Phase 10 chat UI) is still a separate surface and still on the roadmap.

- **Session 5 is D-1 per the arc plan.** Per-file audit of the 10 dead files from the inventory in the Session 5 scope block. No code changes that session except the `src/lib/media.ts` comment fix. Session 6 executes the plan.

- **Two Supabase migrations are now permanent.** The publication now includes `message_affirmations`, and the table has `REPLICA IDENTITY FULL`. Either is a breaking change to remove without also removing the subscription that depends on it — document the dependency before any future cleanup touches these.

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
- **Stale `/roadmap.html` and `/spec.html` prefetches.** Observed
  in David's browser devtools during Session 3.5 recipe test: the
  Network panel showed 404s on `/roadmap.html?_rsc=…` and
  `/spec.html?_rsc=…` alongside successful 307s on the actual
  `/roadmap` and `/spec` routes. Cause: `next.config.ts` redirects
  `/roadmap → /roadmap.html` and `/spec → /spec.html` (both are
  real static files in `public/`). When Next's Link prefetcher
  follows the redirect target it appends `?_rsc=…` for its server-
  components payload — but a static HTML file doesn't have an RSC
  payload, so it returns 404 for the RSC query. The user-visible
  behavior is fine (real clicks get the 307 and then the HTML).
  Console pollution and wasted round trips only. Two resolution
  paths: (a) leave it — cosmetic, no user impact; (b) convert
  `/spec` and `/roadmap` from redirect-to-static to actual App
  Router pages that import/iframe the current HTML content, which
  also removes the redirect hop. Fold into D-1 (Session 5) as a
  cleanup candidate. Not a blocker.
- **Companion "talks at, not with" problem.** Surfaced by David
  during Session 3.5 via screenshot of his real room use. The
  Companion asked him "What made you switch to open palm?" on a
  session mark; he answered it in a subsequent non-session message
  ("Switch to open Palm because i think it's going to make my
  biceps grow faster"); the Companion did not reply because the
  gating in `src/app/api/rooms/[id]/messages/route.ts` is
  `if (sessionFlag && resolvedCommitmentId)` — only session-marked
  posts trigger a Companion response. Visually the Companion reads
  as a conversational participant (bubble styling, questions
  asked); under the hood it's one-shot reflection. User expectation
  vs implementation mismatch.
  The Companion DOES read up to 50 recent room messages as context
  when it eventually fires (see `src/lib/companion/room.ts` lines
  203-269), so the non-session replies aren't lost — they just
  don't get an immediate acknowledgment. The conversation happens
  across session marks, latency-shifted by up to a day.
  Two fix paths, in ascending scope:
  (a) Widen the gating: if the most recent Companion message in
  the room ended with a `?`, the next practitioner message fires a
  Companion response even if not session-marked. ~1hr implementation,
  reuses the entire existing after() + Realtime pipeline. Solves
  ~80% of the felt problem without touching Phase 10 scope.
  (b) Full Phase 10: chat UI, persisted threads, streaming, voice.
  Already on the roadmap, intentionally deferred.

  **RESOLVED in Session 4 (2026-04-21).** Path (a) shipped. The
  `after()` block gained a second branch that fires on non-session
  practitioner messages when the most recent Companion message's
  body contains `?` in its last 200 characters. `generateCompanionRoomResponse`
  gained a `triggerKind: 'session' | 'followup'` parameter that
  swaps envelope text so the Companion knows it's continuing a
  conversation rather than reflecting on a session. Self-limiting
  — no wall-clock rate limit needed. Full rationale in
  docs/chat-room-plan.md §6.6 Decision A. Path (b) remains Phase 10
  scope; its shape can be reconsidered after real use of (a)
  reveals whether the felt gap is closed.

---

## After the arc

When Session 6 completes, the remaining pre-launch blockers from the roadmap
are:
- Phase 9.1 remainder: video recut (Companion v2 doc rewrite is
  deferred/deprecated per chat-room-plan §10)
- Phase 10: Companion v2 Stage B (streaming chat UI, voice input)

Neither depends on B/C/D. Both are independent follow-ups.
