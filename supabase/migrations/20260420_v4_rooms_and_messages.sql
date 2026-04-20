-- v4 Decision #8: rooms are the primary social surface.
-- Schema migration + RLS rewrite, applied atomically.
-- See docs/chat-room-plan.md §5 Phase 2 and docs/v4-decisions.md §8.
--
-- This migration:
--   1. Creates rooms + room_memberships as the new primary social layer
--   2. Adds room_id + started_at to commitments; drops launch_starts_at,
--      launch_ends_at, streak_starts_at, streak_ends_at, frequency,
--      sessions_per_week, title, description (aggressive cleanup of
--      launch-era columns); tightens status check to drop 'launch' and
--      add 'vetoed'
--   3. Renames commitment_posts -> room_messages; adds room_id,
--      message_type enum, is_session boolean; makes commitment_id
--      nullable; drops session_number; adds a unique index enforcing
--      one session per practitioner per commitment per calendar day
--   4. Creates message_affirmations (sponsor "good job" on session-marked
--      messages)
--   5. Rewrites RLS to shift read scope from commitment-scoped to
--      room-scoped; replaces the launch-gated sponsorship insert policy
--      with "insert while commitment is active" (decision #3)
--
-- Backfill for the single live user:
--   - One room created per existing commitment, the practitioner joined
--     as an active member, any sponsors with a sponsor_user_id also
--     joined
--   - The most-recent practitioner post per (user, commitment, calendar
--     day) is marked is_session = true; earlier same-day posts are kept
--     as practitioner_post but not session-marked, so the one-per-day
--     unique index is satisfied

-- ---------------------------------------------------------------------------
-- 0. Drop policies that depend on columns we're about to drop.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "sponsorships: pledge during launch or active" ON sponsorships;
DROP POLICY IF EXISTS "sponsorships: anyone can insert during launch" ON sponsorships;

-- ---------------------------------------------------------------------------
-- 1. rooms
-- ---------------------------------------------------------------------------
CREATE TABLE rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  name text,
  dormancy_status text NOT NULL DEFAULT 'active'
    CHECK (dormancy_status IN ('active','dormant')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rooms_creator ON rooms(creator_user_id);

-- ---------------------------------------------------------------------------
-- 2. room_memberships
-- ---------------------------------------------------------------------------
CREATE TABLE room_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'lingering'
    CHECK (state IN ('active','lingering','exited')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);
CREATE INDEX idx_room_memberships_user ON room_memberships(user_id);
CREATE INDEX idx_room_memberships_room ON room_memberships(room_id);

-- ---------------------------------------------------------------------------
-- 3. commitments
-- ---------------------------------------------------------------------------
ALTER TABLE commitments ADD COLUMN room_id uuid REFERENCES rooms(id) ON DELETE CASCADE;
ALTER TABLE commitments ADD COLUMN started_at timestamptz;

UPDATE commitments SET started_at = COALESCE(streak_starts_at, now());

WITH new_rooms AS (
  INSERT INTO rooms (creator_user_id, created_at)
  SELECT user_id, created_at FROM commitments
  RETURNING id, creator_user_id, created_at
),
pairings AS (
  SELECT c.id AS commitment_id, r.id AS room_id, c.user_id
  FROM commitments c
  JOIN new_rooms r ON r.creator_user_id = c.user_id AND r.created_at = c.created_at
),
_ AS (
  UPDATE commitments c
  SET room_id = p.room_id
  FROM pairings p
  WHERE c.id = p.commitment_id
  RETURNING 1
)
INSERT INTO room_memberships (room_id, user_id, state)
SELECT p.room_id, p.user_id, 'active' FROM pairings p
ON CONFLICT (room_id, user_id) DO NOTHING;

INSERT INTO room_memberships (room_id, user_id, state)
SELECT c.room_id, s.sponsor_user_id, 'active'
FROM sponsorships s JOIN commitments c ON c.id = s.commitment_id
WHERE s.sponsor_user_id IS NOT NULL
ON CONFLICT (room_id, user_id) DO NOTHING;

ALTER TABLE commitments ALTER COLUMN room_id SET NOT NULL;
CREATE INDEX idx_commitments_room ON commitments(room_id);

UPDATE commitments SET status = 'active' WHERE status = 'launch';

ALTER TABLE commitments DROP CONSTRAINT IF EXISTS commitments_status_check;
ALTER TABLE commitments ADD CONSTRAINT commitments_status_check
  CHECK (status IN ('active','completed','vetoed','abandoned'));

ALTER TABLE commitments DROP COLUMN launch_starts_at;
ALTER TABLE commitments DROP COLUMN launch_ends_at;
ALTER TABLE commitments DROP COLUMN streak_starts_at;
ALTER TABLE commitments DROP COLUMN streak_ends_at;
ALTER TABLE commitments DROP COLUMN frequency;
ALTER TABLE commitments DROP COLUMN sessions_per_week;
ALTER TABLE commitments DROP COLUMN title;
ALTER TABLE commitments DROP COLUMN description;

-- ---------------------------------------------------------------------------
-- 4. commitment_posts -> room_messages
-- ---------------------------------------------------------------------------
ALTER TABLE commitment_posts RENAME TO room_messages;

ALTER TABLE room_messages ADD COLUMN room_id uuid REFERENCES rooms(id) ON DELETE CASCADE;
ALTER TABLE room_messages ADD COLUMN message_type text NOT NULL DEFAULT 'practitioner_post'
  CHECK (message_type IN (
    'practitioner_post','companion_response','companion_welcome',
    'companion_milestone','companion_moderation','sponsor_message','system'
  ));
ALTER TABLE room_messages ADD COLUMN is_session boolean NOT NULL DEFAULT false;

ALTER TABLE room_messages ALTER COLUMN commitment_id DROP NOT NULL;

UPDATE room_messages rm SET room_id = c.room_id
FROM commitments c WHERE rm.commitment_id = c.id;
ALTER TABLE room_messages ALTER COLUMN room_id SET NOT NULL;
CREATE INDEX idx_room_messages_room ON room_messages(room_id);
CREATE INDEX idx_room_messages_commitment ON room_messages(commitment_id);

-- Mark only the latest post per (user, commitment, calendar day) as a session.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, commitment_id, (posted_at AT TIME ZONE 'UTC')::date
           ORDER BY posted_at DESC
         ) AS rn
  FROM room_messages
  WHERE message_type = 'practitioner_post' AND commitment_id IS NOT NULL
)
UPDATE room_messages rm
SET is_session = true
FROM ranked r
WHERE rm.id = r.id AND r.rn = 1;

