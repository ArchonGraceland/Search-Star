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
