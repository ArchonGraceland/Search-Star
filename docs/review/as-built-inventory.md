# Search Star — As-Built Inventory

**Generated:** 2026-04-24
**Production commit:** `f414a0e` (f414a0eb5de76e217c09a18910940445c817c7d6)
**Production deploy:** `dpl_8P7rFDNKMPXMHGZw2nVabexwg2E3` — READY on `www.searchstar.com`
**Supabase project:** `qgjyfcqgnuamgymonblj`
**Method:** Deep end-to-end trace of every live user-facing flow, cross-referenced with production schema, RLS policies, and live route probes.

Scope rule: ignore `.bak`, commented-out code, and anything unreachable from a live route. Orphans go in a separate list at the end.

---

## Production schema snapshot (17 tables)

| Table | Rows | RLS | Purpose |
|---|---|---|---|
| `profiles` | 22 | ✓ | User profile, extends `auth.users`. Has `trust_stage`, `mentor_role`, `visibility`, `institution_id`, `pending_validator_email/note` (v3 leftovers). |
| `skill_categories` | 12 | ✓ | Lookup table: 12 categories (public read). |
| `practices` | 2 | ✓ | Named practice per user. `label` in (skill/craft/pursuit). FK to `skill_categories`. |
| `commitments` | 2 | ✓ | Active commitment. Status in (active/completed/vetoed/abandoned). Has `room_id`, `started_at`, `target_payout_amount` (default 2500). **Decision #8**: no `launch_ends_at`; declaration = start. |
| `rooms` | 1 | ✓ | Persistent chat space. `creator_user_id`, `dormancy_status` (active/dormant). |
| `room_memberships` | 2 | ✓ | User ↔ room. State in (active/lingering/exited). Governs read access across room tables. |
| `room_messages` | 78 | ✓ | The chat stream. Was `commitment_posts` pre-Decision #8. `room_id` required, `commitment_id` nullable. `message_type` enum (practitioner_post / companion_response / companion_welcome / companion_milestone / companion_moderation / sponsor_message / system). `is_session` boolean. `transcript` for audio. |
| `message_affirmations` | 0 | ✓ | Sponsor "good job" clicks on session-marked messages. `message_id` + `sponsor_user_id`. In Realtime publication with REPLICA IDENTITY FULL. |
| `sponsor_invitations` | 1 | ✓ | Email-keyed invitations with `invite_token`, status (pending/accepted/declined/expired). |
| `sponsorships` | 1 | ✓ | Pledges. Status (pledged/released/vetoed/refunded). Has Stripe IDs, `access_token`, `released_at`, `vetoed_at`, `veto_reason`, `message`, `pledged_notified_at`. |
| `donations` | 0 | ✓ | 5% voluntary at release. Separate Stripe PaymentIntent from sponsor pledge. Status (pending/succeeded/failed/canceled). |
| `trust_records` | 22 | ✓ | Computed Trust per user. Stage + depth/breadth/durability scores + `completed_streaks`, `share_enabled`. |
| `companion_rate_limit` | 0 | ✓ | Per-user hourly Companion invocation count. |
| `institutions` | 0 | ✓ | Institution account. |
| `institution_memberships` | 0 | ✓ | User ↔ institution. |
| `support_tickets` | 0 | ✓ | Admin-facing support ticket. |
| `ticket_messages` | 0 | ✓ | Messages on a ticket. |

**Realtime publication (`supabase_realtime`):** `room_messages`, `message_affirmations`. Nothing else.

## RLS policy shape (36 policies total)

Key patterns:
- **Room-scoped read**: `rooms`, `commitments`, `room_messages`, `room_memberships`, `sponsorships`, `message_affirmations` all gate SELECT on `user_id IN room_memberships WHERE room_id = X AND state='active'`. `room_memberships` policy is simplified (non-recursive, `own rows read` only) — Session 4.3 fix.
- **Owner full access**: `practices`, `profiles`, `trust_records`, `commitments` for the practitioner's own rows.
- **Public read**: `profiles`, `practices`, `skill_categories`, `trust_records` (controlled by profile `visibility`).
- **Sponsor write**: `sponsorships: insert by self against active commitment`, `room_messages: sponsor inserts sponsor_message`, `message_affirmations: active sponsor inserts`.
- **Admin paths**: `support_tickets` and `ticket_messages` admin policies; admin-detection is app-layer via `supabase_admins` (not inspected yet).

