# Search Star v3 — Build Plan

## What we're doing and why

The v2 codebase was built around a product that no longer exists: Activate profile discovery, sovereign data architecture, platform query economy, 40-day streaks. The new product — 90-day practice commitments, private validator feed, peer sponsorship, voluntary contributions, mentor role economy — shares almost none of that infrastructure.

Rather than build on top of retired code, we start a clean `v3` branch. The auth system, design system, and admin pages carry over verbatim. Everything else is written new against the current spec (v3.0, April 2026).

---

## What carries over from v2

Copy these verbatim into v3 — no changes needed:

- `src/lib/supabase/client.ts` and `server.ts`
- `src/app/auth/callback/route.ts`
- `src/app/(auth)/login/page.tsx` and `signup/page.tsx`
- `src/middleware.ts`
- `src/app/globals.css` (design system — Project Graceland)
- `src/app/layout.tsx` (root layout, fonts)
- `next.config.ts`, `package.json`, `postcss.config.mjs`, `tsconfig.json`, `vercel.json`
- `src/components/sign-out-button.tsx`
- `src/app/admin/` (all admin pages — keep as-is)
- `public/spec.html`, `public/roadmap.html`, `public/logo.svg`

## What gets retired (do not copy)

- Everything in `src/lib/activate/`
- All routes under `src/app/api/activate/`
- `src/app/activate/`, `src/app/profile-builder/`
- `src/app/api/platform/`, `src/app/platform/`
- `src/app/api/messages/`, `src/app/(dashboard)/feed/`
- `src/app/onboarding/estimate/`
- `src/components/endpoint-manager.tsx`
- `src/lib/photo-discovery.ts`, `src/lib/photo-processing.ts`
- All Activate-era Supabase migrations
- The old commitment schema (20260410_commitment.sql) — replaced by new schema in Phase 0

---

## Database design (new schema — built in Phase 0)

### Core tables

```sql
-- Users (extends Supabase auth.users)
profiles
  user_id uuid PK → auth.users
  display_name text
  location text
  bio text
  trust_stage text DEFAULT 'seedling'
    CHECK (trust_stage IN ('seedling','rooting','growing','established','mature'))
  mentor_role text
    CHECK (mentor_role IN ('mentor','coach','community_builder','practice_leader') OR mentor_role IS NULL)
  created_at timestamptz

-- Skill categories (lookup)
skill_categories
  id uuid PK
  name text UNIQUE  -- 'Craft & Making', 'Physical Practice', etc.
  slug text UNIQUE

-- A practitioner's named practice
practices
  id uuid PK
  user_id uuid → profiles
  name text                    -- "I am learning woodworking"
  label text DEFAULT 'skill'
    CHECK (label IN ('skill','craft','pursuit'))
  category_id uuid → skill_categories
  created_at timestamptz
  is_active boolean DEFAULT true

-- 90-day commitment (the atomic sponsorable unit)
commitments
  id uuid PK
  user_id uuid → profiles
  practice_id uuid → practices
  status text DEFAULT 'launch'
    CHECK (status IN ('launch','active','completed','abandoned'))
  launch_starts_at timestamptz     -- Day 1 of 14-day launch period
  launch_ends_at timestamptz       -- Day 14 (sponsor window closes)
  streak_starts_at timestamptz     -- Day 15 (start ritual timestamp)
  streak_ends_at timestamptz       -- Day 15 + 90 days
  completed_at timestamptz
  target_payout_amount numeric DEFAULT 2500
  sessions_logged int DEFAULT 0
  created_at timestamptz

-- Session posts (private to validator circle)
commitment_posts
  id uuid PK
  commitment_id uuid → commitments
  user_id uuid → profiles
  body text
  media_urls text[] DEFAULT '{}'
  session_number int              -- which session this is
  posted_at timestamptz

-- Validators (people who witness a commitment)
validators
  id uuid PK
  commitment_id uuid → commitments
  validator_user_id uuid → profiles
  invited_at timestamptz
  accepted_at timestamptz
  status text DEFAULT 'invited'
    CHECK (status IN ('invited','active','declined'))

-- Validator confirmations on posts
post_confirmations
  id uuid PK
  post_id uuid → commitment_posts
  validator_id uuid → validators
  quality_note text              -- qualitative attestation
  confirmed_at timestamptz

-- Sponsors (pledge during 14-day launch window)
sponsorships
  id uuid PK
  commitment_id uuid → commitments
  sponsor_user_id uuid → profiles  -- NULL if external personal sponsor
  sponsor_email text               -- for external sponsors
  sponsor_name text
  sponsor_type text DEFAULT 'personal'
    CHECK (sponsor_type IN ('personal','institutional','brand'))
  pledge_amount numeric NOT NULL
  status text DEFAULT 'pledged'
    CHECK (status IN ('pledged','paid','refunded'))
  pledged_at timestamptz
  paid_at timestamptz

-- Voluntary contributions (at payout moment)
contributions
  id uuid PK
  commitment_id uuid → commitments
  sponsor_id uuid → sponsorships
  gross_amount numeric            -- sponsor's total contribution
  ss_share numeric                -- 5% to Search Star
  mentor_share numeric            -- 23.75% to immediate mentor
  coach_share numeric             -- 23.75% to coach pool
  cb_share numeric                -- 23.75% to community builder pool
  pl_share numeric                -- 23.75% to practice leader pool
  contribution_rate numeric       -- % of payout (default 0.50)
  created_at timestamptz

-- Mentor relationships
mentor_relationships
  id uuid PK
  mentor_user_id uuid → profiles
  mentee_user_id uuid → profiles
  started_at timestamptz
  ended_at timestamptz
  status text DEFAULT 'active'
    CHECK (status IN ('active','ended'))

-- Trust record (computed periodically)
trust_records
  id uuid PK
  user_id uuid → profiles UNIQUE
  stage text DEFAULT 'seedling'
  depth_score numeric DEFAULT 0     -- sessions × quality
  breadth_score numeric DEFAULT 0   -- distinct categories
  durability_score numeric DEFAULT 0 -- streak age in days
  completed_streaks int DEFAULT 0
  active_validators int DEFAULT 0
  mentees_formed int DEFAULT 0
  updated_at timestamptz
```

