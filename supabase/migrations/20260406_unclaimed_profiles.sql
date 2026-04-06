-- ═══════════════════════════════════════════════════
-- ACTIVATE PHASE 8 — Unclaimed Profiles System
-- ═══════════════════════════════════════════════════
-- Spec reference: Section 3.9 "Unclaimed profiles" (five-property comparison table)
--
-- Adds:
--   1. seeding_status column on profiles table (mirrors directory table)
--   2. Index for seeding_status filtering in platform directory

-- ═══ 1. Add seeding_status to profiles table ═══

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS seeding_status text DEFAULT 'claimed'
  CHECK (seeding_status IN ('claimed', 'unclaimed'));

-- ═══ 2. Index for directory filtering ═══

CREATE INDEX IF NOT EXISTS idx_profiles_seeding_status ON profiles(seeding_status);

-- ═══ 3. Add user_id column to directory table if missing ═══
-- (needed for claim flow — linking a Supabase auth user to their directory stub)

ALTER TABLE directory ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS idx_directory_user_id ON directory(user_id);