---

## Route inventory

Below, every route file grouped by user-facing flow. For each: purpose, auth gate, DB reads/writes, external calls, what renders or returns.

### Block A — Sponsor flow + Stripe

Nine files: two sponsor-facing pages, five API routes, the Stripe webhook, and `src/lib/stripe.ts`. This block is the money path — from an invitation email through pledge authorization, the 90-day hold, release-or-veto at day 90, and the optional 5% voluntary donation on release.

**Lib — `src/lib/stripe.ts` (53 lines).** Lazy factory `getStripe()` that throws if `STRIPE_SECRET_KEY` is unset. Exports `MIN_PLEDGE_USD = 5`, `DEFAULT_DONATION_RATE = 0.05`, `pledgeDollarsToCents()`, `coerceDonationRate()` (clamps 0..1, returns default on NaN), `donationDollarsToCents()`. No Stripe API calls from here — this file is only the client factory plus money arithmetic.

| File | Purpose | Auth gate | DB reads | DB writes | External calls | Returns |
|---|---|---|---|---|---|---|
| `src/app/sponsor/[commitment_id]/[token]/page.tsx` | Grace-period redirect for the retired anonymous sponsor-feed surface. Resolves `access_token` → commitment → `room_id` and 307s to `/room/[id]`. | None (token-gated via DB lookup); downstream `/room/[id]` is auth-gated | `sponsorships (commitment_id, access_token)`, `commitments.room_id` | none | none | `redirect(/room/[id])` or `notFound()` |
| `src/app/sponsor/invited/[invite_token]/page.tsx` (917 LOC, client) | Invited-sponsor landing surface. Four-step flow: `auth_gate` → `details` → `payment` → `success`. Fetches invitation metadata (no auth), checks Supabase session, POSTs `/api/sponsorships`, mounts `StripePaymentForm` with returned `client_secret`. | Page itself is public (token is the gate). Middleware deliberately excludes `/sponsor/invited` from protected prefixes so the client-side auth-gate with `?returnTo=` works (see middleware.ts comment). The POST to `/api/sponsorships` is auth-gated server-side. | via API only | via API only | `/api/sponsors/invite/lookup`, `/api/sponsorships` | Rendered UI only |
| `src/app/api/sponsorships/route.ts` GET (362 LOC file) | Public commitment snapshot for the sponsor landing page. `service_role` client. Returns practice name, status, computed `streak_ends_at = started_at + 90d`, `total_pledged`, `pledge_count`. **`launch_ends_at` is hardcoded `null` — field retained as a legacy-caller compat key.** | None | `commitments.{id,status,started_at,user_id, practices(name)}`, `profiles.display_name`, `sponsorships.pledge_amount WHERE status IN ('pledged','paid')` | none | none | 200 JSON or 400/404 |
| `src/app/api/sponsorships/route.ts` POST | **The invitation-only pledge creator.** Tokenless POSTs return 410 Gone. Validates invite → matches authed email (case-insensitive) → creates Stripe Customer + manual-capture PaymentIntent with `setup_future_usage='off_session'` → inserts `sponsorships` row → upserts `room_memberships` (sponsor joins the room) → marks `sponsor_invitations` accepted. **Pledge confirmation emails are NOT sent here** — fired from the webhook when the card actually authorizes. | SSR `getUser()` + `invite_token` email match | `sponsor_invitations`, `commitments(id,status,user_id,room_id,practices(name))`, `profiles.display_name` | `sponsorships INSERT status='pledged'`, `room_memberships UPSERT state='active'` (non-fatal on failure), `sponsor_invitations UPDATE status='accepted'` (non-fatal) | `stripe.customers.create`, `stripe.paymentIntents.create(capture_method='manual')`, on insert failure `stripe.paymentIntents.cancel` | `{ id, client_secret, room_id }` or 401/403/404/409/410/502 |
| `src/app/api/sponsorships/[id]/route.ts` GET | Practitioner-only listing of sponsors on a commitment. SSR `getUser()` then `createServiceClient()` for reads (per the `0710ce4` writeup noted inline). | SSR `getUser()` + ownership check | `commitments WHERE id=$1 AND user_id=auth.uid`, `sponsorships WHERE commitment_id=$1` | none | none | `{ commitment_id, commitment_title, sponsorships[], total_pledged }` |
| `src/app/api/sponsorships/[id]/action/route.ts` POST (440 LOC) | **The release/veto action.** Authenticated by `sponsorship.access_token` — sponsors don't need SS accounts to release. **Release branch:** guards `commitment.status='active'` + `now >= started_at+90d`. Captures the held PI (fails hard if capture fails), updates sponsorship `status='released', released_at=now`, checks remaining `status='pledged'` rows, if none flips commitment to `'completed'` and invokes `computeAndPersistTrust()` (wrapped; failure doesn't roll back release), then optionally fires off-session donation PI + inserts `donations` row. **Veto branch:** cancels the held PI (non-fatal on failure), updates sponsorship `status='vetoed'`, flips commitment to `'abandoned'`, notifies practitioner + other still-pledged sponsors via Resend. Idempotent on already-terminal status. | `access_token` match | `sponsorships, commitments(user_id,started_at,practices(name)), profiles.display_name, auth.users` | `sponsorships UPDATE status/released_at OR status/vetoed_at/veto_reason`, `commitments UPDATE status='completed'` or `'abandoned'`, `donations INSERT` | `stripe.paymentIntents.capture` (release), `stripe.paymentIntents.retrieve` + `stripe.paymentIntents.create` (donation), `stripe.paymentIntents.cancel` (veto), `resend.emails.send` | `{ok,action,released,donated,donation_amount}` or 400/404/409/502 |
| `src/app/api/sponsors/invite/route.ts` POST | Practitioner invites a sponsor by email. Mints 24-byte base64url `invite_token`, inserts `sponsor_invitations` row, sends Resend email with link to `/sponsor/invited/[invite_token]`. Guards `commitment.status='active'` + ownership + no pending duplicate to same email. | SSR `getUser()` + ownership | `commitments, sponsor_invitations (dedupe), profiles.display_name` | `sponsor_invitations INSERT status='pending'` | `resend.emails.send` (non-fatal; row persists) | `{ id, invite_token, pledge_url }` or 400/401/404/409/500 |
| `src/app/api/sponsors/invite/route.ts` GET | Practitioner lists invitations for a commitment. | SSR `getUser()` + ownership | `commitments`, `sponsor_invitations` | none | none | `{ invitations: [...] }` |
| `src/app/api/sponsors/invite/lookup/route.ts` GET | Public token lookup used by the invited-sponsor page to pre-fill copy. | None (token is the gate) | `sponsor_invitations, commitments, profiles.display_name` | none | none | Flat JSON with `commitment_title = practice_name`, computed `streak_ends_at`, `launch_ends_at: null` (retired compat key) |
| `src/app/api/stripe/webhook/route.ts` POST (423 LOC) | Stripe webhook handler. Verifies signature against `STRIPE_WEBHOOK_SECRET` using raw body. Handles four event types, dispatched by `metadata.intent_type` ∈ `{'pledge','donation'}`. Forward-only transitions; replay-safe. Nodejs runtime, force-dynamic. | Stripe signature verification | `sponsorships`, `donations`, `commitments`, `profiles`, `auth.users` | `sponsorships UPDATE pledged_notified_at` and `status='paid', paid_at=...` and `status='refunded'`; `donations UPDATE status` | `resend.emails.send` (sponsor confirmation + practitioner notification on authorization) | `{received:true}` or 400/500 (500 triggers Stripe retry) |