### RLS policies
- Profiles: owner full access; public read for public-mode profiles
- Commitments: owner full access; validators can read commitments they're attached to
- Posts: owner full access; validators of that commitment can read
- Sponsorships: owner and sponsor can read; insert during launch window only
- Contributions: owner read; admin full access
- Mentor relationships: both parties can read; mentor can insert

---

## Phase breakdown

Each phase is designed to fit in one chat session (~2–4 hours of work). Each phase ends with a working, deployed state — nothing is half-built at the end of a session.

---

### Phase 0 — Clean branch + database foundation
**Goal:** v3 branch exists, carries over preserved files, new schema is live in Supabase, Vercel deploys cleanly.

**Work:**
1. Create `v3` branch from current `main`
2. Delete retired files and directories
3. Copy preserved files (list above)
4. Write new Supabase migration: `20260413_v3_schema.sql` with all tables above
5. Apply migration, verify all tables exist
6. Update Vercel to deploy from `v3` branch
7. Verify clean build and deploy

**Deliverable:** Blank but functional app — auth works, admin works, database is ready, nothing else yet.

**Session prompt keywords:** "Phase 0 — clean branch, new schema"

---

### Phase 1 — Homepage + public narrative
**Goal:** Homepage reflects the actual product. First thing anyone sees is correct.

**Work:**
1. Rewrite `src/app/page.tsx` — hero: "What do you want to practice?", 90-day commitment mechanic, voluntary sponsorship model, trust as growth not grade, no platform query economy
2. Rewrite `src/app/onboarding/page.tsx` — practice-first explainer, the 14-day launch, validators, sponsors, the commitment
3. Rewrite `src/components/public-header.tsx` — remove Activate link, update nav: Practice / How It Works / Sign In / Sign Up
4. Rewrite `src/components/public-footer.tsx` — version v3.0, correct links
5. Write `src/app/manifesto/page.tsx` — beauty, grace, truth; garbage culture problem; conscientiousness as signal (currently exists but needs full rewrite)
6. Update footer links throughout

**Deliverable:** Public-facing product narrative is correct and consistent with spec.

**Session prompt keywords:** "Phase 1 — homepage, onboarding, public narrative"

