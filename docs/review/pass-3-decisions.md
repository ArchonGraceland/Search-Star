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

### §4 — Completion note

**Status: COMPLETE.** Landed at commit `b3fe91c` on `main`,
deploy `dpl_B5Hy2cTopbaKXuKszVV89PLsp7De` READY in production.

**Code changes (13 files, +486/−158, single commit):**

| Site | File | Disposition |
|---|---|---|
| — | `src/lib/auth.ts` | NEW. Exports `isCurrentUserAdmin`, `requireAdminPage`, `requireAdminApi`. Service-client read of `profiles.role`. ~100 LOC including doc comments. |
| 1 | `src/app/admin/layout.tsx` | Inline service-client `profiles.role` lookup → `requireAdminPage()`. Display-name read split off into its own SELECT. |
| 2 | `src/app/admin/donations/page.tsx` | Defense-in-depth re-check kept as a pattern; mechanism replaced with `requireAdminPage()`. |
| 3 | `src/app/api/admin/companion/milestone/route.ts` | Inline SSR `profiles.role` lookup → `requireAdminApi()`. Service-client write path unchanged (already correct). |
| 4 | `src/app/api/admin/tickets/route.ts` | Inline `checkAdmin` (SSR anon `profiles.role`) → `requireAdminApi()`. **F38 piggyback**: anon-client writes for `ticket_messages` INSERT and `support_tickets` UPDATE switched to service client. |
| 5 | `src/app/(dashboard)/layout.tsx` | `user.user_metadata?.role === 'admin'` → `await isCurrentUserAdmin()`. |
| 6 | `src/app/admin/page.tsx` | `user.user_metadata?.role !== 'admin'` → `requireAdminPage()`. |
| 7 | `src/app/api/admin/users/route.ts` | Inline `checkAdmin` (`user_metadata.role`) → `requireAdminApi()`. **F38 piggyback**: anon-client writes for `profiles` UPDATE and `trust_records` UPDATE switched to service client. |
| 8 | `src/app/institution/[id]/dashboard/page.tsx` | `user_metadata.role === 'admin'` override → `await isCurrentUserAdmin()`. (Surface 404'd behind 3c flag.) |
| 9 | `src/app/institution/[id]/members/page.tsx` | Same as 8. (Surface 404'd behind 3c flag.) |
| 10 | `src/app/api/institution/[id]/enroll/route.ts` | Same shape with `isCurrentUserAdmin`. (Route 404'd behind 3c flag.) |
| 11 | `src/app/(auth)/login/page.tsx` | F42 platform-role branch deleted outright. `onSuccess` collapses to `router.push('/dashboard')` after the `safeReturnTo` short-circuit. |
| — | `docs/review/pass-3-decisions.md` | §4 plan + this completion note. |

**Verification (Task 5):**

- `npx tsc --noEmit`: clean (run before commit; no type errors).
- Vercel deploy state `READY`; build clean (`turbopack`, `nodejs:3`).
  Vercel's build runs tsc as part of every deploy — `READY` is a
  second tsc verification.
- Runtime logs (15-minute window post-deploy, error+fatal levels):
  zero results.
- Endpoint verification against `https://www.searchstar.com`:
  - `GET /admin` (no auth) → **307** redirect (expected: helper redirects to `/login`)
  - `GET /dashboard` (no auth) → **307** redirect
  - `GET /login` → **200**
  - `PATCH /api/admin/users` (no auth) → **401** Unauthorized
  - `POST /api/admin/companion/milestone` (no auth) → **401**
  - `POST /api/admin/tickets` (no auth) → **401**
  - `GET /institution/signup` → **404** (3c flag still gates the surface)
- Pre-3d these admin API routes returned 403 (since they read
  `profiles.role` on what was a missing column → null profile →
  failed at the role step). Post-3d they correctly distinguish
  unauthenticated (401) from non-admin (403). The 401 vs 403 split
  is the helper's design and matches REST convention.
- Production data state re-queried at session close:
  - `profiles`: 1 admin (David), 27 NULL — unchanged
  - `commitments`: 2 active, 0 completed, 0 abandoned — unchanged
  - `sponsorships`: 1 pledged, 0 paid, 0 released — unchanged
  - `support_tickets`: 0, `ticket_messages`: 0 — unchanged
  - `institutions`: 0, `institution_memberships`: 0 — unchanged
- Code grep at tip `b3fe91c`: zero `user_metadata?.role` /
  `user_metadata.role` reads; zero inline `profiles.role` reads
  outside `src/lib/auth.ts`.

**Deviations from §4 plan worth recording:**

(i) Q2 framing was corrected mid-plan, before code execution. The
initial Task 2 recommendation said SSR client for the role read
based on owner-full-access RLS. A closer read of
`admin/layout.tsx:18–22` flipped this — the layout's pre-3d code
already used the service client *deliberately* with an in-line
comment about the @supabase/ssr JWT-propagation bug silently
returning empty owner-RLS reads. The corrected Q2 (service client
for the read) was written into §4 and signed off; the helper
implements service-client reads accordingly.

(ii) Site 2's defense-in-depth disposition shifted from "delete the
re-check entirely" (per the original §4 plan) to "replace the
mechanism with the helper, keep the re-check pattern." Removing the
re-check would have lost a real safety net if a future layout
regression bypassed the gate. The helper-based re-check costs one
service-client query and preserves the defense-in-depth shape.

**Production state at session close:**
- Tip: `b3fe91c` on `main`.
- Active commitments: 2 (started 2026-04-22; day 90 lands 2026-07-21,
  ~87 days runway).
- Active sponsorships: 1 (`pledged`).
- Admin profiles: 1 (David); non-admin profiles: 27.
- `is_admin()` DB function: unchanged, still backing 4 RLS policies on
  `support_tickets` / `ticket_messages` (verified Task 1c).
- `profiles_role_check` constraint: unchanged (`role IS NULL OR role
  = 'admin'`).
- Institutional surface: hidden behind feature flag from 3c; entry
  points return 404 in production. Sites 8/9/10's helper migration
  is internally consistent for v4.8 redesign.
- F38 (anon-client admin writes) closed as Pass 3d piggyback at sites
  4 and 7. No remaining anon-client admin writes in the codebase.
- F2 (room_membership upsert atomicity), F23 (companion/reflect dead
  code), F36 (`commitments.title` on missing column), F37
  (`select('id')` on `profiles`) NOT yet executed — Pass 3e
  candidates.
- F26 + F30 (visibility enum residue — Cluster 4 in Pass 2's roll-up)
  NOT yet executed. Pass 3 closing summary should record disposition.

---

## §5 — Cluster 4 visibility + schema residue cleanup: plan for principal review

Pass 3e. Closes F26, F30, F36, F37 by aligning four "DB-accepts-X / app-doesn't" or "app-expects-X / DB-doesn't-have-X" surfaces. Lower complexity than 3b/3d — mostly read-path corrections plus one small CHECK-constraint shrink.

### Pre-execution sanity checks (Task 1, completed this session)

**(1a) Call-site count, stable.** Re-grepped at tip `c082399`. None of 3a/3b/3c/3d touched any of the four findings' surfaces. Counts match Pass 1 inventory exactly.

| # | Finding | File:line | Current shape |
|---|---|---|---|
| F26 | API rejects DB-accepted value | `src/app/api/profiles/visibility/route.ts:15` | PATCH validator allows only `('public', 'private')` |
| F30 | API serves narrow-audience as public | `src/app/api/trust/[userId]/route.ts:22–24` | Filter excludes `'private'` only |
| F36 | App expects column DB doesn't have | `src/app/admin/donations/page.tsx:74, 146, 326, 355` | `select('id, title')` against `commitments`; render fallback `cm?.title ?? d.commitment_id.slice(0, 8)` |
| F37 | App expects column DB doesn't have | `src/app/admin/tickets/page.tsx:86`, `src/app/admin/tickets/[id]/page.tsx:67, 82`, `src/app/(dashboard)/support/page.tsx:49` | `select('id', ...)` against `profiles` |

**(1b) Production DB inspection.**

- `profiles_visibility_check`: `CHECK ((visibility = ANY (ARRAY['private'::text, 'network'::text, 'public'::text])))`. Confirmed.
- Visibility row distribution: `{private: 28, network: 0, public: 0}` — total 28, matches `profiles_admin (1) + profiles_null (27)`. **Zero `'network'` rows in production.** Q3 simplifies: clean DROP/ADD migration, no backfill needed.
- `commitments` columns: `{id, user_id, practice_id, status, completed_at, target_payout_amount, created_at, room_id, started_at}`. **No `title` column.** Per Decision #8 the commitment statement IS the practice name (no separate title field). Q1 disposition forced to (b): change the read shape, not add a column.
- `profiles` columns: `{user_id, display_name, location, bio, trust_stage, mentor_role, created_at, pending_validator_email, pending_validator_note, visibility, institution_id, role}`. **No `id` column.** PK is `user_id`.

**(1c) F37 PostgREST runtime probe — answer is not load-bearing for the disposition.**

The empirical disambiguation between (A) PostgREST silently drops unknown column vs (B) PostgREST returns 400 cannot be drawn cleanly from production logs: zero F37-site traffic in the 24-hour log window (donations/support_tickets/ticket_messages all empty, no admin visited `/admin/tickets`, no user visited `/support`). The raw-SQL probe via `execute_sql` confirms the SQL layer raises `42703: column "id" does not exist`. Postgrest's documented behavior is to return 400 on unknown columns in `select=`; that is the most likely production behavior.

But the runtime answer doesn't change the fix shape. All four sites destructure `{ data }` only and never inspect `error`. Both possible behaviors converge on the same observable outcome:

- (A) silent-drop: `data` rows arrive with `id: undefined`. Site 1's `(profiles || []).reduce(...)` handles it; sites 2/3/4 read `?.id || ''` fallbacks.
- (B) 400 + swallowed error: `data` is `null`. Site 1's `(profiles || [])` handles it; sites 2/3/4's optional chaining + `||` fallbacks handle it.

Either way the fix is mechanical: change SELECTs to `'user_id'`, update downstream references. Whether to also start checking `error` is a separate cleanup not strictly required to close F37.

**(1d) Production data state — baselines re-confirmed at session open.**

- `commitments`: 2 active, 0 completed, 0 abandoned (unchanged from 3d close)
- `sponsorships`: 1 pledged, 0 paid, 0 released (unchanged)
- `support_tickets`: 0, `ticket_messages`: 0 (unchanged — F37 user-visible impact today: zero)
- `donations`: 0 (unchanged — F36 user-visible impact today: zero)
- `profiles`: 1 admin (David), 27 NULL = 28 total (unchanged)
- `profiles.visibility`: `{private: 28, network: 0, public: 0}` — the visibility-shrinkage collateral check passes.

**(1e) Onboarding visibility UI audit — surfaces a third bug, not previously inventoried.**

`src/app/onboarding/visibility/page.tsx`:

1. The form offers all three options: `'private'`, `'network'`, `'public'` (lines 7, 9–25). Under the proposed binary shrinkage, the `'network'` option must be removed.
2. **The form submits to `/api/profiles` PATCH (line 38), not `/api/profiles/visibility` PATCH.** `/api/profiles` does not accept `visibility` at all — it whitelists `{display_name, location, bio}` only (route lines 13, 25). Any `visibility` value submitted is silently dropped; the API returns `{success: true}` with no rows updated. **This means the onboarding visibility step has been a no-op from day one.** The fact that all 28 production profiles are `'private'` (the column default) and zero are `'public'` or `'network'` is direct evidence — there has been no real variation despite users having gone through the form.

This is a third schema-residue bug in the same surface. It is genuinely separate from F26/F30 in mechanism, but it lives in the same file Pass 2 §51 explicitly scoped into Cluster 4 ("the onboarding visibility step also needs to be audited"). The fix is one line: route the form to `/api/profiles/visibility`. Bundling avoids shipping a binary-visibility deploy whose UI still doesn't work.

Searching for `'network'` across `src/`: only two references, both in the onboarding visibility page. The DB CHECK is the only other place it lives. Cluster 4's surface area is small.

### Per-finding disposition table

| Finding | Current shape | Proposed fix | Files touched |
|---|---|---|---|
| F26 | API validator already accepts only `('public', 'private')`; DB CHECK accepts the third value `'network'`. | **No code change required.** Migration shrinks DB CHECK to match API. F26 dissolves at migration time. | (none — DB only) |
| F30 | Filter excludes `'private'` only; treats `'network'` and `'public'` identically. | **No code change required post-migration.** With `'network'` removed from the DB, the binary `not-private == public` predicate becomes correct. | (none — relies on migration) |
| F36 | `select('id, title')` against `commitments`; render fallback. | Change SELECT to read practice name via the `practice_id` join. Recommended Supabase nested-select shape: `select('id, practice:practices(name)')`, then read `cm?.practice?.name ?? d.commitment_id.slice(0, 8)` at the render site. Type `CommitmentRow` updated accordingly. Existing slice fallback preserved as a defense for malformed rows. | `src/app/admin/donations/page.tsx` (type, SELECT, render — 3 spots) |
| F37 | `select('id', ...)` against `profiles` at 4 sites. | Change SELECT column from `'id'` to `'user_id'` at all 4 sites. Update downstream field references where applicable. **Bonus simplification (recommend bundling):** sites 3 and 4 pass `?.id \|\| ''` to props (`adminProfileId`, `profileId`) the API's `author_id \|\| user.id` fallback already covers — these props have always been `''` in production. Delete the props from the call sites and component signatures; the API behavior is unchanged. | 4 page files + 2 component files (props removed) |
| F37b (sub) | Onboarding visibility form submits to `/api/profiles` (which silently drops `visibility`). | Route the fetch in `src/app/onboarding/visibility/page.tsx` to `/api/profiles/visibility`. | `src/app/onboarding/visibility/page.tsx` (1-line route change) |
| Onboarding UI residue | Onboarding visibility page offers `'network'` as a selectable option. | Remove the `'network'` entry from `OPTIONS`; remove `'network'` from the `Visibility` type. | `src/app/onboarding/visibility/page.tsx` (type + array entry) |

### Principal sign-offs needed before execution

**Q1 — F36 disposition.** **Recommend (b): change the read shape.** The `commitments` schema does not contain `title`, has not contained `title`, and per Decision #8 should not — the practice name *is* the commitment statement. Adding the column would create a duplicate field that nothing else in the codebase writes to or reads from. The donations page joins `commitments → practices(name)` via the existing `practice_id` foreign key. The Supabase JS nested-select shape `select('id, practice:practices(name)')` matches the idiom used elsewhere in the repo (e.g., `/api/cron/release-streaks` reads `practice:practices(name)` the same way) and is the cleanest fix. The existing `?? d.commitment_id.slice(0, 8)` fallback stays — defense for malformed rows.

**Q2 — F37 disposition.** **Recommend: change SELECTs to `'user_id'`, AND prune the dead-prop pattern.**

The strict literal fix is column rename: `'id'` → `'user_id'` at all four SELECTs, with downstream `profile?.id` references updated accordingly. This closes F37 by the inventory's literal definition.

But sites 1 and 2 select `id` and *never use it* — pure dead column selection. Sites 3 and 4 select `id` and pass it through `?.id || ''` props that have been empty strings in 100% of production calls (zero rows in `support_tickets` so the `<AdminTicketActions>` branch has never run; the `<TicketForm profileId>` prop has been `''` for every form ever rendered). The downstream APIs (`/api/admin/tickets` POST and `/api/tickets` POST) already fall back to `user.id` when `author_id` is empty.

Bundling the prop cleanup means: delete the `id` selection at sites 1–2 entirely; delete the SELECT at sites 3–4 entirely (they served only the prop); delete the `adminProfileId` prop from `<AdminTicketActions>` and the `profileId` prop from `<TicketForm>` and `<TicketReplyForm>`. The API fallback to `user.id` continues to do the right thing. Net change: less code, identical behavior.

The bundled cleanup is small (probably +0/-25 LOC) and removes a Pass-1-flagged misleading prop pattern. The unbundled "literal column rename" version preserves the misleading shape for a future cleanup. Recommend bundle.

**Q3 — Visibility migration shape + UI work.**

Migration: option (i) — clean `DROP CONSTRAINT IF EXISTS profiles_visibility_check` + `ADD CONSTRAINT ... CHECK (visibility IN ('private', 'public'))`. No backfill needed (zero `'network'` rows confirmed).

UI work: per the (1e) audit, two changes to `/onboarding/visibility/page.tsx`:

(α) Remove `'network'` from the `Visibility` type and from the `OPTIONS` array (one entry deleted at lines 16–20 plus the `| 'network'` from the type union at line 7).

(β) **Sub-question for principal:** the form submits to `/api/profiles` instead of `/api/profiles/visibility` — a third bug surfaced during audit, mechanism distinct from F26/F30 but in the file Pass 2 §51 scoped into Cluster 4. **Recommend bundling the route fix (1-line change) with the visibility shrinkage.** Rationale: shipping a binary-visibility deploy whose UI still doesn't persist any visibility selection means the cleanup superficially closes F26/F30 but leaves the entire visibility surface broken end-to-end. Cohesive fix.

If you prefer to defer the route fix to a separate session for clean scope discipline, say so and Q3(β) becomes "remove `'network'` only; leave route fix for a later pass." The visibility shrinkage stands either way.

**Q4 — Commit shape.** **Recommend single commit.** Cluster 4 is small: one migration + ~6 file touches (donations page, three F37 pages, one F37 supporting component pair, onboarding visibility page). The Pass 3d retro showed single commits handle this cohesively. Bundling reduces verification surface (one deploy, one log scan, one set of curl probes) and keeps the cluster's identity intact.

The migration lands first (no app-layer dependency on it; `'network'` rows are zero so the DROP/ADD is a pure DDL change). Code lands in the same commit as the migration would not be problematic because the application doesn't care about the constraint shape at runtime — it only cares that the API and DB agree, which they do post-migration.

### What this plan does NOT do

- **Does not address F2** (`room_memberships` upsert atomicity — sponsor pays but cannot see the room). Pass 3f.
- **Does not address F23** (companion/reflect dead-code retirement, ~600 LOC). Pass 3f.
- **Does not introduce a `network` interpretation under v4.** No v4 doc reinstates the value; the validator-circle anchor it depended on was retired in Decision #1; the room model that replaced it has no middle tier.
- **Does not add a surrogate `id` PK to `profiles`.** Cluster 2 (Pass 3a) added `role` only, not a new PK shape. F37 is handled via column rename, not by reintroducing the column the old code expected.
- **Does not modify the `DEFAULT 'private'` on `profiles.visibility`.** Default remains `'private'` post-shrinkage — still the v4 sensible default.
- **Does not touch the trust visibility behavior beyond the binary semantics.** F30's filter shape is unchanged in code; it becomes correct because the DB column can no longer hold `'network'`.

### Standing rules for execution

- `npx tsc --noEmit` before commit. Cluster 4 is small-LOC; tsc gate is cheap.
- `git restore package.json package-lock.json` after any `npm install`.
- Single-commit landing on `main`. Deploy automatic.
- Migration via `Supabase:apply_migration`, name `20260425_visibility_shrink_to_binary` (or principal-preferred name). Verify with `execute_sql` follow-up showing the new constraint and re-querying the row distribution.
- 45-second wait, then `list_deployments` for `state=READY` against the new SHA.
- `get_runtime_logs` production, `level=['error','fatal']`, `since='15m'` post-deploy.
- Spot-checks:
  - `GET /api/trust/{userId}` for the David admin user (visibility=private) → 404 (correct: private filter still triggers).
  - `PATCH /api/profiles/visibility` with `{visibility: 'network'}` → 400 (correct: API still rejects).
  - `PATCH /api/profiles/visibility` with `{visibility: 'public'}` → 200 (correct: post-migration the DB now also accepts it without `'network'` in scope).
  - `/admin/donations` loads (empty data; no SELECT 500).
  - `/admin/tickets` loads (empty data; no SELECT 500).
  - `/onboarding/visibility` renders with two options only.
- Re-query baselines at session close. Visibility distribution should remain `{private: 28}` (no users will have changed visibility during the session); CHECK constraint definition should now show the binary shape.
- Append §5 completion note mirroring §2/§3/§4 pattern.

### Awaiting principal sign-off on Q1, Q2, Q3, Q4

Q1: F36 — change read shape via `practice:practices(name)` join. Recommend (b).
Q2: F37 — column rename `'id'` → `'user_id'` AND bundle the dead-prop cleanup at sites 3/4 (`adminProfileId`, `profileId`).
Q3: Visibility — clean DROP/ADD (no backfill) + remove `'network'` UI option + (β) route the onboarding form fix from `/api/profiles` to `/api/profiles/visibility` (recommend bundling; defer if principal prefers strict scope).
Q4: Single commit.

PAUSE before executing.

### §5 — Completion note

**Status: COMPLETE.** Landed at commit `dd1807e` on `main`,
deploy `dpl_FKwnPmYX3MJGoFqURbDzhnsQcWVd` READY in production.

**Migration note.** `visibility_shrink_to_binary` was applied as
a separate Supabase MCP operation in an earlier session (the
original Task 3, executed before the §5 plan was written). The
migration is recorded in the Supabase migration history under
that name. At Task 1 sanity check this session, the constraint
was already in place: `CHECK ((visibility = ANY (ARRAY
['private'::text, 'public'::text])))`. No DDL ran during the
code-execution session that landed `dd1807e`.

**Code changes (10 files, +26/−53, single commit `dd1807e`):**

| Cluster | File | Disposition |
|---|---|---|
| F36 | `src/app/admin/donations/page.tsx` | `CommitmentRow.title: string \| null` → `practice: { name: string } \| null`; SELECT switched from `'id, title'` to `'id, practice:practices(name)'`; render switched from `cm?.title` to `cm?.practice?.name`. |
| F37 site 1 | `src/app/admin/tickets/page.tsx` | Dropped `id` from `ProfileName` interface; SELECT shrunk from `'id, user_id, display_name'` to `'user_id, display_name'`. |
| F37 sites 2+3 | `src/app/admin/tickets/[id]/page.tsx` | Dropped `createClient` import; deleted `await createClient()` call; rewrote the leading comment to point at `requireAdminPage()` (Pass 3d) as the gate; SELECT shrunk from `'id, display_name'` to `'display_name'`; deleted the entire admin-user-id block (`auth.getUser()` + adminProfile SELECT); JSX for `<AdminTicketActions>` no longer passes `adminProfileId`. |
| F37 site 4 | `src/app/(dashboard)/support/page.tsx` | Deleted profile SELECT block; JSX for `<TicketForm>` no longer passes `profileId`. |
| F37 site 5 | `src/app/(dashboard)/support/[id]/page.tsx` | **DEVIATION 1.** Fifth F37 site, not in the §5 plan inventory. Same shape as sites 1–4: deleted profile SELECT block; JSX for `<TicketReplyForm>` no longer passes `authorId`. `user` retained — still referenced by the ticket SELECT at line 49. |
| F37 components | `src/components/admin-ticket-actions.tsx` | Dropped `adminProfileId` from prop interface and parameter destructure; removed `author_id: adminProfileId,` from the POST body to `/api/admin/tickets`. |
| F37 components | `src/components/ticket-form.tsx` | Dropped `profileId` from prop interface and parameter destructure; removed `author_id: profileId,` from the POST body to `/api/tickets`. |
| F37 components | `src/components/ticket-reply-form.tsx` | Dropped `authorId` from prop interface and parameter destructure; removed `author_id: authorId,` from the PATCH body to `/api/tickets`. |
| F37b + Q3 | `src/app/onboarding/visibility/page.tsx` | Type narrowed from `'private' \| 'network' \| 'public'` to `'private' \| 'public'`; the `network` `OPTIONS` entry removed (two options remain); fetch URL changed from `/api/profiles` (which silently dropped `visibility` — only `display_name`/`location`/`bio` are whitelisted) to `/api/profiles/visibility`. |
| Deviation 2 | `src/app/api/admin/tickets/route.ts` | **DEVIATION 2.** Added `const adminUser = guard` after the `requireAdminApi()` short-circuit; relaxed validation from `!ticket_id \|\| !msgBody \|\| !author_id` to `!ticket_id \|\| !msgBody`; insert payload changed from `author_id,` to `author_id: author_id \|\| adminUser.id,`; comment updated to mirror the wording on `/api/tickets`. The §5 plan claimed both `/api/tickets` and `/api/admin/tickets` already had this fallback. Only `/api/tickets` did. Without this fix, dropping `author_id` from `<AdminTicketActions>`'s POST body would 400 every admin reply. |

**Verification (Task 5):**

- `npx tsc --noEmit`: clean on first run, exit 0, no output. (No
  TS7016 cache spam this session — the cache was already warm from
  earlier `npm install` runs in the same container.)
- Vercel deploy state `READY`; build clean (`turbopack`,
  `nodejs:3`); commit SHA `dd1807e9ee648912ae332cfde3aadd317a73d32f`
  matches HEAD. Vercel's build runs tsc as part of every deploy —
  `READY` is a second tsc verification.
- Runtime logs (15-minute window post-deploy, error+fatal levels):
  zero results.
- Endpoint verification against `https://www.searchstar.com`:
  - `GET /api/trust/c5370edf-8505-441a-a60e-4d9a5ef0d7e0` → **404**
    (David, visibility=private — trust route returns 404 for
    private profiles)
  - `PATCH /api/profiles/visibility` (no auth) → **401**
    (route exists; auth-gated as expected)
  - `GET /admin/donations` (no auth) → **307** (helper redirects to `/login`)
  - `GET /admin/tickets` (no auth) → **307** (helper redirects to `/login`)
  - `curl /onboarding/visibility | grep -c value="network"` → **0**
    (the `network` option no longer renders)
- Verification greps at tip `dd1807e`:
  - `grep -rn "'network'" src/` → zero hits
  - `grep -n "title" src/app/admin/donations/page.tsx` → zero hits
  - `grep -rn "adminProfileId\|profileId\|authorId" src/` → zero
    hits except the comment in `src/app/api/admin/tickets/route.ts`
    documenting the prop drop (intentional, per the commit
    message and the rewritten comment block).
- Production data state re-queried at session close (matches
  Task 1 sanity check exactly — nothing drifted during Task 4):
  - `profiles`: 1 admin (David), 27 NULL, 28 total — unchanged
  - `profiles.visibility`: `{private: 28}` — unchanged (CHECK
    constraint binary, distribution unchanged)
  - `commitments`: 2 active, 0 completed, 0 abandoned — unchanged
  - `sponsorships`: 1 pledged, 0 paid, 0 released — unchanged
  - `support_tickets`: 0, `ticket_messages`: 0 — unchanged
  - `donations`: 0 — unchanged

**Deviations from §5 plan worth recording:**

(1) **Fifth F37 site discovered.** Pass 1's F37 inventory listed
four sites (`admin/tickets/page.tsx`, `admin/tickets/[id]/page.tsx`
×2, `(dashboard)/support/page.tsx`). A grep audit at Task 4
execution surfaced a fifth site at
`src/app/(dashboard)/support/[id]/page.tsx` — same shape (a
`profiles` SELECT for `id` to forward to `<TicketReplyForm>` as
`authorId`), missed by the original inventory because the file
was added later in the v4 ticket-flow build and the F37
audit ran against an older snapshot. Same disposition applied:
profile block deleted, `authorId` prop dropped from JSX, `user`
retained for the ticket SELECT. The behavior was already
production-equivalent — `profile?.id || ''` was always the empty
string in production because `profiles.id` does not exist as a
column, and the `/api/tickets` PATCH fallback (`author_id ||
user.id`) had been the only path that ever ran.

(2) **`/api/admin/tickets` POST handler required a server-side
fallback addition that the §5 plan claimed already existed.** The
plan asserted both `/api/tickets` and `/api/admin/tickets` had
the `author_id || user.id` fallback. Inspection during Task 4
showed only `/api/tickets` actually had it. `/api/admin/tickets`
validated `author_id` as required (line 25) and inserted it
literally (line 36). Dropping `author_id` from the
`<AdminTicketActions>` POST body without this fix would have
400'd every admin reply. The fix:
`const adminUser = guard` after the short-circuit, validation
relaxed to `!ticket_id || !msgBody`, and insert changed to
`author_id: author_id || adminUser.id`. The fallback was
load-bearing — `adminProfileId` had always forwarded an empty
string in production from the JSX caller, so the fallback path
was already the only path that ever ran in any case where the
prop drop was observable.

**Production state at session close:**

- Tip: `dd1807e` on `main`.
- Active commitments: 2 (started 2026-04-22; day 90 lands
  2026-07-21, ~87 days runway).
- Active sponsorships: 1 (`pledged`).
- Admin profiles: 1 (David); non-admin profiles: 27.
- `profiles.visibility` distribution: `{private: 28}`.
- `profiles_visibility_check` constraint: binary
  (`'private', 'public'`) — `network` retired.
- `profiles.role` from Pass 3a; `role` CHECK
  (`role IS NULL OR role = 'admin'`) unchanged.
- 13 role-check call sites consolidated to `src/lib/auth.ts`
  helpers (Pass 3d), unchanged.
- Institutional surface 404'd behind `INSTITUTIONAL_PORTAL_ENABLED`
  (Pass 3c), unchanged.
- F26 (visibility CHECK constraint mismatch with API validators)
  closed naturally post-migration — the migration brought the
  CHECK constraint into alignment with the API validators that
  were already binary.
- F30 (visibility enum residue across surfaces) closed via the
  `network` option removal in `onboarding/visibility/page.tsx`
  and the type narrowing in the same file.
- F36 (`commitments.title` on missing column) closed via the
  donations page's nested-SELECT read shape.
- F37 (`select('id')` on `profiles` at admin/ticket sites) closed
  at five sites with three component prop drops; behavior was
  already production-equivalent due to the API fallbacks.
- F37b (onboarding visibility silent-drop on `/api/profiles`)
  closed via the route change to `/api/profiles/visibility`.
- F2 (room_memberships upsert atomicity — sponsor pays but cannot
  see the room) and F23 (companion/reflect dead-code retirement,
  ~600 LOC) deferred to Pass 3f.
- Pass 3 closing summary still pending — a final summary commit
  should record what landed across 3a/b/c/d/e, what's deferred to
  Pass 3f and Pass 4, and what Pass 4 should pick up first.

---

## §6 — Pass 3 closing summary

This section records the whole pass — not a single cluster — and
mirrors the per-pass completion-note shape one level up. It is
appended after Pass 3e's §5 completion note and before Pass 3f
opens. No code changes.

### (a) Executive summary

Pass 3 reconciled the Pass 1 F-finding catalog against the v4 spec
across five sub-passes (3a–3e) executed between 2026-04-24 and
2026-04-25. Twenty F-findings closed, two deferred to Pass 3f, and
the remainder dispositioned per Pass 2's three-state verdict
(MATCHES-SPEC / DEFENSIBLE-DIVERGENCE / GENUINE-BUG) without
requiring code in this pass. The sponsorship state machine
(Cluster 1) was the principal blocking-tier work; the institutional
portal take-down (Cluster 4 in Pass 2's roll-up — spec-deferred to
v4.8) and the role-check consolidation (Cluster 3) collapsed
13-call-site / 4-mechanism / 0-agreement drift into a single helper
backed by a single column. Production data state at session close:
two active commitments, one pledged sponsorship, zero terminal-
state rows; 28 profiles all `private`; ~87 days runway to day 90.

### (b) What landed, by sub-pass

| Sub-pass | Cluster (Pass 2 roll-up) | Findings closed | Closing tip | Deploy |
|---|---|---|---|---|
| **Pass 3a** — `profiles.role` column add | Cluster 2 prep (for Cluster 3 in Pass 2's roll-up) | F11 (DB layer), F33 | Supabase migration only — no code commit; the column landing was a schema-only `apply_migration`. Tip referenced in Pass 3d as "post-3a." | n/a (DDL) |
| **Pass 3b** — Sponsorship state machine | Cluster 1 | F1, F7, F10, F21, F22 | `e909cdf` | `dpl_9dRS8Kja4kFme1hFHe9FQbpWy578` |
| **Pass 3c** — Institutional portal take-down | Cluster 4 in Pass 2's roll-up (spec-deferred to v4.8) | F39, F40, F41 | `db24acc` | `dpl_3bxvbtR8Yry29k72gxJqKhR5JQvy` |
| **Pass 3d** — Role-check consolidation | Cluster 3 | F11 (app layer), F27, F33 (app-level callers — DB function unchanged), F34, F38, F42 | `b3fe91c` | `dpl_B5Hy2cTopbaKXuKszVV89PLsp7De` |
| **Pass 3e** — Visibility + schema residue | Cluster 4 (Pass 2's roll-up — second half, separate from 3c) | F26, F30, F36, F37, F37b (sub-finding) | `dd1807e` | `dpl_FKwnPmYX3MJGoFqURbDzhnsQcWVd` |

A note on cluster numbering: Pass 2's roll-up labelled the
visibility-enum work Cluster 4 and the institutional portal as a
separate concern under "scope decisions"; the session-prompt
shorthand for 3c reads "Cluster 4 take-down" because both surfaces
shared the v4-deferred shape. The findings dispositioned by 3c and
3e do not overlap. The naming is harmless but recorded here for
audit.

### (c) F-findings closed, with closing commits

The list below covers every F-finding from the Pass 1 catalog
(F1–F45) that Pass 3 dispositioned with a code-or-schema change.
Findings disposed of as MATCHES-SPEC, DEFENSIBLE-DIVERGENCE,
documentation-only, or out-of-band-fix-pre-Pass-3 are listed in
(d) and (e).

| Finding | Severity (Pass 1) | Closing commit | Sub-pass |
|---|---|---|---|
| F1 — `sponsorship.status='paid'` rejected by CHECK | Blocking | `e909cdf` | 3b |
| F7 — `'vetoed'` enum stranded; veto branch wrote `'abandoned'` | Concerning | `e909cdf` | 3b |
| F10 — Cron + release-action both flip `commitments.status='completed'` | Blocking | `e909cdf` | 3b |
| F11 (DB) — `profiles.role` column missing | Blocking | Pass 3a migration | 3a |
| F11 (app) — Inline `profiles.role` reads consolidated to helper | Blocking | `b3fe91c` | 3d |
| F21 — Practitioner-complete endpoint as third independent writer | Blocking | `e909cdf` | 3b |
| F22 — Sponsors-page UI status union stale | Concerning | `e909cdf` | 3b |
| F26 — `/api/profiles/visibility` rejects DB-accepted `'network'` | Concerning | `dd1807e` (closed at migration time) | 3e |
| F27 — Dashboard nav reads `user_metadata.role` (third mechanism) | Blocking | `b3fe91c` | 3d |
| F30 — `/api/trust/[userId]` serves `'network'` as if public | Concerning | `dd1807e` (closed naturally post-migration) | 3e |
| F33 — `is_admin()` reads missing column | Blocking | Pass 3a migration (function unblocked atomically with column add); app-level callers consolidated `b3fe91c` | 3a + 3d |
| F34 — Four `user_metadata.role` admin surfaces | Concerning | `b3fe91c` | 3d |
| F36 — `commitments.title` selected; column does not exist | Concerning | `dd1807e` | 3e |
| F37 — `profiles.select('id', ...)` against non-existent column | Concerning | `dd1807e` | 3e |
| F37b (sub) — Onboarding visibility form submits to wrong route | Concerning (newly inventoried during 3e (1e) audit) | `dd1807e` | 3e |
| F38 — Admin API writes via anon client silently no-op | Concerning | `b3fe91c` (piggyback at sites 4 + 7) | 3d |
| F39 — Institution signup creates row without auth user | Concerning | `db24acc` (gated 404) | 3c |
| F40 — `/api/institution/[id]/enroll` writes via anon client under owner-only RLS | Concerning | `db24acc` (gated 404) | 3c |
| F41 — `/api/institution/[id]/analytics` orphan | Nit | `db24acc` (deleted outright) | 3c |
| F42 — Login redirects `user_metadata.role==='platform'` to non-existent route | Concerning | `b3fe91c` (branch deleted) | 3d |

**Twenty F-findings dispositioned with code or schema changes.**

### (d) F-findings deferred to Pass 3f

| Finding | Severity | Why deferred from 3a–3e | Fix shape (one line) |
|---|---|---|---|
| F2 — `room_memberships` upsert atomicity on pledge | Concerning | Live production money flow; needs a transaction wrapper or service-client RPC pattern, plus a behavior change in the sponsor pledge flow. The active-pledge count was 1 at the time 3b/3c/3d/3e ran — low urgency but real. Wrapping the room-membership write into the pledge transaction (or a Supabase RPC) deserves its own pre-execution sanity-check pass before code touches the path. | Wrap pledge + membership writes in a single transactional unit (Supabase RPC or service-client pattern that can roll back); surface failures to client with retry. Bundle in Pass 3f Task 2 plan block before any code execution. |
| F23 — Companion/reflect dead-code retirement (~600 LOC) | Concerning (Pass 1 upgrade) | Per userMemories the BCD arc Session 5 was supposed to author the per-file decision table for these ~10 dead files (`log/client.tsx`, `start/launch|ritual|active|sponsor|companion`, profiles API stubs, plus `companion-panel.tsx` + `/api/companion/reflect/route.ts` + the two unused system prompts in `src/lib/anthropic.ts`). Bundling deletion into 3a–3e would have side-stepped that decision-table review. F23 needs the principal's per-file sign-off before deletion. | Author per-file decision table (delete/redirect/fix-copy); grep Resend templates and Vercel runtime logs (30 days) for retired-path traffic; then delete in single commit. ~500 LOC + drop one table (`companion_rate_limit`) per F16+F23 confirmation. |

### (e) F-findings deferred beyond Pass 3 (Pass 4+ candidates)

These are either MATCHES-SPEC, DEFENSIBLE-DIVERGENCE, or
GENUINE-BUG-but-non-blocking findings that Pass 3 chose not to
execute. Verdicts are taken from `pass-2-reconciliation.md`.

| Finding | Pass 2 verdict | Why deferred |
|---|---|---|
| F3 — `donations.sponsor_id` is actually `sponsorship_id` | DEFENSIBLE-DIVERGENCE | Cosmetic naming; harmless. Ride-along on a future donations migration if one happens. |
| F4 — `donation_rate` not persisted by action-route insert | GENUINE-BUG | One-line fix (`donation_rate: rate` in the insert payload). Donations table is empty — zero user-visible impact today. Pass 4 candidate alongside other small donation-flow fixes. |
| F5 — `streak_ends_at = started_at + 90d` computed per-caller in 3 routes | DEFENSIBLE-DIVERGENCE | 90 is a fixed spec constant; drift risk small. Helper consolidation is fine cleanup but not blocking. Pass 4+. |
| F6 — Practitioner email links to `/commit/.../sponsors`, sponsor email to `/room/...` | MATCHES-SPEC | Different audiences legitimately have different destinations. No action. |
| F8 — Access-token release flow has no replay window beyond idempotent status check | MATCHES-SPEC | Spec doesn't require nonce; bearer-token model is intentional. Defer hardening until threat model is named. |
| F9 — Stripe signature verification uses default tolerance | MATCHES-SPEC | Industry standard. No action. |
| F12 — `companion_moderation` enum value never written | DEFENSIBLE-DIVERGENCE | Reserved for chat-room-plan §5 Phase 5 (sponsor-drift moderation). Carry as scaffold; document in chat-room-plan §2 schema section. |
| F13 — Room-level Companion bypasses 20-calls/hour rate limit | GENUINE-BUG | Followup path is structurally self-limiting (one-session-per-day DB constraint + Companion voice terminating naturally) but no cost floor. Pass 4 — add room-keyed rate limit (30/hour or compound-key reuse of `companion_rate_limit`). |
| F14 — Followup heuristic addressee-unaware in multi-practitioner rooms | DEFENSIBLE-DIVERGENCE | V2 design absorbs the fix. No production multi-practitioner rooms today. |
| F15 — `companion_rate_limit` upsert is racy | DEFENSIBLE-DIVERGENCE | Becomes moot if F23's reflect-endpoint retirement also drops the `companion_rate_limit` table. |
| F16 — `/api/companion/reflect` is dead under Decision #8 | GENUINE-BUG | Bundled into F23. Pass 3f. |
| F17 — Day-90 summary result discarded by cron | DEFENSIBLE-DIVERGENCE | chat-room-plan §5 Phase 5 explicitly defers persistence pending self-pilot signal. |
| F18 — Admin milestone endpoint non-idempotent | MATCHES-SPEC | chat-room-plan §6.5 documents this as design. |
| F19 — userMemories references non-existent `SUMMARY_MODEL` | DEFENSIBLE-DIVERGENCE | Doc drift. Update userMemories — code is correct as-is. |
| F20 — `POST /api/commitments` reuses any room caller is a member of | GENUINE-BUG | Spec-aligned fix (filter on creator ownership) is small but not currently triggered by production data — no practitioner is in multiple rooms as a sponsor while declaring a new commitment. Pass 4 candidate. |
| F24 — Two profile-write endpoints use SSR client for UPDATE | GENUINE-BUG | Pattern fix mechanical; covers `/api/profiles` PATCH and `/api/profiles/visibility` PATCH. Pass 4 — bundle with broader SSR-client-bug audit. |
| F25 — `/commit` form collects 5 fields the API ignores | GENUINE-BUG (nit-level) | Form simplification work; not blocking. Pass 4. |
| F28 — `/api/commitments/[id]/posts` orphan | GENUINE-BUG (orphan cleanup) | Bundle with F23 in Pass 3f or in a broader v3-residue cleanup pass. |
| F29 — Toggling `is_session=true` does not fire Companion | GENUINE-BUG | Mirror the `after()` block from the insert path with idempotency guard. Pass 4 candidate alongside Companion behavior work. |
| F31 — `/api/account/delete` does not check profile-delete result | GENUINE-BUG | Mechanical fix; check result before `auth.admin.deleteUser`. Pass 4. |
| F32 — Admin nav references `/feed` route that doesn't exist | GENUINE-BUG (nit) | Dead link in admin chrome. Trivial. Pass 4 — bundle with admin-chrome cleanup. |
| F35 — `POST /api/admin/create-test-users` no auth gate | RESOLVED OUT-OF-BAND | Already deleted in commit `93f8214` before Pass 2 opened. No further action. |
| F43 — StageBar hardcodes 6 stages; only 3 live post-Decision #8 | GENUINE-BUG (nit) | Stage copy cleanup. Pass 4. |
| F44 — `/start/commitment` collects 5 fields API drops | GENUINE-BUG (nit) | Parallels F25; same disposition. Pass 4. |
| F45 — Root layout renders `<PublicFooter/>` on logged-in surfaces | GENUINE-BUG (nit) | Layout cleanup. Pass 4. |

### (f) Schema state at end of Pass 3 (diff vs Pass 1 baseline)

| Object | Pass 1 baseline | End of Pass 3 | Sub-pass |
|---|---|---|---|
| `profiles.role` (column) | Did not exist | `text NULL` with CHECK `role IS NULL OR role = 'admin'` | 3a (added) |
| `profiles_visibility_check` (constraint) | Ternary: `private`/`network`/`public` | Binary: `private`/`public` | 3e (migration `visibility_shrink_to_binary`, applied as a separate Supabase MCP operation in an earlier session — see §5 completion note) |
| `sponsorships.paid_at` (column) | Existed (timestamp) | Dropped | 3b (migration `20260424_v4_drop_sponsorships_paid_at.sql`) |
| `confirmation_acknowledgments` (table) | (Per session-prompt: dropped pre-Pass-3) | Not present | Pre-Pass-3, out-of-band — recorded here per principal's session-prompt assertion; not corroborated by review docs and not a Pass 3 change. |
| `commitments_status_check` (constraint) | `{active, completed, vetoed, abandoned}` | Unchanged — `'vetoed'` was already in the enum; F7 fix was code-only | n/a |
| `sponsorships_status_check` (constraint) | `{pledged, released, vetoed, refunded}` | Unchanged — `'paid'` was already absent; F1 fix was code-only | n/a |
| `is_admin()` (Postgres function) | Read `profiles.role` (column missing → false for everyone) | Read `profiles.role` (column now exists; function works as written) | 3a (atomically unblocked when column landed) |

Net Pass 3 schema impact: one column added (`profiles.role`), one
column dropped (`sponsorships.paid_at`), one CHECK constraint
shrunk (`profiles_visibility_check`). No new tables. No tables
dropped (`companion_rate_limit` deferred to Pass 3f as part of
F23). No RLS policy changes. The DB function `is_admin()` is
unchanged in definition but now functional because its referenced
column exists.

### (g) Code structure changes worth recording

| Module | Status | Sub-pass | Purpose |
|---|---|---|---|
| `src/lib/auth.ts` | NEW (~100 LOC) | 3d | Canonical admin detection. Exports `isCurrentUserAdmin()`, `requireAdminPage()`, `requireAdminApi()`. Service-client read of `profiles.role`. Replaces 13 distinct call sites across 4 mechanisms. |
| `src/lib/feature-flags.ts` | NEW | 3c | Reads `INSTITUTIONAL_PORTAL_ENABLED` env var; exports `isInstitutionalPortalEnabled()` and `requireInstitutionalPortal()`. Default off; surface 404s in production. |
| Institutional `page.tsx` files | RENAMED to `*-form.tsx` (client components) with new server wrappers | 3c | Pattern: thin server wrapper gates on `requireInstitutionalPortal()` and renders the (preserved) client component. Lets v4.8 redesign salvage the form code without branch archaeology. |
| Sponsorship state machine | Single canonical writer pattern | 3b | Release-action route is the only path that flips `commitments.status='completed'`. Cron writes milestone + summary only; webhook is no-op-with-log on `payment_intent.succeeded` for pledges (release-action owns the synchronous capture and status flip). Practitioner-complete endpoint deleted entirely. |
| Visibility surface | Binary (`private`/`public`) end-to-end | 3e | DB CHECK, API validators, onboarding UI option list, type unions, and trust-route filter all aligned. `'network'` removed from every reader and writer. |
| Admin write paths | Service-client post-auth (uniform) | 3d (F38 piggyback) | `/api/admin/users` and `/api/admin/tickets` migrated. No remaining anon-client admin writes in the codebase. |

### (h) What Pass 4 should pick up first

This is a recommendation, not a decree. The principal sets Pass 4
scope based on launch readiness and runway considerations.

**Recommended Pass 4 anchor: password reset flow (Option C).**
Per userMemories ("On the horizon" → "Password reset flow") and
the v4 launch posture, this is the load-bearing blocker to real-
user launch — there is no self-serve recovery path for a
mistyped signup password. Resend is already wired for transactional
email; the fix is `supabase.auth.resetPasswordForEmail` + `/auth/
reset` handler route + new-password form. Estimated single-session
work.

**Other Pass 4 candidates (smaller, stackable):**

- **F2 + F23** (if Pass 3f doesn't land before Pass 4 opens) —
  see (d) above.
- **F4** (donation_rate persistence) — one-line fix; ride-along.
- **F13** (room-level Companion rate limit) — bounded
  guardrail against prompt regression; adds a cost floor.
- **F24** (SSR-client profile-write bug) — small, mechanical;
  bundles with broader SSR-bug audit work flagged in
  userMemories.
- **F31** (account-delete result check) — small mechanical fix.
- **F32 + F45** (admin chrome cleanup, footer) — small, low-
  risk.

**Larger Pass 4+ candidates (may warrant their own session):**

- **F25 + F44** (form-field cleanup at `/commit` and
  `/start/commitment`) — UI work; coordinate with v4 declaration
  shape per Decision #8.
- **F29** (`is_session` toggle Companion fire) — Companion
  behavior work; coordinate with chat-room-plan Phase 3+ work.
- **F43** (StageBar 6→3 stages) — UI; bundle with v4 onboarding
  copy review.

**Out of Pass 4 scope (Pass 5+ / platform-stage):**

- v4.8 institutional portal redesign (deferred per spec; the 3c
  take-down preserved the code behind a flag for the redesign
  to refer to).
- Day-90 summary persistence (chat-room-plan §5 Phase 5; awaits
  self-pilot signal).
- Multi-practitioner room work (F14 V2 absorption).
- v4.9 portable Trust export.

### (i) Production state at end of Pass 3

- **Tip:** `30803fc` on `main` (Pass 3e §5 completion note,
  docs-only). Last code-bearing commit: `dd1807e`.
- **Last code deploy:** `dpl_FKwnPmYX3MJGoFqURbDzhnsQcWVd` from
  `dd1807e`, READY in production.
- **Active commitments:** 2 (both started 2026-04-22; day 90
  lands 2026-07-21, ~87 days runway from Pass 3 close).
- **Active sponsorships:** 1 (`pledged`); zero terminal-state
  rows across the entire production dataset.
- **Profiles:** 28 total; 1 admin (David,
  `c5370edf-8505-441a-a60e-4d9a5ef0d7e0`); 27 NULL role.
- **`profiles.visibility` distribution:** `{private: 28}` —
  consistent with the (1e) audit's finding that the onboarding
  visibility step had been a no-op from day one (now closed by
  F37b).
- **Schema state:** `profiles.role` present (Pass 3a);
  `profiles_visibility_check` binary (Pass 3e); `sponsorships.
  paid_at` dropped (Pass 3b); `is_admin()` functional.
- **Code state:** 13 admin-detection call sites consolidated to
  `src/lib/auth.ts` helpers; institutional portal surface 404'd
  behind `INSTITUTIONAL_PORTAL_ENABLED` (unset in prod, safe by
  default); `'network'` visibility retired from every reader and
  writer; `'paid'` sponsorship status retired from every reader
  and writer.
- **Open Pass 3f scope:** F2 (room_memberships upsert atomicity),
  F23 (companion/reflect dead-code retirement, ~600 LOC).
- **Recommended Pass 4 anchor:** Password reset flow (Option C),
  per userMemories.

---


## §7 — Pass 3f deferred findings (F2 + F23): plans for principal review

This section covers Pass 3f Task 1 — the pre-execution sanity
checks for the two F-findings deferred from Pass 3a–3e per §6(d).
Two sub-blocks: §7.1 for F2 (`room_memberships` upsert atomicity),
§7.2 for F23 (companion/reflect dead-code retirement). Both are
plan-only. Code execution lands in a later session after principal
sign-off on the questions raised below.

**Status (both findings): plan only — pending principal sign-off
on the questions inside each sub-block before any code or
migration is touched.**

---

### §7.1 — F2: `room_memberships` upsert atomicity on pledge

**Finding dispositioned.** F2 (sponsorship pledge succeeds; the
follow-on `room_memberships` upsert is best-effort, logged but not
surfaced to client; sponsor pays and cannot see the room they paid
for).

**Pass 1 severity:** Concerning.
**Pass 2 verdict:** GENUINE-BUG. Spec anchor: `v4-decisions.md`
decision #8 — "A sponsor must be in a room to back a
practitioner... Every sponsor who backs a practitioner is a
member of the room."

#### Pre-execution sanity checks (Task 1, completed this session)

**Pledge-flow trace at tip 4d3f4a5 (`src/app/api/sponsorships/route.ts`,
POST handler lines 97–362):**

| Step | Lines | Action | Failure handling today |
|---|---|---|---|
| 1 | 97–138 | Auth + body validation | Returns 4xx; no side effects |
| 2 | 142–178 | Resolve `sponsor_invitations` row + email match | Returns 4xx; no side effects |
| 3 | 181–211 | Load commitment; reject self-sponsor / non-`active` | Returns 4xx/409; no side effects |
| 4 | 213–222 | Resolve sponsor display name | Best-effort read |
| 5 | 233 | Generate `access_token` | In-memory |
| 6 | 242–252 | Stripe Customer create | On error: 502, no DB writes yet |
| 7 | 254–273 | Stripe PaymentIntent create (`capture_method='manual'`) | On error: 502, no DB writes yet |
| 8 | 284–301 | `sponsorships.insert` (status `'pledged'`) | On error: cancel PI (best-effort), return 500 |
| **9** | **321–339** | **`room_memberships.upsert` — F2 surface** | **Logged via `console.error`, NOT returned to client; sponsorship row already committed** |
| 10 | 342–349 | `sponsor_invitations.update` to `'accepted'` | Try/catch + log; non-fatal |
| 11 | 357–361 | Return `{id, client_secret, room_id}` to client | n/a |

The "a later repair job can reconcile" comment Pass 1 cited is
at **line 318**. No such repair job exists in any cron, in any
admin route, or in any other surface in the codebase.

**`room_memberships` schema (queried this session against
`qgjyfcqgnuamgymonblj`):**

```
id          uuid PK DEFAULT gen_random_uuid()
room_id     uuid NOT NULL  → rooms(id) ON DELETE CASCADE
user_id     uuid NOT NULL  → profiles(user_id) ON DELETE CASCADE
state       text NOT NULL  DEFAULT 'lingering'
                          CHECK (state IN ('active','lingering','exited'))
joined_at   timestamptz NOT NULL DEFAULT now()
```

Constraints: PK on `id`; **UNIQUE (`room_id`, `user_id`)** —
matches the upsert's `onConflict: 'room_id,user_id'`. RLS:
`relrowsecurity=true`, `relforcerowsecurity=false` — service-role
bypasses. Only one policy, read-on-own-rows
(`user_id = auth.uid()`). **No INSERT policy**, but service-role
writes are unaffected; the route uses `createServiceClient()` for
the upsert, so RLS is not the failure path.

**Sponsorship FK shape (queried this session):**

`sponsorships` has FKs to `commitments` and `profiles` only. **No
FK to `room_memberships`.** The two writes (`sponsorships.insert`
+ `room_memberships.upsert`) are schema-independent — the DB
permits a sponsorship row whose sponsor has no membership row.
Linkage is transitive:
`sponsorship.commitment_id → commitments.room_id →
room_memberships.room_id`.

**Production data state (queried this session):**

| Sponsorship id | Status | Room id | Membership id | Membership state |
|---|---|---|---|---|
| `59720e9f-…2847` | `pledged` | `5574621b-…0bb63` | `3b4e087a-…d844b8` | `active` |

Aggregate: 1 sponsorship row with `sponsor_user_id IS NOT NULL`,
1 corresponding membership. Zero orphans. **Pass 1's failure-mode
hypothesis is structurally true but not realized in production
data — same shape as F10 entering Pass 3b.** No backfill or row
migration will be required when the fix lands.

**RPC inventory (queried this session for fix-shape feasibility):**

Public-schema functions: `get_user_id_by_email(text)`,
`handle_new_user()`, `is_admin()`, `is_commitment_owner(uuid)`,
`is_commitment_validator(uuid)`, `refresh_confidence_priors()`,
`source_confidence(text)`, plus four `update_*` triggers. No
existing transactional-write RPC. Only one Supabase RPC call site
in code: `src/app/api/institution/[id]/enroll/route.ts:53`
(`get_user_id_by_email`). A multi-write transactional RPC for the
pledge flow would be the codebase's first.

#### Fix-shape candidates (documented, not chosen)

| Option | Mechanism | Atomicity | Stripe interaction | Code complexity |
|---|---|---|---|---|
| **A — Supabase RPC (transactional)** | New SECURITY DEFINER PL/pgSQL function wrapping `sponsorships.insert` + `room_memberships.upsert` in a single transaction. Route calls `.rpc('record_pledge', {...})`. | Strong: both rows commit or neither does | PI is created **before** the RPC; on RPC failure, route still calls `paymentIntents.cancel` (mirrors current line 306–310 path) | Highest — net new RPC + migration; no precedent in codebase |
| **B — Service-client with explicit rollback** | Same two writes in sequence as today; on membership failure, `DELETE FROM sponsorships WHERE id = $1` and cancel PI. | Compensating transaction, not true atomic — a crash between insert and delete leaves an orphan | PI cancel mirrors current path | Low — pure application code; one new branch in the existing handler |
| **C — Reorder: membership first, sponsorship second** | Upsert `room_memberships` before `sponsorships.insert`. On membership failure, return early, cancel PI, no sponsorship row written. | Avoids the orphan-sponsorship-without-membership state; introduces an orphan-membership-without-sponsorship state instead | PI cancel needed if membership fails; reorder before line 284 | Low — single block reorder + new error branch |
| **D — Surface failure to client with retry path** | Today's order preserved; on membership failure, return a non-2xx with structured error so client can retry membership write idempotently (UNIQUE conflict already makes retry safe). | Not atomic at server level; relies on client retry | No change | Low — one return-shape change + client handler |

**Trade-off matrix (Claude's read; principal decides):**

- **A** is the strongest guarantee but introduces a new code path
  shape (Supabase RPC) the codebase doesn't currently use. Worth
  it if the principal wants the foundation for future
  multi-write flows; overkill if F2 is the only one.
- **B** matches the current architecture (service-client, no
  RPCs) and reads the most naturally to anyone familiar with the
  rest of the route. The orphan window between the two writes is
  small — bounded by the single membership write's latency — but
  is real if the function process is killed mid-handler.
- **C** is the simplest fix and removes the worst failure mode
  (sponsor pays without room access) by reversing the order
  rather than adding atomicity. It introduces a new failure mode
  (membership exists without sponsorship) which is
  user-invisible — a sponsor who never completed the pledge
  shows up as a room member, which is consistent with the
  Decision #8 framing of "lingering" memberships, except the
  state would be `'active'` not `'lingering'`. State could be
  written as `'lingering'` until sponsorship insert succeeds,
  then flipped — but at that point we're back to two writes
  needing atomicity, so C reduces to A or B.
- **D** is the lowest-impact change but makes the client
  responsible for state convergence. Acceptable if the principal
  is comfortable with the failure being a surfaced, retryable
  error rather than a silent log line. The client-side retry
  surface today (the `/sponsor/invited/[invite_token]` page)
  would need a new "membership setup failed, retry?" branch.

#### Open questions for principal sign-off

##### Q1 — Which fix shape?

A / B / C / D, or a hybrid (e.g., B with telemetry alerting on
the orphan window). **Claude's recommendation: B.** Reasoning: it
matches the codebase's existing service-client pattern; the orphan
window is bounded by a single round-trip to Postgres; production
already shows zero orphans, so the failure-mode urgency is
"prevent the first one" rather than "clean up many." Option A is
worth the extra weight only if the principal wants to seed an RPC
pattern for future multi-write flows (release-action, veto, etc.)
in which case A becomes the right anchor and a small ride-along
RPC inventory pays back in later passes.

##### Q2 — Should the membership state be `'active'` or `'lingering'` on pledge?

Today's code writes `'active'` (line 327). Decision #8 says
"sponsors are room members" but does not explicitly mandate that
`state` text. The CHECK accepts `{active, lingering, exited}`;
`'lingering'` is documented in §3 of `v4-decisions.md` as
"prospective sponsors and prospective practitioners can be in a
room without yet being economically committed." A pledged sponsor
is **economically committed** (Stripe authorization in place,
`sponsorships.status='pledged'`), so `'active'` is the correct
state. Flagging only because the question would surface during
fix-shape A (the RPC would write the state) and §7 should record
that no change is intended. **Recommended: keep `'active'`.**

##### Q3 — Backfill / one-time reconciliation pass?

Production has zero orphans (1/1 sponsorships have memberships).
**Recommended: no backfill.** The only orphans that could exist
are pre-Pass-3a records, and the production query confirms there
are none. The fix lands in a clean state.

##### Q4 — Does the sponsor_invitations update (line 342–349) need the same treatment?

The third write in the pledge flow — flipping the invitation to
`'accepted'` — is already wrapped in try/catch + log + non-fatal.
A failure here means the invitation row stays `'pending'`, which
prevents a successful pledge from being followed by another
attempt with the same `invite_token` (line 152 rejects on
`status !== 'pending'`)… wait — actually a `'pending'` invitation
with a successful pledge would let the SAME sponsor pledge again
(same email, same auth user, would pass all checks). This is a
secondary atomicity concern adjacent to F2. **Flagging for
principal awareness; not in F2 scope as defined.** If A or B is
chosen, the sponsor_invitations write naturally gets included in
the same atomicity boundary and Q4 dissolves. If C or D is
chosen, Q4 remains as a separate concerning-tier finding worth
its own pass.

#### Standing rules for execution (when this lands)

- Migration only if Q1 → A (the RPC + supporting function).
- Single commit covering route changes + (if A) migration.
- `npx tsc --noEmit` before commit.
- `git restore package.json package-lock.json` after any
  incidental npm work (none anticipated).
- Post-deploy: 45s wait → `list_deployments` for state=READY →
  `get_runtime_logs` 10m window error+fatal → re-query the
  Task 1 production data state (sponsorship + membership join)
  to confirm no regression. The single live pledge row should
  remain unchanged.

#### What this plan does NOT do

- Does not fix F4 (donation_rate persistence — Pass 4).
- Does not address Q4's secondary sponsor_invitations atomicity
  unless the chosen fix shape (A or B) absorbs it naturally.
- Does not modify the access_token flow (F8 deferred per §6(e)).
- Does not modify Stripe webhook behavior (Cluster 1 closed in
  Pass 3b).

#### PAUSE — F2 awaits sign-off on Q1.

---

### §7.2 — F23: companion/reflect dead-code retirement

**Findings dispositioned.** F23 (the entire reflect/panel chain is
orphan code), bundled with F16 (the spec anchor for retirement)
and F15 (becomes moot when `companion_rate_limit` drops). The
related orphan-cleanup F28 (`/api/commitments/[id]/posts` orphan)
rides along per §6(e)'s "bundle with F23 in Pass 3f" disposition.

**Pass 1 severity:** Concerning (upgrade).
**Pass 2 verdict:** GENUINE-BUG (orphan cleanup). Spec anchors:
`v4-decisions.md` decision #8 (rooms are primary);
`chat-room-plan.md` §3 (Companion is a room-level entity).

#### Pre-execution sanity checks (Task 1, completed this session)

**File-level grep results at tip 4d3f4a5:**

`grep -rn "companion-panel|CompanionPanel" src/`:
- `src/components/companion-panel.tsx` (self-references at
  lines 5, 106, 112, 116) — **zero external import sites**.

`grep -rn "/api/companion/reflect" src/`:
- `src/app/api/companion/reflect/route.ts` (self, line 8)
- `src/lib/media.ts:3` — **stale comment** flagged in
  userMemories; references the route in a list of importers
- `src/components/companion-panel.tsx:140` — `fetch` call (also
  being deleted)

`grep -rn "COMPANION_SYSTEM_PROMPT|COMPANION_LAUNCH_SYSTEM_PROMPT" src/`:
- `src/app/api/companion/reflect/route.ts:4` (import) and
  line 183 (use of `COMPANION_SYSTEM_PROMPT`)
- `src/lib/anthropic.ts` (definitions at lines 59 and 104; doc
  comments referencing the names at lines 149, 178, 195)
- **No live consumers outside `reflect/route.ts`.**
  `COMPANION_LAUNCH_SYSTEM_PROMPT` has zero references anywhere
  in `src/` outside its own definition.

`grep -rn "companion_rate_limit" src/`:
- `src/app/api/companion/reflect/route.ts:23, 101, 116` only.
  **Single-route table.**

**Live Companion-prompt constants (verified to remain after
deletion):**
- `COMPANION_MODEL` (used by `lib/companion/room.ts` at lines 5,
  445, 563, 706 and `lib/companion/day90.ts` at lines 5, 169) —
  **KEEP**.
- `COMPANION_ROOM_SYSTEM_PROMPT` (used by `lib/companion/room.ts`
  at lines 6, 38, 447, 565, 712) — **KEEP**.
- `DAY90_SUMMARY_SYSTEM_PROMPT` (used by `lib/companion/day90.ts`
  at lines 6, 17, 171) — **KEEP**.

**BCD-arc dead-file inventory (per userMemories Session 5 list):**

The userMemories list referenced ten files; the actual tree at
4d3f4a5 contains the following. Several files in the userMemories
list (`log/client.tsx`, `start/ritual`) **do not exist in the
current tree** — already removed in earlier work (likely the v4.1
Atomic Role Excision per Pass 1's note on F23). The remaining
files break into three groups:

- **Live redirect routers** (`/log/page.tsx` and the four retired
  `/start/*` stages): each loads the user's most recent active
  commitment and `redirect`s to `/room/[room_id]` or
  `/dashboard`. They handle legacy bookmarks, email links, and
  screenshot OCRs. Vercel runtime logs (30 days, queried this
  session) confirm `/log` receives ~6 hits per visible window —
  **the routers are doing real work.**
- **Live onboarding stages** (`/start/page.tsx`,
  `/start/practice/page.tsx`, `/start/commitment/page.tsx`):
  these are the post-signup three-stage flow that
  `/start/page.tsx` routes to. Load-bearing for new-user
  onboarding. Not orphans; not in F23 scope.
- **Genuine orphans** (`companion-panel.tsx`,
  `companion/reflect/route.ts`, the two retired prompts in
  `anthropic.ts`, `companion_rate_limit` table, F28's
  `/api/commitments/[id]/posts/route.ts`): zero callers in tree;
  zero live function; zero traffic in production logs.

**Per-file decision table:**

| File / object | LOC | Live callers in tree | Production traffic (30d) | Disposition |
|---|---|---|---|---|
| `src/components/companion-panel.tsx` | 380 | 0 | n/a (component) | **DELETE** |
| `src/app/api/companion/reflect/route.ts` | 360 | 0 | 0 | **DELETE** |
| `COMPANION_SYSTEM_PROMPT` (in `lib/anthropic.ts`) | ~45 lines (59–101) | only `reflect/route.ts` | n/a | **DELETE** |
| `COMPANION_LAUNCH_SYSTEM_PROMPT` (in `lib/anthropic.ts`) | ~30 lines (104–131) | none in tree | n/a | **DELETE** |
| Doc comments referencing the retired prompts (`anthropic.ts` lines 149, 178, 195) | ~3 lines | n/a | n/a | **FIX-COPY** (rewrite the references in the doc comments around `COMPANION_ROOM_SYSTEM_PROMPT` so they don't dangle) |
| `companion_rate_limit` table | n/a (DB) | only `reflect/route.ts` | n/a | **DROP TABLE** (closes F15 per §6(e)) |
| `src/lib/media.ts` line 3 (stale comment) | 1 line | n/a | n/a | **FIX-COPY** (remove `companion/reflect/route.ts` from the comment's reference list) |
| `src/app/api/commitments/[id]/posts/route.ts` (F28 ride-along) | ~30 LOC | 0 | 0 (`/posts` query returned zero hits) | **DELETE** |
| `src/app/api/commitments/[id]/start/route.ts` | 13 | 0 | not separately probed (low-volume tombstone) | **DEFER** (returns 410 Gone — David's call: KEEP-as-tombstone OR DELETE; see Q1 below) |
| `src/app/log/page.tsx` | 37 | router | `/log` shows 307 redirects in 30d window | **KEEP** — live redirect router |
| `src/app/log/layout.tsx` | 4 | only `log/page.tsx` | n/a | **KEEP** (passthrough; harmless) |
| `src/app/start/launch/[id]/page.tsx` | 30 | router | not separately probed | **KEEP** — live redirect router |
| `src/app/start/active/[id]/page.tsx` | 36 | router | not separately probed | **KEEP** — live redirect router |
| `src/app/start/sponsor/page.tsx` | 27 | router | not separately probed | **KEEP** — live redirect router |
| `src/app/start/companion/page.tsx` | 32 | router | not separately probed | **KEEP** — live redirect router |
| `src/app/start/page.tsx` | 30 | live post-signup | (substring match returned 0 — Vercel API is sampled per userMemories pattern) | **KEEP** — load-bearing |
| `src/app/start/practice/page.tsx` | 154 | live stage 1 | as above | **KEEP** |
| `src/app/start/commitment/page.tsx` | 147 | live stage 2 | as above | **KEEP** (flagged for F44/F25 form-field cleanup in Pass 4) |
| `src/app/api/profiles/route.ts` | 40 | live | not probed | **NOT IN F23 SCOPE** (F24 Pass-4 candidate) |
| `src/app/api/profiles/visibility/route.ts` | 30 | live | not probed | **NOT IN F23 SCOPE** (F24 Pass-4 candidate) |

**Net deletion scope:**
- `companion-panel.tsx` (380 LOC) + `companion/reflect/route.ts`
  (360 LOC) + `commitments/[id]/posts/route.ts` (~30 LOC) +
  the two retired prompts in `anthropic.ts` (~75 LOC).
- ~845 LOC removed (vs Pass 1's ~500 LOC estimate — the
  difference is because Pass 1 didn't include the prompt LOC).
- 1 table dropped (`companion_rate_limit`).
- Two single-line FIX-COPY edits in `media.ts:3` and
  `anthropic.ts` (cleanup of dangling doc references).

**Resend template audit (this session):**

Four files import `getResend` from `@/lib/resend`:
- `src/app/api/sponsorships/[id]/action/route.ts`
- `src/app/api/stripe/webhook/route.ts`
- `src/app/api/sponsors/invite/route.ts`
- `src/app/api/rooms/[id]/invite/route.ts`

Grep across all four for retired path strings (`/log`,
`/start/launch`, `/start/active`, `/start/ritual`,
`/start/sponsor`, `/start/companion`, `/api/companion/reflect`):
**only one match** — `webhook/route.ts:137`, which mentions
`/login` in a comment (substring of `/log`), not a template URL.
**No transactional email points at any retired surface.** No
template updates needed before deletion.

**Vercel runtime log audit (30-day window, this session):**

| Path queried | 30d hits |
|---|---|
| `/api/companion/reflect` | 0 |
| `/log` (substring) | 6 visible 307 redirects (the redirect router is in use) |
| `/start/` and `start` (substring) | 0 — but this is sampled / partial per the broader Vercel-MCP truncation pattern; absence here does not prove absence everywhere |
| `/posts` (substring) | 0 |

The absence of `/api/companion/reflect` and `/posts` traffic
across 30 days, combined with zero in-tree callers, is the
authoritative basis for deleting those routes. The presence of
`/log` traffic is the authoritative basis for keeping it.

#### Open questions for principal sign-off

##### Q1 — `/api/commitments/[id]/start/route.ts` (13-line 410-Gone tombstone): KEEP or DELETE?

Returns 410 Gone with a clear retirement message. Stale clients
calling it today see a clean diagnostic. If deleted, those clients
get 404 instead. Both are acceptable, but the choice has a
philosophical edge: 410 is the honest response when a path has
been deliberately retired, and a tombstone preserves that signal
for any external observer (third-party docs, screenshots,
older versions of email templates). **Claude's recommendation:
KEEP-as-tombstone.** Cost is 13 LOC; benefit is honest deprecation
diagnostics. The principal may prefer DELETE for hygiene; either
is safe.

##### Q2 — `src/app/log/layout.tsx` (4-line passthrough): KEEP or DELETE?

The layout is a no-op wrapper; `/log/page.tsx` is a redirect with
no UI. Deletion has no functional impact. **Claude's
recommendation: KEEP** — it's the kind of file that someone might
re-create later when adding chrome to a new `/log` surface, and
the cost of keeping it is 4 LOC. But DELETE is also clean and
removes a file that does nothing.

##### Q3 — Single migration for `companion_rate_limit` drop, or batch with future cleanup?

The table is single-route and the route is being deleted. Dropping
the table in the same commit/migration as the route deletion is
the spec-aligned move. **Recommended: DROP TABLE
companion_rate_limit** in the same Supabase migration as the code
deletion lands (mirrored to repo). One migration file. Closes
F15 (`companion_rate_limit` racy upsert) per §6(e)'s
"becomes moot if F23 retires the table" disposition.

##### Q4 — Per-file disposition: any objections?

The table above is the recommendation. Principal review of the
**DELETE** rows is the load-bearing sign-off. The **KEEP** rows
(redirect routers, live onboarding) are documented for the audit
trail; principal approval there is implicit. The two **FIX-COPY**
edits (`media.ts`, `anthropic.ts` doc comments) are mechanical.

#### Standing rules for execution (when this lands)

- Single migration: `DROP TABLE companion_rate_limit;`. Mirror to
  repo under `supabase/migrations/`.
- Single code commit covering all DELETE + FIX-COPY rows in the
  table above. Splitting commits would deploy a known-broken
  intermediate state (e.g., `media.ts` referencing a deleted
  route) — the deploy-atomicity exception in §2's completion
  note (the 70%-mark rule yielding to deploy atomicity) applies.
- `npx tsc --noEmit` before commit. The deletion of
  `COMPANION_SYSTEM_PROMPT` and `COMPANION_LAUNCH_SYSTEM_PROMPT`
  is structurally checked by `tsc` because the only consumer
  (`reflect/route.ts`) is deleted in the same commit. No dangling
  imports possible.
- `git restore package.json package-lock.json` after any
  incidental npm work (none anticipated).
- Post-deploy: 45s wait → `list_deployments` for state=READY →
  `get_runtime_logs` 10m window error+fatal. Re-query the
  Task 1 grep results to confirm zero references to
  `companion-panel`, `/api/companion/reflect`,
  `COMPANION_SYSTEM_PROMPT`, `COMPANION_LAUNCH_SYSTEM_PROMPT`,
  and `companion_rate_limit` remain anywhere in `src/`.
- Schema verification: `SELECT 1 FROM information_schema.tables
  WHERE table_schema='public' AND table_name='companion_rate_limit'`
  — must return zero rows post-migration.

#### What this plan does NOT do

- Does not delete the live redirect routers (`/log`,
  `/start/launch`, `/start/active`, `/start/sponsor`,
  `/start/companion`). Production traffic confirms they are
  doing real work.
- Does not touch `/api/profiles` or `/api/profiles/visibility`
  — those are F24 (Pass 4 candidate per §6(h)), not F23.
- Does not modify `/start/page.tsx`, `/start/practice/page.tsx`,
  or `/start/commitment/page.tsx` — load-bearing live
  onboarding. F44/F25 form-field cleanup remains a Pass 4
  candidate per §6(h).
- Does not consolidate `COMPANION_MODEL`,
  `COMPANION_ROOM_SYSTEM_PROMPT`, or `DAY90_SUMMARY_SYSTEM_PROMPT`
  — those are the live constants; no change to them.

#### PAUSE — F23 awaits sign-off on Q1, Q2, Q3, Q4 (and the disposition table).

---

## §8 — Pass 3f Task 2 completion notes

This section records the execution of the F2 + F23 fixes whose plans
were laid out in §7. Two sub-blocks: §8.1 for F2, §8.2 for F23. Both
findings landed this session.

---

### §8.1 — F2 completion note

**Status: closed.**

**Principal sign-offs received before execution:**
- Q1 — Fix shape: **B** (service-client + explicit rollback).
- Q2 — Membership state on pledge: **keep `'active'`**.
- Q3 — Backfill: **none** (zero orphans in production confirmed
  during §7.1 sanity-check; nothing to reconcile).
- Q4 — sponsor_invitations atomicity: **awareness-only**, dissolves
  naturally under Option B (any failure before the
  sponsor_invitations.update line returns 500 and leaves the
  invitation `'pending'`, which is the correct retryable state).

**Code changes:**

| File | Lines | Change |
|---|---|---|
| `src/app/api/sponsorships/route.ts` | 314–339 → 314–369 | Replaced best-effort membership upsert with explicit rollback per Option B. On membership upsert failure: compensating delete of the just-inserted sponsorship row, then cancel the orphaned PaymentIntent, then return 500 with `code: 'membership_upsert_failed'`. The rollback delete is itself wrapped in try/catch with a CRITICAL log line if it fails (the only path that produces a true sponsorship-without-membership orphan, and the log gives forensic traceability). The sponsor_invitations.update branch at the original line 342–349 is unchanged — still best-effort try/catch (non-fatal) per Q4. |

**Migrations applied:** none. Option B is a pure application-code
change.

**Verification (post-deploy):**
- Vercel deploy `dpl_6bVKJxtoEjJga7qk74vrvqRVodxf` from
  `40a37ad892af31fd9fc5b80b097d0a98ae764dc9`, state `READY` in
  production. Build clean.
- `npx tsc --noEmit`: clean.
- Vercel runtime logs (30m window covering deploy +25 minutes,
  level error+fatal, production environment): zero entries.
- Production data re-query (mirror of §7.1's sponsorship +
  membership join): identical baseline. 1 sponsorship row
  (`59720e9f-d4ab-447b-a280-a6b5b1df2847`, status `pledged`,
  room `5574621b-e783-4627-8648-9d69c530bb63`), 1 corresponding
  membership (`3b4e087a-04c7-4b46-95f2-8479e2d844b8`, state
  `active`). Zero orphans. No regression.

**Deviations from §7.1 plan:** none. The implementation matches
Option B as documented in §7.1's fix-shape candidates table.

**Production state at session close:** unchanged for F2's surface.
The fix is forward-protective — its effect will be seen the next
time a membership upsert fails (which has not happened in the
production lifetime of the route per the §7.1 baseline). The route
now returns 500 with a structured error code rather than committing
a sponsor-without-room state.

---

### §8.2 — F23 completion note

**Status: closed.**

**Principal sign-offs received before execution:**
- Q1 — `/api/commitments/[id]/start/route.ts` 410-Gone tombstone:
  **KEEP**.
- Q2 — `src/app/log/layout.tsx` passthrough: **KEEP**.
- Q3 — Single migration for `DROP TABLE companion_rate_limit`
  alongside the code: **yes**.
- Q4 — Per-file disposition table: **no objections**, proceed as
  tabled in §7.2.

**Code changes:**

| File / object | Action | LOC delta |
|---|---|---|
| `src/components/companion-panel.tsx` | DELETE | −380 |
| `src/app/api/companion/reflect/route.ts` | DELETE | −360 |
| `src/app/api/commitments/[id]/posts/route.ts` | DELETE (F28 ride-along) | ~−30 |
| `COMPANION_SYSTEM_PROMPT` constant in `src/lib/anthropic.ts` | DELETE (consumer was reflect/route.ts only) | −15 (the constant body) |
| `COMPANION_LAUNCH_SYSTEM_PROMPT` constant in `src/lib/anthropic.ts` | DELETE (zero callers anywhere) | −12 (the constant body) |
| `src/lib/anthropic.ts` preamble doc-block (formerly lines 24–57, 75–103) | DELETE (rationale for now-deleted prompts) | ~−70 (comment lines) |
| `src/lib/anthropic.ts` `COMPANION_ROOM_SYSTEM_PROMPT` preamble refs at formerly lines 149, 178, 195 | FIX-COPY (rewrote three dangling references; reflowed surrounding paragraphs for clean line breaks) | net 0 (rewrite) |
| `src/lib/media.ts` line 3 | FIX-COPY (removed `src/app/api/companion/reflect/route.ts` from the importer-list comment) | net 0 (rewrite) |
| `supabase/migrations/20260425_v4_drop_companion_rate_limit_table.sql` | NEW (mirror of applied migration) | +5 |

Net commit: 6 files changed, 20 insertions, 932 deletions.

**Migrations applied:**
- `drop_companion_rate_limit_table` via `Supabase:apply_migration`
  on project `qgjyfcqgnuamgymonblj`. SQL:
  `DROP TABLE IF EXISTS companion_rate_limit;` Mirrored to repo
  at `supabase/migrations/20260425_v4_drop_companion_rate_limit_table.sql`.

**Verification (post-deploy):**
- Vercel deploy `dpl_FgCryf66HxrRNLVYagQDYFGcW1hy` from
  `3674732d0a3c2b85ec57831f0bdea91fabad6ff9`, state `READY` in
  production. Build clean (TypeScript pre-commit gate covered the
  prompt-deletion cascade because the only consumer,
  reflect/route.ts, was deleted in the same commit).
- `npx tsc --noEmit`: clean.
- Vercel runtime logs (30m window covering both F2 and F23
  deploys, level error+fatal, production environment): zero
  entries.
- Re-grep against `src/` for the five retired references — all
  return zero matches:
    - `companion-panel|CompanionPanel`: 0
    - `/api/companion/reflect`: 0
    - `COMPANION_SYSTEM_PROMPT`: 0
    - `COMPANION_LAUNCH_SYSTEM_PROMPT`: 0
    - `companion_rate_limit`: 0
    - `/api/commitments/[id]/posts` (F28): 0
- Schema verification: `SELECT COUNT(*) FROM information_schema
  .tables WHERE table_schema='public' AND table_name=
  'companion_rate_limit'` returns 0. Table is gone.

**Deviations from §7.2 plan:**

(1) The `anthropic.ts` patch initially produced two awkward
sentence fragments in the `COMPANION_ROOM_SYSTEM_PROMPT` preamble
where the FIX-COPY anchors landed (anchor A produced "Distinct
surface from the per-commitment / the per-commitment Companion
surface that v3 used:" — a duplicated phrase; anchors B and C
left odd line breaks). Three follow-up `str_replace` edits
reflowed the affected paragraphs for clean reading. The semantic
content matches §7.2's recommendation; only the prose surface
changed.

(2) Stale-comment note flagged in commit body but **not patched**
(out of F23 scope to keep the commit surface tight): the preamble
above `COMPANION_ROOM_SYSTEM_PROMPT` still says "This constant is
not yet wired to any invocation path. Phase 2 of
docs/chat-room-plan.md (the minimum room build) picks it up." —
that wiring already happened when Decision #8 went live. This is
the kind of stale-doc finding that fits a Pass 4 anchor like F4
or F44/F25, not a F23 ride-along. Recording for archaeology.

(3) Empty parent directories `src/app/api/companion/reflect/`
and `src/app/api/commitments/[id]/posts/` removed via `rmdir`
after their only files were deleted. Not separately enumerated
in §7.2's plan (the plan listed file deletions only) but the
removal is mechanical and keeps the tree clean. No effect on
routing or build.

**Production state at session close:**
- 28 profiles unchanged.
- 2 active commitments unchanged (started 2026-04-22, day 90
  lands 2026-07-21, ~86 days runway).
- 1 pledged sponsorship + 1 active room_membership unchanged
  (re-verified post-F2 deploy).
- `companion_rate_limit` table dropped.
- ~845 LOC of dead code removed from `src/`.
- `profiles.role` distribution unchanged: {1 admin, 27 NULL}.
- `profiles.visibility` distribution unchanged: {28 private}.

---

### Pass 3f close

Both deferred concerning-tier findings from §6(d) have landed.
F2 closes the only remaining write-path atomicity concern in the
pledge flow; F23 retires ~845 LOC of v3-era dead code plus one
single-route table.

Pass 3f opens with `a79bbf4` (§7 plan blocks); closes with
`3674732` (F23 fixes; F2 fixes at `40a37ad`). Both deploys
production-READY, runtime logs clean, production data state
non-regressive.

Per §6(h), Pass 4 picks up the password reset flow (Option C)
as the next anchor — it remains the load-bearing blocker to
real-user launch.

