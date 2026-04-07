-- ═══════════════════════════════════════════════════
-- ACTIVATE PHASE 12 — Machine Verification Columns
-- ═══════════════════════════════════════════════════
-- Adds v1.4 synthesis/verification metadata to
-- profile_fields. Every claim produced by the
-- synthesis pipeline now carries machine-verification
-- status — a stronger provenance guarantee than v1.3.0.
-- ═══════════════════════════════════════════════════

-- Verification timestamp: set when Stage 4 fetches
-- the cited URL and finds the claim text in the page.
ALTER TABLE profile_fields
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- SHA-256 of the page content at verification time.
-- Allows future audits to detect page changes since
-- the claim was first verified.
ALTER TABLE profile_fields
  ADD COLUMN IF NOT EXISTS verification_hash text;

-- True when Stage 4 fetched the URL successfully but
-- could not find the claim text. Confidence is
-- downgraded by 0.3 in this case (spec Section 3.9).
ALTER TABLE profile_fields
  ADD COLUMN IF NOT EXISTS verification_failed boolean DEFAULT false;

-- The confidence score before Stage 4 ran, so
-- we can display "was 0.7, downgraded to 0.4" in
-- the review UI.
ALTER TABLE profile_fields
  ADD COLUMN IF NOT EXISTS confidence_before_verification numeric(3,2);

-- Whether this claim came from only one synthesis
-- model (Claude) or was corroborated by Grok too.
-- multi-source agreement is a positive trust signal.
ALTER TABLE profile_fields
  ADD COLUMN IF NOT EXISTS single_source boolean DEFAULT true;

-- Which synthesis models produced this claim.
-- JSON array: ["claude"], ["grok"], or ["claude","grok"]
ALTER TABLE profile_fields
  ADD COLUMN IF NOT EXISTS merged_from jsonb DEFAULT '["claude"]'::jsonb;

-- Synthesis pipeline version that produced this row.
-- Allows future migrations to identify rows that
-- need re-synthesis.
ALTER TABLE profile_fields
  ADD COLUMN IF NOT EXISTS synthesis_version text DEFAULT 'v1.3';

-- ═══ Indexes ═══

-- Fast lookup for claims that have/haven't been
-- verified yet (used by admin dashboards and
-- the Phase 14 learning loop)
CREATE INDEX IF NOT EXISTS idx_pf_verified_at
  ON profile_fields(verified_at)
  WHERE verified_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pf_verification_failed
  ON profile_fields(verification_failed)
  WHERE verification_failed = true;

CREATE INDEX IF NOT EXISTS idx_pf_synthesis_version
  ON profile_fields(synthesis_version);

-- ═══ Comments ═══

COMMENT ON COLUMN profile_fields.verified_at IS
  'v1.4: Set by Stage 4 when cited URL contains the claim text';
COMMENT ON COLUMN profile_fields.verification_hash IS
  'v1.4: SHA-256 of page content at verification time';
COMMENT ON COLUMN profile_fields.verification_failed IS
  'v1.4: True when URL fetched OK but claim text not found; confidence downgraded 0.3';
COMMENT ON COLUMN profile_fields.confidence_before_verification IS
  'v1.4: Confidence before Stage 4 ran, for display purposes';
COMMENT ON COLUMN profile_fields.single_source IS
  'v1.4: True if only one synthesis model (Claude or Grok) produced this claim';
COMMENT ON COLUMN profile_fields.merged_from IS
  'v1.4: Which synthesis models produced this claim: ["claude"], ["grok"], or both';
COMMENT ON COLUMN profile_fields.synthesis_version IS
  'Pipeline version: v1.3 = six-scraper, v1.4 = synthesis pipeline';
