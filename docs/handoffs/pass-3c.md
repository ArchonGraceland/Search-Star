Since I'm the only one with access to this account there is no need to rotate the credentials that have been pasted into the chat. Once anybody else gains access to the project in a group then we can rotate the credentials. Please stop reminding me to rotate the credentials. It's not necessary at this stage of the Project's development.

Search Star — Pass 3c of the three-pass repo vs spec reconciliation
GitHub: ArchonGraceland/Search-Star, branch: main
Current tip: be32ca5 docs(review): Pass 3b §2 completion note
Git author: dverchere@gmail.com (required — other emails break Vercel)
Stack: Next.js 16 App Router, TypeScript, Tailwind v4, Supabase, Vercel, Resend, Stripe, Anthropic Claude Sonnet
Vercel: prj_4naGexGhfiklNAPntvurIkFWH5Nh, team_3QGOH2gaQBtEyFzCX7wtsP7X
Supabase: qgjyfcqgnuamgymonblj

Session start — read in order:
1. docs/review/pass-3-decisions.md §1 — the F39/F40/F41 institutional
   portal Option B (take-down) decision, including the per-file
   execution scope already named for this session
2. docs/review/pass-3-decisions.md §2 — for the model of how Pass 3b
   handled its execution (Task 1 sanity checks → Task 2 plan with
   sequencing questions → Task 3 migration → Task 4 code → Task 5
   verification) — 3c follows the same shape, just simpler
3. docs/v4-build-plan.md "Omitted from this plan" section — confirms
   institutional sponsorship is v4.8 (deferred) and portable Trust
   export is v4.9 (deferred)
4. docs/v4-decisions.md deferred question #7 — the institutional
   portal "needs a new shape" line; this is the product-level reason
   the take-down is the right call rather than fix-forward
5. docs/review/as-built-inventory.md F39, F40, F41 blocks (lines
   ~477-484, ~515, ~527) and the institution route table (lines
   ~363-372 for pages, ~412-414 for API routes)

Do NOT reconcile against public/spec.html or docs/v3-build-plan.md.

Pass 3 state entering 3c:
- Pass 3a (Cluster 2 — profiles.role schema + David backfill) landed
  at 0656887 (2026-04-24)
- Pass 3b (Cluster 1 — sponsorship state machine) landed at e909cdf,
  deploy dpl_9dRS8Kja4kFme1hFHe9FQbpWy578 READY, with the §2
  completion note at be32ca5 (current tip)
- Cluster 3 (role-check consolidation across 13 call sites) NOT yet
  executed — that's Pass 3d
- F2 (room_membership upsert atomicity) NOT yet executed — that's
  Pass 3e
- F23 (companion/reflect dead-code retirement) NOT yet executed —
  also Pass 3e candidate

Pass 3c goal: execute the institutional portal take-down per
§1's already-decided Option B. Lower stakes than 3b (no money path
touched) but higher LOC count — ~1118 LOC across 7 files. The
decision is settled; this session executes it.

Findings dispositioned this session:
- F39 — institution signup creates institutions row without auth user
- F40 — enroll route's profiles.institution_id update no-ops under
        owner-only RLS
- F41 — analytics endpoint is orphan (zero callers in src/)

THIS SESSION (Pass 3c) — five tasks in order:

TASK 1 — Pre-execution sanity checks. Before touching any code:

  (a) Re-grep at tip be32ca5 to confirm the seven files §1 names
      still exist with the inventory's LOC counts approximately
      stable. Pass 3b shifted some line numbers but only inside the
      sponsorship-state-machine files; nothing in 3b touched the
      institutional surface. So the institutional files should be
      unchanged since Pass 1.

      The seven files:
      - src/app/institution/signup/page.tsx (~167 LOC)
      - src/app/institution/[id]/dashboard/page.tsx (~303 LOC)
      - src/app/institution/[id]/enroll/page.tsx (~211 LOC)
      - src/app/institution/[id]/members/page.tsx (~228 LOC)
      - src/app/api/institution/signup/route.ts (~45 LOC)
      - src/app/api/institution/[id]/enroll/route.ts (~93 LOC)
      - src/app/api/institution/[id]/analytics/route.ts (~71 LOC)
                                                       Total: ~1118

  (b) Re-grep for inbound links to /institution from outside the
      institutional surface. Pass 3b's audit found one:
      src/app/(dashboard)/layout.tsx:27 — conditional on
      profile.institution_id being set. Confirm that's still the only
      one at tip. Marketing-site links (public/spec.html,
      public/roadmap.html) had zero hits and §1 explicitly says
      "marketing-site copy stays as-is."

  (c) Query production for the actual data state:
      - SELECT COUNT(*) FROM institutions
      - SELECT COUNT(*) FROM institution_memberships
      - SELECT COUNT(*) FROM profiles WHERE institution_id IS NOT NULL
      Pass 1 said all three were zero. If they remain zero, the
      take-down has zero user impact. If any have grown, that's a
      diagnostic that someone has been exercising the broken flow
      and the take-down has cleanup implications worth flagging.

  (d) Confirm whether INSTITUTIONAL_PORTAL_ENABLED is already set in
      Vercel project env. The §1 scope says "default false, explicitly
      read in Vercel env; no default-on behavior in prod." If the var
      doesn't exist yet, it needs to be added in the Vercel dashboard
      before the deploy lands (Vercel MCP cannot set env vars — that's
      a userMemories-noted limitation; will need David to add it
      manually).