**Sponsorship status state machine (as built).** The allowed statuses per the DB check constraint are `{pledged, released, vetoed, refunded}`. Transitions:

```
(insert POST /api/sponsorships)
        │
        ▼
    pledged ─────────┬───────────────┬─────────────────┐
        │            │               │                 │
   action/release    action/veto     webhook.canceled  webhook.succeeded
        │            │               │ (status=pledged)│ (requires status=
        ▼            ▼               ▼                  released; see F1)
    released ─┐     vetoed        refunded           ↓ no-op
      │        │
      │        └─ webhook.succeeded ──▶ status='paid' ←── NOT IN CHECK CONSTRAINT
      │                                                       (F1 — blocking)
      │
      └─ idempotent replay returns {already:true, status}
```

**Donation status state machine.** Allowed: `{pending, succeeded, failed, canceled}`. Inserted as `'succeeded'` if Stripe confirmed synchronously in the release path, otherwise `'pending'`; webhook advances pending → succeeded / failed / canceled.

**Commitment status state machine (as observed from Block A writes).** Allowed per check constraint: `{active, completed, vetoed, abandoned}`. Action route writes `'completed'` (final release) or `'abandoned'` (veto). The enum contains `'vetoed'` but nothing in Block A writes it — only `'abandoned'` on veto. This is documented more fully when Block C inventories `/api/commitments`.

