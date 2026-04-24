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

*(Not yet written. Pass 1 committed at `1fd87a2` explicitly as partial — infra
layer + schema only. Route flows, API inventory, lib modules, and components
remain.)*

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
