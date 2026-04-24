# Search Star — Pass 2 Reconciliation

**Generated:** 2026-04-24
**Pass 1 baseline:** `docs/review/as-built-inventory.md` at commit `b2eedfc` (+ `93f8214` F35 preamble annotation)
**Reconciliation baseline:** `docs/v4-decisions.md`, `docs/chat-room-plan.md`, `docs/v4-build-plan.md`
**Deliberately NOT reconciled against:** `public/spec.html` (itself a Pass 3 target), `docs/v3-build-plan.md` (v3 artifact)
**Output:** Three-state verdict per finding (MATCHES-SPEC / DEFENSIBLE-DIVERGENCE / GENUINE-BUG), severity preserved from Pass 1, one cluster block per multi-finding decision.

This is a reconciliation document, not a fix list. Pass 3 executes the fixes.

F-numbers are preserved from Pass 1. Where a finding belongs to one of the four decision clusters the session prompt named, its verdict section references the cluster block and does not re-derive the resolution independently.

---

## Cluster resolutions

Four finding clusters were flagged in the Pass 1 handoff as requiring spec-level decisions before Pass 3 can execute. Each is resolved here as a single decision that the individual findings reference. Cluster resolutions name a *direction* (one to two sentences) so Pass 3 has an anchor; they do not prescribe a patch.

### Cluster 1 — Sponsorship state machine (F1 + F10 + F21)

**Finding summary.** Three independent writers of `commitments.status='completed'` (release-action, practitioner-complete, cron), with different guards and no coordination (F10, F21). Separately, the Stripe webhook writes `sponsorship.status='paid'` which the CHECK constraint rejects — a status value that exists only in code, never in the database (F1).

**Spec anchor.** `v4-decisions.md` "Payment release is the attestation": *"A sponsor releasing payment at day 90 is saying 'I saw the work, I stayed convinced, I am paying what I pledged.' A sponsor vetoing or going silent is saying the opposite. No additional attestation layer is required because the money is the attestation."* `chat-room-plan.md` §2: *"A commitment's status simplifies: there is no `launch` state. A commitment is `active` from declaration through day 90, then either `completed` (release) or `vetoed` (veto) or `abandoned` (practitioner-initiated)."*

**Verdict cluster:** GENUINE-BUG. The spec is unambiguous that release is what drives completion. The cron's time-based status flip and the practitioner-complete endpoint are both spec-misaligned. The `'paid'` sponsorship status is a v3 two-step artifact (released-then-paid) that decision #5 collapsed into a single release event.

