# Search Star v4 — Build Plan

## What we're doing and why

The v3 codebase shipped a working product: 90-day practice commitments, a private validator feed, peer sponsorship, a four-way voluntary contribution split across mentor roles, and a Trust Record computed from validator confirmations. The v4 decisions retire three load-bearing pieces of that product: the validator role, the mentor role and the mentor economy, and the mentor-share contribution split. In their place: sponsors are the witnesses, an AI Companion accompanies the practitioner without authority, and a single 5% voluntary donation funds the platform.

This is not a green-field rewrite. It is surgery on the attestation model and the role model, performed on a live codebase with a single live user. The v3 auth, design system, admin pages, stage resolver framework, Supabase/Vercel/Resend wiring, and much of the commitment-lifecycle API survive intact. What changes is who has standing to attest that 90 days were real — and the schema, RLS, routes, pages, and copy that express that standing.

The v4.0 spec rewrite and `docs/v4-decisions.md` are the source of truth. Every session starts by reading those two documents and this build plan. If anything here conflicts with the spec or the decisions doc, the spec and decisions win.

---

## What carries over from v3

Preserved verbatim — no changes needed:

- `src/lib/supabase/client.ts` and `server.ts`
- `src/lib/resend.ts` (lazy-initialized client pattern — preserve)
- `src/app/auth/callback/route.ts`
- `src/app/(auth)/login/page.tsx` and `signup/page.tsx`
- `src/middleware.ts` — verify `protectedPrefixes` after new routes land
- `src/app/globals.css` (Project Graceland design system)
- `src/app/layout.tsx` (root layout, fonts)
- `next.config.ts`, `package.json`, `postcss.config.mjs`, `tsconfig.json`, `vercel.json`
- `src/components/sign-out-button.tsx`
- `src/app/admin/` (structure preserved; content updates where retired columns are shown — see Phase 1)
- `public/spec.html` (already rewritten to v4 in commit 6fd7ff1), `public/roadmap.html`, `public/logo.svg`
- `.github/workflows/deploy-v3.yml` (renamed to `deploy-v4.yml` at Phase 0 — same logic)
- The commitment lifecycle routes `src/app/api/commitments/route.ts`, `[id]/route.ts`, `[id]/start`, `[id]/complete`, `[id]/posts` (validator-sweep needed in Phase 1, but the commitment state machine is retained)
- The practice, profile, account, support, and admin API surfaces outside the validator/mentor/contribution areas

Preserved as shells but with new internals:

- `src/lib/stage.ts` — the shape stays (step 1..6 enum, `resolveStage` signature) but steps 3 and 4 are re-wired in Phase 3
- `src/app/api/trust/compute/route.ts` — the endpoint stays, the compute is rebuilt from scratch in Phase 5
- `src/app/api/sponsorships/pledge/route.ts` — the right foundation for the new sponsor flow; RLS and business logic reworked in Phase 2

## What gets retired

Files and directories dropped entirely:

- `src/app/validate/` and everything under it (`[commitment_id]/`, `expired/`, `invalid/`)
- `src/app/api/validate/` (entire namespace: `accept/`, `[commitment_id]/`)
- `src/app/api/validators/` (the `invite` route)
- `src/app/api/confirmations/` (entire namespace: `[post_id]/route.ts`, `[post_id]/acknowledge/route.ts`)
- `src/app/api/commitments/[id]/validators/route.ts` (validator-listing and invitation within a commitment)
- `src/app/start/validator/` (onboarding step 3 validator UI)
- `src/app/start/mentor/` (onboarding step 4 mentor intro)
- `src/app/(dashboard)/mentors/` (mentee-view page)
- `src/app/(dashboard)/mentoring/` (mentor-view page)
- `src/app/api/mentors/` (entire namespace: `invite/`, `mine/`)
- `src/app/api/mentoring/` (entire namespace: `mentees/`)
- `src/app/api/profiles/mentor-step-seen/` (flag endpoint)
- Any email template references to validators or mentors

Database objects dropped:

- Tables: `validators`, `post_confirmations`, `mentor_relationships`
- Columns on `contributions`: `mentor_share`, `coach_share`, `cb_share`, `pl_share`
- Columns on `trust_records`: `active_validators`, `mentees_formed`
- Column on `profiles`: `mentor_step_seen`

RLS policies rewritten (the atomicity of these changes is the reason Phase 1 is structured as a single fused phase):

