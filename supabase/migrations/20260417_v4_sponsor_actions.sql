-- Phase 2: Sponsor invite/pledge/release/veto state machine
-- Extends sponsorships with action timestamps; adds sponsor_invitations table.
-- Applied to production via Supabase MCP on 2026-04-17.

-- Extend sponsorships status enum to include 'released' and 'vetoed'
ALTER TABLE sponsorships DROP CONSTRAINT IF EXISTS sponsorships_status_check;
ALTER TABLE sponsorships ADD CONSTRAINT sponsorships_status_check
  CHECK (status IN ('pledged','released','vetoed','refunded'));

-- Columns to record the veto/release moments
ALTER TABLE sponsorships ADD COLUMN IF NOT EXISTS released_at timestamptz;
ALTER TABLE sponsorships ADD COLUMN IF NOT EXISTS vetoed_at timestamptz;
ALTER TABLE sponsorships ADD COLUMN IF NOT EXISTS veto_reason text;

-- Access token column (already added in Phase 1; keep idempotent for historical record)
ALTER TABLE sponsorships ADD COLUMN IF NOT EXISTS access_token text;

-- Ensure unique index on access_token (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'sponsorships' AND indexname = 'sponsorships_access_token_key'
  ) THEN
    CREATE UNIQUE INDEX sponsorships_access_token_key ON sponsorships(access_token) WHERE access_token IS NOT NULL;
  END IF;
END $$;

-- Sponsor invitations: practitioner-initiated invites that produce a redeemable token
CREATE TABLE IF NOT EXISTS sponsor_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_id uuid NOT NULL REFERENCES commitments(id) ON DELETE CASCADE,
  inviter_user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  invitee_email text NOT NULL,
  invite_token text UNIQUE NOT NULL,
  sent_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  declined_at timestamptz,
  status text DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined','expired'))
);

CREATE INDEX IF NOT EXISTS sponsor_invitations_commitment_idx ON sponsor_invitations(commitment_id);
CREATE INDEX IF NOT EXISTS sponsor_invitations_token_idx ON sponsor_invitations(invite_token);

-- RLS on sponsor_invitations
ALTER TABLE sponsor_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sponsor_invitations: inviter can read" ON sponsor_invitations;
CREATE POLICY "sponsor_invitations: inviter can read"
  ON sponsor_invitations FOR SELECT
  USING (auth.uid() = inviter_user_id);

DROP POLICY IF EXISTS "sponsor_invitations: inviter can insert" ON sponsor_invitations;
CREATE POLICY "sponsor_invitations: inviter can insert"
  ON sponsor_invitations FOR INSERT
  WITH CHECK (auth.uid() = inviter_user_id);

DROP POLICY IF EXISTS "sponsor_invitations: inviter can update" ON sponsor_invitations;
CREATE POLICY "sponsor_invitations: inviter can update"
  ON sponsor_invitations FOR UPDATE
  USING (auth.uid() = inviter_user_id);