**Direction for Pass 3.** The release path owns the `active → completed` flip; the cron writes the milestone marker and the day-90 summary but leaves status alone; the practitioner-complete endpoint is retired or narrowed to veto/abandon semantics. On the sponsorship side, `'released'` is the terminal state after capture — retire the `'paid'` value entirely (remove the webhook's rewrite, drop `paid_at` or reinterpret it as a release-capture timestamp, drop the stranded `'paid'` from the TS union at the sponsors-page UI). Any extension to the release-guard to accept `status IN ('active','completed')` is a workaround, not the fix — the spec-aligned shape is a single writer.

### Cluster 2 — Admin role schema (F11 + F33)

**Finding summary.** Every admin-detection mechanism that reads `profiles.role` fails at query time because the column does not exist (F11). The Postgres `is_admin()` security-definer function referenced by RLS policies on `support_tickets` and `ticket_messages` has the same dependency and the same failure (F33), extending F11 into the DB layer. Net effect: admin surfaces are unreachable today, not because they're disabled but because every gate is structurally broken.

**Spec anchor.** None. The v4 docs do not discuss admin surface access. This is a silent-spec decision — the design must be made by the project, not derived from the spec.

**Verdict cluster:** GENUINE-BUG (schema gap). The gate logic was written against a column the schema never grew.

**Direction for Pass 3.** Add `profiles.role text` with a CHECK constraint (`{practitioner, admin}` or similar — the minimal set is `role IN ('admin')` nullable). This is strictly simpler than creating a new `admins` table because it repairs both F11 and F33 atomically — `is_admin()` starts working the moment the column exists, and app-layer `profiles.role === 'admin'` checks also start working. The tradeoff — schema changes carry more inertia than table additions — is outweighed by the atomicity benefit here; the rewriting of five call sites is avoidable. A Supabase MCP `apply_migration` + backfill of David's row is a one-action fix at current scale. Cluster 3 (F27/F34/F42) then rewrites call sites to read this single source.

### Cluster 3 — Role-check consolidation (F27 + F34 + F42)

**Finding summary.** Thirteen distinct call sites, four mechanisms (`profiles.role`, `user_metadata.role==='admin'`, `user_metadata.role==='platform'`, the DB `is_admin()` function), zero agreement. F27 flags the dashboard-nav `user_metadata.role` check as a third mechanism on top of F11's `profiles.role` reads. F34 documents four more `user_metadata.role` surfaces in the admin and institution flows. F42 documents the dead `user_metadata.role==='platform'` branch in the login path that redirects to a retired `/platform` route.

**Spec anchor.** None. Same silent-spec condition as Cluster 2.

**Verdict cluster:** GENUINE-BUG (code consolidation). The mechanisms don't disagree on intent — they all try to answer "is this user an admin." They disagree on where to read that bit. The fragmentation is accumulated debt, not a principled design.

**Direction for Pass 3.** Execute Cluster 2 first. Then introduce a single `isAdmin(supabase)` helper in `src/lib/auth.ts` (or equivalent) that reads the canonical `profiles.role` column through a service client, and migrate all thirteen call sites to it. Kill the F42 `/platform` branch outright — it's dead code pointing at a retired v3 surface; the collapse is to `router.push(returnTo ?? '/dashboard')`. The institution-specific "admin can view any portal" override belongs in the same helper with a second function or a second parameter — not duplicated per institution route.

### Cluster 4 — Visibility enum (F26 + F30)

**Finding summary.** The `profiles.visibility` CHECK constraint accepts `{private, network, public}`. The `/api/profiles/visibility` PATCH endpoint accepts only `{public, private}` — sending `'network'` returns 400 (F26). The `/api/trust/[userId]` GET endpoint only filters out `'private'`, meaning a `'network'` profile is served identically to a `'public'` one — the narrower audience the value implies is not enforced (F30). The onboarding visibility step also needs to be audited — Pass 1 notes this but does not probe it.

**Spec anchor.** Neither v4-decisions.md nor chat-room-plan.md nor v4-build-plan.md contains the word "network" in the visibility context. The spec docs only discuss `private` and `public` visibility, and primarily in the context of the Trust Record being private-by-default and shareable on the practitioner's terms. Decision #8's rooms-are-primary model makes the "validator circle" sense of `'network'` — which was v3's framing — structurally moot: there is no validator network to share to. The room is the social unit, and membership in a room is the access control mechanism.

**Verdict cluster:** GENUINE-BUG (schema residue). `'network'` is v3 residue. The v3 spec §3.3 described three visibility modes — private / network (validator circle-adjacent) / public — and that three-mode system lost its middle tier the moment the validator role was retired in decision #1. No v4 doc reinstates or reinterprets `'network'`. The DB CHECK accepts a value no v4 reader or writer knows how to handle; the result is exactly the drift the finding catches.

**Direction for Pass 3.** Drop `'network'` from the `profiles_visibility_check` constraint (migration), and simplify `/api/trust/[userId]` to a binary `public/private` check. Verify `/onboarding/visibility/page.tsx` offers only the two options. This is a shrinkage of the visibility surface, not an expansion — the v3 design never cleared the bar of being implemented and the v4 design has no use for the middle state.

---

## Per-finding reconciliation

Findings are listed in F-number order. Pass 1 severity preserved. Findings that belong to a cluster reference the cluster block above.

### F1. `sponsorship.status='paid'` is written by the webhook but rejected by the CHECK constraint

**Pass 1 severity:** Blocking
**Pass 2 verdict:** GENUINE-BUG
**Cluster:** 1 (sponsorship state machine)

See Cluster 1. `'paid'` is a v3 artifact — a two-step "released then paid" shape that Decision #5's simplified single-voluntary-donation-at-release model collapses. The webhook writes a value the DB was never configured to accept and the UI types a status that the DB was never configured to produce. The fix direction is retirement of `'paid'`, not migration to accept it.

### F2. `room_memberships` upsert failure on pledge is non-fatal — sponsor pays and cannot see the room

**Pass 1 severity:** Concerning
**Pass 2 verdict:** GENUINE-BUG
**Spec anchor:** `v4-decisions.md` decision #8 ("A sponsor must be in a room to back a practitioner... Every sponsor who backs a practitioner is a member of the room")

The spec is explicit that sponsorship and room membership are not independently optional — sponsorship only has meaning inside a room. A sponsor whose membership write fails after the pledge row commits is in a state the spec does not allow: financially committed, socially invisible. Pass 1's severity stands. Pass 3 should either wrap the two writes in a single transactional unit (Supabase RPC, or a service-client pattern that can rollback), or surface the failure to the client with a retry path. The comment "a later repair job can reconcile" is a promise the codebase has not kept — no such job exists.

### F3. `donations.sponsor_id` is actually a `sponsorship_id`

**Pass 1 severity:** Nit
**Pass 2 verdict:** DEFENSIBLE-DIVERGENCE (repo unchanged; naming is misleading but harmless)
**Spec anchor:** None (schema-level; no spec visibility)

The column name is misleading but the behavior is correct — the donations row references the sponsorship row whose release triggered it, which is what the spec requires. A rename is a migration for a cosmetic reward, and the column is exposed only to readers of the schema. Leave alone. If any Pass 3 migration touches the donations table for other reasons, the rename can ride along; otherwise, document and move on.

### F4. `donation_rate` column defaults to 0.05 but the action-route insert does not set it

**Pass 1 severity:** Concerning
**Pass 2 verdict:** GENUINE-BUG
**Spec anchor:** `v4-decisions.md` decision #5 ("The suggested default is 5% of the pledge amount, fully editable by the sponsor")

The spec requires that a sponsor's chosen donation rate — not the suggested default — be the one recorded. The code computes the correct charge amount (uses `rate` for `donationDollarsToCents`) but persists the default in place of the custom rate. The aggregate donation revenue number the admin dashboard reports is therefore correct at the dollar level but structurally misleading at the rate level — any sponsor who changed their rate has that choice erased from the record. Fix is one line: add `donation_rate: rate` to the insert.

### F5. Release branch computes `streak_ends_at = started_at + 90d` per-caller, in three routes

**Pass 1 severity:** Nit
**Pass 2 verdict:** DEFENSIBLE-DIVERGENCE (defer)
**Spec anchor:** `v4-decisions.md` decision #7 ("90 days") — the number is fixed

90 days is a fixed spec constant, not a tier-variable. The drift risk is small in practice. Consolidating into a helper is fine cleanup but the Pass 1 defer disposition is correct. Rank below the concerning set in Pass 3 ordering.

### F6. Practitioner notification email uses `/commit/${commitment.id}/sponsors` while the sponsor email uses `/room/${room_id}`

**Pass 1 severity:** Nit
**Pass 2 verdict:** MATCHES-SPEC
**Spec anchor:** None (implementation detail)

Pass 1 already concluded "no action" — the two audiences legitimately have different destinations. Preserving this verdict without further action.

### F7. `commitment.status='abandoned'` is written but the CHECK also allows `'vetoed'`

**Pass 1 severity:** Concerning
**Pass 2 verdict:** GENUINE-BUG (nit-level fix)
**Spec anchor:** `chat-room-plan.md` §2 ("A commitment is `active` from declaration through day 90, then either `completed` (release) or `vetoed` (veto) or `abandoned` (practitioner-initiated)")

The spec does distinguish between `vetoed` and `abandoned` — chat-room-plan.md names both as distinct terminal states. The code writes only `'abandoned'` on veto, conflating the two. The spec-aligned shape is to distinguish: sponsor-initiated end = `vetoed`, practitioner-initiated end = `abandoned`. Pass 3 should either (a) write `'vetoed'` on the sponsor veto path and leave `'abandoned'` for a future practitioner-initiated exit, or (b) retire `'vetoed'` from the enum and treat them as one state. Option (a) is spec-aligned; option (b) simplifies but drops a distinction the spec names. Recommend option (a). Note that F21 (practitioner-complete route) separately raises the question of whether a practitioner-initiated abandon endpoint is a v4 surface at all — see Cluster 1.

### F8. Access-token release flow has no replay-window guard beyond the idempotent status check

**Pass 1 severity:** Concerning (security hygiene)
**Pass 2 verdict:** MATCHES-SPEC
**Spec anchor:** `v4-decisions.md` (no nonce requirement stated)

The spec doesn't require a nonce or replay window. The bearer-token model for sponsor access is intentional — it's how the spec's "no login required for sponsors" affordance works. Pass 1's disposition — document as intentional, note that a stolen inbox equals a stolen signature — is correct. Defer any hardening until a specific threat model is named; token expiration after 30 days post-release is a reasonable belt-and-suspenders addition but not a gap against the spec.

### F9. Stripe signature verification tolerance is Stripe's default

**Pass 1 severity:** Nit
**Pass 2 verdict:** MATCHES-SPEC
**Spec anchor:** None (implementation detail)

Stripe default is industry standard. No action.

### F10. `commitments.status='completed'` is written by two independent paths with different semantics and no coordination

**Pass 1 severity:** Blocking
**Pass 2 verdict:** GENUINE-BUG
**Cluster:** 1 (sponsorship state machine)

See Cluster 1. The spec-aligned model is sponsor release drives completion — the cron's time-based flip is not in the spec.

### F11. Admin-role detection reads `profiles.role` — which does not exist

**Pass 1 severity:** Blocking
**Pass 2 verdict:** GENUINE-BUG
**Cluster:** 2 (admin role schema)

See Cluster 2. Schema gap; add the column.

### F12. `companion_moderation` is in the message_type enum but is never written

**Pass 1 severity:** Concerning
**Pass 2 verdict:** DEFENSIBLE-DIVERGENCE (spec should clarify)
**Spec anchor:** `chat-room-plan.md` §3 mentions "sponsor-drift moderation" as Phase 5 deferred work

The enum value exists as a forward-looking scaffold for behavior the chat-room-plan explicitly defers ("Sponsor-drift moderation. If real sponsor messages in Phase 3 drift toward evaluation, moderation prompt becomes necessary. If they don't drift, this is skipped"). The formatter branch in `src/lib/companion/room.ts` is aligned with that future. This is defensible as scaffold-ahead-of-writer — the cost of the enum value is near-zero, and the cost of adding it later under a migration is small but non-trivial. The spec should be explicit about whether `companion_moderation` is a reserved-but-deferred value or should be retired. Recommend documenting in chat-room-plan.md §2 code-and-schema section that the enum value is reserved for Phase 5 and carrying the code as-is. If the direction is retirement, a single-migration enum drop + formatter-branch delete is routine but premature — Phase 3's self-pilot hasn't happened yet.

### F13. Room-level Companion invocations completely bypass the 20-calls/hour rate limit

**Pass 1 severity:** Concerning
**Pass 2 verdict:** GENUINE-BUG
**Spec anchor:** `chat-room-plan.md` §8 ("depends on: v4 Phase 2 — sponsor state machine (invite, pledge, release, veto flows all working)") + the inline commentary on rate limits as "guardrail against a render-loop bug burning the Anthropic account — do not remove"

The spec doesn't mandate a specific rate limit, but the design intent of the existing reflect-endpoint rate limit is explicit in the code comments Pass 1 quotes: it's a runtime-cost guardrail, not a feature. The room path bypasses it. The session-mark path is bounded by the one-session-per-day DB constraint; the followup path is structurally self-limiting (as Session 4 Decision A documents) but only under the assumption that the Companion's voice continues to terminate naturally — a prompt-regression could break that assumption and there's no cost floor. Pass 3 direction: add a room-keyed rate limit (30/hour is the Pass 1 suggestion; either that or reuse `companion_rate_limit` with a compound key). Not a blocker because the followup self-limiting argument is probably right in practice, but not a comfortable place to leave production code that calls a billed API.

### F14. The followup trigger heuristic is addressee-unaware in multi-practitioner rooms

**Pass 1 severity:** Documented — known V2 scope
**Pass 2 verdict:** DEFENSIBLE-DIVERGENCE (repo carries v1 as-shipped; V2 design absorbs the fix)
**Spec anchor:** `docs/bcd-arc.md` lines 1498–1596 document the issue fully

The principal has already chosen the V2 treatment: V1 stays, V2 design session absorbs the problem. This is defensible because no production user today is a multi-practitioner room member, so the misfire is hypothetical. The inventory's mention of F14 is a pointer for the V2 session, not a Pass 3 action. No action.

### F15. `companion_rate_limit` upsert is racy; the comment acknowledges it

**Pass 1 severity:** Nit
**Pass 2 verdict:** DEFENSIBLE-DIVERGENCE (defer)
**Spec anchor:** None (implementation detail)

The 20/hour cap is generous enough that single-digit drift is harmless, and at current single-user scale the race is vanishingly rare. If Cluster 1's disposition retires the entire reflect endpoint and its rate limit table (see F16/F23), this finding becomes moot — the code disappears.

### F16. `/api/companion/reflect` is dead code under Decision #8 — the in-room Companion is the product surface

**Pass 1 severity:** Concerning
**Pass 2 verdict:** GENUINE-BUG (orphan code)
**Spec anchor:** `v4-decisions.md` decision #8 (rooms are primary); `chat-room-plan.md` §3 (Companion is a room-level entity)

Decision #8 made the room the primary surface and the Companion a room-level entity. The per-commitment reflection panel is pre-#8 architecture. F23 confirms zero import sites for the companion-panel component. The whole chain — panel, endpoint, two system prompts, rate-limit table — is unreachable. Pass 3 deletion is spec-aligned cleanup. ~500 LOC + one empty table.

### F17. Day-90 summary result is discarded by the cron

**Pass 1 severity:** Documented — known deferred work
**Pass 2 verdict:** DEFENSIBLE-DIVERGENCE (defer per existing documentation)
**Spec anchor:** `chat-room-plan.md` §5 Phase 5 ("Day-90 summary. Scheduled Companion message at day 90 summarizing the 90-day arc for sponsors to read before releasing payment. Its shape depends heavily on what Phase 3 shows is actually useful to sponsors")

The spec explicitly defers day-90 summary persistence to Phase 5 after Phase 3's self-pilot reveals what's actually useful. The cron's discard is a placeholder — the Anthropic bill is per-page-view only if sponsors actually view completion pages, which at current (one sponsor, pre-completion) traffic is zero. Pass 3 defers.

### F18. The admin milestone endpoint is explicitly non-idempotent

**Pass 1 severity:** Nit — known design
**Pass 2 verdict:** MATCHES-SPEC
**Spec anchor:** `chat-room-plan.md` §6.5 ("Non-idempotency is by design. The admin endpoint does not check whether a `companion_milestone` row already exists for this `(commitment_id, day_number)` pair before inserting. That check belongs in Session 2's cron")

Spec explicitly documents this design. The cron has the guard; the admin surface doesn't. No action.

### F19. userMemories references a `SUMMARY_MODEL` constant that does not exist in code

**Pass 1 severity:** Nit — documentation drift
**Pass 2 verdict:** DEFENSIBLE-DIVERGENCE (memory updates; code unchanged)
**Spec anchor:** None (internal doc drift)

The userMemories record and the as-built code disagree. The code is internally consistent — all Companion calls use the single `COMPANION_MODEL` constant; the two voices are separated by distinct system prompts, not distinct model constants. The drift is in the memory, not in the code. Recommend Pass 3 updates the userMemories entry to match the as-built state. If the spec later requires independently-upgradable voices and budgets, adding `SUMMARY_MODEL` is routine; don't pre-add it against a spec that doesn't ask for it.

### F20. `POST /api/commitments` reuses any room the caller is a member of, not just their own rooms

**Pass 1 severity:** Concerning
**Pass 2 verdict:** GENUINE-BUG
**Spec anchor:** `v4-decisions.md` decision #8 ("A room is created when a first-time practitioner declares a commitment; ... the founding practitioner doesn't think about creating a room as a separate step") + the same decision's "One person can be in multiple rooms"

The spec is explicit: a first-time practitioner's declaration auto-creates a room *around them*. The code as written would drop a new commitment into an arbitrary other room the caller happens to be a member of (as a sponsor). This is only safe today because the production user population is small enough that the shape doesn't arise, but the spec-aligned behavior requires either filtering on `rooms.creator_user_id = caller` or always creating a new room for a first-time commitment. The multiple-rooms-per-person case the spec describes is a future-state where a practitioner is actively in multiple rooms as practitioner — a scenario the code also doesn't yet handle (this is F20's implicit companion gap). Pass 3 direction: fix by filtering on creator ownership when reusing a room, and surface the "which room should this commitment live in" question if a practitioner ever has multiple owned rooms (deferred UX — not blocking).