- `commitments` read policy — drop validator reach-through, add sponsor reach-through via `sponsorships`
- `commitment_posts` read policy — same swap
- `sponsorships` insert policy — remove the `status = 'launch' AND launch_ends_at > now()` restriction; permit inserts during `'launch'` or `'active'` status

Terminology retired from copy: "validator," "validator circle," "validator feed," "validation," "confirm this session," "mentor," "coach," "community builder," "practice leader," "mentor economy," "four-way split," "23.75%," "1:100 ratio," "platform scale stages," "Early/Growing/Established/Scaling/Mature/At Scale."

---

## Database design (migrations, not a rebuild)

v3 shipped a working schema. v4 performs targeted surgery on it. The single live user is the founder and the `trust_records` row is disposable — no data migration is required for Trust Record rebuilds.

### Migration: `20260416_v4_role_excision.sql` (Phase 1)

```sql
-- Drop validator tables
DROP TABLE IF EXISTS post_confirmations CASCADE;
DROP TABLE IF EXISTS validators CASCADE;

-- Drop mentor tables
DROP TABLE IF EXISTS mentor_relationships CASCADE;

-- Drop retired columns on contributions
ALTER TABLE contributions DROP COLUMN IF EXISTS mentor_share;
ALTER TABLE contributions DROP COLUMN IF EXISTS coach_share;
ALTER TABLE contributions DROP COLUMN IF EXISTS cb_share;
ALTER TABLE contributions DROP COLUMN IF EXISTS pl_share;

-- Drop retired columns on trust_records
ALTER TABLE trust_records DROP COLUMN IF EXISTS active_validators;
ALTER TABLE trust_records DROP COLUMN IF EXISTS mentees_formed;

-- Drop retired column on profiles
ALTER TABLE profiles DROP COLUMN IF EXISTS mentor_step_seen;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS companion_step_seen boolean DEFAULT false;

-- Rewrite sponsorships insert RLS to permit launch OR active
DROP POLICY IF EXISTS "sponsorships: anyone can insert during launch" ON sponsorships;
CREATE POLICY "sponsorships: pledge during launch or active"
  ON sponsorships FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM commitments c
      WHERE c.id = commitment_id
        AND c.status IN ('launch','active')
        AND (c.status = 'active' OR c.launch_ends_at > now())
    )
  );

-- Rewrite commitments SELECT policy: drop validator reach-through, add sponsor reach-through
DROP POLICY IF EXISTS "commitments: validators can read" ON commitments;
CREATE POLICY "commitments: sponsors can read"
  ON commitments FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM sponsorships s
      WHERE s.commitment_id = commitments.id
        AND s.sponsor_user_id = auth.uid()
        AND s.status IN ('pledged','released')
    )
  );

-- Rewrite commitment_posts SELECT policy: same swap
DROP POLICY IF EXISTS "commitment_posts: validators can read" ON commitment_posts;
CREATE POLICY "commitment_posts: sponsors can read"
  ON commitment_posts FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM sponsorships s
      WHERE s.commitment_id = commitment_posts.commitment_id
        AND s.sponsor_user_id = auth.uid()
        AND s.status IN ('pledged','released')
    )
  );
```

### Migration: `20260416_v4_sponsor_actions.sql` (Phase 2)

Extending the `sponsorships` status enum is cleaner than adding a separate `sponsor_actions` table. A veto or release is an event but the sponsorship row itself carries the outcome.

```sql
-- Extend sponsorships status enum
ALTER TABLE sponsorships DROP CONSTRAINT IF EXISTS sponsorships_status_check;
ALTER TABLE sponsorships ADD CONSTRAINT sponsorships_status_check
  CHECK (status IN ('pledged','released','vetoed','refunded'));

-- Add columns to record the veto/release moments
ALTER TABLE sponsorships ADD COLUMN IF NOT EXISTS released_at timestamptz;
ALTER TABLE sponsorships ADD COLUMN IF NOT EXISTS vetoed_at timestamptz;
ALTER TABLE sponsorships ADD COLUMN IF NOT EXISTS veto_reason text;

-- Token for sponsor feed access — generated at pledge time, opaque to sponsor
ALTER TABLE sponsorships ADD COLUMN IF NOT EXISTS access_token text UNIQUE;

-- Add an invitation record for sponsors the practitioner has invited but who haven't pledged yet
CREATE TABLE IF NOT EXISTS sponsor_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_id uuid REFERENCES commitments(id) ON DELETE CASCADE,
  inviter_user_id uuid REFERENCES profiles(user_id),
  invitee_email text NOT NULL,
  invite_token text UNIQUE NOT NULL,
  sent_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  declined_at timestamptz,
  status text DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined','expired'))
);

-- RLS: inviter can read their invitations; anyone with token can read to accept
ALTER TABLE sponsor_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sponsor_invitations: inviter can read"
  ON sponsor_invitations FOR SELECT
  USING (auth.uid() = inviter_user_id);
```

