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

### §2 — Completion note

**Status: COMPLETE.** Landed at commit `e909cdf` on `main`,
deploy `dpl_9dRS8Kja4kFme1hFHe9FQbpWy578` READY in production.

**Principal sign-offs (received before execution):**
- Q1 → Option B with `paid_at` dropped (full hygiene, one migration)
- Q2 → Option (i) (cron leaves still-pledged commitments at `'active'`)
- Q3 → Option (a) (delete practitioner-complete route entirely)

**Migration applied to production:**
- `20260424_v4_drop_sponsorships_paid_at.sql` — verified column gone
  via `information_schema.columns` post-apply. Mirrored to repo for
  audit.

**Code changes (9 files, +96/−157, single consolidated commit):**

| Finding | File | Disposition |
|---|---|---|
| F1 | `src/app/api/stripe/webhook/route.ts` | `'paid'` write retired; `terminal` set corrected to include `'released'` |
| F10 | `src/app/api/cron/companion-milestones/route.ts` | Step 3 status flip block removed; `status_flip` field gone from type; header comment rewritten |
| F21 | `src/app/api/commitments/[id]/complete/route.ts` | File + parent dir deleted (zero UI consumers verified) |
| F22 (read-side) | `src/app/(dashboard)/commit/[id]/sponsors/page.tsx` | Status union widened to `pledged \| released \| vetoed \| refunded`; badge map updated; `paid_at` dropped from interface, `released_at`/`vetoed_at` added |
| F22 (GET shape) | `src/app/api/sponsorships/[id]/route.ts` | `.select(...)` replaces `paid_at` with `released_at, vetoed_at` |
| F7 (write) | `src/app/api/sponsorships/[id]/action/route.ts` | Veto branch writes `'vetoed'` instead of `'abandoned'` |
| F7 (read) | `src/app/(dashboard)/earnings/page.tsx` | Status pill renders "Ended by sponsor" for `'vetoed'`; preserves `'abandoned'` branch |
| F7 (read) | `src/app/sponsor/invited/[invite_token]/page.tsx` | Both terminal-status gates (useEffect + closed-render) recognize `'vetoed'` |

**Verification (Task 5):**
- Vercel deploy state `READY`; build clean.
- Runtime logs (10m window post-deploy, error+fatal levels): zero
  results.
- Production data state re-queried: 2 commitments (`active`),
  1 sponsorship (`pledged`), zero terminal-state rows. Unchanged
  from Task 1(b) baseline. No backfill needed; none was expected.
- `npx tsc --noEmit`: clean against the full working tree before
  commit.
- `package.json` / `package-lock.json`: restored after `npm install`
  (no drift).

**Deviation from §2 plan worth recording:**

The plan called for two commits (write-side then read-side, per
the 70%-mark rule). Revised to **one consolidated commit** because
the migration was already applied to production and splitting
commits across pushes would have deployed a known-500 state
between them — `/api/sponsorships/[id]` selecting the dropped
`paid_at` column. The 70%-mark commit rule is for surviving
tool-budget interruptions within a session, not for sacrificing
deploy atomicity. Captured in the commit body for future
archaeology.

**Production state at session close:**
- Tip: `e909cdf` on `main`
- Active commitments: 2 (both started 2026-04-22; day 90 lands
  2026-07-21, ~87 days runway)
- Active sponsorships: 1 (`pledged`)
- Webhook will now log-only on `payment_intent.succeeded` for
  pledges; no DB transition (release-action owns the flip).
- Cron will continue firing milestone + summary at day 90; no
  longer flips status. A still-pledged commitment past day 90
  will sit in `'active'` until a sponsor releases — by spec.

---

## §3 — Cluster 4 institutional portal take-down: plan and execution

**Findings dispositioned.** F39 (institution signup creates institution
row without auth user — broken sign-in promise), F40 (`/api/institution
/[id]/enroll` writes `profiles.institution_id` via SSR client — silently
no-ops under owner-only RLS), F41 (`/api/institution/[id]/analytics` is
orphan — zero callers in the codebase).

**Decision** (already made in §1, Option B): take down. This section
documents the implementation shape and execution.

### Pre-execution sanity checks

**Files at tip eaa8204 (LOC counts exact match to inventory):**

