# Pass 3 — Principal Decisions

This file records decisions the principal (David) has made during Pass 3
that Pass 2 could not resolve without input. Each entry names the
findings it dispositions, the decision taken, the rationale, and the
execution scope for the session that will carry it out.

Pass 3a is schema-only. Execution of these decisions lands in later
Pass 3 sessions (3b, 3c, etc.) per the ordering in
`pass-2-reconciliation.md` §Pass 3 ordering suggestion.

---

## §1 — F39 / F40 / F41 institutional portal: Option B, take down

**Findings dispositioned.** F39 (institution signup creates institution
row without an auth user), F40 (`/api/institution/[id]/enroll` writes
via anon client and is blocked by owner-only RLS on `profiles`), F41
(`/api/institution/[id]/analytics` is orphan — no consumer in the
codebase).

**Decision.** Option B — take down. The institutional portal surface is
gated behind a feature flag (default off) and 404s for all users in
production until the v4 institutional shape is designed.

**Rationale.**

1. `docs/v4-build-plan.md` lists institutional sponsorship (v4.8) and
   portable Trust export (v4.9) under "Omitted from this plan". Both are
   tagged "Future" in the spec.
2. `docs/v4-decisions.md` deferred question #7 states the portal
   "needs a new shape — or needs to be rethought as a simpler
   institutional-sponsor flow rather than a cohort-management product.
   Deferred until the sponsor flow for individual practitioners is
   stable." The product-level answer is not yet known.
3. Shipping a working-but-premature portal commits Search Star to
   maintenance of a surface that will be redesigned. The cost of
   keeping a broken-but-available flow online is worse than the cost of
   the feature flag: an unreachable but preserved surface is not
   misleading, while a reachable-but-broken one is.
4. The current flow is structurally broken in ways that cannot be
   no-op-fixed. F39 requires designing a sign-in flow (magic link?
   institution admin as first member? separate auth type?) that the v4
   plan has not yet specified. F40 is a straightforward service-client
   migration — but fixing it underneath F39 ships a working write path
   into a sign-in flow that shouldn't exist yet.
5. Take-down removes roughly 700 LOC of drift and stops advertising a
   broken flow to real traffic.

**Execution scope for Pass 3c.** (Not this session — this section
describes what 3c will do.)

- Introduce env var `INSTITUTIONAL_PORTAL_ENABLED` (default `false`,
  explicitly read in Vercel env; no default-on behavior in prod).
- Gate the following surfaces behind the flag; return 404 when
  disabled:
  - `src/app/institution/signup/page.tsx`
  - `src/app/institution/[id]/dashboard/page.tsx`
  - `src/app/institution/[id]/members/page.tsx`
  - `src/app/institution/[id]/enroll/page.tsx`
  - `src/app/api/institution/signup/route.ts` (and any sibling API
    routes under `src/app/api/institution/`)
- Delete `src/app/api/institution/[id]/analytics/route.ts` outright
  (F41). It is orphan code with no consumers; the dashboard inlines the
  same logic. Retiring it reduces surface area now and doesn't block
  the future redesign — when v4.8 institutional is picked up, the
  analytics shape will be reconsidered anyway.
- The marketing-site copy referencing institutional sponsorship
  (public spec page, roadmap page) stays as-is. The spec describes it
  as deferred, which is honest.

**Preferred over deletion because** the code embodies the v3-era
institutional model and may be partially salvageable when the v4
institutional shape is designed. Keeping it compiles-but-404s lets the
redesign refer to it without a branch-archaeology detour.

**Deferred to v4.8 design work.** The actual question of what the
institutional portal is under v4 — cohort management vs. simple
sponsor flow, admin-as-first-member vs. magic-link signup, whether
institutions even get a dashboard or just participate as large
sponsors — is not this session's work and is not Pass 3's work at all.
This file's decision is only about what to do with the existing code
while that question waits.

---

## §2 — Cluster 1 sponsorship state machine: plan for principal review

