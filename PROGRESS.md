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

#### Phase 1b — Profile Builder ✅
- [x] Multi-step profile builder at /profile-builder (7 steps: identity, financial, presence, skills, interests, pricing, review)
- [x] Identity collection (name, handle, tagline, location, age)
- [x] Financial standing as age-cohort percentiles (no raw dollars) with all 5 metrics from spec
- [x] Presence Composite self-assessment (Rizz/Vibe/Drip sliders, 0.85 confidence discount shown)
- [x] Skills with level selection (beginner/intermediate/advanced/expert) + add/remove
- [x] Interests across 3 domains (athletic/social/intellectual) + add/remove
- [x] Access tier pricing with suggested ranges from spec and market comps
- [x] Review step showing full profile summary before creation
- [x] Profile number assignment (SS-XXXXXX)
- [x] Saves to Supabase profiles table with full JSON-LD in profile_json column
- [x] Sets onboarding_completed flag
- [x] "Build Profile" link added to dashboard sidebar
- [x] Auth middleware protects /profile-builder
- [x] Supabase migration: added tagline, age, profile_json columns
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
**Status: ⚪ NOT STARTED**

Earnings, stats, and profile rank.

- [ ] Total earnings display (lifetime + current period)
- [ ] Revenue breakdown by source (platform, tier, feed)
- [ ] Settlement projection (next payout date + amount)
- [ ] Profile rank (Presence percentile, trust score, query volume)
- [ ] Feed subscriber count
- [ ] Referral earnings breakdown (spec 5.5)

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

---

## Key Decisions

1. **Next.js App Router** over Pages Router — spec calls for Next.js, App Router is the current standard
2. **Supabase Auth** for MVP — simpler than DID:web for initial launch, upgrade path to full W3C identity later
3. **Static pages preserved** — spec, profile sample, create, setup pages migrate as-is into `/app` routes
4. **Design system: Project Graceland** — Crimson Text headings, Roboto body, navy #1a3a6b, 3px border-radius, institutional restraint
5. **Guided form over AI-only** — Profile builder uses a guided multi-step form for reliability; AI-assisted creation (Anthropic API) planned as enhancement
6. **Profile number is random** — SS-XXXXXX assigned randomly at creation; sequential assignment deferred until directory registration API

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
