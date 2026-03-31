# Search Star MVP — Development Progress

**Started:** March 31, 2026
**Spec Version:** v0.5
**Tech Stack:** Next.js 15 + Supabase + Vercel + Stripe Connect
**Repo:** github.com/ArchonGraceland/Search-Star
**Live:** searchstar.com

---

## Architecture Overview

The MVP converts the current static HTML marketing site into a full Next.js application with Supabase backend. The static spec/marketing pages are preserved as routes within the app.

### Stack
| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Next.js 15 (App Router) | Deployed on Vercel |
| Auth | Supabase Auth | Email + password, magic links |
| Database | Supabase Postgres | Directory, earnings, messages, tickets |
| Edge Functions | Supabase Edge Functions | Query proxying, feed fetching |
| Payments | Stripe Connect | Prepaid credits, settlements, subscriptions |
| AI Builder | Anthropic API (Claude) | Profile creation flow |
| Design System | Project Graceland | Crimson Text + Roboto, navy #1a3a6b, 3px radius |

---

## Build Phases

### Phase 0 — Foundation
**Status: ✅ COMPLETE**

Convert to Next.js + Supabase, deploy the shell.

- [x] Create Supabase project for Search Star (qgjyfcqgnuamgymonblj, us-east-1)
- [x] Scaffold Next.js app with App Router (Next.js 16, TypeScript, Tailwind v4)
- [x] Set up Project Graceland design system (globals, fonts, variables)
- [x] Migrate static pages into Next.js (spec, profile, create, setup → /public)
- [x] Connect Supabase Auth (email sign-up/login)
- [x] Create core database tables (9 tables with RLS)
- [x] Auto-profile-creation trigger on user signup
- [x] Configure Vercel deployment (env vars + framework preset)
- [x] Landing page, login, signup, auth callback
- [x] Dashboard layout with sidebar (Dashboard, Feed, Account)
- [x] Auth middleware protecting dashboard routes
- [x] **Deployed and verified live at searchstar.com**

### Phase 1 — Onboarding
**Status: ✅ COMPLETE**

New user experience: learn, estimate earnings, create profile.

#### Phase 1a — Earnings Estimator + Walkthrough ✅
- [x] "How it works" walkthrough at /onboarding (6-step guide: profile, tiers, payments, feed, hosting, trust)
- [x] Interactive earnings estimator at /onboarding/estimate (age, income, interests, dating/advertising toggles)
- [x] Projected earnings breakdown by tier (Public, Private, Marketing) with revenue math
- [x] PublicHeader and PublicFooter shared components
- [x] Landing page updated with "Estimate Earnings" and "Learn More" CTAs
- [x] Responsive design matching Graceland system
- [x] **Deployed and verified live**

#### Phase 1b — Profile Registration (Two-Path Flow) ✅
- [x] **Path A (primary): AI-generated profile import**
  - User copies AI prompt from /create.html, builds profile in Claude/Grok/ChatGPT
  - Pastes JSON-LD output → validates structure (@context, identity, presenceComposite)
  - Extracts profile data for directory index (name, handle, presence, skills, financials)
  - Optional endpoint URL entry for self-hosted profiles (links to /setup.html guide)
  - Pricing pre-filled from JSON accessPolicy if present
  - Confirm & register → SS-XXXXXX assigned, endpoint_url + domain saved
- [x] **Path B (fallback): Manual guided form**
  - 7-step form preserved (identity, financial, presence, skills, interests, pricing, review)
  - Nudges toward AI path with tips and links to /create.html
  - Post-registration note to self-host for full sovereignty
- [x] Path chooser screen at /profile-builder entry
- [x] Sidebar label: "Register Profile" (was "Build Profile")
- [x] Identity collection (name, handle, tagline, location, age)
- [x] Financial standing as age-cohort percentiles (no raw dollars) with all 5 metrics from spec
- [x] Presence Composite self-assessment (Rizz/Vibe/Drip sliders, 0.85 confidence discount shown)
- [x] Skills with level selection (beginner/intermediate/advanced/expert) + add/remove
- [x] Interests across 3 domains (athletic/social/intellectual) + add/remove
- [x] Access tier pricing with suggested ranges from spec and market comps
- [x] Profile number assignment (SS-XXXXXX)
- [x] Saves to Supabase profiles table with full JSON-LD in profile_json column
- [x] Saves endpoint_url and domain columns (for self-hosted profiles)
- [x] Sets onboarding_completed flag
- [x] Auth middleware protects /profile-builder
- [x] Links to /create.html (AI prompt) and /setup.html (hosting guide) throughout
- [x] **Deployed and verified live**