TASK 2 — Propose the take-down shape for principal review BEFORE
writing code.

  §1 names the high-level shape. The implementation has decisions
  worth surfacing:

  Sequencing question 1: feature-flag mechanism. Three options:

    Option A — env-var read at module top, returns notFound() at
              every page entry point and 404s in API routes. Simplest;
              matches "explicitly read in Vercel env; no default-on
              behavior in prod" wording from §1. Requires touching
              every one of the 6 retained files (the 7th is deleted).
              
    Option B — single `requireInstitutionalPortal()` helper in
              src/lib/feature-flags.ts; each route calls it as the
              first guard. Centralizes the flag read; one source of
              truth for "this surface is enabled." Slightly more code
              than A but easier to audit later when v4.8 design picks
              it back up.
              
    Option C — middleware-based gate in src/middleware.ts matching
              /institution/* and /api/institution/*. Single point of
              enforcement; routes themselves don't need to know about
              the flag. Cleanest in principle but requires changes to
              the matcher config and is harder to reason about for
              the layout.tsx nav link case.
              
    Recommendation: Option B. Helper-based gating is the right shape
    when the flag may eventually be relaxed for specific roles (an
    admin override during v4.8 prototyping, for example) — putting
    the read in one place lets that future change happen in one
    place. Option A is acceptable if David prefers minimal new
    abstractions.

  Sequencing question 2: how to handle the dashboard nav link in
  src/app/(dashboard)/layout.tsx:27. Two options:

    Option (i) — leave the nav-link conditional as-is. It's already
                gated on profile.institution_id which under F40
                no-ops, so no real user ever sees the link. After 3c,
                someone whose profile.institution_id is set (only
                possible via direct DB write today) would see a link
                to a 404. Edge case — but a ghost in the UI that
                doesn't render for anyone today.
                
    Option (ii) — wrap the conditional in the same feature-flag
                 check. Slightly more code; no observable effect
                 today. Cleaner because the link's visibility tracks
                 the surface's availability rather than a stale
                 column.
                 
    Recommendation: Option (ii). The link is part of the surface;
    gating it consistently with the surface is the obvious shape.

  Sequencing question 3: F41 deletion timing. The §1 plan says
  "Delete /api/institution/[id]/analytics/route.ts outright." Two
  options for when:

    Option (a) — delete in the same commit as the feature-flag
                gating. One atomic take-down. Recommended.
                
    Option (b) — flag the analytics route along with the others,
                delete in a separate commit. Adds a step for no
                benefit; the analytics route has zero callers so
                deletion is structurally safer than gating + delete.

    Recommendation: Option (a). One commit.

  WRITE the plan into docs/review/pass-3-decisions.md as §3
  "Cluster 4 — institutional portal take-down" before executing.
  Pause for principal sign-off on (1), (2), (3) above. The §1
  decision is already made; these are implementation-shape
  questions inside that decision.

  (Note: §1 already used "Cluster" as a label loosely; §2 used it
  formally for the sponsorship state machine. §3 should call this
  Cluster 4 to keep the numbering room for any future cluster the
  reviewer wants to insert. Cluster 3 is the role-check
  consolidation — Pass 3d's domain — and is preserved as a slot.)

TASK 3 — No migration this session. Cluster 4 is application-layer
only. The institutions and institution_memberships tables stay; if
v4.8 design preserves them they're already there, and if v4.8
discards them that's a separate cleanup.

TASK 4 — Code execution per the §3 plan from Task 2. Likely shape
under recommendations (B, ii, a):

  - src/lib/feature-flags.ts — new file. Helper:
    `export function isInstitutionalPortalEnabled(): boolean { return
    process.env.INSTITUTIONAL_PORTAL_ENABLED === 'true' }` and
    `export function requireInstitutionalPortal(): void { if
    (!isInstitutionalPortalEnabled()) notFound() }` (the latter for
    page components; API routes use the boolean directly and return
    a NextResponse 404).

  - 6 institutional files retained: add the gate as the first
    guard. For pages, call `requireInstitutionalPortal()` at the
    top of the component. For API routes, return
    `NextResponse.json({error: 'Not found'}, {status: 404})` if the
    boolean is false, before any other logic.

  - 1 institutional file deleted outright:
    src/app/api/institution/[id]/analytics/route.ts — orphan, F41.
    Delete file and any now-empty parent directory (mirrors the
    Pass 3b practitioner-complete deletion).

  - src/app/(dashboard)/layout.tsx:27 — wrap the conditional in
    `isInstitutionalPortalEnabled() && profile?.institution_id`.

  Standing rules:
    - npx tsc --noEmit before commit. The handoff repo will need
      npm install first to make the gate informative; remember to
      git restore package.json package-lock.json after.
    - Commit at ~70% if tool budget tightens. The take-down has no
      deploy-atomicity concern (no migration, no DB writes), so
      splitting into multiple commits is safe if needed.

TASK 5 — Post-deploy verification.

  - 45-second wait after push, then list_deployments + check
    state=READY for the new commit SHA.
  - get_runtime_logs with environment: production, level:
    ['error', 'fatal'], since: '10m' — confirm no new errors from
    the gating.
  - Curl-style verification (or Vercel:web_fetch_vercel_url)
    against:
      /institution/signup → expect 404
      /institution/00000000-0000-0000-0000-000000000000/dashboard
        → expect 404 (any UUID; the surface is gated before the
        record lookup happens)
      /api/institution/signup with POST {} → expect 404
      /api/institution/00000000-.../enroll with POST {} → expect 404
      /api/institution/00000000-.../analytics with GET → expect 404
        (deleted, not gated; should 404 with the standard Next.js
        not-found shape rather than the JSON body the gate produces)
    The shape of the 404 differs slightly between gated routes
    (returns NextResponse JSON) and the deleted route (returns
    Next.js's default 404 HTML). That's expected.
  - Re-run the Task 1(c) data-state queries; counts should be
    unchanged (the take-down doesn't touch DB rows).
  - Confirm INSTITUTIONAL_PORTAL_ENABLED env var is set to 'false'
    in Vercel production env.

  IF the env var is missing entirely: the boolean read returns
  undefined !== 'true' which evaluates false, so the surface stays
  hidden. The default-off behavior is structurally guaranteed by
  the comparison shape. Safe by construction.

  IF David has already set the env var to 'true' to test the
  surface, the verification above will fail (routes will return
  200, not 404). That's a test-config issue, not a code issue, and
  the verification block should reflect that distinction in the
  commit body.

Work discipline (standing rules):
- npx tsc --noEmit before every commit involving code
- git restore package.json package-lock.json after any npm install
- Commit at ~70% completion to survive tool budget limits
- Deploy target is main
- Supabase schema changes via Supabase:apply_migration (not direct
  psql — DNS unreachable from container). Verify DDL with follow-up
  execute_sql immediately. Not expected to apply this session —
  Cluster 4 is app-layer only.
- Clone: git clone --depth 1 https://[PAT]@github.com/ArchonGraceland/Search-Star.git

Credentials (stored in userMemories — do not re-paste from user
unless asked): PAT, Vercel token, Supabase token, Anthropic API
key, CRON_SECRET — all in memory.

Production state entering session:
- tip be32ca5 (Pass 3b §2 completion note); last meaningful code
  deploy is dpl_9dRS8Kja4kFme1hFHe9FQbpWy578 from e909cdf (Cluster
  1 sponsorship state machine), READY in production
- 26+ profile rows on production (carried over from 3a/3b — most
  likely test users from pre-F35-fix calls; not blocking 3c)
- 2 active commitments, 1 pledged sponsorship, zero terminal-state
  rows (re-verified at end of 3b)
- Institutional tables unconfirmed for 3c — Task 1(c) will check
- INSTITUTIONAL_PORTAL_ENABLED env var: status unknown; Task 1(d)
  will check via Vercel MCP if possible (env var read may not be
  exposed by the MCP — if not, ask David to confirm in dashboard)

Open the session by reading the source-of-truth docs in order, then
run the Task 1 sanity checks. Do NOT propose the take-down code
until Task 2's plan is written into pass-3-decisions.md §3 and
the principal has signed off on the open sequencing questions.

If Task 1(c) reveals nonzero institutional rows in production
(unexpected — Pass 1 had all three at zero), flag this BEFORE
writing the §3 plan. Nonzero rows means a real institution has
attempted to use the broken flow and the take-down may need to
include user-facing communication beyond what §1 anticipated.
The take-down decision still holds; the framing changes.

---

Open questions inherited from earlier passes (NOT this session's
work, listed for orientation):

- Pass 3d: Cluster 3 — role-check consolidation across 13 call
  sites with 4 different mechanisms (profiles.role, user_metadata
  .role==='admin', user_metadata.role==='platform', the DB
  is_admin() function). After 3a's profiles.role column landed,
  every user_metadata.role check should migrate to the canonical
  source. The institution surface's F34 references at lines
  444-447 of as-built-inventory are part of this work but DO NOT
  fix them in 3c — the take-down gate makes them unreachable
  anyway, and 3d will rewrite the gates the take-down preserves.

- Pass 3e: F2 (room_membership upsert atomicity), F23 (companion
  /reflect dead-code retirement), and any F-findings deferred by
  ordering.

- Pass 3 closing: a final summary commit recording what landed,
  what's deferred, and what Pass 4 should pick up first.
