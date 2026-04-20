-- Repair tail for v4_rooms_and_messages.
-- Context: an earlier session applied 20260420_v4_rooms_and_messages.sql but
-- the trailing DDL (status default, started_at NOT NULL, sessions_logged drop,
-- redundant sponsor-read policy cleanup) did not land. This migration
-- completes the target state without nuking the data already backfilled.
--
-- Applied to production 2026-04-20.

-- Status default was still 'launch', which contradicts the new CHECK constraint.
ALTER TABLE commitments ALTER COLUMN status SET DEFAULT 'active';

-- started_at backfilled for all existing rows (1); enforce NOT NULL.
ALTER TABLE commitments ALTER COLUMN started_at SET NOT NULL;

-- sessions_logged is replaced by COUNT(*) over room_messages WHERE is_session=true.
ALTER TABLE commitments DROP COLUMN sessions_logged;

-- Drop the redundant sponsor-read policy; "room members read" covers sponsors too.
DROP POLICY IF EXISTS "commitments: sponsors can read" ON commitments;
