# Pass 6 — Principal Decisions

This file records decisions the principal (David) has made during Pass 6.
Pass 6 opens with the `/api/trust/*` SSR-client sweep nominated by Pass 5's
closing memory note ("NOT migrated: /api/trust/* only"), the last item on
the SSR-client migration list per the post-Pass-5 state.

The shape mirrors Pass 4's and Pass 5's single-section-per-work-item
convention. Unlike Pass 5, this section is audit-only: the audit found
the migration work was already shipped out-of-band before either F24 or
F25 landed, so there is no §2 execution block — Pass 6 §1 is the whole
of the work and the entry resolves to closed-no-op with a bookkeeping
correction.

---

## §1 — Audit of the `/api/trust/*` surface

**Discovery (entering Pass 6).** Memory #9 carried `/api/trust/*` as the
sole remaining unmigrated surface in the SSR-client → service-client
sweep, after Pass 4 §3 (F24) closed `/api/profiles` and Pass 5 §2 (F25)
closed `/api/institution/signup` + `/api/institution/[id]/enroll`. The
expectation entering this session was a small audit + migration of three
routes following the F24/F25 pattern.

**The F24 pattern, restated for this audit.** Keep the SSR client for
`auth.getUser()` (cookie-bound — that's correct). Move every `.from(...)`
read and write through the service client. Authorization comes from an
explicit WHERE-clause filter that ties the row to `user.id` (or another
identifier returned by the SSR auth check). RLS becomes defense-in-depth,
not the primary gate. Reference implementations: `src/app/api/profiles/
route.ts` and `src/app/api/profiles/visibility/route.ts` post-F24;
`src/app/api/institution/signup/route.ts` and
`src/app/api/institution/[id]/enroll/route.ts` post-F25.

**Audit table.** Every file under `src/app/api/trust/*`, classified:

| # | Path | Auth call client | `.from()` client | Authorization model | F24 violation? | Action |
|---|---|---|---|---|---|---|
| 1 | `src/app/api/trust/[userId]/route.ts` | None — public endpoint, no `getUser()` call | `createServiceClient()` for both `profiles` (visibility check) and `trust_records` reads | Visibility-based: `profile.visibility === 'private'` returns 404; otherwise the trust record is publicly readable | **No — already on the post-F24 service-client read pattern** | None |
| 2 | `src/app/api/trust/compute/route.ts` | SSR `createClient()` for `auth.getUser()` only — return 401 on no user | `createServiceClient()` is created locally and passed into `computeAndPersistTrust(db, user.id)`; the helper does every `.from()` through it | App-layer: `.eq('user_id', userId)` filter inside `trust-compute.ts` for every read and write; the helper's own comment (`src/lib/trust-compute.ts:183-186`) explicitly sanctions the service-client pattern | **No — already on the post-F24 pattern** | None |
| 3 | `src/app/api/trust/share/route.ts` | SSR `createClient()` for `auth.getUser()` only — return 401 on no user | `createServiceClient()` for both the `profiles` visibility read and the `trust_records` upsert | App-layer: `.eq('user_id', userId)` filter on both reads; visibility gate (private profiles cannot share) preserved | **No — already on the post-F24 pattern** | None |

All three files explicitly reference the SSR-bug commit history in their
own comments (commits `0710ce4 / 1dccc46 / 501d976 / 0f28db9`), the same
provenance citation F24 and F25 carry. The migration was applied to all
three at once; the citation is identical because the rationale is
identical.

**Provenance check.** `git log --oneline -- src/app/api/trust/share/
route.ts src/app/api/trust/compute/route.ts src/app/api/
trust/[userId]/route.ts` shows a single migration commit covering all
three:

```
cc793d3 Phase 9b: migrate admin/institution/api/trust from SSR client to service client
```

Commit `cc793d3` (Mon Apr 20 13:57:38 2026 UTC) migrated 12 files in one
sweep — admin layer (7 files), `/api/trust/*` (3 files), institution
pages (2 files). Its commit message: *"Completes the sweep started in
commits 0710ce4 / 1dccc46 / 501d976 / 0f28db9. Twelve files migrated:
the same SSR -> service-client pattern applied to every RLS-gated table
read across admin, institution, and /api/trust surfaces."* So
`/api/trust/*` was migrated **on the same day as the broader admin
sweep, before F24 (`2af29fb`, Apr 25) and before F25 (`c5bcc45`, Apr
25) landed.** The Pass 5 closing memory carrying it on the
"NOT migrated" list was a bookkeeping error, not a real outstanding
item.

**Repo-wide cross-check.** Two greps to confirm no remaining
F24/F25-shape offenders survived elsewhere:

1. *Every API route that imports from `@/lib/supabase/server`*, filtered
   to those importing `createClient` without also importing
   `createServiceClient`. Result: **zero hits** under `src/app/api/`.
   Every API route that creates an SSR client also creates a service
   client.
2. *Every server page (non-API) doing the same*, narrowed further to
   files where the SSR client also performs a `.from(...)` UPDATE /
   INSERT / UPSERT / DELETE. Result: **zero hits** under `src/app/`
   excluding `/api/`.

The `@supabase/ssr` JWT-propagation symptom is fully eliminated from the
application surface. The sweep is closed. The remaining long-term
project — diagnosing the underlying `@supabase/ssr` JWT-propagation
cause itself, so the workaround can someday be retired — is unchanged
in scope.

**Verification.** No code changes in this section. Build / runtime / DB
state at session start is unchanged at session end. Production tip
remains `618deda` for code; this docs commit lands on top.

**Decisions.**

1. **No migration. No execution. No §2.** The three `/api/trust/*` routes
   are already on the post-F24 service-client pattern; they were
   migrated in `cc793d3` on 2026-04-20 as part of the same sweep that
   migrated the admin layer.

2. **Memory #9's "NOT migrated: /api/trust/* only" line is corrected.**
   Updated to reflect that the SSR-client write sweep is closed across
   the entire app surface — every API route and every server page that
   could carry the symptom has been audited and is on the post-F24
   pattern. The long-term `@supabase/ssr` JWT-propagation diagnosis
   remains as the only outstanding work, and is not gating real-user
   launch.

3. **The SSR-client sweep saga is closed.** Future sessions should not
   re-open this question on the basis of the (now-corrected) memory.
   Any new offender that surfaces is a regression to fix in place,
   not a new pass.

**Production state at section close.**

- Repo tip: `618deda` (Pass 5 §1 + §2 docs); this Pass 6 §1 docs commit
  on top.
- 28 profiles unchanged (28 private, 1 admin / 27 NULL).
- 0 institutions, 0 institution_memberships, 0 profiles with
  `institution_id` set — unchanged from Pass 5 close.
- `INSTITUTIONAL_PORTAL_ENABLED` still unset in production env.
  Institutional surface still 404s (correct).
- `/api/trust/*` continues to serve as it has since `cc793d3` — no
  behavior change, no schema change, no env change.

**Outcome.** Pass 6 §1 closes the SSR-client write sweep with a
bookkeeping correction. The body of work that began with `0710ce4` on
the early-stage commit/post/start routes and ran through F24 (profiles)
and F25 (institutional) is fully complete. The next session does not
inherit this thread.