| File | LOC |
|---|---:|
| `src/app/institution/signup/page.tsx` | 167 |
| `src/app/institution/[id]/dashboard/page.tsx` | 303 |
| `src/app/institution/[id]/enroll/page.tsx` | 211 |
| `src/app/institution/[id]/members/page.tsx` | 228 |
| `src/app/api/institution/signup/route.ts` | 45 |
| `src/app/api/institution/[id]/enroll/route.ts` | 93 |
| `src/app/api/institution/[id]/analytics/route.ts` | 71 |
| **Total** | **1118** |

Pass 3b shifted line numbers inside the sponsorship-state-machine
files; nothing in 3b touched the institutional surface.

**Inbound links from outside the institution surface (single hit):**
`src/app/(dashboard)/layout.tsx:27` — conditional nav link gated on
`profile?.institution_id`. Marketing-site references in
`public/spec.html` and `public/roadmap.html` stay as-is per §1.

**Production data state:** `institutions` 0, `institution_memberships`
0, `profiles WHERE institution_id IS NOT NULL` 0. Take-down has zero
user impact.

**Vercel env state:** `INSTITUTIONAL_PORTAL_ENABLED` is not set in
production, preview, or development. `undefined === 'true'` evaluates
false; default-off is structurally guaranteed. No env change required.

### Principal sign-offs

- **Q1 → Option B (helper).** New `src/lib/feature-flags.ts` exporting
  `isInstitutionalPortalEnabled()` and `requireInstitutionalPortal()`.
- **Q2 → Option (ii) (wrap nav-link).** Layout line 27 wrapped in
  `isInstitutionalPortalEnabled() && profile?.institution_id`.
- **Q3 → Option (a) (delete F41 in same commit).** One atomic
  take-down.
- **Env var stays unset.** No Vercel state change.

### Execution shape

**No migration.** Application-layer only. The `institutions` and
`institution_memberships` tables stay for v4.8 redesign reference.

**New file:** `src/lib/feature-flags.ts` exports the two helpers.

**Code changes (8 existing files):**

For the two **client** pages (`signup/page.tsx`, `[id]/enroll/page.tsx`):
env vars aren't readable in client components, so the gate must be
server-side. Pattern: `git mv` the existing `page.tsx` to a sibling
`{form}-form.tsx`, rename the default export to `SignupForm` /
`EnrollForm`, then write a new server-component `page.tsx` that calls
`requireInstitutionalPortal()` and renders the client form. The client
form's existing `useParams()` continues to work — route params are
still available at the client layer.

For the two **server** pages (`[id]/dashboard/page.tsx`,
`[id]/members/page.tsx`): `requireInstitutionalPortal()` as the first
line of the async component body.

For the two **API routes** (`signup/route.ts`, `[id]/enroll/route.ts`):
early return `NextResponse.json({error: 'Not found'}, {status: 404})`
when `!isInstitutionalPortalEnabled()`.

For the **dashboard layout** (`(dashboard)/layout.tsx`): wrap the
line-27 nav-link spread in the flag check.

**File deleted:** `src/app/api/institution/[id]/analytics/route.ts`
— F41. Parent `analytics/` dir disappears with it; the `[id]/`
parent stays because `enroll/` lives there.

### What this plan does NOT do

- No DB row migration (zero institutional rows exist).
- No deletion of `institutions` / `institution_memberships` tables.
- No marketing-site copy changes.
- No Cluster 3 role-check consolidation (Pass 3d).
- No Vercel env var change.

### §3 — Completion note

**Status: COMPLETE.** Landed at commit `db24acc` on `main`,
deploy `dpl_3bxvbtR8Yry29k72gxJqKhR5JQvy` READY in production.

**Code changes (12 files, +524/−444, single commit):**

| Finding | File | Disposition |
|---|---|---|
| — | `src/lib/feature-flags.ts` | NEW. Exports `isInstitutionalPortalEnabled()` and `requireInstitutionalPortal()`. |
| F39 | `src/app/institution/signup/page.tsx` | RENAMED to `signup-form.tsx`; default export renamed `SignupForm`. |
| F39 | `src/app/institution/signup/page.tsx` | NEW thin server wrapper: gates and renders `<SignupForm />`. |
| F39, F41 | `src/app/api/institution/signup/route.ts` | Early-return 404 JSON when flag off. |
| F40 | `src/app/institution/[id]/enroll/page.tsx` | RENAMED to `enroll-form.tsx`; default export renamed `EnrollForm`. |
| F40 | `src/app/institution/[id]/enroll/page.tsx` | NEW thin server wrapper: gates and renders `<EnrollForm />`. |
| F40 | `src/app/api/institution/[id]/enroll/route.ts` | Early-return 404 JSON when flag off. |
| — | `src/app/institution/[id]/dashboard/page.tsx` | `requireInstitutionalPortal()` as first line of component body. |
| — | `src/app/institution/[id]/members/page.tsx` | `requireInstitutionalPortal()` as first line of component body. |
| F41 | `src/app/api/institution/[id]/analytics/route.ts` | DELETED. Parent `analytics/` dir removed; `[id]/` parent retained for `enroll/`. |
| Q2 | `src/app/(dashboard)/layout.tsx` | Line 27 nav-link wrapped in `isInstitutionalPortalEnabled() && profile?.institution_id`. |
| — | `docs/review/pass-3-decisions.md` | §3 plan + this completion note. |

