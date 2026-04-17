-- Search Star v4 — Phase 1 role excision migration
-- Drops validator/mentor infrastructure, adds sponsor access_token,
-- rewrites RLS so sponsors replace validators as the read-path.
--
-- Applied 2026-04-16 via Supabase MCP (project qgjyfcqgnuamgymonblj).
-- This file is the record of what was run.

BEGIN;

-- 1. Drop validator tables
DROP TABLE IF EXISTS post_confirmations CASCADE;
DROP TABLE IF EXISTS validators CASCADE;

-- 2. Drop mentor tables
DROP TABLE IF EXISTS mentor_relationships CASCADE;

-- 3. Drop retired columns on contributions
ALTER TABLE contributions DROP COLUMN IF EXISTS mentor_share;
ALTER TABLE contributions DROP COLUMN IF EXISTS coach_share;
ALTER TABLE contributions DROP COLUMN IF EXISTS cb_share;
ALTER TABLE contributions DROP COLUMN IF EXISTS pl_share;

-- 4. Drop retired columns on trust_records
ALTER TABLE trust_records DROP COLUMN IF EXISTS active_validators;
ALTER TABLE trust_records DROP COLUMN IF EXISTS mentees_formed;

-- 5. Swap mentor_step_seen -> companion_step_seen on profiles
ALTER TABLE profiles DROP COLUMN IF EXISTS mentor_step_seen;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS companion_step_seen boolean DEFAULT false;

-- 6. Add access_token on sponsorships (Phase 1 needs this; Phase 2 migration uses
--    ADD COLUMN IF NOT EXISTS so this is forward-compatible).
ALTER TABLE sponsorships ADD COLUMN IF NOT EXISTS access_token text UNIQUE;

-- 7. Rewrite sponsorships INSERT RLS: permit launch OR active
DROP POLICY IF EXISTS "sponsorships: anyone can insert during launch" ON sponsorships;
CREATE POLICY "sponsorships: pledge during launch or active"
  ON sponsorships FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM commitments c
      WHERE c.id = commitment_id
        AND c.status IN ('launch','active')
        AND (c.status = 'active' OR c.launch_ends_at > now())
    )
  );

-- 8. Rewrite commitments SELECT RLS: drop validator reach-through, add sponsor reach-through
DROP POLICY IF EXISTS "commitments: validators can read" ON commitments;
CREATE POLICY "commitments: sponsors can read"
  ON commitments FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM sponsorships s
      WHERE s.commitment_id = commitments.id
        AND s.sponsor_user_id = auth.uid()
        AND s.status IN ('pledged','paid')
    )
  );

-- 9. Rewrite commitment_posts SELECT RLS: drop validator reach-through, add sponsor reach-through
-- Note: existing policy is named "posts: validators can read" (not "commitment_posts: validators can read")
DROP POLICY IF EXISTS "posts: validators can read" ON commitment_posts;
CREATE POLICY "commitment_posts: sponsors can read"
  ON commitment_posts FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM sponsorships s
      WHERE s.commitment_id = commitment_posts.commitment_id
        AND s.sponsor_user_id = auth.uid()
        AND s.status IN ('pledged','paid')
    )
  );

COMMIT;