### Migration: `20260416_v4_donations.sql` (Phase 4)

The `contributions` table is renamed to `donations` to reflect the new semantics — one recipient (Search Star), one suggested percentage, sponsor-paid on top of the pledge. The four-way split is gone.

```sql
-- Rename contributions → donations and drop old columns
ALTER TABLE contributions RENAME TO donations;
ALTER TABLE donations DROP COLUMN IF EXISTS contribution_rate;
ALTER TABLE donations RENAME COLUMN gross_amount TO pledge_amount;
ALTER TABLE donations RENAME COLUMN ss_share TO donation_amount;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS donation_rate numeric DEFAULT 0.05;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS sponsor_id uuid REFERENCES sponsorships(id);
ALTER TABLE donations ADD COLUMN IF NOT EXISTS stripe_charge_id text;
```

---

## Phase breakdown

Each phase is designed to fit one chat session (~2–4 hours) and to end with a working, deployed state on the v4 branch. The phases do not map 1:1 to spec §13 milestones — the spec describes the product arc; this plan describes the work arc.

### Phase 0 — v4 branch + schema migration prep
**Goal:** v3 branch is renamed to v4. Deploy pipeline is updated. The environment is ready for Phase 1's role excision but nothing breaks yet.

**Work:**
1. Rename local branch `v3` → `v4`. Push `v4` to origin and delete the remote `v3` branch.
2. Rename `.github/workflows/deploy-v3.yml` → `deploy-v4.yml`; update the workflow to trigger on pushes to `v4`.
3. Update the Vercel production branch in project settings from `v3` to `v4`.
4. Verify a clean deploy of the unchanged v3 code on the new `v4` branch (confirm `curl -s -o /dev/null -w "%{http_code}" https://www.searchstar.com/dashboard` returns 307 after ~90s).
5. Update `docs/v3-build-plan.md` references in `CLAUDE.md` or any project docs to point at `docs/v4-build-plan.md`.
6. Do NOT apply any schema migrations in this phase. Phase 1 owns the migrations because they must be atomic with the RLS and frontend changes.

**Deliverable:** v4 branch exists, deploys cleanly, carries unchanged v3 code. Zero user-visible change.

**Session prompt keywords:** "Phase 0 — v4 branch rename, deploy pipeline"

---

### Phase 1 — Atomic role excision: retire validator, ship sponsor-as-witness
**Goal:** The validator role is retired end-to-end and sponsors become the witnesses in one atomic session. Drop tables, rewrite RLS, rewire routes and pages, sweep terminology — all in a single deploy so the app never enters a broken intermediate state.

This is the hardest phase in the plan. Size it generously (target 4 hours). If it runs long, commit progress on a feature branch off `v4` and finish in a follow-up session — but do not merge to `v4` until the whole phase is complete and verified.

**Work:**
1. Apply migration `20260416_v4_role_excision.sql` (see Database design above). This drops `validators`, `post_confirmations`, `mentor_relationships`, rewrites RLS to grant sponsors read access on `commitments` and `commitment_posts`, and permits sponsorship inserts during active commitments.
2. Delete the retired route and page directories listed in "What gets retired." Do not leave empty directories.
3. Sweep the ~320 validator references across ~50 files:
   - DB identifiers: already gone after migration
   - URL paths: `/validate/*` and `/api/validate/*` and `/api/validators/*` deleted
   - UI copy and in-code strings: replace "validator" with "sponsor" only where the semantics match v4. Where v3 said "validator confirms session," v4 says nothing — sessions no longer have per-post confirmation. Where v3 said "validator circle," v4 says "sponsor circle" or more often just "sponsors."
   - JSX and TSX imports: remove any `import` of deleted components; adjust dashboard nav to remove the "Validating" link.
4. Retire mentor surfaces in the same session since they have no reach-through and the sweep is already happening:
   - Delete `/api/mentors/*`, `/api/mentoring/*`, `/api/profiles/mentor-step-seen/`
   - Delete `src/app/(dashboard)/mentors/`, `src/app/(dashboard)/mentoring/`, `src/app/start/mentor/`
   - Update `src/app/(dashboard)/layout.tsx` nav to remove Mentors, Mentoring links; keep Earnings for now (Phase 4 reworks it)
   - Update `src/app/admin/users/[id]/page.tsx` to stop reading `active_validators` and `mentees_formed`