### F21. Three independent writers of `commitments.status='completed'` with no coordination

**Pass 1 severity:** Blocking (extends F10)
**Pass 2 verdict:** GENUINE-BUG
**Cluster:** 1 (sponsorship state machine)

See Cluster 1. The practitioner-complete endpoint is an additional spec-misaligned writer on top of F10's cron/release race. Cluster 1's direction retires it or narrows it — the v4 model's completion is the sponsors' decision.

### F22. Sponsors-page UI status type is stale and incomplete

**Pass 1 severity:** Concerning
**Pass 2 verdict:** GENUINE-BUG
**Cluster:** 1 (sponsorship state machine) — depends on

See Cluster 1. The UI type union is stale against the DB CHECK; the specific drift (types `'paid'`, missing `'released'` and `'vetoed'`) exists because Cluster 1's state-machine mess has never been resolved. Pass 3 ordering: Cluster 1 fix first, then sync the TS union and badge map to the post-fix reality. `'paid'` disappears; `'released'` and `'vetoed'` appear with appropriate badges.

### F23. F16 confirmed: the entire reflect/panel chain is orphan code, safely deletable

**Pass 1 severity:** Concerning (upgrade)
**Pass 2 verdict:** GENUINE-BUG (orphan cleanup)
**Cluster:** See F16

