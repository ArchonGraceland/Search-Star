-- ═══════════════════════════════════════════════════
-- ACTIVATE PHASE 7 — Activation State Persistence
-- ═══════════════════════════════════════════════════
-- Stores activation flow progress so users can resume
-- if they leave mid-flow. One row per user.

CREATE TABLE IF NOT EXISTS activation_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Current step in the activate flow
  current_step text NOT NULL DEFAULT 'identify'
    CHECK (current_step IN ('identify', 'disambiguate', 'results', 'review', 'private', 'photos', 'publish', 'completed')),
  
  -- Identity inputs (Step 1)
  full_name text,
  employer text,
  city text,
  linkedin_url text,
  
  -- References to persisted data
  profile_id uuid,  -- directory entry ID (set after discover)
  field_ids uuid[] DEFAULT '{}',  -- profile_fields IDs
  photo_ids text[] DEFAULT '{}',  -- NarrativePhoto IDs (client-generated)
  
  -- Pricing (Step 7)
  public_price numeric(10,2) DEFAULT 0.02,
  private_price numeric(10,2) DEFAULT 0.50,
  marketing_price numeric(10,2) DEFAULT 5.00,
  
  -- Publish result
  published_handle text,
  published_profile_number text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id)
);

-- Index
CREATE INDEX idx_activation_state_user_id ON activation_state(user_id);

-- RLS
ALTER TABLE activation_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own activation state"
  ON activation_state FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role can manage activation_state"
  ON activation_state FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Updated_at trigger
CREATE TRIGGER trigger_activation_state_updated_at
  BEFORE UPDATE ON activation_state
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_fields_updated_at();