---

### Phase 2 — Practice-first onboarding + auth flow
**Goal:** New user signs up → names their practice → invites first validator → minimal profile. No Activate, no profile-builder.

**Work:**
1. Rewrite signup flow to route to practice declaration after email confirmation
2. Build `src/app/onboarding/practice/page.tsx` — step 1: name your practice, choose label (skill/craft/pursuit), choose category
3. Build `src/app/onboarding/validator/page.tsx` — step 2: invite first validator (email or Search Star handle)
4. Build `src/app/onboarding/profile/page.tsx` — step 3: name, location, brief bio (manual only, no discovery)
5. Build `src/app/onboarding/visibility/page.tsx` — step 4: set initial visibility (default Private)
6. Wire steps into a linear flow with progress indicator
7. Write API routes: `POST /api/practices`, `POST /api/validators/invite`, `PATCH /api/profiles`

**Deliverable:** A new user can complete onboarding in 4 steps and land on the dashboard with a practice defined and a validator invited.

**Session prompt keywords:** "Phase 2 — practice-first onboarding, signup flow"

---

### Phase 3 — 90-day commitment mechanic
**Goal:** A practitioner can declare a 90-day commitment, run the 14-day launch period, perform the start ritual, and begin logging sessions.

**Work:**
1. Build `src/app/commit/page.tsx` — commitment declaration form: practice selection, commitment statement, target payout amount
2. Build `src/app/commit/launch/[id]/page.tsx` — the 14-day launch dashboard: countdown, sponsors invited so far, validators confirmed, share link
3. Build `src/app/commit/start/[id]/page.tsx` — the start ritual: written statement, timestamp, transition to active
4. Build `src/app/commit/[id]/page.tsx` — active commitment view: 90-day grid, session logging, days remaining
5. Build `src/app/api/commitments/` routes: create, launch, start-ritual, log-session
6. Build the 90-day grid component (replaces ArcGrid — same idea, 90 squares not 40)
7. Handle commitment status transitions: launch → active → completed/abandoned

**Deliverable:** Full commitment lifecycle works end-to-end. A practitioner can declare, launch, start, and log sessions on a 90-day commitment.

**Session prompt keywords:** "Phase 3 — 90-day commitment, launch period, start ritual, session logging"

---

### Phase 4 — Validator feed
**Goal:** Session posts flow privately to the validator circle. Validators can confirm sessions and leave quality notes. No public feed.

**Work:**
1. Build `src/app/(dashboard)/feed/page.tsx` — PRIVATE validator feed: shows posts from commitments the user is validating, chronological, no engagement metrics
2. Build post card component — body, media, session number, confirmation button, quality note field
3. Build validator confirmation flow — confirm button triggers `POST /api/confirmations`, stores quality note
4. Build `src/app/(dashboard)/validating/page.tsx` — list of commitments the user is currently validating with their status
5. Build validator invite acceptance flow — email link → accept → added to validator circle
6. Write API routes: `POST /api/posts`, `GET /api/feed`, `POST /api/confirmations`, `POST /api/validators/accept`
7. RLS: enforce that only validators of a commitment can see its posts

**Deliverable:** The private validator feed is live. Posts flow to validators only. Confirmations work.

**Session prompt keywords:** "Phase 4 — validator feed, post confirmations, private by default"

---

### Phase 5 — Sponsorship + contribution flow
**Goal:** Sponsors can pledge during the 14-day launch window. Payout triggers on streak completion. Voluntary contribution prompt at payout.

**Work:**
1. Build `src/app/sponsor/[commitmentId]/page.tsx` — public pledge page (no login required for personal sponsors): name, email, pledge amount, pledge button
2. Build `src/app/api/sponsorships/pledge/route.ts` — create sponsorship record, send confirmation email
3. Build payout trigger logic — when commitment marked complete and validators confirmed, trigger payout flow
4. Build `src/app/api/sponsorships/payout/route.ts` — mark pledges as paid, generate contribution prompt
5. Build contribution prompt UI — shows at payout moment: suggested 50% of payout, split visualization (5% SS / 23.75% × 4 roles), single-click remove option
6. Build `src/app/api/contributions/route.ts` — record contribution, calculate splits, queue payments
7. Build earnings summary on dashboard — what the practitioner received, what went to the mentor economy
8. Stripe integration for payment collection (processing only — voluntary contributions handled separately)