---

#### Block A — Findings

**F1. `sponsorship.status='paid'` is written by the webhook but rejected by the CHECK constraint. Blocking.**
`src/app/api/stripe/webhook/route.ts:307–310` updates `status: 'paid', paid_at: now()` on `payment_intent.succeeded` for pledges. The DB constraint `sponsorships_status_check` allows only `{pledged, released, vetoed, refunded}` — `'paid'` is not in the list. Any real release will silently fail this update (Postgres 23514); `sponsorship.status` will stay `'released'` and `paid_at` will stay NULL forever. Evidence: no row currently exists in `'paid'` status in production (`SELECT status, count(*) FROM sponsorships` → only `pledged:1`) — the path has never been exercised. Two compounding consequences:
- `src/app/api/sponsorships/[id]/route.ts:45` selects `paid_at`, and `src/app/(dashboard)/commit/[id]/sponsors/page.tsx:14` types it — the sponsors-list UI will render `null` for every released sponsorship.
- The webhook also guards `status='refunded'` transition with `terminal = ['paid', 'refunded', 'vetoed']` (`route.ts:360`). `'paid'` in the terminal set is dead logic because no row ever reaches it, and conversely a released row would incorrectly be eligible for regression to `'refunded'` since `'released'` is not in `terminal`.
Pass 3 disposition: fix. Either extend the CHECK to include `'paid'` (migration) and leave the code alone, or retire `'paid'` entirely (release IS the terminal state once capture completes; the webhook's role becomes purely a replay-safety audit and the `paid_at` column is dropped). The latter matches what the v4 spec §7 actually describes.

**F2. `room_memberships` upsert failure on pledge is non-fatal — sponsor pays and cannot see the room. Concerning.**
`src/app/api/sponsorships/route.ts:321–339`. The sponsorship row and Stripe PI are committed; the room_memberships upsert is best-effort with a console.error and no user-visible error. A sponsor whose membership insert fails (transient DB error, race, etc.) has authorized a card hold on a commitment they cannot see, read, affirm on, or veto. Pass 3 disposition: fix. Either make the membership insert part of the same transactional window (it's not currently — these are sequential Supabase calls), or surface a specific follow-up state to the client and add an idempotent repair cron. The comment in the code acknowledges this: "a later repair job can reconcile" — no such repair job exists in Block A or in any cron.

**F3. `donations.sponsor_id` is actually a `sponsorship_id`. Nit (naming).**
`src/app/api/sponsorships/[id]/action/route.ts:264` — `sponsor_id: sponsorship.id` inserts a sponsorship UUID into a column whose name suggests it references `profiles.user_id` or similar. The foreign key (if one exists) presumably points at `sponsorships.id`. Column name is misleading for anyone reading the DB without the code at hand. Pass 3 disposition: document in the schema snapshot; renaming requires a migration + code change and is not worth it.

**F4. `donation_rate` column defaults to 0.05 but the action-route insert does not set it. Concerning.**
Schema probe shows `donations.donation_rate` defaults to `0.05`, but `src/app/api/sponsorships/[id]/action/route.ts:262–270` does NOT include `donation_rate` in the insert payload. The insert relies on the DB default. That works — but any future sponsor who picked a custom rate (e.g. 0.10 or 0.03 via the `donation_rate` body param) will have their rate silently overridden to 0.05 in the persisted `donations` row. The `rate` variable is computed on line 207 and used for `donationDollarsToCents()` on line 236 to derive the Stripe charge amount, so the charge is correct; only the persisted rate is wrong. This makes donation analytics structurally misleading. Pass 3 disposition: fix. Add `donation_rate: rate` to the insert.

**F5. Release branch computes `streak_ends_at = started_at + 90d` per-caller, in three routes. Nit.**
`src/app/api/sponsorships/route.ts:60`, `src/app/api/sponsorships/[id]/action/route.ts:104`, `src/app/api/sponsors/invite/lookup/route.ts:52` all repeat the same arithmetic. No shared helper. Drift risk is low (90d is fixed), but if the streak duration ever becomes per-commitment or per-tier, four sites need coordinated edits. Pass 3 disposition: defer or consolidate into a single helper (`computeStreakEndsAt(startedAt)` in `src/lib/commitments.ts`).

**F6. Practitioner notification email uses `/commit/${commitment.id}/sponsors` while the sponsor email uses `/room/${room_id}`. Nit — consistency.**
`src/app/api/stripe/webhook/route.ts:213` directs the practitioner to the dashboard sponsors page (fine). `route.ts:171` directs the sponsor to `/room/${commitment.room_id}` (also fine — Decision #8). Just noting the split audience is intentional. No action.

**F7. `commitment.status='abandoned'` is written but the CHECK also allows `'vetoed'`. Concerning — documented drift.**
`src/app/api/sponsorships/[id]/action/route.ts:352` writes `status: 'abandoned'` on veto; `src/app/api/sponsorships/route.ts:199` rejects pledges if `commitment.status !== 'active'` — so an 'abandoned' commitment correctly stops taking pledges. But the CHECK enum includes `'vetoed'` as a valid commitment status and nothing writes it. Either `'vetoed'` is dead (remove from the enum in a migration, retire the idea of the commitment-level "vetoed" distinction) or there's an intended design where a veto-during-active distinguishes from a natural abandonment (never implemented). The spec §7 uses "veto" for the sponsor action and "abandoned" as the resulting commitment state, so the code matches the spec — the CHECK has a stranded value. Pass 3 disposition: drop `'vetoed'` from the commitments status enum, OR wire it in and document where the distinction matters. Defer until Pass 2 confirms v4 spec §7 is explicit on this.

**F8. Access-token release flow has no replay-window guard beyond the idempotent status check. Concerning (security hygiene).**
The `access_token` is a 24-byte secret mailed to the sponsor. Lines 63–68 of the action route treat it as bearer auth and return `{already:true, status}` on a repeat release. There is no check for (a) link age (a token from a leaked 2024 email still works), (b) IP/UA change, or (c) a one-time nonce. For a flow that captures money, this is worth flagging even though the current UX requires it. Pass 3 disposition: document as intentional v4 behavior (spec does not require a nonce), note that a stolen inbox is equivalent to a stolen release signature, consider expiring `access_token` after 30 days post-release.

**F9. Stripe signature verification tolerance is Stripe's default. Nit.**
`src/app/api/stripe/webhook/route.ts:38` uses `constructEvent(rawBody, signature, secret)` without a tolerance override. Stripe's default is 300s. Non-issue in practice; flagging only because webhook hardening reviews sometimes ask. No action.

---

## Pass 2 reconciliation — scope-correction note

**Date:** 2026-04-24
**Status:** Pass 2 did not execute. The handoff prompt assumed inputs that do not exist.

### What the Pass 2 handoff assumed

The handoff prompt for Pass 2 described the starting state as:

- Pass 1 complete across 8 commits ending at `276aa2e`
- Inventory doc containing production schema, full RLS summary, route inventory for all 4 blocks (A–D), and 31 numbered findings F1–F31
- 613-line document ready to reconcile against the canonical marketing docs

### What is actually in the repo

- The latest commit on `main` is `1fd87a2` — not `276aa2e`. No commit `276aa2e` exists anywhere in `git log --all`.
- The inventory doc is **51 lines**. It contains the schema snapshot and RLS shape only. No route inventory, no F-findings catalog.
- The `1fd87a2` commit message is explicit: "Partial Pass 1 of a three-pass repo vs spec reconciliation... Scope remaining for Pass 1: practitioner/sponsor/Companion/admin/institution route flows, API inventory, lib modules, components."

The Pass 2 handoff was written speculatively against an imagined completed Pass 1 that did not get committed.

### A substantive finding that surfaced anyway

While verifying the handoff's assumptions, one real reconciliation finding became visible without needing the full Pass 1 inventory:

**The v3.0 spec HTML pasted into the Pass 2 handoff context is stale.** The repo's `public/spec.html` is already at v4.0. Commit `75c7d0b` (2026-04-22) — "docs(spec,roadmap): propagate Decision #8 through v4 public docs" — rewrote both canonical marketing docs against the v4 room-model architecture. The current spec:

- Has a new §0 Terminology block that explicitly marks Validator, Validator circle, Launch period, and Start ritual as retired
- Renames §4.2 to "Commitments Happen Inside Rooms" and §4.3 to "Sessions, Session-Marks, and Affirmations"
- Renames §5.4 to "The Room Chat Stream"
- In §6.4, replaces validator-witnessing language with sponsors as the witnesses ("Sponsors Who Deliver")
- Collapses the §9 sponsorship model to a single voluntary 5% donation at release (§7.7), retiring the four-way mentor split
- Has a new §8 AI Companion section
- Marks §10 Institutional Sponsorship as deferred in §10.2 with a standing principle in §10.1
- Adds a new §14 "Product as Built" section documenting deviations between spec and code
- Documents the v4.1 role excision milestone in the §13 roadmap

The v3.0 spec the handoff asked Pass 2 to reconcile against was pre-`75c7d0b` and no longer reflects what is served at searchstar.com/spec. The heavy Category (D) blocks the handoff anticipated — R2 (14-day launch period retirement), R3 (validator feed retirement), R5 (mentor role retirement) — have already been reconciled in the spec itself.

### Implication for Pass 2

Pass 2's reconciliation method depends on Pass 1's F-findings and route inventory as the evidence it pairs spec claims against. Without those, the available options were:

- **(a) Do Pass 1's remaining 80% inside Pass 2.** Defeats the three-pass structure; produces a merged pass that can't cleanly hand off.
- **(b) Reconcile loosely against code surface reads.** Produces low-confidence findings without the evidence chain Pass 1 is meant to establish.
- **(c) Stop and flag.** Preserves the structure and makes the scope problem visible.

This note is option (c). No R1–R9 blocks were written.

### Residual reconciliation work still needed

Even with the v3→v4 spec migration already done at `75c7d0b`, genuine drift between the v4 spec and the code almost certainly exists and is worth cataloguing — but the right target is *v4* spec claims vs code, not the v3 spec claims the handoff was written against. Candidate areas to watch once Pass 1 completes:

- §7 sponsorship flow vs actual `/api/sponsorships` state machine — any gaps between spec state names and DB `status` enum
- §8 Companion mechanics vs `src/lib/anthropic.ts` — whether documented behavior (no Trust writes, rate limiting, milestone triggers) matches code
- §10.2 institutional deferred — the code has `institutions` + `institution_memberships` tables and signup/dashboard pages; reconcile scope of what's live vs what the spec says is deferred
- §12.2 API target list — several endpoints listed as "v4 target"; confirm which exist
- §14 "Product as Built" — this section already documents some deviations; verify its claims match current code and flag any that have shifted since 75c7d0b

### Recommended next-session scope

Finish Pass 1. Route flows for all four blocks, API inventory, lib modules, components, and the F-findings catalog. That is a full session on its own. A subsequent Pass 2 session can then reconcile the resulting F-findings against the v4 spec (not v3) with the evidence chain intact.

No code changes were made this session. No spec or roadmap edits. This note is the only addition to the inventory doc.
