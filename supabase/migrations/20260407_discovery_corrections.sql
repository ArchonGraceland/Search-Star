-- ═══════════════════════════════════════════════════
-- ACTIVATE PHASE 11 — Discovery Corrections Logging
-- ═══════════════════════════════════════════════════
-- Every confirm/correct/remove action in the review
-- step is logged here. These rows become training
-- data for per-source-per-field-type confidence priors
-- in Phase 14.

CREATE TABLE IF NOT EXISTS discovery_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which profile this correction belongs to
  profile_id uuid REFERENCES directory(id) ON DELETE CASCADE,

  -- Which discovery source produced this claim
  -- (e.g. 'linkedin.com', 'github.com', 'scholar.google.com', 'web-search')
  source text NOT NULL,

  -- Field type / section (e.g. 'Skills', 'Identity', 'Interests (athletic)')
  field_type text NOT NULL,

  -- Human-readable label (e.g. 'Python', 'Location', 'Employer')
  label text NOT NULL,

  -- What the discovery pipeline originally found
  discovered_value text NOT NULL,

  -- What the user changed it to — NULL when action = 'confirmed' or 'removed'
  corrected_value text,

  -- User action: confirmed = accepted as-is, corrected = changed value, removed = rejected entirely
  action text NOT NULL CHECK (action IN ('confirmed', 'corrected', 'removed')),

  created_at timestamptz DEFAULT now()
);

-- Indexes for the Phase 14 learning loop
-- Per-source-per-field-type accuracy queries:
-- SELECT source, field_type, action, count(*) FROM discovery_corrections GROUP BY 1,2,3
CREATE INDEX idx_dc_source_field ON discovery_corrections(source, field_type);
CREATE INDEX idx_dc_profile_id ON discovery_corrections(profile_id);
CREATE INDEX idx_dc_created_at ON discovery_corrections(created_at);

-- RLS: users can only read their own corrections (via profile ownership)
-- writes happen only through the API (service role), never directly
ALTER TABLE discovery_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own corrections"
  ON discovery_corrections FOR SELECT
  USING (
    profile_id IN (
      SELECT id FROM directory WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage corrections"
  ON discovery_corrections FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ═══════════════════════════════════════════════════
-- ACTIVATE PHASE 11 — Identity Lock column on activation_state
-- ═══════════════════════════════════════════════════
-- Stores the locked identity candidate chosen by the
-- user in Step 0. Downstream stages (Phase 12+) use
-- these constraints to focus evidence gathering.

ALTER TABLE activation_state
  ADD COLUMN IF NOT EXISTS locked_identity jsonb;

-- locked_identity shape:
-- {
--   "candidateId": "candidate-0",
--   "name": "Jane Smith",
--   "employer": "Datadog",
--   "location": "Brooklyn, NY",
--   "photoUrl": "https://...",
--   "summary": "Staff engineer at Datadog working on observability",
--   "sourceUrls": ["https://..."],
--   "lockedAt": "2026-04-07T..."
-- }

-- Also add Step 0 to the current_step CHECK constraint
-- by recreating the constraint with the new value included.
ALTER TABLE activation_state DROP CONSTRAINT IF EXISTS activation_state_current_step_check;
ALTER TABLE activation_state
  ADD CONSTRAINT activation_state_current_step_check
  CHECK (current_step IN ('identity-lock', 'identify', 'disambiguate', 'results', 'review', 'private', 'photos', 'publish', 'completed'));
