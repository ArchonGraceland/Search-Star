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
**Status: 🔵 IN PROGRESS**

Convert to Next.js + Supabase, deploy the shell.

- [ ] Create Supabase project for Search Star
- [ ] Scaffold Next.js 15 app with App Router
- [ ] Set up Project Graceland design system (globals, fonts, variables)
- [ ] Migrate static pages into Next.js (spec, profile, create, setup, index)
- [ ] Connect Supabase Auth (email sign-up/login)
- [ ] Create core database tables:
  - [ ] `profiles` (extends directory schema from spec 7.3)
  - [ ] `earnings_ledger` (from spec 4.5)
  - [ ] `messages` (Marketing tier + feed items + system notifications)
  - [ ] `subscriptions` (feed subscriptions from spec 4.8)
  - [ ] `support_tickets` (admin support system)
  - [ ] `referrals` (referral validation from spec 5.5)
  - [ ] `validator_stakes` (from spec 5.1)
- [ ] Set up Row Level Security policies
- [ ] Configure Vercel deployment (convert from static to Next.js)
- [ ] Deploy and verify at searchstar.com

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
