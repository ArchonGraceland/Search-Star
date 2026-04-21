-- Retire the anonymous-sponsor model.
--
-- Background: v3 shipped a sponsorship flow where a sponsor supplied name +
-- email + card at /sponsor/invited/[token] and never created a Supabase auth
-- account. Their `sponsorships` row had `sponsor_user_id = NULL`. Decision #8
-- (rooms are primary) requires every sponsor to be a visible, named room
-- member. A room membership requires a `user_id`. The two models are
-- incompatible — which is why the Phase 2 backfill silently skipped all
-- anonymous sponsorships (see 20260420_v4_rooms_and_messages.sql lines 94-98)
-- and why a sponsor who accepted an invite in production found they could
-- pledge but never land in the room.
--
-- This migration makes the new model load-bearing at the DB level:
--
--   1. Vetoes any remaining anonymous sponsorships so they stop blocking the
--      commitment's sponsor-set accounting. (A pre-migration check confirmed
--      the corresponding Stripe PaymentIntents had already aged out of the
--      requires_capture state on Stripe's side, so no explicit cancel is
--      needed here. If the Stripe state had been live, a coordinated cancel
--      would have had to run before this migration to avoid a week of held
--      funds on test cards.)
--   2. Tightens the sponsorships insert RLS policy to require
--      sponsor_user_id to match auth.uid(). This is defense-in-depth;
--      the primary check is in the POST /api/sponsorships handler, which
--      uses the service client (RLS bypass) but performs its own explicit
--      auth and ownership checks in application code.
--
-- What this migration does NOT do: add NOT NULL on sponsor_user_id.
-- Reason: the retired anonymous rows are being marked 'vetoed' (not
-- deleted) to preserve the audit trail, and they still have
-- sponsor_user_id = NULL. A NOT NULL would require either deleting those
-- rows or inventing a placeholder user_id to stamp them with. Neither is
-- worth the defense-in-depth benefit when the RLS policy and app code
-- are already doing the work. If a future migration retires the
-- anonymous-row audit entirely, NOT NULL can be added then.
--
-- The access_token column is NOT dropped. The release/veto email flow in
-- /api/sponsorships/[id]/action/route.ts still uses it (those emails arrive
-- in the sponsor's inbox and link back to a release/veto surface without
-- requiring an active browser session). A separate migration will retire
-- that flow once authenticated release/veto ships.

-- 1. Retire the two existing anonymous sponsorships.
--
-- These are test pledges from 2026-04-19 (pre-Phase-2). They're the only
-- anonymous rows in the DB as of this migration. Status -> vetoed rather
-- than DELETE so the audit trail survives and the commitment's
-- sponsorship-count history is preserved. veto_reason is set to a sentinel
-- string the action route and the public webhook never produce, so we can
-- spot these retroactively.

UPDATE sponsorships
SET
  status = 'vetoed',
  vetoed_at = now(),
  veto_reason = 'retired: anonymous sponsor model superseded by Decision #8'
WHERE sponsor_user_id IS NULL
  AND status = 'pledged';

-- 2. Tighten the insert RLS policy. The previous policy only checked that
-- the commitment was 'active'. That was fine when the insert was
-- happening via the service client (which bypasses RLS) from a
-- /api/sponsorships handler that trusted itself. With the code change,
-- inserts now happen via an authenticated SSR client and must be
-- constrained so a malicious caller can't insert a sponsorship against
-- someone else's commitment with their own user_id as the sponsor (or
-- worse, someone else's).

DROP POLICY IF EXISTS "sponsorships: insert while active" ON sponsorships;

CREATE POLICY "sponsorships: insert by self against active commitment"
ON sponsorships
FOR INSERT
TO authenticated
WITH CHECK (
  sponsor_user_id = auth.uid()
  AND commitment_id IN (
    SELECT id FROM commitments WHERE status = 'active'
  )
);

-- 3. sponsor_email and sponsor_name remain on the row as duplicated-from-
-- profile copies. They're used by the webhook email and the Trust compute's
-- email-fallback tally. Keeping them avoids re-plumbing two unrelated code
-- paths in this commit. A future migration can drop them once those paths
-- read from profiles instead.

-- 4. access_token stays. See header comment.