**Verification (Task 5):**

- Vercel deploy state `READY`; build clean (`turbopack`, `nodejs:3`).
- Runtime logs (15-minute window post-deploy, error+fatal levels):
  zero results.
- Endpoint verification against `https://www.searchstar.com`:
  - `GET /institution/signup` → **404** (Next.js default HTML)
  - `GET /institution/{uuid}/dashboard` → **404**
  - `GET /institution/{uuid}/enroll` → **404**
  - `GET /institution/{uuid}/members` → **404**
  - `POST /api/institution/signup` → **404** (`{"error":"Not found"}` JSON)
  - `POST /api/institution/{uuid}/enroll` → **404** (`{"error":"Not found"}` JSON)
  - `GET /api/institution/{uuid}/analytics` → **404** (Next.js default HTML — file deleted, not gated, as planned)
- Production institutional row counts re-queried: `institutions` 0,
  `institution_memberships` 0, `profiles WHERE institution_id IS NOT NULL` 0.
  Unchanged from pre-commit baseline.
- Commitment + sponsorship state collateral check: 2 active
  commitments, 1 pledged sponsorship. Unchanged from Pass 3b
  session-close baseline.

**Deviation from §3 plan worth recording:**

`npx tsc --noEmit` was verified clean against the identical change
set in two prior session attempts before this session. The final
push session skipped the tsc gate to avoid a recurring tool-budget
exhaustion that prevented the commit from landing in earlier
attempts (each attempt completed all file edits but ran out of
budget before commit/push). Vercel's build pipeline runs tsc as
part of the production deploy — the `READY` state of
`dpl_3bxvbtR8Yry29k72gxJqKhR5JQvy` is itself the final tsc
verification, since a type error would have failed the build.

`package.json` / `package-lock.json`: no drift (no npm install
performed in the final push session; cached deps from prior sessions
were sufficient for tsc verification when it ran).

**Production state at session close:**
- Tip: `db24acc` on `main` (pre-completion-note commit; this commit
  appends the note as a doc-only follow-up).
- Active commitments: 2 (started 2026-04-22; day 90 lands 2026-07-21,
  ~87 days runway).
- Active sponsorships: 1 (`pledged`).
- Institutional surface: hidden behind feature flag; all entry points
  return 404 in production. `INSTITUTIONAL_PORTAL_ENABLED` env var
  remains unset — surface is safe-by-default.
- Cluster 3 (role-check consolidation across 13 call sites with 4
  detection mechanisms) NOT yet executed — Pass 3d. The
  institutional surface's F34 references at inventory lines 444–447
  are now unreachable behind the gate; 3d will rewrite the gates the
  take-down preserves.
- F2 (room_membership upsert atomicity), F23 (companion/reflect dead
  code) NOT yet executed — Pass 3e candidates.

---

## §4 — Cluster 3 role-check consolidation: plan for principal review

Pass 3d. Closes F11, F27, F33, F34, F42 by routing every admin
detection through a single canonical helper backed by `profiles.role`
(landed in Pass 3a). 13 call sites, 4 mechanisms, 0 agreement
collapse to 1 mechanism.

### Pre-execution sanity checks (Task 1, completed this session)

**(1a) Call-site count, stable at 13.** Re-grepped at tip `383567e`.
The Pass 3c analytics-route deletion removed one F34 site (Pass 1
inventory line 447); the count went from 14 in Pass 1 to 13 in 3d.
None of 3a/3b/3c incidentally rewrote any other role check — every
remaining mechanism site is exactly as Pass 1 catalogued it.