### Phase 2 — Messaging Feed
**Status: ✅ COMPLETE**

Unified inbox: marketing messages, content feed, subscriptions.

#### Phase 2a — Feed UI + Message Schema ✅
- [x] Unified feed view component at /feed (replaces empty shell)
- [x] Three message types with distinct visual treatments (marketing=amber, feed=navy, system=green)
- [x] Filter tabs: All, Marketing, Feed, System with live unread counts
- [x] Message expand/collapse with full content view
- [x] Read/unread state toggle (auto-marks read on expand, manual toggle in actions)
- [x] Block sender functionality (blocks all messages from sender, hides from feed)
- [x] Empty state per filter tab with contextual descriptions
- [x] Responsive layout matching Graceland design system

#### Phase 2b — API + Real-time Delivery ✅
- [x] Marketing tier message delivery API (`POST /api/messages/marketing`)
  - Validates platform API key, 500 char limit, recipient existence
  - Checks platform credit balance ≥ recipient's marketing price
  - Debits platform balance with optimistic lock
  - Credits 90/10 split to earnings ledger (owner/marketplace)
  - Delivers message to messages table
  - Returns 402 with balance info on insufficient funds
- [x] Content feed delivery API (`POST /api/messages/feed`)
  - Delivers content to all active subscribers of a publisher
- [x] Real-time updates via Supabase Realtime (messages table subscription)
- [x] Seed data API (`POST /api/seed`) — 8 demo messages + platform account
- [x] Supabase migration: Realtime enabled, RLS policies for message read/update
- [x] **Deployed and verified live**

### Phase 3 — Account Dashboard
**Status: ✅ COMPLETE**

Earnings, stats, and profile rank.