**Deliverable:** The full money flow works. Sponsors pledge, practitioner completes, payout triggers, contribution prompt appears, splits are recorded.

**Session prompt keywords:** "Phase 5 — sponsorship pledges, payout flow, voluntary contributions, split calculation"

---

### Phase 6 — Mentor role system
**Goal:** Mentor relationships exist, contribution income routes correctly, leadership roles are tracked.

**Work:**
1. Build `src/app/(dashboard)/mentors/page.tsx` — the user's mentor relationships: who they mentor, who mentors them
2. Build mentor invitation flow — invite someone to be your mentor during or after onboarding
3. Build `src/app/(dashboard)/mentoring/page.tsx` — mentor's view of their mentees: active commitments, recent posts, confirmation queue
4. Build mentor contribution routing — when contribution splits are calculated, route mentor share to the right user_id
5. Build community pool distribution logic — Coach/CB/PL shares accumulate in pool, distributed weekly
6. Build leadership role progression — track mentee count, commitment completion rates; auto-suggest role advancement
7. Build `src/app/(dashboard)/earnings/page.tsx` — full earnings breakdown: practitioner income + mentor contribution income + institutional facilitation (manual entry for now)
8. Write API routes: `POST /api/mentors/invite`, `GET /api/mentors/mine`, `GET /api/mentoring/mentees`

**Deliverable:** Mentor relationships work. Contribution income routes correctly. Leadership roles are tracked and displayed.

**Session prompt keywords:** "Phase 6 — mentor relationships, contribution routing, leadership roles, earnings"

---

### Phase 7 — Trust record
**Goal:** The Trust record is computed, displayed, and shareable.

**Work:**
1. Build Trust record computation — cron job or on-demand: calculate Depth (sessions × quality confirmations), Breadth (distinct active categories), Durability (streak ages)
2. Build growth stage assignment — map scores to Seedling/Rooting/Growing/Established/Mature
3. Build `src/app/(dashboard)/trust/page.tsx` — private Trust record view: stage, three dimensions, history
4. Build Trust record share flow — generate a shareable attestation link with user's Trust stage and record summary
5. Build `src/app/trust/[userId]/page.tsx` — public Trust record view (only visible if user has set visibility to Public or Network)
6. Build Trust record in profile — show stage on public profile when user opts in
7. Write `POST /api/trust/compute` and `GET /api/trust/[userId]`

**Deliverable:** Trust record is computed, private by default, shareable on user's terms.

**Session prompt keywords:** "Phase 7 — trust record, growth stages, depth breadth durability, shareable attestation"

---

### Phase 8 — Dashboard + account cleanup
**Goal:** The logged-in experience is coherent and reflects the new product throughout.

**Work:**
1. Rewrite `src/app/(dashboard)/dashboard/page.tsx` — active commitment status, current streak day, upcoming launch windows, recent validator confirmations, earnings summary
2. Rewrite `src/app/(dashboard)/layout.tsx` — new nav: Dashboard / Practice / Commit / Validating / Mentors / Trust / Earnings / Account / Support
3. Rewrite `src/app/(dashboard)/account/page.tsx` — profile settings, visibility controls, notification preferences; remove all old Activate/endpoint/pricing fields
4. Build `src/app/(dashboard)/practice/page.tsx` — list of user's practices with active commitments and streak history
5. Clean up all remaining v2 references in dashboard pages
6. Update public-footer version to v3.0

**Deliverable:** The logged-in experience is clean, correct, and navigable. No orphaned pages or dead links.

**Session prompt keywords:** "Phase 8 — dashboard rewrite, account page, nav cleanup"

---

### Phase 9 — Institutional portal (lightweight v1)
**Goal:** An institution can create an account, allocate a sponsorship budget, and enroll members.

**Work:**
1. Build `src/app/institution/signup/page.tsx` — institution account creation (name, type, contact)
2. Build `src/app/institution/` dashboard — budget management, member enrollment, basic analytics
3. Build institution sponsorship flow — institution sponsors a skill category across a cohort rather than individual commitments
4. Build `src/app/api/institution/` routes: signup, members, budget, analytics
5. Build institution-level Trust record reporting — aggregate stage distribution for HR/admissions use
6. Update profiles with institution_id for enrolled members