| # | File:line | Current mechanism | Finding |
|---|---|---|---|
| 1 | `src/app/admin/layout.tsx:38` | `profiles.role === 'admin'` (service client) | F11 |
| 2 | `src/app/admin/donations/page.tsx:96` | `profiles.role` defense-in-depth re-check (service client) | F11 |
| 3 | `src/app/api/admin/companion/milestone/route.ts` | `profiles.role` (SSR client) | F11 |
| 4 | `src/app/api/admin/tickets/route.ts` (POST + PATCH share `checkAdmin`) | `profiles.role` (SSR anon — F38) | F11 |
| 5 | `src/app/(dashboard)/layout.tsx:19` | `user_metadata.role === 'admin'` | F27 |
| 6 | `src/app/admin/page.tsx:12` | `user_metadata.role !== 'admin'` | F34 |
| 7 | `src/app/api/admin/users/route.ts:25` | `user_metadata.role !== 'admin'` (F38: anon-client write) | F34 |
| 8 | `src/app/institution/[id]/dashboard/page.tsx:81` | `user_metadata.role === 'admin'` override | F34 (gated by 3c) |
| 9 | `src/app/institution/[id]/members/page.tsx:58` | `user_metadata.role === 'admin'` override | F34 (gated by 3c) |
| 10 | `src/app/api/institution/[id]/enroll/route.ts:37` | `user_metadata.role === 'admin'` override | F34 (gated by 3c) |
| 11 | `src/app/(auth)/login/page.tsx:56–57` | `user_metadata.role === 'platform'` → `/platform` | F42 |
| 12 | DB `is_admin()` function | `profiles.role = 'admin'` (correct post-3a) | F33 |
| 13 | RLS policies on `support_tickets`, `ticket_messages` | call `is_admin()` | F33 chain |

**(1b) `is_admin()` function body.** Live DB inspection:

```sql
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$function$
```

The function reads `profiles.role = 'admin'` correctly. Pre-3a it was
broken (column missing); post-3a it works as written. **Decision 3
disposition: (a) keep, no repair, no drop.** No DDL needed for the
function in 3d.

**(1c) RLS dependents.** Four policies, not the three the inventory
listed:

| Table | Policy | cmd | qual / with_check |
|---|---|---|---|
| `support_tickets` | Admins read all tickets | SELECT | `is_admin()` |
| `support_tickets` | Admins update all tickets | UPDATE | `is_admin()` |
| `ticket_messages` | Admins read all ticket_messages | SELECT | `is_admin()` |
| `ticket_messages` | Admins insert ticket_messages | INSERT | `is_admin()` (with_check) |

All four work post-3a. The inventory at line 449 missed the INSERT
policy — minor inventory drift, not load-bearing. Pass 3d does not
need to rewrite any of these.

**(1d) Column state.** Live DB:

- `profiles.role`: `text`, nullable, no default
- CHECK constraint `profiles_role_check`: `((role IS NULL) OR (role = 'admin'::text))`
- Distribution: 1 row `role='admin'` (David, `c5370edf-…`), 27 rows
  `role IS NULL`, total 28.

**Two corrections to the handoff prompt the actual state forces:**

(i) The handoff said the CHECK allows `('user', 'admin', 'platform')`.
The actual constraint is `IS NULL OR = 'admin'` — `NULL` is the
non-admin state, there's no `'user'` literal, and `'platform'` was
never permitted. The Task 3 sub-step "tighten CHECK to drop
`'platform'`" is moot.

(ii) The handoff framed the helper as needing the service client
because of "F40 lesson". The F40 lesson was about reading *another
user's* profile under owner-only RLS. For "is the *current* user an
admin," `profiles` SELECT RLS is owner-full-access — the SSR (anon)
client reading the caller's own row is sufficient and correct.

**(1e) Production baselines.**

- `commitments`: 2 active, 0 completed, 0 abandoned (one extra row
  vs 3c — re-verified, unchanged from 3c session close, the count
  was correct then too)
- `sponsorships`: 1 pledged, 0 paid, 0 released
- `support_tickets`: 0 rows. `ticket_messages`: 0 rows. The
  ticket-admin write paths are dead code in production today; their
  consolidation is correctness work, not an incident fix.
- `profiles.role`: 1 admin, 27 NULL

### Principal sign-offs needed before execution

**Q1 — Helper shape.** Three options on the table:

(i) Inline: each call site queries `profiles.role` directly. No
helper. Most repetitive.

(ii) **Recommended.** Helper(s) in `src/lib/auth.ts`:

```ts
// Read the current user's admin bit. SSR client is sufficient
// because profiles RLS is owner-full-access for SELECT.
export async function isCurrentUserAdmin(
  supabase: SupabaseClient
): Promise<boolean>

// One-shot guard for admin server pages and route handlers. Returns
// the user if admin; redirects to /dashboard (pages) or returns null
// for the route handler to 403 (routes). Two flavors because
// redirect() doesn't compose with route handlers' Response shape.
export async function requireAdminPage(): Promise<{ user, supabase }>
export async function requireAdminApi(): Promise<{ user, supabase } | null>
```

(iii) Middleware-based gate at `/admin/*` and `/api/admin/*`. Cleanest
for that surface but doesn't help non-admin role checks (the F42
`/platform` branch in `/login`). Mixing middleware and helper-based
gating across the same finding is more surface area than (ii).

Recommendation: **(ii) helper-based.** Rationale: 12 of 13 sites
follow the same shape ("am I admin? if not, redirect or 403"), so
inlining would copy the same six lines twelve times. Pages need
`redirect()` from `next/navigation`, route handlers need `NextResponse`
JSON, hence two thin wrappers around one core check.

**Q2 — Service client vs SSR client for the role read.**

Inside the helper, use the **service client** for the role lookup —
not the SSR client. The Task 1 plan recommended SSR on the basis
that owner-full-access RLS makes elevation unnecessary, but a closer
read of `src/app/admin/layout.tsx:18–22` flips this:

> Data reads via service client. This layout is the admin gate — a
> silent empty read (the @supabase/ssr JWT-propagation bug
> documented in commits 0710ce4 / 1dccc46 / 501d976 / 0f28db9) would
> boot a real admin out to /dashboard at line 30 even with valid
> creds. Authorization is still enforced at the app layer via the
> profile.role === 'admin' check.

The known SSR JWT-propagation bug means owner-RLS reads can silently
return empty even for the row's owner. Under SSR, an admin's
`profiles.role` lookup could come back `null` and boot them. The
service client bypasses RLS entirely, so the read is reliable. Auth
is still owned by the explicit `getUser()` check at the top of the
helper — the service-client read is just looking up the role bit
once that's known.

This matches the convention every other admin gate in the repo
already uses (call sites 1, 2). 3d brings call sites 3, 4, 5, 6, 7,
8, 9, 10 into the same convention.

**Writes:** the two F38 sites — `/api/admin/users` (call site 7) and
`/api/admin/tickets` (call site 4) — also need service-client writes,
since their current anon-client writes either silently no-op
(`/api/admin/users` against owner-only `profiles` RLS) or depend on
`is_admin()` RLS policies whose stability we shouldn't rely on for
correctness. Service-client writes after the explicit auth check
match the rest of the codebase.

**Q3 — DB `is_admin()` disposition.** Per Task 1(b): **(a) keep**.
The function is correct post-3a. RLS policies that depend on it work.
Dropping it would force rewriting four RLS policies for no benefit.
Keeping it preserves the option to push more admin gating down to
RLS later if that becomes attractive.

**Q4 — F42 `/platform` branch.** Per Decision 2 (already approved):
delete outright. The login `onSuccess` collapse is:

```ts
// Before
const role = data.user?.user_metadata?.role
if (role === 'platform') {
  router.push('/platform')
} else {
  router.push(returnTo ?? '/dashboard')
}

// After
router.push(returnTo ?? '/dashboard')
```

The `role` local variable goes away. No CHECK constraint change is
needed because the constraint never permitted `'platform'` in the
first place; no production row carries the value.

### Proposed execution shape (pending Q1–Q4 sign-off)

**One commit, application-layer only, no migrations.**

Files touched (~13):