5. Ship a minimal sponsor feed at `src/app/sponsor/[commitment_id]/[token]/page.tsx` as a read-only first cut:
   - Server-side token lookup against `sponsorships.access_token`
   - Display commitment summary, session post stream (chronological, no engagement metrics)
   - No release/veto actions yet — those come in Phase 2
   - This proves the RLS swap works and the token-based access path is live
6. Update the existing `src/app/sponsor/[id]/page.tsx` (the public pledge page) to generate an `access_token` on pledge and email it to the sponsor via Resend using the `getResend()` lazy init pattern.
7. Rewrite `src/lib/stage.ts` step 3: replace the `validators` table query with a `sponsor_invitations` query (check whether the practitioner has invited at least one sponsor). Step 4 placeholder remains — Phase 3 rewires it to Companion.
8. Run `npx tsc --noEmit` in container; verify no type errors. Run `git restore package.json package-lock.json` before committing.
9. Push to `v4`. Verify deploy. Smoke test: log in as founder, confirm dashboard loads, confirm an existing active commitment is still visible, confirm the old `/validate/*` routes return 404.

**Deliverable:** Validator and mentor roles fully retired from code and schema. Sponsors have read access to the private feed via a token-based URL. The app is visibly changed (nav updated, validator UI gone) but fully functional. This phase ships most of what spec §13's v4.1 describes plus the minimum of v4.2 required to avoid brokenness.

**Session prompt keywords:** "Phase 1 — atomic validator + mentor retirement, sponsor feed scaffold"

---

### Phase 2 — Sponsor invitation, pledge, release, veto
**Goal:** The full sponsor state machine is live. Practitioners can invite sponsors during launch or mid-streak. Sponsors can pledge, release at day 90, or veto at any time.

**Work:**
1. Apply migration `20260416_v4_sponsor_actions.sql` (extends sponsorships enum, adds `sponsor_invitations` table, adds token + action timestamp columns).
2. Build `/api/sponsors/invite/route.ts` — practitioner invites a sponsor by email. Creates `sponsor_invitations` row with opaque token. Sends invitation email via Resend. Callable during `launch` or `active` commitment status.
3. Build `/api/sponsors/pledge/route.ts` — the right foundation already exists in `src/app/api/sponsorships/pledge/route.ts`; rework it to consume an `invite_token` query param, mark the invitation accepted, create the `sponsorships` row with an `access_token`, and email the sponsor a link to `/sponsor/[commitment_id]/[token]`.
4. Build `/api/sponsors/release/route.ts` — available only when the commitment has reached day 90. Marks the sponsorship as `released`, sets `released_at`. When the last outstanding sponsor releases, trigger the commitment completion flow (status → `completed`, `completed_at` set).
5. Build `/api/sponsors/veto/route.ts` — available any time during `active` status. Marks the sponsorship as `vetoed`, sets `vetoed_at` and optional `veto_reason`. Flips the commitment status to `abandoned` and sets `completed_at` null. Queues refund processing for all pledged sponsors.
6. Update the sponsor feed at `/sponsor/[commitment_id]/[token]/page.tsx` to surface:
   - Release button (visible only when day ≥ 90 and not yet vetoed)
   - Veto button (visible at any time during `active` status, positioned as a serious standalone action — not inline on posts, consistent with decisions doc "positioned as a serious, standalone choice")
   - Read-only sponsor-count and pledge-roster display
   - Clear communication of the no-escape-hatch principle — any sponsor veto ends the streak
7. Build the launch dashboard sponsor invitation UI at `src/app/commit/launch/[id]/page.tsx` (adjust existing page) — "invite sponsor by email" form, list of pending invitations, list of confirmed pledges.
8. Build the active commitment sponsor-invitation surface at `src/app/commit/[id]/page.tsx` — same form, available any day during the 90-day streak.
9. Update email templates:
   - Sponsor invitation email (from practitioner, includes pledge link)
   - Sponsor welcome email on pledge (includes access token URL)
   - Day-90 release prompt email (sent to each sponsor on streak day 90)
   - Veto notification email (sent to practitioner and other sponsors when any sponsor vetoes)