- [x] Earnings overview: three summary cards (lifetime earnings, unsettled balance, last settlement)
- [x] Settlement notice with next Monday date + $1.00 minimum payout warning
- [x] Revenue breakdown by tier (Public/Private/Marketing) with transaction counts and totals
- [x] Revenue breakdown by platform (top 5 platforms by revenue)
- [x] Profile stats: profile number, handle, display name, presence score, trust score, member since
- [x] Profile completeness bar (calculated from optional field fill rate)
- [x] Pricing display: three colored tier cards (Public, Private, Marketing) with edit link
- [x] Content feed stats (conditional: subscriber count + published items)
- [x] Quick actions: Edit Profile, View Feed (with unread count), View Spec
- [x] Seed earnings API (`POST /api/seed-earnings`) — 216 ledger entries across 3 weeks, 5 platforms, 3 tiers
- [x] JetBrains Mono for monetary amounts, green (#166534) for earnings
- [x] Empty state handling for zero earnings
- [x] **Deployed and verified live**

### Phase 4 — Admin Panel
**Status: ⚪ NOT STARTED**

System administration for operators.

#### Phase 4a — Financial + User Management
- [ ] Admin role + route protection (Supabase RLS)
- [ ] Financial dashboard (pending settlements, platform balances, revenue)
- [ ] User search + profile viewer
- [ ] Trust score manual adjustment
- [ ] Account suspend/unsuspend

#### Phase 4b — Support Tickets
- [ ] Ticket submission form (user-facing)
- [ ] Ticket queue (admin-facing)
- [ ] Status tracking (open → in progress → resolved)
- [ ] Admin response thread

### Phase 5 — Platform Portal
**Status: ⚪ NOT STARTED**

Demand-side dashboard for platforms (advertisers, recruiters, dating apps, brands) to manage their Search Star operations. Spec section 9 (v0.6).

#### Phase 5a — Platform Auth + Credit Management
- [ ] Platform signup flow (company name, billing email, company URL)
- [ ] Separate auth role (`role: 'platform'` in user_metadata)
- [ ] Company verification (domain DNS TXT or email verification)
- [ ] API key generation and rotation
- [ ] Stripe integration for credit deposits ($50 minimum)
- [ ] Auto-refill configuration (threshold + target)
- [ ] Real-time credit balance display
- [ ] Transaction history with CSV export
- [ ] Schema: add `user_id` to `platform_accounts`, add `platform_users` table or role flag

#### Phase 5b — Directory Browser + Messaging
- [ ] Searchable directory UI (mirrors GET /v1/search parameters)
- [ ] Profile query from browser (paid, debits balance)
- [ ] Marketing message composer (500 char, price preview, confirmation)
- [ ] Sent message history
- [ ] Block rate tracking (how often recipients block the platform)

#### Phase 5c — Spending Analytics
- [ ] Total spend (lifetime + by period)
- [ ] Spend breakdown by tier (Public, Private, Marketing)
- [ ] Query volume over time
- [ ] Average cost per query by tier
- [ ] Top profiles queried with spend per profile
- [ ] Credit usage forecast (30-day projection)
- [ ] Marketing message stats (sent, spend, block rate)

---

## Completed Work

| Date | Phase | What was done |
|------|-------|---------------|
| Mar 31, 2026 | Phase 0 | Full foundation: Supabase project, Next.js scaffold, Graceland design, auth, 9 tables, RLS, dashboard shell |
| Mar 31, 2026 | Phase 0 | **App live at searchstar.com** |
| Mar 31, 2026 | Phase 1a | /onboarding walkthrough + /onboarding/estimate earnings calculator |
| Mar 31, 2026 | Phase 1a | PublicHeader/PublicFooter components, landing page CTAs |
| Mar 31, 2026 | Phase 1b | /profile-builder 7-step form (identity, financial, presence, skills, interests, pricing, review) |
| Mar 31, 2026 | Phase 1b | Supabase migration (tagline, age, profile_json), sidebar nav, auth middleware |
| Mar 31, 2026 | Phase 2a | /feed unified inbox: 3 message types, filter tabs, expand/collapse, read/unread, block sender |
| Mar 31, 2026 | Phase 2b | POST /api/messages/marketing (payment validation, 90/10 split, earnings ledger) |
| Mar 31, 2026 | Phase 2b | POST /api/messages/feed (subscriber delivery), POST /api/seed (demo data) |
| Mar 31, 2026 | Phase 2b | Supabase Realtime on messages, RLS policies for read/update, **deployed and verified** |
| Mar 31, 2026 | Phase 3 | /account dashboard: earnings overview (lifetime, unsettled, last settlement), revenue breakdown by tier and platform |
| Mar 31, 2026 | Phase 3 | Profile stats, completeness bar, pricing cards, feed stats, quick actions |
| Mar 31, 2026 | Phase 3 | POST /api/seed-earnings (216 ledger entries, 3 weeks, 5 platforms, 3 tiers, 90/10 split) |
| Mar 31, 2026 | Phase 3 | **Deployed and verified live** |
| Mar 31, 2026 | Phase 1b | Refactor: two-path profile builder (AI prompt primary, manual fallback), endpoint URL registration, JSON-LD validation |

---

## Key Decisions

1. **Next.js App Router** over Pages Router — spec calls for Next.js, App Router is the current standard
2. **Supabase Auth** for MVP — simpler than DID:web for initial launch, upgrade path to full W3C identity later
3. **Static pages preserved** — spec, profile sample, create, setup pages migrate as-is into `/app` routes
4. **Design system: Project Graceland** — Crimson Text headings, Roboto body, navy #1a3a6b, 3px border-radius, institutional restraint
5. **AI prompt is primary, manual form is fallback** — Profile builder offers two paths: (A) paste AI-generated JSON-LD from any AI + register endpoint URL, or (B) manual guided form. AI path is recommended and linked to /create.html prompt and /setup.html hosting guide. Self-hosting is the spec's default; Search Star indexes only directory metadata.
6. **Profile number is random** — SS-XXXXXX assigned randomly at creation; sequential assignment deferred until directory registration API
7. **Platform Portal is post-MVP** — Spec section 9 (v0.6) defines the demand-side platform experience. Building after the owner-side MVP (Phases 0–4) is complete so the owner experience is solid before onboarding platforms. Schema implications noted: `platform_accounts` needs `user_id` column for platform login.

---

## Notes

- Git token available for direct pushes from chat sessions
- Vercel auto-deploys on push to main
- Supabase MCP connected for database operations
- Spec is the source of truth — keep spec.html updated as we build

## Infrastructure Reference

| Service | ID | Notes |
|---------|-----|-------|
| Supabase project | `qgjyfcqgnuamgymonblj` | us-east-1, Search Star |
| Supabase URL | `https://qgjyfcqgnuamgymonblj.supabase.co` | |
| Vercel project | `prj_4naGexGhfiklNAPntvurIkFWH5Nh` | search-star |
| Vercel team | `team_3QGOH2gaQBtEyFzCX7wtsP7X` | archon-graceland |
| GitHub repo | `ArchonGraceland/Search-Star` | auto-deploy on push |
| Live URL | `searchstar.com` | www redirects to bare domain |

