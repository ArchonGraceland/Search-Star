-- Phase 3: sponsor_step_seen flag on profiles.
-- Parallel to companion_step_seen. Set to true when the practitioner either
-- invites at least one sponsor or explicitly dismisses the sponsor step with
-- "I'll invite sponsors later". Used as an OR branch in stage resolver step 3.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS sponsor_step_seen boolean NOT NULL DEFAULT false;