10. Update the launch period to 14 days (spec §4.2) — v3 shipped with 7; `launch_ends_at` calculation needs to move back to launch + 14 days. Check `src/app/api/commitments/route.ts` for the hardcoded value.

**Deliverable:** Full sponsor lifecycle works: invite → pledge → (release or veto). Mid-streak pledging works. Veto ends the streak. Release at day 90 triggers completion.

**Session prompt keywords:** "Phase 2 — sponsor invite/pledge/release/veto, 14-day launch restoration"

---

### Phase 3 — Stage resolver + onboarding rework
**Goal:** The onboarding flow reflects v4 roles. Step 3 is sponsor invitation; step 4 is Companion introduction.

**Work:**
1. Rewrite `src/lib/stage.ts`:
   - Step 3 check: practitioner has created at least one `sponsor_invitation` OR at least one `sponsorship` exists for their current commitment
   - Step 4 check: `profiles.companion_step_seen = true`
   - Steps 5 and 6 unchanged
2. Build `src/app/start/sponsor/page.tsx` replacing the retired `start/validator/`:
   - Explain the sponsor role in v4 terms (witness, releases payment at day 90, can veto)
   - Prominently communicate the no-escape-hatch principle
   - Invite-sponsor form (reuses the Phase 2 invitation flow)
   - "I'll invite sponsors later" option advances the stage without requiring an invitation (stage step 3 check is OR-logic — either an invitation or the user dismisses)
3. Build `src/app/start/companion/page.tsx` replacing the retired `start/mentor/`:
   - Introduce the Companion as a non-authoritative AI accompaniment
   - Explain it accompanies the practitioner daily and summarizes for sponsors at day 90
   - Explain it has no authority over the Trust Record
   - "Continue" button calls `/api/profiles/companion-step-seen` and advances to step 5
4. Build `/api/profiles/companion-step-seen/route.ts` (replaces the retired mentor-step-seen endpoint)
5. Update `src/app/(dashboard)/layout.tsx` nav — verify Dashboard / Practice / Commit / Sponsoring (renamed from Validating if that link survived Phase 1) / Trust / Earnings / Account / Support flow makes sense post-retirement.

**Deliverable:** A new user can onboard through all five stage steps with v4-correct copy. Stage resolver returns the right step for every account state.

**Session prompt keywords:** "Phase 3 — stage resolver rework, sponsor + companion onboarding steps"

---

### Phase 4 — Payment flow (Part 1 of 2): Stripe holds and day-90 release
**Goal:** Stripe is integrated for sponsor pledges. Funds are held at pledge time, released to the practitioner at day 90 completion, refunded on veto.

**Work:**
1. Apply migration `20260416_v4_donations.sql` (renames contributions → donations, drops four-way split columns, simplifies to single donation amount/rate).
2. Add Stripe SDK to `package.json`. Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to Vercel env via the direct API.
3. Rework `/api/sponsors/pledge` to create a Stripe PaymentIntent with `capture_method: 'manual'` — funds are authorized at pledge time, not captured.
4. Rework `/api/sponsors/release` to capture the PaymentIntent. Once every sponsor releases, transfer aggregate funds to the practitioner's connected Stripe account (if Stripe Connect is in scope for v4.5; otherwise record the release and handle payouts manually for the single-user beta).
5. Rework `/api/sponsors/veto` to cancel the PaymentIntent (cancels the hold, funds never captured, no refund needed).
6. Build Stripe webhook handler at `/api/stripe/webhook/route.ts` — handle `payment_intent.succeeded`, `payment_intent.canceled`, `payment_intent.requires_action`.
7. Update the sponsor pledge page to collect card details via Stripe Elements.
8. Dashboard earnings summary — update `src/app/(dashboard)/earnings/page.tsx` to show practitioner payouts only (remove the mentor-income and community-pool sections that assumed the retired economy).

**Deliverable:** Sponsors can pledge with a card. Funds held until day 90. Release captures the payment. Veto cancels the hold cleanly. No voluntary donation prompt yet — that comes in Phase 5.

**Session prompt keywords:** "Phase 4 — Stripe integration, pledge hold, release capture, veto cancel"

---

### Phase 5 — Payment flow (Part 2 of 2): Voluntary donation at release
**Goal:** At the moment a sponsor releases payment, they see a one-prompt voluntary donation ask at 5% default, fully editable, removable in one click.