**Findings dispositioned.** F1 (`sponsorship.status='paid'` rejected by
CHECK), F10 (cron and release-action both write `commitments.status='completed'`
with different semantics), F21 (third writer — practitioner-complete
endpoint — extends F10's race to a triple), F22 (sponsors-page UI status
type stale; `'paid'` typed but never reachable, `'released'`/`'vetoed'`
unmapped). Optionally bundled: F7 (`'vetoed'` enum value stranded —
veto branch writes `'abandoned'`).

**Status: plan only — pending principal sign-off on questions Q1–Q3
below before any code or migration is touched.**

### Pre-execution sanity checks (Task 1, completed this session)

**Call sites at tip 645e06a (re-verified, line numbers stable since Pass 1):**

| # | Writer | File | Lines | Direction |
|---|---|---|---|---|
| 1 | Release-action `release` branch | `src/app/api/sponsorships/[id]/action/route.ts` | 147–196 | KEEP — canonical writer; only path that calls `computeAndPersistTrust` |
| 2 | Veto branch (writes `'abandoned'` to commitment) | `src/app/api/sponsorships/[id]/action/route.ts` | 334–355 | F7: change to `'vetoed'` (option a) |
| 3 | Practitioner-complete endpoint | `src/app/api/commitments/[id]/complete/route.ts` | 38–47 | F21: retire (entire route — see below) |
| 4 | Cron status flip | `src/app/api/cron/companion-milestones/route.ts` | 286–305 | F10: REMOVE the status flip; keep milestone + summary writes |
| 5 | Webhook `'paid'` write | `src/app/api/stripe/webhook/route.ts` | 306–318 | F1: retire `'released'→'paid'` advance; treat `'released'` as terminal |

**Production data state (queried this session against `qgjyfcqgnuamgymonblj`):**

- `commitments` rows by status: `{active: 2}`. Zero `completed`, zero
  `vetoed`, zero `abandoned`. No terminal-state rows exist.
- `sponsorships` rows by status: `{pledged: 1}`. Zero `released`, zero
  `vetoed`, zero `refunded`, zero `paid`. The CHECK has done its job;
  the webhook's rejected writes have left no DB residue.
- Stuck-active-past-day-90 rows: **zero**. Both active commitments
  started 2026-04-22; day 90 lands 2026-07-21 (~87 days from today).
  F10's "structurally dead from day 90" claim is **structurally true
  but not yet realized in production data.** No backfill needed; no
  rows to migrate. The fix lands in a quiet state and acquires runway
  before live data hits the failure mode.

**Current CHECK constraints (queried this session):**

- `commitments_status_check`: `{active, completed, vetoed, abandoned}` —
  `'vetoed'` already in the enum (F7 fix is purely a code change to
  start writing it).
- `sponsorships_status_check`: `{pledged, released, vetoed, refunded}` —
  `'paid'` already absent (F1 fix is purely a code change to stop
  trying to write it).

**Implication for the migration question.** The spec-aligned
vocabulary is already in the DB. If we keep both enums as they are,
**Cluster 1 needs no Supabase migration** — the entire fix is
application-layer. (The only schema change worth considering is
dropping the `sponsorships.paid_at` column, addressed under Q1
below.) This is a meaningful simplification of the original handoff
plan, which assumed CHECK rewrites would be needed.

### Open sequencing questions for principal sign-off

#### Q1 — `'paid'` retirement: how far to go?

The handoff prompt named two options. After the production query
above, a third option emerged. The trio:

- **Option A (minimal) — widen the sponsorships CHECK to accept
  `'paid'`.** Lowest-risk; fixes F1 by making the failing write succeed.
  Does NOT fix the underlying spec misalignment (Decision #5 collapsed
  released-then-paid into one state; preserving both contradicts the
  spec). Not recommended; raised only because the handoff prompt asked
  for it.

- **Option B (full retirement) — webhook stops writing status; treat
  `'released'` as terminal.** Code-only change. Webhook on
  `payment_intent.succeeded` for a pledge becomes either (i) a no-op
  with a log line, or (ii) audit-only — writes `paid_at` as a Stripe
  capture-confirmation timestamp without changing status (option B*
  below). Either way `'paid'` is removed from the TS union (F22) and
  the `sponsors-page` badge map collapses to the four real DB values.
  **Recommended.**

