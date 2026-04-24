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

### Block B — Companion

Six files: the core prompts + Anthropic factory in `src/lib/anthropic.ts`, the room pipeline in `src/lib/companion/room.ts`, the day-90 summary lib in `src/lib/companion/day90.ts`, the media helpers in `src/lib/companion/media.ts`, the three user-facing HTTP handlers (`/api/companion/reflect`, `/api/companion/day90-summary`, `/api/rooms/[id]/messages` — the last one is where the room Companion is actually triggered), the daily cron (`/api/cron/companion-milestones`), and the admin manual trigger (`/api/admin/companion/milestone`). Plus the shared `src/lib/media.ts` URL classifiers.

**Lib — `src/lib/anthropic.ts` (237 lines).** Lazy `getAnthropic()` factory, one exported model constant `COMPANION_MODEL = 'claude-sonnet-4-6'`, and four system prompts as exported string constants: `COMPANION_SYSTEM_PROMPT` (per-commitment reflect), `COMPANION_LAUNCH_SYSTEM_PROMPT` (launch-window variant — retained in code, no longer invoked after Decision #8; see F10), `DAY90_SUMMARY_SYSTEM_PROMPT` (sponsor-facing completion summary), `COMPANION_ROOM_SYSTEM_PROMPT` (room-level steady participant — v1 hybrid, ~1200 words, full rationale in `docs/chat-room-plan.md §6.3`). No `SUMMARY_MODEL` constant exists despite what userMemories says.

**Lib — `src/lib/companion/room.ts` (759 lines).** Three exported functions, all null-safe on every failure path:
- `generateCompanionRoomResponse({ db, roomId, triggerMessageId, triggerKind })` — `triggerKind` ∈ `{'session','followup'}`. Writes a `companion_response` row. Loads room roster (memberships + sponsorships with pledge amounts annotated per-member), recent 50 messages as chronological history, transcribes trigger video via Whisper if present, assembles a content-block array (images → text), calls Claude with max_tokens=400.
- `generateCompanionRoomWelcome({ db, roomId, commitmentId })` — writes a `companion_welcome` row when a commitment is first declared; max_tokens=300.
- `generateCompanionRoomMilestone({ db, roomId, commitmentId, dayNumber: 30|60|90 })` — writes a `companion_milestone` row; max_tokens=200. Day-90 uses a specifically disambiguated event-line to prevent the model reaching for the "return the room to the sponsors" completion template.

All three companion_* rows are written with `user_id = practitioner.user_id` (the Companion has no account; schema requires non-null), `is_session: false`, `message_type` set appropriately so the existing room-scoped RLS reads surface them without special-casing. `MAX_ROOM_HISTORY=50`, `MAX_BODY_CHARS=1200` truncation on each message pulled into context.

**Lib — `src/lib/companion/day90.ts` (360 lines).** `summarizeCommitment(commitmentId)` returns `{ ok, summary, truncated, postCount }` or `{ ok: false, error }`; never throws. Reads the full session record (all session-marked `practitioner_post` rows for the commitment), truncates to `MAX_RECORD_CHARS=400_000` by dropping oldest sessions first, samples up to 6 images via first/last/four-evenly-distributed strategy, calls Claude with `max_tokens=2000`. Also exports `isDay90Reached(status, streakEndsAt)`: `true` iff `status==='completed'` OR `now >= started_at+90d`.

**Lib — `src/lib/companion/media.ts` (221 lines).** `buildImageBlocks(mediaUrls)` builds `ImageBlockParam[]` via URL passthrough (no fetch+base64 — Cloudinary is publicly reachable). `getOrFetchTranscript(postId, mediaUrls, cached)` transcribes via Groq Whisper-large-v3: rewrites the Cloudinary video URL to `.mp3` to use Cloudinary's server-side audio extractor (30MB video → 266KB mp3), POSTs to `GROQ_TRANSCRIBE_URL` with the audio blob, caches the result on `room_messages.transcript`. Returns `null` if no video, a placeholder string `'[video attached — transcription unavailable]'` on failure, or the transcript on success.

**Lib — `src/lib/media.ts` (38 lines).** Shared `isVideoUrl` / `isImageUrl` classifiers. Extension-based primarily, with Cloudinary `/video/upload/` and `/image/upload/` path markers as secondary signals. Handles case-insensitivity, query strings, heic/avif for iOS, avi/mkv/m4v for desktop.

| File | Purpose | Auth gate | DB reads | DB writes | External calls | Returns |
|---|---|---|---|---|---|---|
| `src/app/api/companion/reflect/route.ts` POST (361 LOC) | Per-commitment Companion reflection. Reads up to 30 most-recent session-marked `practitioner_post` rows for the commitment, inlines video transcripts into bodies, anchors on the latest post if it's `<10min` old (fresh-post window), builds image blocks from latest post only, calls Claude with `COMPANION_SYSTEM_PROMPT` and max_tokens=400. Gates on `commitment.status==='active'` only — 403 for launch/completed/abandoned. **Rate-limited: 20 calls/hour per user via `companion_rate_limit` upsert.** | SSR `getUser()` + commitment ownership + `commitment.status==='active'` + rate limit | `commitments, room_messages (practitioner_post + is_session=true), companion_rate_limit, profiles.display_name via joined practices.name` | `companion_rate_limit UPSERT call_count+1`, `room_messages UPDATE transcript` (cache writes through `getOrFetchTranscript`) | Claude `messages.create` (COMPANION_MODEL), Groq Whisper (lazy per video), Cloudinary (audio extract fetch) | `{ text }` or 400/401/403/404/429/500 |
| `src/app/api/companion/day90-summary/route.ts` POST (107 LOC) | Long-form sponsor-facing summary of the 90 days. **Dual auth**: either a sponsor's `access_token` (gated on `isDay90Reached`) OR the practitioner's Supabase session (any time — preview). Delegates to `summarizeCommitment`. **No rate limit.** | `access_token` match + day-90 reached, OR SSR `getUser()` + ownership | `sponsorships, commitments.{status,started_at}, plus summarizeCommitment's full session read` | `room_messages UPDATE transcript` (transitive via Whisper cache) | Claude `messages.create` (MAX_OUTPUT_TOKENS=2000), Groq Whisper (transitive) | `{ summary, truncated, post_count }` or 400/401/403/404/500 |
| `src/app/api/rooms/[id]/messages/route.ts` POST (304 LOC) | **The only surface that writes practitioner_post / sponsor_message rows.** Gate 1 is room-membership active; then infers `message_type` from whether caller owns `commitment_id` (if supplied). Validates `is_session` is only honored on `practitioner_post`. DB enforces one session-mark per practitioner per UTC day via `uq_room_messages_one_session_per_day` unique constraint; catches 23505 and returns a friendly 409. **Fires Companion via `after()` in two paths:** (a) `is_session=true` → session trigger; (b) non-session `practitioner_post` whose prior `companion_*` message has a `'?'` in its last 200 chars → followup trigger (see F14). | SSR `getUser()` + room_memberships.state='active' | `room_memberships, commitments` | `room_messages INSERT`, + async `after()` writes `companion_response` | Claude (async after()) | `{ message, companion_queued, companion_maybe_queued }` or 400/401/403/404/409/500 |
| `src/app/api/cron/companion-milestones/route.ts` GET (333 LOC) | Daily cron (via `vercel.json`, 09:00 UTC). Pulls all `status='active'` commitments, filters client-side to `dayNumber ∈ {30,60,90}`. For each: (1) milestone guard — count existing `companion_milestone` rows; fire if count < `expectedMilestonesSoFar(dayNumber)`; (2) day-90 only — call `summarizeCommitment` (result is **discarded**, not persisted; noted in comments as punted until sponsor traffic matters); (3) day-90 only — UPDATE `commitments SET status='completed'` gated on `status='active'` as the idempotency branch. Supports `?dry_run=1`. | `Authorization: Bearer $CRON_SECRET` | `commitments WHERE status='active'`, `room_messages COUNT` per commitment, `summarizeCommitment` internals | `room_messages INSERT companion_milestone` (via `generateCompanionRoomMilestone`), `commitments UPDATE status='completed'` | Claude (milestone + summary), Groq Whisper (transitive) | `{ ok, dry_run, processed[], candidate_count, total_active, checked_at }` or 401/500 |
| `src/app/api/admin/companion/milestone/route.ts` POST (130 LOC) | Admin manual trigger for dropping a milestone marker. Non-idempotent by design. Does NOT use `after()` (operator wants to see the result). Gates on SSR `getUser()` + `profiles.role==='admin'` — **but that column does not exist** (see F11). | SSR `getUser()` + `profiles.role==='admin'` | `profiles.role`, `commitments` | `room_messages INSERT companion_milestone` (via `generateCompanionRoomMilestone`) | Claude | `{ ok, message_id, commitment_id, room_id, day_number, commitment_status }` or 401/403/404/500 |

**Companion message_type enum writes.** Five values are written by Block B code:

| message_type | Writer | Trigger |
|---|---|---|
| `practitioner_post` | `POST /api/rooms/[id]/messages` | caller owns the supplied `commitment_id` |
| `sponsor_message` | `POST /api/rooms/[id]/messages` | caller is in the room but does not own the commitment |
| `companion_response` | `generateCompanionRoomResponse` (via `after()` from messages POST) | session-mark or followup |
| `companion_welcome` | `generateCompanionRoomWelcome` (called from commitments POST — Block C) | commitment declaration |
| `companion_milestone` | `generateCompanionRoomMilestone` (cron + admin endpoint) | day 30 / 60 / 90 |

`companion_moderation` exists in the enum and in the formatter's `who=='Companion'` branch in `loadRoomHistory()` but is **never written anywhere** — enum-only at this point. Noted in F12.

---

#### Block B — Findings

**F10. `commitments.status='completed'` is written by two independent paths with different semantics and no coordination. Blocking.**
The release-action route (`src/app/api/sponsorships/[id]/action/route.ts:167–174`) flips a commitment to `'completed'` only when the last pledged sponsorship has been released. The cron (`src/app/api/cron/companion-milestones/route.ts:286–305`) flips a commitment to `'completed'` purely on elapsed-time reaching day 90, **regardless of sponsor release state**. The cron fires first on day 90 at 09:00 UTC. Consequence: after the cron runs on day 90, any sponsor who arrives via their release email gets a 409 from the action route's `commitment.status !== 'active'` guard, because the guard expects `'active'`. The money never captures, and the release path is structurally dead from day 90 onward. Evidence: `src/app/api/sponsorships/[id]/action/route.ts:112–116` returns `{ error: 'This commitment is not currently active.' }` when `status !== 'active'`, and no other code path captures the PI. Secondary consequence: `computeAndPersistTrust` in Block A is called from the release path after the last release — but under the cron-flips-first model, it will never run for commitments that go through the full 90 days, because the release path's "all released" branch never executes. Trust recompute then only happens if the practitioner manually triggers it from `/api/trust/compute`. Pass 3 disposition: fix. Either (a) the cron should not flip status — it should write the milestone/summary and leave status='active' until releases drive the flip, or (b) the release guard should accept `status IN ('active','completed')` for day-90-or-later commitments. The first option matches the spec intent more cleanly: the commitment completes when sponsors release, not when the calendar elapses. The second preserves the cron's load-bearing "done when time is up" semantics but requires checking `released_at` on the sponsorship row rather than the commitment status at the capture site. See also F1 — the downstream `'paid'` status write will fail silently either way.

**F11. Admin-role detection reads `profiles.role` — which does not exist. Blocking.**
`src/app/api/admin/companion/milestone/route.ts:42–48` and `src/app/api/admin/tickets/route.ts:21–32` both perform `.from('profiles').select('role').eq('user_id', user.id).single()` and branch on `profile.role === 'admin'`. Production schema probe: `profiles` columns are `{institution_id, mentor_role, pending_validator_email, pending_validator_note, visibility, ...}` — no `role` column. The `.single()` returns an error, `profile` is null, `checkAdmin`/the inline check returns null, the handler returns 401/403. Zero admin endpoints reachable. No `supabase_admins` table exists either (the userMemories reference is stale). Pass 3 disposition: fix. Either add `role text` to `profiles` with a CHECK on allowed values, or create a `supabase_admins` table keyed on `user_id`. Cross-referenced in Block D (admin pages) when it's written — the `/admin/*` page layouts almost certainly have the same pattern.

**F12. `companion_moderation` is in the message_type enum but is never written. Concerning.**
`src/lib/companion/room.ts:256–261` has a formatter branch treating `message_type==='companion_moderation'` as Companion-authored in the history serializer. No code path anywhere writes a row with this type. Either the feature is deferred (the term "moderation" suggests a future cross-member intervention the Companion would make — e.g., nudging a drift in tone) or the branch is dead. Searching git history for commits mentioning "moderation" would disambiguate; scope of this pass is inventory, so it stays flagged. Pass 3 disposition: document intent (is this deferred or abandoned?) and either retire the enum value + formatter branch or land the writer. If deferred, add a short note to the chat-room-plan doc.

**F13. Room-level Companion invocations (welcome/milestone/response) completely bypass the 20-calls/hour rate limit. Concerning.**
`src/lib/companion/room.ts` makes three direct `anthropic.messages.create` calls (`route.ts:444`, `route.ts:562`, `route.ts:705`) without touching `companion_rate_limit`. The rate limit exists at `src/app/api/companion/reflect/route.ts:91–120` — the per-commitment reflection endpoint the practitioner pokes from the dashboard. A bug in the room messages POST (`after()` being fired in a retry loop from Realtime, a broken dedup, a runaway client resubmitting) that produces many session-marks or many question-reply chains would fire Companion calls as fast as the session-mark dedup allows. The UTC-day session-mark uniqueness constraint bounds session-trigger volume to once per practitioner per day, but the followup trigger has no DB-level cap (the "self-limiting" argument in the comments assumes the Companion always stops asking questions at some point — a bad prompt drift could break that). And the cron itself is gated at day-30/60/90 per commitment. So real exposure is limited today, but as the plan writer notes: "guardrail against a render-loop bug burning the Anthropic account — do not remove." The same reasoning applies to the room path. Pass 3 disposition: fix. Add a room-id keyed rate limit (e.g., 30 room-Companion calls/hour) or extend the existing `companion_rate_limit` with a second row-shape and wire the three generators to read+increment it.

**F14. The followup trigger heuristic is addressee-unaware in multi-practitioner rooms. Documented — known V2 scope.**
`src/app/api/rooms/[id]/messages/route.ts:237–287`. The heuristic finds the most recent `companion_*` message in the room whose body ends with `'?'` in the last 200 chars and fires a followup Companion reply whenever ANY practitioner in the room posts a non-session message afterward. In multi-practitioner rooms this mis-fires when practitioner A is answering a question addressed to practitioner B. Already documented extensively in `docs/bcd-arc.md` via commit `f414a0e` with three candidate fixes (dedupe by addressee id, addressee column on companion rows, or a V2 conversation-aware model). The principal has chosen fix (3) as the right target ("V1 stays as-shipped; V2 design should absorb this"). No action for Pass 3; this finding exists in the inventory so the V2 design session has a pointer to the V1 code surface.

**F15. `companion_rate_limit` upsert is racy; the comment acknowledges it. Nit.**
`src/app/api/companion/reflect/route.ts:115–120`. Two near-simultaneous POSTs can both read `call_count=N`, both upsert to `N+1`, leaving one call uncounted. The cap of 20 is generous enough that single-digit drift is harmless. Pass 3 disposition: defer or replace with an atomic RPC (`rpc.increment_rate_limit(...)` returning the new count, reject if >limit).

**F16. `/api/companion/reflect` is dead code under Decision #8 — the in-room Companion is the product surface. Concerning.**
The reflect endpoint and `COMPANION_SYSTEM_PROMPT` predate Decision #8 and predate the rooms-are-primary architecture. The per-commitment reflection panel they served has been replaced by the room-level Companion surface written by `POST /api/rooms/[id]/messages` via `after()`. `COMPANION_LAUNCH_SYSTEM_PROMPT` is even more stranded — launch is retired, the code at `reflect/route.ts:80–85` returns 403 for all non-active statuses, so the launch prompt is unreachable. Grep confirms: `COMPANION_LAUNCH_SYSTEM_PROMPT` is exported but not imported anywhere. Verify the reflect endpoint is actually reachable from the dashboard before Pass 3 — if no UI surface calls it, the whole `/api/companion/reflect` route + `COMPANION_SYSTEM_PROMPT` + `COMPANION_LAUNCH_SYSTEM_PROMPT` + fresh-post windowing logic is retired-by-architecture and can be deleted. Pass 3 disposition: depends on Block C findings — if the dashboard's Companion panel still hits this endpoint, it's live; if not, delete 361+ LOC. Block C must answer this before Pass 3 can act.

**F17. Day-90 summary result is discarded by the cron. Documented — known deferred work.**
`src/app/api/cron/companion-milestones/route.ts:263–282` and the "Flag for future work" block at the bottom of the file. Every sponsor viewing the completion page triggers a fresh Claude call (see `day90-summary` route). The cron calls `summarizeCommitment` and throws the result away. The Anthropic bill is currently taken per-page-view. Pass 3 disposition: defer until sponsor traffic justifies; add a `commitment_summaries` table or a column on `commitments` and persist on first successful generation. Well-documented; no action needed this pass.

**F18. The admin milestone endpoint is explicitly non-idempotent. Nit — known design.**
`src/app/api/admin/companion/milestone/route.ts:19–20` comment: "Non-idempotent by design. Calling twice produces two rows." Operator deletes duplicates manually. The cron path adds the guard; the admin endpoint does not. No action unless operations become noisy — at which point the cron's `existingCount >= expected` check can be lifted into a shared helper. Pass 3 disposition: defer.

**F19. userMemories references a `SUMMARY_MODEL` constant that does not exist in code. Nit — documentation drift.**
Session memory says "COMPANION_MODEL and SUMMARY_MODEL as separate exported constants (both currently `claude-sonnet-4-6`) to allow independent upgrades." Only `COMPANION_MODEL` is defined and exported in `src/lib/anthropic.ts:22`. Every Companion call site uses that one constant, including `day90.ts:169`. The day-90 summary voice IS separated by a distinct system prompt (`DAY90_SUMMARY_SYSTEM_PROMPT`) but not by a distinct model constant. Pass 3 disposition: either add `export const SUMMARY_MODEL = COMPANION_MODEL` and wire `day90.ts` + `day90-summary/route.ts` to it (so the two voices can be independently upgraded per the original intent), or update the userMemories record to reflect the actual as-built state. The code is consistent today; only the memory is drifted.

---

### Block C — Dashboard, trust, support, room, commit, onboarding, trust APIs

Thirty-four files grouped across six surfaces. This is the largest block by LOC (~6,800 total) but much of it is UI-layer routing; the state-machine weight lives in the commitment lifecycle routes, the room write surface (already covered in Block B), the trust compute pipeline, and the profile/visibility writes. The page-level routes are mostly thin — redirect stubs (`/commit/[id]*`, `/log`), public views (`/trust/[userId]`, `/sponsor/...` already in Block A), or server-component readers that delegate to libs.

**Libs.**

| File | Purpose |
|---|---|
| `src/lib/supabase/server.ts` (37 LOC) | Exports `createClient()` — SSR cookie-bound anon client for `getUser()` — and `createServiceClient()` — service-role key, bypasses RLS, used for all data reads/writes after auth. The "getUser via SSR, data via service client" pattern is the load-bearing workaround for the `@supabase/ssr` JWT-propagation issue documented in commits `0710ce4 / 1dccc46 / 501d976 / 0f28db9`. Every route that follows this pattern is safe under the bug; the two routes that don't (see F24) are not. |
| `src/lib/supabase/client.ts` (8 LOC) | Browser client for `'use client'` pages. Uses anon key + cookies. |
| `src/lib/stage.ts` (46 LOC) | Post-Decision-#8 stage resolver. Three states: `{step:1}` (no practice), `{step:2}` (practice, no active commitment), `{step:3, commitmentId, roomId}` (active commitment). Called by `/start` router and middleware-adjacent logic. Clean. |
| `src/lib/trust-compute.ts` (455 LOC) | `computeTrustForUser(db, userId)`, `computeAndPersistTrust(db, userId)`, plus pure helpers (`sponsorCountFactor`, `sponsorDiversityFactor`, `sponsorReliabilityFactor`, `sponsorReliabilityScore`). Definition of completed-for-Trust: **every sponsorship on the commitment is `status IN ('released', 'paid')`**. Three dimensions (Depth = streak-weight sum, Breadth = distinct skill categories, Durability = calendar span oldest→newest completed). v1 calibrations explicitly notional. Read access via service client per its own comment block. |

**Page routes — server components and redirects.**

| File | Purpose | Auth gate | DB reads | DB writes | Returns |
|---|---|---|---|---|---|
| `src/app/log/page.tsx` (37 LOC) | v3 `/log` surface retired. Thin server-component router: unauth → `/login`; active commitment → `/room/[room_id]`; else → `/dashboard`. | SSR `getUser()` | `commitments WHERE user_id AND status='active'` | none | redirect only |
| `src/app/log/layout.tsx` (4 LOC) | Pass-through layout — renders `{children}` with no chrome. |
| `src/app/commit/page.tsx` (281 LOC, client) | Standalone public commitment-declaration form. Gates on SSR session + at least one `practices` row; POSTs `/api/commitments`. **Form still collects `title/description/frequency/sessionsPerWeek/startDate` though the API ignores all of them** (see F25). | Client-side `supabase.auth.getUser()` + practice check | `practices WHERE user_id` | via `/api/commitments` | Rendered form; on success redirects to `/room/[room_id]` |
| `src/app/(dashboard)/commit/[id]/page.tsx` (30 LOC) | Retired per Decision #8. Looks up `commitments.room_id` and 307s to `/room/[id]`. | SSR + ownership | `commitments WHERE id AND user_id` | none | redirect |
| `src/app/(dashboard)/commit/[id]/invite/page.tsx` (20 LOC, client) | Retired stub. `useEffect` → `router.replace('/commit/[id]')` which cascades to the room. | — | — | — | renders nothing |
| `src/app/(dashboard)/commit/[id]/sponsors/page.tsx` (177 LOC, client) | **Only remaining live page under `/commit/[id]/`.** Fetches `/api/sponsorships/[id]` and renders a sponsors table. `Sponsorship.status` is typed `'pledged' \| 'paid' \| 'refunded'` and `STATUS_BADGE` covers those three — but actual DB values are `{pledged, released, vetoed, refunded}` (F22). | Client — implicit via API | via `/api/sponsorships/[id]` | none | Rendered UI |
| `src/app/room/[id]/page.tsx` (587 LOC) | The room. v4 primary post-login surface. Server-component that loads room metadata, roster (memberships + active commitments + sponsorships for annotation), initial message history; gates on room_memberships.state='active'; hands off to `<RealtimeMessages>` + `<RoomComposer>` client children. Own chrome (compact header / roster sidebar / message stream / composer), lives outside the `(dashboard)` group. | SSR `getUser()` + membership | `rooms, room_memberships + profiles, commitments + practices, sponsorships, room_messages INITIAL PAGE` | none (children do) | Rendered room UI |
| `src/app/room/[id]/invite/page.tsx` (173 LOC, client) | Sponsor-invitation form inside the room. POSTs `/api/rooms/[id]/invite` with invitee email. | — | — | via API | Rendered UI |
| `src/app/room/[id]/realtime-messages.tsx` (452 LOC, client) | The message stream with Supabase Realtime subscription on `room_messages` + `message_affirmations`. Single channel for component lifetime (Session 4 fix — no custom retry loop, SDK handles reconnection). Primes `supabase.realtime.setAuth` at mount and re-primes on `onAuthStateChange TOKEN_REFRESHED/SIGNED_IN`. |
| `src/app/room/[id]/room-composer.tsx` (406 LOC, client) | The composer. Text + media uploads (Cloudinary), session-mark toggle, optimistic UI; POSTs `/api/rooms/[id]/messages`. |
| `src/app/room/[id]/room-message.tsx` (374 LOC, client) | Single-message card renderer. Handles practitioner/sponsor/companion styling variants, media rendering (images inline, video with controls, unknown → link), affirmation button, session-mark toggle pill. |
| `src/app/room/[id]/types.ts` (30 LOC) | Shared `MessageType`, `RoomMessageData`, `RosterLine` types used across the four room files. |
| `src/app/trust/[userId]/page.tsx` (358 LOC) | Public Trust Record view. Respects `profiles.visibility` — non-public profiles render a locked state. Uses `share_enabled` on `trust_records` as an additional gate. Not auth-gated in middleware deliberately (employers / anyone with a share link can view). | None (visibility-based) | `profiles WHERE visibility<>private AND share_enabled`, `trust_records, practices` | none | Public-facing page |
| `src/app/onboarding/page.tsx` (359 LOC) | Marketing explainer — read more fully in Block D. Not part of the account-bound flow. |
| `src/app/onboarding/practice/page.tsx` (212 LOC, client) | Step 1 of post-signup onboarding — name practice, choose label, pick category. POSTs `/api/practices`. | Client-side auth | via API | via API | UI |
| `src/app/onboarding/profile/page.tsx` (156 LOC, client) | Step 2 — `display_name`, `location`, `bio`. PATCHes `/api/profiles`. | Client | via API | via API | UI |
| `src/app/onboarding/visibility/page.tsx` (162 LOC, client) | Step 3 — choose visibility. PATCHes `/api/profiles/visibility`. See F26 for the enum mismatch. | Client | via API | via API | UI |
| `src/app/(dashboard)/layout.tsx` (36 LOC) | Dashboard shell. Builds `navLinks` from profile + metadata. **Uses `user.user_metadata?.role === 'admin'` to decide whether to show the Admin link — a third, incompatible admin-detection surface** (F27). |
| `src/app/(dashboard)/dashboard/page.tsx` (239 LOC) | v4 dashboard fallback. Redirects to `/room/[id]` if active commitment exists; otherwise shows stage + CTAs. | SSR + service | `commitments, trust_records, profiles` | none | UI or redirect |
| `src/app/(dashboard)/trust/page.tsx` (403 LOC) | Private Trust dashboard. Computes on page load via `computeTrustForUser` rather than reading persisted row. Imports collocated `<TrustControls>` (client subcomponent, `./trust-controls.tsx`) that can trigger `POST /api/trust/compute` and `POST /api/trust/share`. | SSR + service | compute pipeline | none | UI |
| `src/app/(dashboard)/trust/trust-controls.tsx` | Collocated client subcomponent of the trust page. |
| `src/app/(dashboard)/earnings/page.tsx` (202 LOC) | Earnings view: commitment / total_pledged / total_released table. **No `total_paid` column surfaced** (status `'paid'` doesn't exist in reality per F1, so `released` is the correct endpoint). Shows all statuses including `vetoed/abandoned` so practitioners see the full arc. | SSR + service | `commitments, sponsorships, practices` | none | UI |
| `src/app/(dashboard)/account/page.tsx` (58 LOC) | Account settings. Loads `display_name, bio, location, visibility`; renders form children that PATCH `/api/profiles`, `/api/profiles/visibility`; provides `POST /api/account/delete`. | SSR + service | `profiles` | via API children | UI |
| `src/app/(dashboard)/support/page.tsx` (137 LOC) | Support ticket list (user's own). Renders `<TicketForm>` client subcomponent that POSTs `/api/tickets`. | SSR + service | `support_tickets WHERE user_id` | via API | UI |
| `src/app/(dashboard)/support/[id]/page.tsx` (151 LOC) | Single ticket + thread view. Loads ticket + messages; renders `<TicketReplyForm>` client subcomponent that POSTs `/api/tickets`. | SSR + ownership | `support_tickets, ticket_messages` | via API | UI |
| `src/app/(dashboard)/mobile-nav-toggle.tsx` | Client subcomponent wrapping the layout's children with a mobile nav drawer. |

**API routes.**

| File | Purpose | Auth gate | DB reads | DB writes | External | Returns |
|---|---|---|---|---|---|---|
| `src/app/api/commitments/route.ts` POST (144 LOC) | Declare commitment. Creates room if none; else reuses "any active room the caller is a member of" (F20). Inserts `commitments WHERE status='active', started_at=now()`. Ignores legacy body fields `title/description/frequency` (logs warning). Fires `generateCompanionRoomWelcome` via `after()` iff `roomIsNew`. Lookup order: first practice by `created_at ASC` (owner assumed from single practice). | SSR `getUser()` | `practices, room_memberships` | `rooms INSERT (maybe)`, `room_memberships INSERT (maybe)`, `commitments INSERT status='active'` | Claude (async via Companion) | `{ id, room_id }` |
| `src/app/api/commitments/[id]/route.ts` GET | Commitment detail. Reads commitment + computed `sessions_logged` from `room_messages WHERE is_session=true`. | SSR + ownership | `commitments + practices, room_messages` | none | none | `{ commitment: {..., sessions_logged}, posts[] }` |
| `src/app/api/commitments/[id]/start/route.ts` POST | **Retired per Decision #8.** Returns 410 Gone. Clean stub (13 LOC). | — | — | — | — | 410 |
| `src/app/api/commitments/[id]/complete/route.ts` POST | Practitioner manually marks complete. Flips to `status='completed', completed_at=now()` gated on current `status='active'`. **This is a third independent writer** of `commitments.status='completed'` alongside the release-action route and the cron. Compounds F10/F21. | SSR + ownership | `commitments, sponsorships` | `commitments UPDATE status='completed'` | none | `{ commitment_id, total_pledged }` |
| `src/app/api/commitments/[id]/posts/route.ts` POST | v3-era session-log write path. Inserts a `room_messages practitioner_post WITH is_session=true` for the current day; 23505 → 409. **Does not fire the Companion** (unlike `/api/rooms/[id]/messages`, which does — see Block B). No live callers exist in the repo (see F28). | SSR + ownership | `commitments` | `room_messages INSERT` | none | `{ id, session_number }` |
| `src/app/api/rooms/[id]/invite/route.ts` POST (177 LOC) | Room-scoped sponsor invite. Resolves the caller's active commitment inside this room, mints invite_token, inserts `sponsor_invitations`, sends Resend email linking to `/sponsor/invited/[invite_token]`. Parallel to `/api/sponsors/invite` (Block A) with different callsite ergonomics — room UI doesn't need the commitment_id. | SSR + room membership + commitment ownership | `room_memberships, commitments, profiles, sponsor_invitations (dedupe)` | `sponsor_invitations INSERT status='pending'` | `resend.emails.send` | `{ id, invite_token, pledge_url }` |
| `src/app/api/rooms/[id]/messages/[msg_id]/affirm/route.ts` POST/DELETE (150 LOC) | Sponsor affirmation. POST inserts `message_affirmations`, DELETE removes. Eligibility: active sponsorship of the specific commitment the message belongs to — NOT just any room member. Practitioner cannot self-affirm. 23505 swallowed as idempotent. | SSR + sponsor-of-this-commitment | `room_messages, sponsorships, room_memberships` | `message_affirmations INSERT/DELETE` | none | `{ ok }` |
| `src/app/api/rooms/[id]/messages/[msg_id]/toggle-session/route.ts` PATCH (84 LOC) | Flip `is_session` on caller's own `practitioner_post`. Rules: must be practitioner_post, must be in this room, message must be owned. 23505 on the one-session-per-day constraint → 409 with readable copy. **Does NOT fire the Companion** even if the toggle introduces a new session mark. See F29. | SSR + message ownership | `room_messages` | `room_messages UPDATE is_session` | none | `{ is_session }` |
| `src/app/api/trust/compute/route.ts` POST (42 LOC) | Recompute caller's own Trust. Delegates to `computeAndPersistTrust(db, user.id)`. No admin variant. | SSR `getUser()` | (compute pipeline) | `trust_records UPSERT`, `profiles UPDATE trust_stage` | none | compute result |
| `src/app/api/trust/[userId]/route.ts` GET (46 LOC) | Public Trust read. Gates on `profile.visibility === 'private'` → 404. **Treats `'network'` identically to `'public'`** (F30). | None — visibility-gated | `profiles, trust_records` | none | none | `{ stage, depth_score, breadth_score, durability_score, completed_streaks, updated_at }` or 404 |
| `src/app/api/trust/share/route.ts` POST (53 LOC) | Enable sharing (toggle `trust_records.share_enabled=true`). Blocks private profiles (403). | SSR `getUser()` + non-private profile | `profiles` | `trust_records UPDATE share_enabled` | none | `{ share_enabled: true }` |
| `src/app/api/practices/route.ts` POST (53 LOC) | Create a practice. Validates `label ∈ {skill,craft,pursuit}` + `category_id`. Inserts via service client. | SSR `getUser()` | none | `practices INSERT` | none | `{ id }` |
| `src/app/api/profiles/route.ts` PATCH (40 LOC) | Update display_name / location / bio. **Uses the SSR client for the UPDATE itself** — no service-client fallback (F24). Bio length capped at 280 chars. | SSR `getUser()` | none | `profiles UPDATE` via SSR client | none | `{ success: true }` |
| `src/app/api/profiles/visibility/route.ts` PATCH (30 LOC) | Change visibility. **Accepts only `'public' \| 'private'` even though the CHECK constraint allows `'network'` as well** (F26). Uses SSR client for the UPDATE (same F24 exposure). | SSR `getUser()` | none | `profiles UPDATE visibility` via SSR client | none | `{ visibility }` |
| `src/app/api/contributions/route.ts` POST (15 LOC) | **Retired stub.** Returns 501. v3 four-way mentor-share split gone; v4 5% donation rebuild deferred. Comment acknowledges the dropped columns (`mentor_share / coach_share / cb_share / pl_share`). Clean. | — | — | — | — | 501 |
| `src/app/api/tickets/route.ts` POST (131 LOC) | Create ticket or reply. Uses its own cookie-auth helper (`getAuthClient`) — distinct from `createClient` in the shared lib, but equivalent SSR pattern. | SSR `getUser()` | `support_tickets, ticket_messages` | `support_tickets INSERT`, `ticket_messages INSERT` | none | `{ ticket_id }` |
| `src/app/api/account/delete/route.ts` POST (26 LOC) | Delete profile then delete auth user. **No transaction; profile delete is not checked for error before proceeding to auth deletion** (F31). | SSR `getUser()` | none | `profiles DELETE`, `auth.admin.deleteUser` | none | `{ ok }` |

**Commitment status transitions observed across Blocks A+B+C.** Allowed per CHECK: `{active, completed, vetoed, abandoned}`. Writers:

| Writer | From → To | Trigger |
|---|---|---|
| `POST /api/commitments` | (insert) → `active` | declaration |
| `POST /api/commitments/[id]/complete` | `active` → `completed` | practitioner self-service |
| `POST /api/sponsorships/[id]/action` (release branch, last pledge) | `active` → `completed` | all pledges released |
| `POST /api/sponsorships/[id]/action` (veto branch) | `active` → `abandoned` | any sponsor veto |
| `GET /api/cron/companion-milestones` (day-90 flip) | `active` → `completed` | elapsed time, regardless of sponsor state |
| — nothing writes `'vetoed'` | — | — |

Three writers produce `'completed'`, one produces `'abandoned'`, none produce `'vetoed'` (the stranded enum value from F7). The three `'completed'` writers have no coordination and independently race — F10/F21.

---

#### Block C — Findings

**F20. `POST /api/commitments` reuses any room the caller is a member of, not just their own rooms. Concerning.**
`src/app/api/commitments/route.ts:64–75`. The existing-membership lookup filters on `user_id + state='active'` with no check that the room was created by the caller. A user who joined another room as a sponsor (now always the case post-Decision #8) and then declares their first commitment will have it inserted into that other person's room. Every member of the host room suddenly sees a second commitment appear; the room's `creator_user_id` mismatch is not enforced anywhere. Not triggered today because no production user matches this shape. Pass 3 disposition: fix. Either also filter on `rooms.creator_user_id = user.id`, or explicitly create a new room for any commitment whose user is not the room creator of their first membership.

**F21. Three independent writers of `commitments.status='completed'` with no coordination. Blocking (extends F10).**
The release-action route (Block A), the practitioner-complete route (`/api/commitments/[id]/complete`), and the daily cron (Block B) all write `status='completed'` with different semantics:
- Release-action expects `'active'` → `'completed'` when the *last pledged sponsorship flips to released*. It's the only path that triggers `computeAndPersistTrust`.
- Practitioner-complete flips `'active'` → `'completed'` unilaterally, at any time, whether any sponsor has released or not. No Trust recompute, no sponsor notification.
- Cron flips `'active'` → `'completed'` at day 90 elapsed, regardless of sponsor state. No Trust recompute.

Whichever fires first locks the other two out of their expected transitions because the guards on each writer require `status='active'`. Consequence matrix:
- Practitioner self-completes on day 40 → cron's day-90 flip no-ops → sponsor releases after day 90 get 409 because `status !== 'active'` (release path dead) → money never captures, Trust never computed.
- Cron fires on day 90 first → same downstream: release path dead, money never captures.
- Sponsor releases all pledges on day 92 before cron runs → release-action correctly flips to completed and computes Trust. This is the happy path, which only works if there's exactly one sponsor and they release before 09:00 UTC.

Pass 3 disposition: fix. The spec-aligned model is "sponsors release → commitment completes." The cron should not flip status at all — it should write the milestone and the summary and leave status='active' until releases drive the flip; OR the release-guard should be widened to accept `status IN ('active','completed')` for post-day-90 commitments. F10 proposed option A as cleaner. The practitioner-complete endpoint is separately questionable — it's a spec-misaligned escape hatch and arguably should be retired in the v4 model (the commitment "completes" when sponsors say so, not when the practitioner says so).

**F22. Sponsors-page UI status type is stale and incomplete. Concerning.**
`src/app/(dashboard)/commit/[id]/sponsors/page.tsx:12` types `Sponsorship.status` as `'pledged' | 'paid' | 'refunded'`; `STATUS_BADGE` at line 17 maps exactly those three. Actual DB values per `sponsorships_status_check`: `{pledged, released, vetoed, refunded}`. Effects: (a) `'paid'` is rendered in the UI but per F1 is never reached in the DB — dead code branch; (b) `'released'` and `'vetoed'` — the actual post-day-90 and post-veto states — fall off the TS union, get a `[key: typeof value]` lookup miss in the badge map, and render as `undefined` (no background, no label, no color). Any practitioner viewing the sponsors page on a released-but-not-yet-captured commitment sees a status-less row. Pass 3 disposition: fix. Sync the union and badge map to the real DB values; audit for similar drift in `earnings/page.tsx` (which appears to get it right — uses `total_released`). See F10/F21 — the whole `'paid'` flow needs to go first.

**F23. F16 confirmed: the entire reflect/panel chain is orphan code, safely deletable. Concerning (upgrade).**
Grepped for `companion-panel` / `CompanionPanel` in `src/`: zero consumers. `src/components/companion-panel.tsx` exists with its own `fetch('/api/companion/reflect')` call, but no page imports it. Combined with F16: the chain is `(no caller) → companion-panel.tsx → /api/companion/reflect → COMPANION_SYSTEM_PROMPT + COMPANION_LAUNCH_SYSTEM_PROMPT + companion_rate_limit`. Safe to delete all of: `src/components/companion-panel.tsx`, `src/app/api/companion/reflect/route.ts` (361 LOC), the two system-prompt constants in `src/lib/anthropic.ts`, and the `companion_rate_limit` table (no other reader/writer). Pass 3 disposition: delete. Net ~500 LOC removed + one table dropped.

**F24. Two profile-write endpoints use the SSR client for their UPDATE — on the exact code path the known JWT-propagation bug affects. Concerning.**
`src/app/api/profiles/route.ts:29–31` (display_name/location/bio PATCH) and `src/app/api/profiles/visibility/route.ts:19–22` (visibility PATCH) both do `supabase.from('profiles').update(...)` against the SSR client without a service-client fallback. Every other profile write in the repo goes through `createServiceClient()` precisely to dodge the `@supabase/ssr` JWT propagation race. Under that race, the UPDATE's WHERE `user_id = auth.uid()` resolves to an unauthenticated context, matches zero rows, returns `{ error: null, count: 0 }`, and the route returns `{ success: true }` to the client — the user sees a "saved" confirmation for writes that silently no-opped. Pass 3 disposition: fix. Add `createServiceClient()` path (get user via SSR, update via service client with the confirmed `user.id`), matching the pattern used by every other profile writer.

**F25. `/commit` declaration form collects five fields the API ignores. Nit.**
`src/app/commit/page.tsx:9–13` stores `title, description, frequency, sessionsPerWeek, startDate` in component state and submits them in the POST body. `src/app/api/commitments/route.ts:41–43` explicitly notes legacy fields are soft-accepted and logged-warned; the UI is asking the practitioner to fill data that disappears. The practice name IS the commitment statement per Decision #8, but the form doesn't say so. Pass 3 disposition: rewrite the form to match v4 — prompt once for the commitment statement if any UI is needed, otherwise skip directly to "declare this commitment for your existing practice."

**F26. `/api/profiles/visibility` PATCH rejects `'network'` even though the DB accepts it. Concerning.**
`src/app/api/profiles/visibility/route.ts:15–17` allows only `'public'` or `'private'`. DB CHECK `profiles_visibility_check` allows `('private', 'network', 'public')`. The spec §3.3 describes all three visibility modes as intended product surfaces. The onboarding visibility step (`/onboarding/visibility/page.tsx`) should also be audited — if it offers `'network'`, the API will 400; if it doesn't offer it, then the DB value is unreachable by design and can be dropped from the CHECK constraint for simplicity. Either way, UI/API/schema are out of sync. Pass 3 disposition: decide — is `'network'` a v4 feature or v3 residue? If residue, drop from the enum + drop the spec §3.3 language. If feature, widen the API + add the onboarding option.

**F27. Third admin-detection surface: dashboard nav reads `user.user_metadata?.role === 'admin'`. Blocking (extends F11).**
`src/app/(dashboard)/layout.tsx:18`. This is a third mechanism — Supabase Auth's `user_metadata.role` (JWT claim) — on top of the `profiles.role` check in `/api/admin/companion/milestone`, `/api/admin/tickets`, and `src/app/admin/layout.tsx`, which all read a column that doesn't exist (F11). So the dashboard nav *might* show the Admin link to a user whose JWT has `user_metadata.role='admin'`, but clicking through takes them to `/admin` → `AdminLayout` → `profiles.role` lookup → 404 on the column → `profile` is null → `redirect('/dashboard')`. Three surfaces, zero agreement. Pass 3 disposition: pick one. The standard Supabase-shaped choice is a `profiles.role` column with a CHECK constraint; a less invasive choice is a dedicated `admins` table. Either way, all three call sites must read the same source.

**F28. `/api/commitments/[id]/posts` is an orphan — no UI calls it. Nit.**
Grep for `/api/commitments` usage across `src/`: only `/api/commitments` (the POST route for declaration) has callers. The `[id]/posts` sub-route is v3 era (the legacy `/log` session-log form). `/log/page.tsx` is now a pure redirect router. Safe to delete. Pass 3 disposition: delete alongside F23 orphan cleanup.

**F29. Toggling `is_session=true` on an earlier message does not fire the Companion. Concerning.**
`src/app/api/rooms/[id]/messages/[msg_id]/toggle-session/route.ts` flips `is_session` but does not invoke `generateCompanionRoomResponse`. The only code path that triggers the session-response Companion is `POST /api/rooms/[id]/messages` with `is_session=true` at insert time (Block B). A practitioner who posts something as chat, then later toggles it to be their session for the day, will have their session marked in the record but will not receive the Companion reply. This breaks the product promise that session-marks produce a Companion response. Exposure is low-to-medium today (toggle-session is rarer than direct session-mark on insert) but a workflow change — e.g. morning chat, afternoon decision "actually that was my session" — falls into this gap. Pass 3 disposition: fix. If the toggle moves `is_session` from `false` to `true`, fire the Companion via `after()` the same way the insert path does. Include an idempotency check (don't fire if a `companion_response` already exists for this message).

**F30. `/api/trust/[userId]` serves `'network'` visibility profiles as if they were public. Concerning.**
`src/app/api/trust/[userId]/route.ts:22–25` only filters out `private`. The spec (§3.3) describes `'network'` as "validators and their connections" — a constrained audience, not fully public. The code treats it as fully public. Either the spec is stale (if `'network'` was a v3 concept that didn't survive the validator-to-sponsor pivot) or the code is missing an authorization check. Pass 3 disposition: decide in lockstep with F26. If `'network'` is retired, remove the visibility value everywhere; if not, add the network-authorization check here (what's the real predicate — "sponsor in a shared room"? "previously sponsored the user"?).

**F31. `/api/account/delete` does not check profile-delete result before calling `auth.admin.deleteUser`. Concerning.**
`src/app/api/account/delete/route.ts:15–18`. The first delete is fire-and-forget; if FK cascade fails or the DB is transiently down, the auth user still gets deleted and the `profiles` row is orphaned. An orphaned profile row has no valid `auth.users` reference and every subsequent query that joins on `user_id` will skip it. No reconciliation job exists. Pass 3 disposition: fix. Wrap the profile delete in an error check; on failure, return a 500 and do not proceed to auth deletion. If the profile truly can't be deleted, the account cannot be deleted — the user should retry or contact support.

**F32. Admin side nav references `/feed` route that doesn't exist. Nit.**
`src/app/admin/layout.tsx:88` has `<AdminNavLink href="/feed" label="Feed" icon="💬" />`. There is no `/feed` page in the file tree (v3 feed was retired). Clicking it 404s. Pass 3 disposition: delete the link. Also — the admin nav uses emoji (`💰 💵 👥 🎫 📊 💬 👤`), which contradicts the "no emojis in UI chrome" design rule in userMemories. Defer that to a broader styling audit.

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