**Work:**
1. Build the donation prompt UI on the release confirmation screen — shows suggested 5%, editable input, single "Skip" action that records `donation_rate = 0` and completes the release.
2. Extend `/api/sponsors/release` to accept a `donation_rate` parameter (default 0.05, range 0.00–1.00). Create a `donations` row atomically with the release. Create a second Stripe charge for the donation amount (separate from the pledge capture — the donation is paid by the sponsor, never deducted from the practitioner's payout).
3. Build `src/app/(admin)/donations/page.tsx` — admin view of aggregate donation revenue for Search Star operations visibility.
4. Update public-facing copy on the spec and manifesto pages where "voluntary contribution" appears to confirm the 5% default and single-recipient model — much of this is already in the v4 spec rewrite; verify the homepage and onboarding reflect it too.

**Deliverable:** Every release prompts for an optional 5% donation. Sponsors can adjust or remove. Donation revenue flows to Search Star. Practitioner payout is untouched.

**Session prompt keywords:** "Phase 5 — voluntary donation at release, 5% default, removable"

---

### Phase 6 — Trust Record rebuild
**Goal:** `/api/trust/compute` is rewritten from scratch. Depth/Breadth/Durability are computed from completed sponsored streaks, weighted by sponsor count, diversity, and reliability.

**Work:**
1. Delete the existing `/api/trust/compute/route.ts` logic; the endpoint shape is preserved.
2. Build new compute:
   - **Depth:** for each skill category, sum completed streaks weighted by (sponsor_count_factor × sponsor_diversity_factor × sponsor_reliability_factor). Exact weights are notional — pick defensible numbers and document them in code comments as v1 calibration.
   - **Breadth:** count distinct skill categories across completed streaks (simple count).
   - **Durability:** calendar days between the oldest completed streak's `streak_starts_at` and the most recent completed streak's `completed_at`.
3. Sponsor reliability calculation — a sponsor's reliability score is the ratio of released:vetoed sponsorships across all their participation (bounded, starts neutral). First-time sponsors are neutral, not zero.
4. Stage assignment function — notional thresholds:
   - Seedling: 0 completed streaks (default)
   - Rooting: 1 completed streak
   - Growing: 2–3 completed streaks across ≥2 categories OR 3+ streaks in one category
   - Established: 4+ streaks across ≥2 categories with ≥18 months durability
   - Mature: 8+ streaks across ≥3 categories with ≥36 months durability
   - Document these as v1 calibrations; expect to retune.
5. Rebuild `src/app/(dashboard)/trust/page.tsx` to display the new dimensions and stage.
6. Rebuild the public Trust page at `src/app/trust/[userId]/page.tsx` (if it survived Phase 1) to match.

**Deliverable:** Trust compute returns sensible values for the founder's record (even if notional). The three dimensions are visible. The stage resolver no longer touches retired columns.

**Session prompt keywords:** "Phase 6 — Trust Record rebuild from completed sponsored streaks"

---

### Phase 7 — Companion v1: practitioner-facing reflection
**Goal:** The AI Companion is present inside every active commitment. It accompanies the practitioner daily and generates a summary at day 90.

**Work:**
1. Add Anthropic SDK to `package.json`. Add `ANTHROPIC_API_KEY` to Vercel env via the direct API.
2. Build `/api/companion/reflect/route.ts` — given a commitment_id and optional recent session posts, returns a short reflective prompt or pattern observation. System prompt defines the Companion role per spec §5 (practitioner-facing, supportive, non-authoritative, reads like a good teacher noticing).
3. Build the Companion surface on `src/app/commit/[id]/page.tsx` — a conversation-like panel where the practitioner sees reflections after posting a session and can ask questions.
4. Memory architecture v1 — per-commitment only. Companion context is the commitment's session posts in order. No cross-commitment memory, no persistent conversation history beyond the current commitment. This is deliberately minimal per decisions doc deferred question #2.
5. Build `/api/companion/day90-summary/route.ts` — generates a structured summary of the 90-day practice for sponsors at completion. Called from the release flow (Phase 5) or separately by the practitioner.
6. Surface the day-90 summary on the sponsor feed (`/sponsor/[commitment_id]/[token]/page.tsx`) when the commitment reaches day 90, immediately above the release button.

**Deliverable:** Every active commitment has a Companion surface. Day-90 sponsor release flow includes an AI-generated practice summary. The Companion holds no authority — no Trust Record writes, no completion triggers.

**Session prompt keywords:** "Phase 7 — Companion v1, practitioner reflection, day-90 sponsor summary"

---

### Phase 8 — Narrative rewrite (Part 1 of 2): public-facing pages
**Goal:** The homepage, manifesto, and onboarding explainer reflect v4. No references to validators, mentors, the mentor economy, or the four-way split remain on public surfaces.

**Work:**
1. Rewrite `src/app/page.tsx` (homepage):
   - Hero: "What do you want to practice?"
   - 90-day commitment mechanic with 14-day launch
   - Sponsors are the witnesses (the v4 framing)
   - Trust as growth stage, not a number
   - No validator, no mentor economy
2. Rewrite `src/app/manifesto/page.tsx`:
   - Beauty, grace, truth
   - Garbage culture problem
   - Conscientiousness as signal
   - Sponsor-as-witness as the honest answer to "who has standing to say the 90 days were real"
3. Rewrite `src/app/onboarding/page.tsx` — the public onboarding explainer (distinct from the `start/*` authenticated flow).
4. Rewrite `src/components/public-footer.tsx` version to v4.0.
5. Update `src/components/public-header.tsx` navigation if any retired surfaces are linked.
6. Sweep `public/` for any static HTML or images referencing validators or mentors.
7. Verify the spec and roadmap pages (`public/spec.html`, `public/roadmap.html`) match the repo-committed v4.0 version.

**Deliverable:** Every unauthenticated page tells the v4 story. No residual v3 copy on public surfaces.

**Session prompt keywords:** "Phase 8 — public-facing narrative rewrite"

---

### Phase 9 — Narrative rewrite (Part 2 of 2): videos and content assets
**Goal:** Video content is replaced or recut to match v4. Old videos archived.

**Work:**
1. Script new video: *How Search Star works in v4* (3–5 min) — 90-day commitment, sponsors as witnesses, Companion accompaniment, veto mechanic, voluntary donation.
2. Script new video: *Why sponsors are the witnesses* (3–5 min) — the collapse of validator-into-sponsor, money as honest attestation, the no-escape-hatch principle.
3. Recut or retire `seven-feeds-of-death.mp4`, `SearchStar_Trust_as_Validation.mp4`, `trust-as-love.mp4` as needed.
4. Update homepage video section with new assets.
5. Update any remaining `public/*.mp4` references.

**Deliverable:** Video content is accurate to v4. No public surface references retired roles or mechanics.

**Session prompt keywords:** "Phase 9 — v4 video scripts and content assets"

---

## Phase ordering rationale

Phase 0 first because it's preparatory — branch rename and deploy pipeline must be stable before any schema changes.

Phase 1 is the linchpin. It is deliberately large because the validator-table drop, RLS rewrite, frontend excision, and sponsor feed scaffold are mechanically coupled — splitting them leaves the app in a visibly broken state on production (private feed inaccessible, onboarding step 3 dead-ended). The decisions doc is explicit that this work must be atomic. The mentor retirement rides along in the same session because (a) the sweep of retired UI and nav copy is already happening, and (b) mentor surfaces have no RLS reach-through, so they're a clean parallel excision.

Phase 2 completes the sponsor state machine that Phase 1 scaffolded. These could not be combined into Phase 1 without a 6–8 hour session; the scaffold-then-fill split preserves the 4-hour target while still ending Phase 1 in a deployed state.

Phase 3 reworks onboarding to match the new roles. Must come after Phase 2 because the sponsor invitation flow it links to didn't exist before.

Phase 4 and Phase 5 split the payment work because Stripe integration plus hold/release/veto is one session's worth of careful work, and the voluntary donation flow has its own UX subtleties that deserve focused attention. They could merge if Phase 4 runs short.

Phase 6 (Trust rebuild) can technically happen any time after Phase 2, but sits here because having real sponsor-release data (even from the founder's testing) makes calibration more honest.

Phase 7 (Companion) depends on nothing earlier except the active commitment flow, which survives from v3. It sits here in the ordering because it's the first truly new surface — not a replacement for a v3 surface — and deserves attention after the retirement work is complete.

Phases 8 and 9 (narrative rewrite) can technically happen any time after Phase 2 but are placed last because the public-facing copy should reflect what's actually shipped, not what's planned. Doing narrative before build risks writing promises that change during implementation.

**Critical path:** Phase 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

**Can be parallel:** None in practice. Every phase either depends on a prior phase's data model or rewrites code that a prior phase will touch.

**Omitted from this plan:** Spec §13's v4.8 (Institutional Sponsorship experimental) and v4.9 (Portable Trust Export). Both are "Future" in the spec. v4.8 is blocked on decisions doc deferred question #1 (institutional-to-personal ratios) and v4.9 requires real Trust Record data to attest against. Both are deferred until v4.1–v4.7 are shipped and the platform has real completions to work with.

---

## Per-session prompt template

Every chat working on v4 should begin with this context block. Fill in the session-specific fields before starting.

```
Search Star v4 build — [Phase N: description]

GitHub repo: ArchonGraceland/Search-Star (private)
PAT: [store out-of-band]
Branch: v4 (deploy target)
Supabase project ID: qgjyfcqgnuamgymonblj
Vercel project ID: prj_4naGexGhfiklNAPntvurIkFWH5Nh
Team ID: team_3QGOH2gaQBtEyFzCX7wtsP7X
Git author email: dverchere@gmail.com (required — other emails break Vercel)

Stack: Next.js 16 App Router, TypeScript, Tailwind v4, Supabase, Vercel
Design system: Project Graceland — Crimson Text headings, Roboto body, navy #1a3a6b, 3px border-radius

Source of truth documents (read in this order before starting any work):
1. docs/v4-decisions.md — the structural decisions driving v4
2. public/spec.html — the v4.0 spec (authoritative product definition)
3. docs/v4-build-plan.md — this build plan (operational playbook)

Current state: [describe what was completed in the previous session]
This session goal: [Phase N deliverable from the build plan]

Key decisions from v4 (summary):
- Two human roles: Practitioner and Sponsor. One AI role: Companion (no authority).
- Validator role retired entirely — sponsors are the witnesses.
- Mentor role and mentor economy retired entirely — no Mentor/Coach/CB/PL.
- Any single sponsor can veto at any time during the 90 days; no replacement for lost sponsors; streak ends and practitioner restarts.
- Sponsors can join during launch OR mid-streak; once in, bound by veto-or-release.
- Sponsors invited only by the practitioner or via their sponsor link. No public directory.
- Institutional sponsorship cannot stand alone — must ride alongside personal.
- Payment release at day 90 is the attestation. Veto is the counter-attestation.
- Revenue: single 5% voluntary donation to Search Star at release, removable in one click.
- Trust earned from completed sponsored streaks, weighted by sponsor count/diversity/reliability.
- Launch period is 14 days (v3 shipped 7; restore to 14 in Phase 2).
- Trust expressed as growth stage (Seedling → Mature), never a number.
```

---

## Definition of done for v4

- [ ] v4 branch is the deploy target; v3 branch retired
- [ ] `validators`, `post_confirmations`, `mentor_relationships` tables dropped
- [ ] `contributions` table renamed to `donations`; four-way split columns dropped
- [ ] `trust_records` retired columns dropped
- [ ] All `/validate/*`, `/api/validate/*`, `/api/validators/*`, `/api/confirmations/*`, `/api/mentors/*`, `/api/mentoring/*` routes and pages deleted
- [ ] Homepage describes v4 (sponsors as witnesses, 90-day commitment, Companion, 5% donation)
- [ ] Manifesto reflects v4
- [ ] Onboarding has 5 stage steps with v4-correct copy (practice → commitment → sponsor invitation → Companion intro → launch → active)
- [ ] Practitioner can invite sponsors by email during launch or active commitment
- [ ] Sponsor receives invitation email, can pledge with a card via Stripe
- [ ] Pledge holds funds (not captured)
- [ ] Sponsor has token-based access to the private session feed — no engagement metrics, no per-session confirmation
- [ ] Sponsor can veto at any time during active commitment — ends the streak, cancels all holds
- [ ] Sponsor can release at day 90 — captures their pledge, releases funds to practitioner when last sponsor releases
- [ ] Release flow includes voluntary donation prompt at 5% default, removable in one click
- [ ] Donation is a separate charge on the sponsor's card, never deducted from practitioner payout
- [ ] Trust Record computed from completed sponsored streaks with Depth/Breadth/Durability
- [ ] Trust expressed as growth stage, never a number
- [ ] Companion v1 surface present in every active commitment
- [ ] Companion generates day-90 summary for sponsors at release
- [ ] Companion has no write access to Trust Record; release is the only completion trigger
- [ ] No orphan pages, dead links, or references to validators, mentors, mentor economy anywhere in the codebase or copy
- [ ] `docs/v4-build-plan.md`, `docs/v4-decisions.md`, `public/spec.html` all reflect the shipped product
- [ ] Video content replaced or archived to match v4

Total estimated sessions: 10 working chats. Phase 1 is the longest (~4 hours); Phases 4 and 7 are the most technically involved after that.