- **Option B* (B + repurpose `paid_at`)** — same as B but the webhook
  retains its capture-confirmation duty by writing
  `sponsorships.paid_at = now()` without changing status. This
  preserves an audit trail (release-action initiates capture; webhook
  confirms it landed) at the cost of leaving a column whose name
  reads as a status timestamp but is now a confirmation timestamp.
  Keeps the column; saves a migration. Slightly subtle for future
  readers.

- **Option B** with `paid_at` dropped (full hygiene) — same as B but
  add a column-drop migration: `ALTER TABLE sponsorships DROP COLUMN
  paid_at;`. The release-action route already records `released_at`
  on the synchronous capture path; under v4 there's no semantic gap
  between "capture initiated" and "capture confirmed" worth a second
  timestamp, because release-action already awaits Stripe's response
  before writing `'released'`. Dropping `paid_at` removes a column
  whose v4 meaning is unclear. Adds one migration; this would be
  the only DDL change in Cluster 1.

**Recommendation: Option B with `paid_at` dropped.** The audit trail
that B* preserves is already preserved by the synchronous capture in
the release-action route (line 133: `await getStripe().paymentIntents
.capture(...)` — if it fails, status doesn't advance to `'released'`).
A confirmation timestamp from the webhook adds no information that
`released_at` doesn't already imply. Dropping the column is honest;
keeping it requires a comment explaining the v3-versus-v4 reading.

If David prefers no DDL this session, **B* is acceptable** — the
migration can land separately under Pass 3e cleanup, or never. The
critical fix is the code path; the column drop is hygiene.

#### Q2 — Cron at day 90: what does it do for a still-pledged commitment?

The handoff named three options. After confirming zero stuck rows
exist in production, the urgency dimension drops away — option (i)
becomes more defensible than the handoff suggested.

- **Option (i) — leave at `'active'` indefinitely.** The literal Pass 2
  direction. When day 90 elapses without sponsor releases, the
  practitioner sees their own commitment as still-active. The cron
  writes the day-90 milestone (Companion celebrates the streak's
  completion in the room) and the day-90 summary (Companion's
  attestation-input for sponsors), then leaves. Sponsors release
  whenever they choose; release-action drives the flip to
  `'completed'`; if they go silent forever, the row sits in
  `'active'` indefinitely. **Faithful to the spec** — Decision #6's
  "Payment release is the attestation" means a commitment without
  release is, by spec, an unattested commitment. UX cost: a
  practitioner whose sponsor goes silent has no terminal state to
  point at. This is a real but spec-aligned consequence; the room
  surfaces sponsor activity, so silence is legible there.

- **Option (ii) — introduce `'awaiting_release'` status.** Distinguishes
  "day 90 passed, waiting for sponsor action" from "still in active
  streak." Cleaner UX; writes a CHECK migration to add the value;
  expands the state space; requires updating every reader (queries
  filtering by `status='active'` need to consider the new value).
  Not recommended unless the UX cost of (i) is judged too high; even
  then a UI-derived state ("active && now > started_at + 90d") can
  carry the same weight without DB changes.

- **Option (iii) — auto-release after a grace period.** Introduces a
  new mechanic the spec does not describe (automated capture without
  sponsor action). Off-charter for Cluster 1; rejected.

**Recommendation: Option (i).** The spec is unambiguous; the data
shows no live failure mode; UX concerns can be addressed in the
existing UI without a status change.

#### Q3 — Practitioner-complete endpoint: retire entirely or narrow?

The handoff suggested deletion is likely the right call. After
querying for UI consumers, I confirmed: **zero callers in `src/`**.
The endpoint is orphan code on top of being spec-misaligned. Three
disposition options:

- **Option (a) — delete the entire route file.** Simplest. F21's
  third writer disappears. The endpoint is unused; deleting it
  removes the spec violation and simplifies the state machine.
  **Recommended.**

- **Option (b) — narrow it to a 410 Gone response.** Preserves the URL
  for any external bookmarks (none known) and explicitly signals
  retirement. Slightly more code; not necessary given zero callers.

- **Option (c) — keep but reframe as practitioner-initiated abandon.**
  Repurpose the endpoint to write `'abandoned'` (the spec's
  practitioner-initiated terminal state per chat-room-plan §2)
  instead of `'completed'`. This *is* a spec-named state. But: there
  is no UI surface to invoke it; the spec doesn't describe a
  practitioner-initiated abandon flow as live in v4 (the v4 model
  centers on sponsors driving terminal states); and adding a working
  abandon endpoint without a UI invites the same drift this cluster
  is supposed to remove. Defer to a future session if/when the
  product question "should practitioners be able to abandon their
  own commitment" gets a spec answer.

**Recommendation: Option (a) — delete.**

### Proposed execution shape (pending Q1–Q3 sign-off)

Assuming recommendations (B-with-drop, i, a):

**Migration (one, optional under Q1):**
- `20260424_v4_drop_sponsorships_paid_at.sql`:
  `ALTER TABLE sponsorships DROP COLUMN paid_at;`
  (Skipped if David picks B* instead of B-with-drop.)

**Code changes (six files):**

1. `src/app/api/stripe/webhook/route.ts` (F1) — `payment_intent.succeeded`
   for pledges becomes a no-op-with-log, OR an audit-only `paid_at`
   write (depending on Q1). The `terminal` array on the canceled
   branch (line 360) gets corrected to `['released', 'refunded',
   'vetoed']` — `'released'` is the actual terminal state, `'paid'`
   was never reached.

2. `src/app/api/cron/companion-milestones/route.ts` (F10) — remove
   the status flip block (lines 283–305). Keep the milestone write
   and the summary call. The `status_flip` field on the action
   tracking object disappears from the response shape; callers are
   internal monitoring only.

3. `src/app/api/commitments/[id]/complete/route.ts` (F21) — DELETE
   the file. Zero UI consumers, spec-misaligned.

4. `src/app/api/sponsorships/[id]/action/route.ts` (F7, optional
   bundle) — veto branch writes `commitments.status='vetoed'` instead
   of `'abandoned'`. One-line change at line 352.

5. `src/app/(dashboard)/commit/[id]/sponsors/page.tsx` (F22) — TS
   union goes from `'pledged' | 'paid' | 'refunded'` to
   `'pledged' | 'released' | 'vetoed' | 'refunded'`; badge map
   updated to match; `paid_at` field removed from interface (or
   retained per Q1 outcome). Imports/renders updated accordingly.

6. `src/app/api/sponsorships/[id]/route.ts` (F22 follow-on) — the
   GET route's `.select('...paid_at')` is updated. Replace `paid_at`
   with `released_at, vetoed_at` to match the post-fix vocabulary.

**Commits:** Two, per the 70%-mark rule.
- Commit 1 (migration + webhook + cron + practitioner-complete delete):
  the spec-alignment of the state machine on the write side.
- Commit 2 (veto-as-vetoed + sponsors-page UI sync + GET shape sync):
  the read-side alignment, plus the F7 bundle.

**Pre-commit gates:**
- `npx tsc --noEmit` before each commit.
- `git restore package.json package-lock.json` after any incidental
  npm work (none anticipated).

**Post-deploy verification (Task 5):**
- Wait 45s after each push; `list_deployments` for state=READY.
- `get_runtime_logs` 10m window, error+fatal levels.
- Re-run the Task 1(b) data-state queries; confirm counts unchanged
  (the rewrite doesn't touch existing rows). The pre-fix-row-cleanup
  question is moot — there are no pre-fix rows.

### What this plan does NOT do

- Does not introduce `'awaiting_release'` (Q2 option ii rejected).
- Does not introduce auto-release (Q2 option iii rejected).
- Does not migrate any existing rows (none exist that would need it).
- Does not address Cluster 3's role-check consolidation (separate
  session — Pass 3d).
- Does not address F2 (room_membership upsert atomicity), which
  per the Pass 2 ordering belongs to a session after Cluster 1.

---
