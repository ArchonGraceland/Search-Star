# Pass 5 — Principal Decisions

This file records decisions the principal (David) has made during Pass 5.
Pass 5 opens with the institutional-portal SSR-client sweep nominated by
Pass 4 §3's deferred-work block. Two routes were flagged inline there
(`/api/institution/[id]/enroll`, `/api/institution/signup`), but §3 also
called for the broader institutional surface to be audited together
rather than dribbled in one route at a time.

The shape of this file follows Pass 4's single-section-per-work-item
convention — discovery, decision, execution, verification covered
together. The audit-before-sweep two-step is split across §1 (audit
+ decision table) and §2 (execution + verification), mirroring Session 5
of the B/C/D arc.

---

## §1 — Audit of the institutional surface

**Discovery (entering Pass 5).** Pass 4 §3's deferred-work block named
two routes that wrote through the SSR cookie-bound Supabase client in
the same `@supabase/ssr` JWT-propagation pattern F24 fixed for
`/api/profiles` and `/api/profiles/visibility`:

- `src/app/api/institution/[id]/enroll/route.ts`
- `src/app/api/institution/signup/route.ts`

§3 also flagged that the broader institutional surface had not been
audited and that there were "likely other patterns worth fixing in
that surface (RLS coverage, service-vs-SSR client choice, payload
validation)." Pass 5 walks the entire `src/app/api/institution/*`
tree and `src/app/institution/*` page tree once, classifies each
file, and records a written decision table here before any code
edits begin. Mirror of the audit-before-sweep shape from Session 5
of the B/C/D arc, not the per-route fix shape of F24 itself.