**Deliverable:** An employer or foundation can deploy Search Star to their community and sponsor member commitments.

**Session prompt keywords:** "Phase 9 — institutional portal, benefit model, cohort sponsorship"

---

### Phase 10 — Videos + content
**Goal:** Video content reflects the actual product. Old videos replaced or recut.

**Work:**
1. Script new video 1: *What is a 90-day commitment?* — the mechanic, the launch period, the start ritual, how validators work (3–5 min)
2. Script new video 2: *How the sponsorship model works* — the GoFundMe mechanic, voluntary contributions, why the mentor economy works (3–5 min)
3. Script new video 3: *Why Search Star exists* — garbage culture problem, conscientiousness as signal, beauty/grace/truth (recut from existing trust-as-love.mp4 if usable)
4. Retire or archive `seven-feeds-of-death.mp4` and `SearchStar_Trust_as_Validation.mp4`
5. Update homepage video section with new videos
6. Update `public/` with new mp4 files

**Deliverable:** Video content is accurate and reinforces the product rather than describing a retired architecture.

**Session prompt keywords:** "Phase 10 — video scripts, content update"

---

## Per-session prompt template

Every new chat working on this project should begin with this context block:

```
Search Star v3 build — [Phase N: description]

GitHub repo: ArchonGraceland/Search-Star (private)
PAT: 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
Branch: v3 (deploy target)
Supabase project ID: qgjyfcqgnuamgymonblj
Vercel project ID: prj_4naGexGhfiklNAPntvurIkFWH5Nh
Team ID: team_3QGOH2gaQBtEyFzCX7wtsP7X
Git author email: dverchere@gmail.com (required — other emails break Vercel)

Stack: Next.js 16 App Router, TypeScript, Tailwind v4, Supabase, Vercel
Design system: Project Graceland — Crimson Text headings, Roboto body, navy #1a3a6b, 3px border-radius
Spec: searchstar.com/spec (v3.0, April 2026) — authoritative

Current state: [describe what was completed in the previous session]
This session goal: [Phase N deliverable from the build plan]

Key decisions from spec:
- 90-day streaks, 2 per year, ~$5K max annual earning per practitioner
- 14-day launch period before each streak
- Private-by-default validator feed (no public feed, no likes, no follower counts)
- Voluntary contributions only: 90% tip rate, 50% suggested tip size, fully removable
- Split: 5% Search Star, 23.75% each to Mentor/Coach/Community Builder/Practice Leader
- Trust expressed as growth stage (Seedling→Mature), never a number
- No Activate, no platform query economy, no sovereign data architecture
```

---

## Build order rationale

Phases 0–2 first because nothing else can be built without a clean foundation and working auth. Phase 3 before Phase 4 because the validator feed depends on commitment posts existing. Phase 5 before Phase 6 because contribution routing depends on the sponsorship flow existing. Phase 7 can technically be built any time after Phase 3. Phase 8 is cleanup that happens naturally as other phases complete. Phase 9 is a separate product surface that doesn't block anything. Phase 10 is independent and can happen in parallel.

**Critical path:** Phase 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8
**Can be parallel:** Phase 9, Phase 10

---

## Definition of done for v3

- [ ] Homepage describes the actual product
- [ ] New user can onboard: define practice → invite validator → set visibility
- [ ] Practitioner can complete the full commitment lifecycle: declare → launch → start ritual → log sessions → complete
- [ ] Validator feed is private, chronological, no engagement metrics
- [ ] Validator can confirm sessions with quality note
- [ ] Sponsor can pledge during launch window
- [ ] Payout triggers on completion, contribution prompt appears with correct split
- [ ] Mentor relationships work, contribution income routes correctly
- [ ] Trust record computes and displays as growth stage
- [ ] Trust record is private by default, shareable on user's terms
- [ ] Dashboard reflects current state accurately
- [ ] No orphaned pages, dead links, or references to retired features
- [ ] Institutional portal can enroll members and allocate sponsorship budget
- [ ] Video content reflects the product

Total estimated sessions: 10–12 working chats of 2–4 hours each.