ALTER TABLE room_messages DROP COLUMN session_number;

CREATE UNIQUE INDEX uq_room_messages_one_session_per_day
  ON room_messages (user_id, commitment_id, ((posted_at AT TIME ZONE 'UTC')::date))
  WHERE is_session = true AND commitment_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. message_affirmations
-- ---------------------------------------------------------------------------
CREATE TABLE message_affirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES room_messages(id) ON DELETE CASCADE,
  sponsor_user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  affirmed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sponsor_user_id, message_id)
);
CREATE INDEX idx_affirmations_message ON message_affirmations(message_id);

-- ---------------------------------------------------------------------------
-- 6. RLS rewrite
-- ---------------------------------------------------------------------------

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rooms: members read" ON rooms FOR SELECT
  USING (id IN (SELECT room_id FROM room_memberships WHERE user_id = auth.uid()));

ALTER TABLE room_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "room_memberships: members read" ON room_memberships FOR SELECT
  USING (room_id IN (SELECT room_id FROM room_memberships WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "commitment_posts: sponsors can read" ON room_messages;
DROP POLICY IF EXISTS "posts: owner full access" ON room_messages;

CREATE POLICY "room_messages: members read" ON room_messages FOR SELECT
  USING (room_id IN (SELECT room_id FROM room_memberships WHERE user_id = auth.uid()));

CREATE POLICY "room_messages: practitioner inserts own post" ON room_messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND message_type = 'practitioner_post'
    AND room_id IN (SELECT room_id FROM room_memberships WHERE user_id = auth.uid())
  );

CREATE POLICY "room_messages: practitioner updates own post" ON room_messages FOR UPDATE
  USING (user_id = auth.uid() AND message_type = 'practitioner_post')
  WITH CHECK (user_id = auth.uid() AND message_type = 'practitioner_post');

CREATE POLICY "room_messages: practitioner deletes own post" ON room_messages FOR DELETE
  USING (user_id = auth.uid() AND message_type = 'practitioner_post');

CREATE POLICY "room_messages: sponsor inserts sponsor_message" ON room_messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND message_type = 'sponsor_message'
    AND room_id IN (SELECT room_id FROM room_memberships WHERE user_id = auth.uid())
  );

ALTER TABLE message_affirmations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "affirmations: members read" ON message_affirmations FOR SELECT
  USING (message_id IN (
    SELECT id FROM room_messages WHERE room_id IN (
      SELECT room_id FROM room_memberships WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "affirmations: active sponsor inserts" ON message_affirmations FOR INSERT
  WITH CHECK (
    sponsor_user_id = auth.uid()
    AND message_id IN (
      SELECT rm.id FROM room_messages rm
      JOIN sponsorships s ON s.commitment_id = rm.commitment_id
      WHERE rm.is_session = true
        AND s.sponsor_user_id = auth.uid()
        AND s.status IN ('pledged','paid')
    )
  );

CREATE POLICY "affirmations: own rows delete" ON message_affirmations FOR DELETE
  USING (sponsor_user_id = auth.uid());

CREATE POLICY "sponsorships: insert while active" ON sponsorships FOR INSERT
  WITH CHECK (
    commitment_id IN (SELECT id FROM commitments WHERE status = 'active')
  );

CREATE POLICY "sponsorships: room members read" ON sponsorships FOR SELECT
  USING (commitment_id IN (
    SELECT id FROM commitments WHERE room_id IN (
      SELECT room_id FROM room_memberships WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "commitments: room members read" ON commitments FOR SELECT
  USING (room_id IN (SELECT room_id FROM room_memberships WHERE user_id = auth.uid()));