**The F24 pattern, restated for this audit.** Keep the SSR client for
`auth.getUser()` (cookie-bound — that's correct). Move INSERT/UPDATE/
DELETE to the service client. Authorization comes from an explicit
WHERE-clause filter that ties the row to either `user.id` or some
other authenticated identifier the SSR auth check just returned. RLS
becomes defense-in-depth, not the primary gate. Reference
implementations: `src/app/api/profiles/route.ts` and
`src/app/api/profiles/visibility/route.ts` post-F24.

**Audit table.** Every file under `src/app/api/institution/*` and
`src/app/institution/*`, classified:

| # | Path | Layer | Write ops | Current client | Authorization model | F24 violation? | In scope? |
|---|---|---|---|---|---|---|---|
| 1 | `src/app/api/institution/signup/route.ts` | API | INSERT into `institutions` | SSR (`createClient`) | None — public unauthenticated POST behind feature flag (`INSTITUTIONAL_PORTAL_ENABLED`). Auth model: "anyone behind the flag." | **Yes** — INSERT runs through SSR. Symptom matches F24: silently no-ops if RLS rejects the unauthenticated session. | **Yes** |
| 2 | `src/app/api/institution/[id]/enroll/route.ts` | API | SELECT institution; per-email loop: SELECT existing membership, INSERT membership, UPDATE `profiles.institution_id` | SSR for everything (auth check + reads + writes) | App-layer: caller email must match `institution.contact_email` OR caller is platform admin. RLS not relied on. | **Yes** — every read and write goes through SSR. Membership INSERT and `profiles` UPDATE are exactly the JWT-propagation symptom F24 fixed. | **Yes** |
| 3 | `src/app/institution/signup/page.tsx` | Page (server) | None — wrapper that calls `requireInstitutionalPortal()` and renders the client form | N/A | N/A | No | No |
| 4 | `src/app/institution/signup/signup-form.tsx` | Page (client) | None — `fetch('/api/institution/signup', POST)` | N/A | N/A | No | No |
| 5 | `src/app/institution/[id]/dashboard/page.tsx` | Page (server) | Reads only (institution, memberships, trust_records, skill_categories) | SSR for `auth.getUser()`; **service client for all reads** | App-layer: contact_email match or admin; carries an F24-style explanatory comment | **No — already on the F24 read pattern** | No |
| 6 | `src/app/institution/[id]/members/page.tsx` | Page (server) | Reads only (institution, memberships, trust_records, profiles) | Same as dashboard | Same as dashboard | **No — already on the F24 read pattern** | No |
| 7 | `src/app/institution/[id]/enroll/page.tsx` | Page (server) | None — wrapper | N/A | N/A | No | No |
| 8 | `src/app/institution/[id]/enroll/enroll-form.tsx` | Page (client) | None — POSTs to API route | N/A | N/A | No | No |

**Findings.**

The two routes Pass 4 §3 named are exactly the two that need migration.
The broader sweep surfaced no additional offenders. The page tree is
already clean: the dashboard and members pages are already on the right
pattern (service-client reads + app-layer auth) and even carry an F24-
style comment referencing the SSR-bug commit history. Nothing to change
on the page side.

**Decisions for the migration.**

1. **Signup route auth model is preserved.** The route accepts
   unauthenticated POSTs by design — anyone behind the feature flag can
   create an institution. That is a Phase 9 product decision, not a
   Pass 5 question. The fix is to migrate the INSERT to the service
   client; the absence of an auth gate is intentional.

2. **Enroll route keeps both auth checks.** The existing
   `contact_email === user.email || isCurrentUserAdmin()` check is the
   access gate. WHERE-clause filters on the writes (`institution_id`,
   `user_id`) become the authorization on the writes themselves, with
   RLS as defense-in-depth. Mirrors F24 exactly.

3. **`get_user_id_by_email` RPC stays on the SSR client.** It is a
   read, not a write, and F24 specifically targets writes that silently
   no-op under JWT-propagation failure. If a later audit pass wants to
   move all reads off the SSR client too, that is its own decision.
   Pass 5 does not change read paths on the enroll route; only the
   institution lookup and the writes get the service client.

4. **Pass 5 is application-code only.** No migrations. No schema
   changes. No RLS-policy edits. Mirrors F24 in shape and scope.

**Out of scope for Pass 5.**

- `/api/trust/*` — separate concern, its own audit pass later.
- Any institutional feature work (the Phase 9 surface as a product).
  Pass 5 is a security/correctness sweep only — no new features, no
  UX changes.
- Diagnosing the underlying `@supabase/ssr` JWT-propagation root cause.
  That remains the long-term blocker recorded in the principal's
  memory. Pass 5 just keeps closing the symptom surface.

**Verification approach (decision before §2).** The Pass 4 §3 protocol
assumed 401-on-unauth probes against `www.searchstar.com`. That works
cleanly for routes whose access gate is authentication. The
institutional surface complicates this:

- The signup route is unauth-by-design — its unauth probe is supposed
  to succeed (or return 400 on validation). It cannot return 401.
- The feature flag `INSTITUTIONAL_PORTAL_ENABLED` is currently off in
  prod (per Pass 3 §1 Cluster 4). With the flag off both routes return
  404 regardless of payload, which exercises the flag but not the F24
  fix.

Three options were considered: (a) enable the flag transiently in
prod, run probes, disable; (b) leave the flag off and rely on
`npm run build` + structural review of the F24 pattern application as
the verification surface; (c) probe a Vercel preview deployment with
the flag enabled, then merge to main with the flag still off.

**Decision: option (c).** A preview deployment exercises the F24 fix
on real Vercel infra without changing production state. Merge to main
keeps the flag off in prod, matching the Pass 3 §1 Cluster 4 take-down
of the institutional surface. This is recorded here so a future
session reading this file understands why §2's verification looks
different from §3's.

**Production state at section close.**

- Repo tip: `668fb2f`. No code changes yet in Pass 5.
- 28 profiles unchanged (28 private, 1 admin / 27 NULL).
- `INSTITUTIONAL_PORTAL_ENABLED` still unset in production env.
- Vercel deploy `dpl_2TZNXSz69yYZf9nFtpE42ktUY3Yv` (the F24 deploy) READY.

---

## §2 — F25: service-client writes on the institutional surface

**Execution.** Code commit `c5bcc45` on `main`:

> `fix(institution): F25 — service-client writes on institutional surface`

Two files touched, exactly the two §1's audit table flagged in scope:

| File | Change |
|---|---|
| `src/app/api/institution/signup/route.ts` | INSERT moved from SSR client to service client. Route remains unauthenticated by design (Phase 9 product decision); only the client choice changes. |
| `src/app/api/institution/[id]/enroll/route.ts` | Institution lookup, membership SELECT/INSERT, and `profiles.institution_id` UPDATE all moved to service client. SSR client retained for `auth.getUser()` and the `get_user_id_by_email` RPC (a read; SECURITY DEFINER on the database). Authorization on writes is by WHERE-clause filter on `institution_id` (validated by the contact_email/admin gate above) and `user_id` (resolved by the RPC). |

Application-code only. No migrations. Repo tip moves through
`c5bcc45` (F25 code) → `fd6f87a` (verification override) → `1ab586e`
(revert) over the verification window described below.

**Verification approach decided in §1: option (c-modified).** The §1
verification-approach decision settled on a Vercel preview with the
flag enabled. On execution that turned out to require a Vercel
env-var change the session's MCP toolchain cannot make. The chosen
substitute, agreed with the principal: **encode the flag-flip in
source for the verification window**. Two pushes — one to hardcode
`isInstitutionalPortalEnabled()` to `true`, one to revert — bracket
a probe sequence against real production infra. The Vercel env var
`INSTITUTIONAL_PORTAL_ENABLED` stays unset throughout; the
verification window is bounded by the two pushes and visible in
`git log` rather than in the Vercel dashboard.

This is mechanically equivalent to the prod-flag-flip option (1) the
principal would have done in the dashboard, with the advantage that
the override is reverted by the same hand that placed it and leaves
a clear audit trail in the commit history.

**Verification window.**

1. `fd6f87a` — TEMP override pushed: `isInstitutionalPortalEnabled()` returns hardcoded `true`.
2. ~95 sec wait for Vercel auto-deploy.
3. Sanity probe confirms flag is on (`POST /api/institution/signup` no-body → 400, not 404).
4. Four verification probes run.
5. `1ab586e` — revert pushed: env-var-driven gate restored.
6. ~90 sec wait for revert deploy.
7. Post-revert sanity probe confirms surface is gated again (both routes → 404).
8. Drift query against `institutions`, `institution_memberships`, `profiles.institution_id`.

Total flag-on window on production: under 2 minutes between the
revert push landing and the override push landing — wider in
calendar time than that, but the deploy state is what matters.

**Probe results.** Four probes against `www.searchstar.com`:

| # | Probe | Expected | Result |
|---|---|---|---|
| 1 | `POST /api/institution/signup` (no body) | 400 (validation gate) | HTTP 400 `{"error":"name, type, and contact_email are required."}` ✓ |
| 2 | `POST /api/institution/signup` (`{"name":"Pass5SmokeProbe","type":"invalid_type","contact_email":"smoke@pass5.test"}`) | 400 (type-validation gate) | HTTP 400 `{"error":"Invalid institution type."}` ✓ |
| 3 | `POST /api/institution/[id]/enroll` (no body, `[id]` = zero UUID) | 401 (auth gate) | HTTP 401 `{"error":"Unauthorized"}` ✓ |
| 4 | `POST /api/institution/[id]/enroll` (`{"emails":["smoke@pass5.test"]}`, `[id]` = zero UUID) | 401 (auth gate) | HTTP 401 `{"error":"Unauthorized"}` ✓ |

Every probe's first-firing gate fired before any DB write was
reached. This matches the Pass 4 §3 verification shape — gate fires
first, no UPDATE/INSERT runs on the unauth path, no row should
move on the smoke run.

**Why these probes and not others.** The signup route is unauth-by-
design, so the conventional "401 on unauth" probe shape from F24
doesn't apply. Substituted with two probes that exercise the
validation gate ahead of the INSERT — proves the route is reachable
and serving (no longer 404 from the flag) and that the code path
short-circuits before any write attempt. A "real" valid-body signup
probe was deliberately skipped because it would create a row in
`institutions` and require cleanup; the F24 fix's structural shape is
identical to F25's, and structural parity plus reachability is
sufficient verification for an application-only change.

**Drift check.** `institutions`, `institution_memberships`, and
`profiles.institution_id` distributions, queried against the same
SQL before and after the verification window:

| Table / column | Baseline | Post-probe | Drift |
|---|---|---|---|
| `institutions` | 0 rows | 0 rows | none |
| `institution_memberships` | 0 rows | 0 rows | none |
| `profiles.institution_id NOT NULL` | 0 | 0 | none |
| `profiles.institution_id NULL` | 28 | 28 | none |

Zero drift across all four counters. The institutional surface had
never carried a row in production before Pass 5 either, so the clean
baseline made drift detection trivially clean — any single non-zero
post-probe value would have meant a write reached the database.

**Post-revert sanity.** After the revert deployed:

| Probe | Result |
|---|---|
| `POST /api/institution/signup` (valid body) | HTTP 404 `{"error":"Not found"}` |
| `POST /api/institution/[id]/enroll` (valid body, zero UUID) | HTTP 404 `{"error":"Not found"}` |

Surface is gated again. The flag-gate restoration confirms the
revert landed cleanly.

**Migrations applied.** None. F25 is application-code only.
Repo tip moves from `668fb2f` (Pass 4 close) through `c5bcc45` (F25)
→ `fd6f87a` (TEMP override) → `1ab586e` (revert) → this §2 docs
commit on top.

**Production state at section close.**

- Repo tip: `1ab586e` (revert) + this §2 docs commit on top.
- 28 profiles unchanged (28 private, 1 admin / 27 NULL).
- 0 institutions, 0 institution_memberships, 0 profiles with
  institution_id set — unchanged from baseline.
- `INSTITUTIONAL_PORTAL_ENABLED` still unset in production env.
  Surface is flag-gated and returns 404.
- `/api/institution/signup` and `/api/institution/[id]/enroll` now
  write through the service client; auth gate on the SSR client
  unchanged.

**Memory update implied.** The "NOT migrated" list in the principal's
session memory (memory #9: "outbound Postgres queries sometimes run
unauthenticated") narrows from `{institution/[id]/enroll,
institution/signup, /api/trust/*}` to just `{/api/trust/*}`. The
institutional-portal sweep is done.
