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
**Status: 🟡 NEARLY COMPLETE (pending Vercel framework config)**

Convert to Next.js + Supabase, deploy the shell.

- [x] Create Supabase project for Search Star (qgjyfcqgnuamgymonblj, us-east-1)
- [x] Scaffold Next.js app with App Router (Next.js 16, TypeScript, Tailwind v4)
- [x] Set up Project Graceland design system (globals, fonts, variables)
- [x] Migrate static pages into Next.js (spec, profile, create, setup → /public)
- [x] Connect Supabase Auth (email sign-up/login)
- [x] Create core database tables:
  - [x] `profiles` (extends directory schema from spec 7.3)
  - [x] `earnings_ledger` (from spec 4.5, includes referral_share from 5.5)
  - [x] `messages` (Marketing tier + feed items + system notifications)
  - [x] `feed_subscriptions` (from spec 4.8)
  - [x] `support_tickets` + `ticket_messages` (admin support system)
  - [x] `referrals` (referral validation from spec 5.5)
  - [x] `validator_stakes` (from spec 5.1)
  - [x] `platform_accounts` (API access + prepaid credits)
- [x] Set up Row Level Security policies (all 9 tables)
- [x] Auto-profile-creation trigger on user signup
- [x] Configure Vercel deployment (env vars set)
- [ ] **Set Vercel framework to Next.js** (dashboard setting, pending)
- [x] Landing page, login, signup, auth callback
- [x] Dashboard layout with sidebar (Dashboard, Feed, Account)
- [x] Dashboard, Feed, Account page shells
- [x] Auth middleware protecting dashboard routes

### Phase 1 — Onboarding
**Status: ⚪ NOT STARTED**

New user experience: learn, estimate earnings, create profile.

#### Phase 1a — Earnings Estimator + Walkthrough
- [ ] Earnings estimator calculator (interactive, based on profile attributes)
- [ ] "How it works" walkthrough (three tiers, content feed, hosting explained)
- [ ] Responsive design matching Graceland system

#### Phase 1b — Profile Builder
- [ ] AI-powered profile creation flow (Anthropic API integration)
- [ ] OR guided form that collects profile data and generates JSON-LD
- [ ] Profile number assignment (SS-XXXXXX)
- [ ] Directory entry creation in Supabase
- [ ] Access tier pricing setup

### Phase 2 — Messaging Feed
**Status: ⚪ NOT STARTED**

Unified inbox: marketing messages, content feed, subscriptions.

#### Phase 2a — Feed UI + Message Schema
- [ ] Unified feed view component
- [ ] Message type visual treatments (marketing, feed, system)
- [ ] Block sender functionality
- [ ] Subscription management from feed

#### Phase 2b — API + Real-time Delivery
- [ ] Marketing tier message delivery API
- [ ] Content feed subscription wiring
- [ ] Real-time updates (Supabase Realtime)
- [ ] Message read/unread state

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
| Mar 31, 2026 | Phase 0 | Created progress document, pulled latest spec v0.5 |
| Mar 31, 2026 | Phase 0 | Created Supabase project (qgjyfcqgnuamgymonblj) |
| Mar 31, 2026 | Phase 0 | Scaffolded Next.js app, Graceland design system, Supabase client/server config |
| Mar 31, 2026 | Phase 0 | Built landing page, login, signup, auth callback, dashboard layout + shells |
| Mar 31, 2026 | Phase 0 | Applied database migration: 9 tables, indexes, RLS, triggers |
| Mar 31, 2026 | Phase 0 | Merged Next.js app into main repo, pushed to GitHub |
| Mar 31, 2026 | Phase 0 | Set Vercel env vars, fixed prerender errors, fixed CSS import order |
| Mar 31, 2026 | Phase 0 | Build succeeds — pending Vercel framework preset change to Next.js |

---

## Key Decisions

1. **Next.js App Router** over Pages Router — spec calls for Next.js, App Router is the current standard
2. **Supabase Auth** for MVP — simpler than DID:web for initial launch, upgrade path to full W3C identity later
3. **Static pages preserved** — spec, profile sample, create, setup pages migrate as-is into `/app` routes
4. **Design system: Project Graceland** — Crimson Text headings, Roboto body, navy #1a3a6b, 3px border-radius, institutional restraint

---

## Notes

- Git token available for direct pushes from chat sessions
- Vercel auto-deploys on push to main
- Supabase MCP connected for database operations
- Spec is the source of truth — keep spec.html updated as we build