F23 is the Pass 1 confirmation of F16. Same verdict. Pass 3 deletion target.

### F24. Two profile-write endpoints use the SSR client for their UPDATE — on the exact code path the known JWT-propagation bug affects

**Pass 1 severity:** Concerning
**Pass 2 verdict:** GENUINE-BUG
**Spec anchor:** None directly, but the userMemories entry on "SSR Supabase client bug" documents the pattern — every profile write in the repo has migrated to service-client-post-auth specifically to avoid this race

The project's standing pattern, documented in the founder's own session memory, is to use SSR for the auth check and service-client for the write. These two endpoints never got migrated. The bug is silent — UPDATE runs in an unauthenticated context, WHERE clause matches zero rows, client sees "success" for a write that no-opped. Pass 3 fix is mechanical: mirror the pattern used by every other profile writer.

### F25. `/commit` declaration form collects five fields the API ignores

**Pass 1 severity:** Nit
**Pass 2 verdict:** GENUINE-BUG
**Spec anchor:** `v4-decisions.md` decision #8 ("the streak begins immediately at declaration; there is no pre-streak window"); `chat-room-plan.md` §5 ("Subsequent invitations into the existing room use a new `/api/rooms/[id]/invite` endpoint... Onboarding does NOT fork")

The form is a v3-era artifact whose fields (title, description, frequency, sessionsPerWeek, startDate) are all retired concepts under Decision #8. The spec-aligned declaration is a single action — the practice name is the commitment statement, the start is now, the cadence is not tracked. Pass 3 should simplify the form to match the v4 declaration shape. This is a bug in that the UI contradicts the spec; Pass 1's "nit" severity undersells slightly because the form asks the practitioner to do meaningless work. Recommend promoting to concerning-equivalent in Pass 3 ordering, but it's not blocking because the API soft-accepts the extra fields.

