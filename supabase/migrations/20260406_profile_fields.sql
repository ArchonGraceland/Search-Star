-- ═══════════════════════════════════════════════════
-- ACTIVATE PHASE 3 — Provenance System & Database Schema
-- ═══════════════════════════════════════════════════
-- Spec reference: Section 3.9 "Claim provenance", "Unclaimed profiles"
--
-- Creates:
--   1. profile_fields table with per-field provenance and multi-value support
--   2. seeding_status column on directory table
--   3. RLS policies: owners read/write own, platforms read-only, unclaimed frozen
--   4. Indexes for common query patterns

-- ═══ 1. profile_fields table ═══

CREATE TABLE IF NOT EXISTS profile_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links to directory entry (the profile this field belongs to)
  profile_id uuid NOT NULL REFERENCES directory(id) ON DELETE CASCADE,

  -- Field identity (section + label define the logical field; multiple rows = multi-value)
  section text NOT NULL,            -- 'Identity', 'Skills', 'Interests (athletic)', etc.
  label text NOT NULL,              -- 'Python', 'Running', 'Name', etc.
  value text NOT NULL,              -- The field value

  -- Provenance — five states per spec Section 3.9
  provenance_status text NOT NULL DEFAULT 'seeded'
    CHECK (provenance_status IN ('seeded', 'confirmed', 'self_reported', 'corrected', 'validated', 'removed')),
  source_url text,                  -- URL where the data was discovered
  source_name text,                 -- Hostname or source label (e.g., 'github.com')

  -- Timestamps tracking lifecycle
  seeded_at timestamptz,            -- When the Activate engine discovered this
  confirmed_at timestamptz,         -- When the user confirmed it
  corrected_at timestamptz,         -- When the user corrected it
  validated_at timestamptz,         -- When a validator staked on it (future — Phase 8+)

  -- Correction tracking
  original_value text,              -- Stores the discovered value when user corrects

  -- Confidence score — how reliable is the source?
  -- GitHub API = 0.9, LinkedIn via SerpAPI = 0.7, Scholar = 0.85,
  -- Professional directory = 0.8, web scrape = 0.6, self-reported = 0.5, user-input = 0.5
  confidence_score numeric(3,2) DEFAULT 0.5
    CHECK (confidence_score >= 0 AND confidence_score <= 1),

  -- Ordering within section
  sort_order integer DEFAULT 0,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ═══ 2. Indexes ═══

CREATE INDEX idx_profile_fields_profile_id ON profile_fields(profile_id);
CREATE INDEX idx_profile_fields_section ON profile_fields(profile_id, section);
CREATE INDEX idx_profile_fields_provenance ON profile_fields(profile_id, provenance_status);
CREATE INDEX idx_profile_fields_label ON profile_fields(profile_id, section, label);

-- ═══ 3. Add seeding_status to directory table ═══

ALTER TABLE directory ADD COLUMN IF NOT EXISTS seeding_status text DEFAULT 'claimed'
  CHECK (seeding_status IN ('claimed', 'unclaimed'));

-- ═══ 4. Enable RLS ═══

ALTER TABLE profile_fields ENABLE ROW LEVEL SECURITY;

-- ═══ 5. RLS policies for profile_fields ═══

-- Profile owners can read their own fields
CREATE POLICY "Profile owners can read own fields"
  ON profile_fields FOR SELECT
  USING (
    profile_id IN (
      SELECT id FROM directory WHERE user_id = auth.uid()
    )
  );

-- Profile owners can insert fields for their own profiles
CREATE POLICY "Profile owners can insert own fields"
  ON profile_fields FOR INSERT
  WITH CHECK (
    profile_id IN (
      SELECT id FROM directory
      WHERE user_id = auth.uid()
      AND seeding_status = 'claimed'  -- Cannot insert on unclaimed profiles
    )
  );

-- Profile owners can update their own fields (only on claimed profiles)
CREATE POLICY "Profile owners can update own fields"
  ON profile_fields FOR UPDATE
  USING (
    profile_id IN (
      SELECT id FROM directory
      WHERE user_id = auth.uid()
      AND seeding_status = 'claimed'  -- Freeze enforcement: unclaimed = no writes
    )
  )
  WITH CHECK (
    profile_id IN (
      SELECT id FROM directory
      WHERE user_id = auth.uid()
      AND seeding_status = 'claimed'
    )
  );

-- Profile owners can delete their own fields (only on claimed profiles)
CREATE POLICY "Profile owners can delete own fields"
  ON profile_fields FOR DELETE
  USING (
    profile_id IN (
      SELECT id FROM directory
      WHERE user_id = auth.uid()
      AND seeding_status = 'claimed'
    )
  );

-- Admins can manage all fields
CREATE POLICY "Admins can manage profile_fields"
  ON profile_fields FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin')
  );

-- Service role can insert/update (used by discover API which runs server-side)
CREATE POLICY "Service role can manage profile_fields"
  ON profile_fields FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Platform accounts can read fields (status only, for directory queries)
-- They see the field exists but the RLS on directory controls what they access
CREATE POLICY "Authenticated users can read profile_fields"
  ON profile_fields FOR SELECT
  USING (auth.role() = 'authenticated');

-- ═══ 6. Updated_at trigger ═══

CREATE OR REPLACE FUNCTION update_profile_fields_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_profile_fields_updated_at
  BEFORE UPDATE ON profile_fields
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_fields_updated_at();

-- ═══ 7. Helper function: get confidence score for a source ═══

CREATE OR REPLACE FUNCTION source_confidence(source_name text)
RETURNS numeric AS $$
BEGIN
  RETURN CASE
    WHEN source_name ILIKE '%github%' THEN 0.9
    WHEN source_name ILIKE '%scholar%' THEN 0.85
    WHEN source_name ILIKE '%calbar%' OR source_name ILIKE '%nysed%' OR source_name ILIKE '%aicpa%' OR source_name ILIKE '%npi%' THEN 0.8
    WHEN source_name ILIKE '%linkedin%' THEN 0.7
    WHEN source_name ILIKE '%athlinks%' OR source_name ILIKE '%runsignup%' THEN 0.75
    WHEN source_name ILIKE '%meetup%' THEN 0.65
    WHEN source_name = 'user-input' THEN 0.5
    ELSE 0.6  -- generic web scrape
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