| # | File | Change |
|---|---|---|
| — | `src/lib/auth.ts` | NEW. Exports `isCurrentUserAdmin`, `requireAdminPage`, `requireAdminApi`. ~40 LOC. |
| 1 | `src/app/admin/layout.tsx` | Replace inline service-client `profiles.role` lookup with `requireAdminPage()`. |
| 2 | `src/app/admin/donations/page.tsx` | Drop the defense-in-depth re-check entirely; the layout gate is now reliable. |
| 3 | `src/app/api/admin/companion/milestone/route.ts` | Replace SSR `profiles.role` lookup with `requireAdminApi()`. |
| 4 | `src/app/api/admin/tickets/route.ts` | Replace `checkAdmin` with `requireAdminApi()`; switch the writes from the anon SSR client to `createServiceClient()` (F38 fix piggybacked). |
| 5 | `src/app/(dashboard)/layout.tsx` | Replace `user.user_metadata?.role === 'admin'` with `await isCurrentUserAdmin(supabase)`. |
| 6 | `src/app/admin/page.tsx` | Replace `user.user_metadata?.role !== 'admin'` with `requireAdminPage()`. |
| 7 | `src/app/api/admin/users/route.ts` | Replace `user_metadata.role` check with `requireAdminApi()`; switch writes to service client (F38 fix). |
| 8 | `src/app/institution/[id]/dashboard/page.tsx` | Swap `user_metadata.role === 'admin'` for `await isCurrentUserAdmin(supabase)`. (Surface still gated by 3c flag — keeping it internally consistent for v4.8.) |
| 9 | `src/app/institution/[id]/members/page.tsx` | Same as 8. |
| 10 | `src/app/api/institution/[id]/enroll/route.ts` | Same shape with `isCurrentUserAdmin`. (Route still 404s behind 3c flag.) |
| 11 | `src/app/(auth)/login/page.tsx` | Delete the `role === 'platform'` branch per Q4. Collapse to `router.push(returnTo ?? '/dashboard')`. |
| — | `docs/review/pass-3-decisions.md` | This §4 plan + the completion note appended after deploy. |

Inside the helpers, the role read is:

```ts
const db = createServiceClient()
const { data } = await db
  .from('profiles')
  .select('role')
  .eq('user_id', user.id)
  .maybeSingle()
return data?.role === 'admin'
```

The service client bypasses RLS. Auth is still gated by the
explicit `getUser()` check at the top of the helper — the
service-client read just looks up the role bit reliably (defends
against the @supabase/ssr JWT-propagation bug per
`admin/layout.tsx:18–22`). No DB function call (no
`rpc('is_admin')`). The `is_admin()` function continues to exist
for the four RLS policies that use it.

### What this plan does NOT do

- **Does not drop or modify `is_admin()`.** It works post-3a and is
  load-bearing for four RLS policies.
- **Does not modify the `profiles_role_check` constraint.** Already
  the right shape (`IS NULL OR = 'admin'`).
- **Does not touch RLS policies.** The four `is_admin()`-dependent
  policies on `support_tickets` / `ticket_messages` work as-is.
- **Does not address F36** (`commitments.title` selected on a column
  that doesn't exist). Out of cluster scope. Pass 3e or later.
- **Does not address F37** (`select('id')` on `profiles` returning
  undefined). Out of cluster scope.
- **Does not address F2** (room_membership upsert atomicity) or F23
  (companion/reflect dead-code retirement). Pass 3e candidates per
  3c completion note.
- **Does not introduce a Practitioner / Sponsor role distinction in
  `profiles.role`.** v4 decision #5 retired Mentor/Coach/CB/PL but
  did not introduce a `role` value to distinguish Practitioners from
  Sponsors — every user is potentially both. The CHECK stays at
  `IS NULL OR = 'admin'`.

### Standing rules for execution

- `npx tsc --noEmit` before commit, with the 3c retro's tool-budget
  judgment: if the session approaches 70% with tsc still pending,
  push unverified and rely on Vercel's build pipeline (which runs
  tsc on every deploy) for the final check. The change set here is
  more code-touching than 3c, so tsc is more meaningful — but not
  worth losing the commit.
- `git restore package.json package-lock.json` after any `npm install`.
- Single-commit landing on `main`. Deploy is automatic.
- 45-second wait, then `list_deployments` for `state=READY` against
  the new SHA.
- `get_runtime_logs` production, `level=['error','fatal']`,
  `since='15m'` post-deploy.
- Spot-check `/admin` (200 for David) and a non-admin path returning
  403 / redirect from a curl test if cookie material is on hand;
  otherwise verify via Vercel logs that admin routes don't 500.
- Re-query baselines at the end. Append §4 completion note.

### Awaiting principal sign-off on Q1, Q2, Q3, Q4

Q1: Helper shape (recommend ii — `isCurrentUserAdmin`,
`requireAdminPage`, `requireAdminApi` in `src/lib/auth.ts`).
Q2: Service client for the role read (per `admin/layout.tsx:18–22`
SSR JWT-propagation comment); service client for writes in the two
F38 sites (call sites 4 and 7).
Q3: Keep `is_admin()` (a). No DDL.
Q4: Delete the `/platform` branch outright. Collapse login to
`router.push(returnTo ?? '/dashboard')`.

PAUSE before executing.

---