### F26. `/api/profiles/visibility` PATCH rejects `'network'` even though the DB accepts it

**Pass 1 severity:** Concerning
**Pass 2 verdict:** GENUINE-BUG
**Cluster:** 4 (visibility enum)

See Cluster 4. `'network'` is v3 residue; drop from the DB enum, leaving the API correct by default.

### F27. Third admin-detection surface: dashboard nav reads `user.user_metadata?.role === 'admin'`

**Pass 1 severity:** Blocking (extends F11)
**Pass 2 verdict:** GENUINE-BUG
**Cluster:** 3 (role-check consolidation)

See Cluster 3. Thirteen call sites, four mechanisms, zero agreement. Consolidation executes after Cluster 2 provides the canonical source.

### F28. `/api/commitments/[id]/posts` is an orphan — no UI calls it

**Pass 1 severity:** Nit
**Pass 2 verdict:** GENUINE-BUG (orphan cleanup)
**Spec anchor:** `chat-room-plan.md` §5 — session writes flow through `/api/rooms/[id]/messages`

Post-Decision #8, the single writer for session-marked messages is the room messages endpoint. `/api/commitments/[id]/posts` is a v3 path that survived; no UI calls it, and as Pass 1 notes, it's not just orphan — it's an incoherent alternative write path that wouldn't fire the Companion if it were called. Pass 3 deletion.

### F29. Toggling `is_session=true` on an earlier message does not fire the Companion

**Pass 1 severity:** Concerning
**Pass 2 verdict:** GENUINE-BUG
**Spec anchor:** `chat-room-plan.md` §2 Phase 2 bullet 9 ("Companion invocation paths. Server-side triggers: On `room_messages` insert with `is_session = true`: load recent room history... invoke Claude")

The spec defines the trigger as session-marking, not as session-mark-at-insert-time. The toggle endpoint is a second path that gets to session-marked state and should fire the same trigger. The gap creates the described UX break — a practitioner who morning-chats and afternoon-decides-"that was my session" gets the session in the record but no Companion response. Fix direction: mirror the `after()` block from the insert path in the toggle path, guarded on the `false → true` transition specifically (not on `true → false` toggle-off), and idempotency-check against an existing `companion_response` for this message.

### F30. `/api/trust/[userId]` serves `'network'` visibility profiles as if they were public

**Pass 1 severity:** Concerning
**Pass 2 verdict:** GENUINE-BUG
**Cluster:** 4 (visibility enum)

See Cluster 4. `'network'` is v3 residue; no v4 predicate for it exists. Drop the value and the reader simplifies to binary.

