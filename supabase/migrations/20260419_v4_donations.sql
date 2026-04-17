-- 20260419_v4_donations.sql
--
-- Historical record only. This migration was applied out-of-band via the
-- Supabase MCP `apply_migration` tool in a prior session because Supabase
-- DNS is not reachable from the Claude container (the DB cannot be hit
-- directly via psql from this environment). Kept here as the canonical
-- written record of what ran against project qgjyfcqgnuamgymonblj.
--
-- Scope: rename `contributions` → `donations` and collapse the four-way
-- mentor-split columns (mentor/coach/community_builder/practice_leader
-- shares) to a single donation_amount + donation_rate. The mentor economy
-- (v3) is retired; v4 uses a single voluntary donation to Search Star at
-- payout time, default 5% of the pledge amount, removable in one action.
-- See docs/v4-decisions.md §5.
--
-- Additionally wires Stripe payment intent tracking onto both the
-- sponsorships and donations tables. Unique partial indexes allow rows
-- without a PaymentIntent (pre-Stripe pledges) while enforcing uniqueness
-- when one is set.

BEGIN;

-- Rename table
ALTER TABLE IF EXISTS contributions RENAME TO donations;

-- Drop retired mentor-economy columns
ALTER TABLE donations DROP COLUMN IF EXISTS mentor_share;
ALTER TABLE donations DROP COLUMN IF EXISTS coach_share;
ALTER TABLE donations DROP COLUMN IF EXISTS cb_share;
ALTER TABLE donations DROP COLUMN IF EXISTS pl_share;
ALTER TABLE donations DROP COLUMN IF EXISTS contribution_rate;

-- Rename / repurpose value columns to the simpler shape
ALTER TABLE donations RENAME COLUMN gross_amount TO pledge_amount;
ALTER TABLE donations RENAME COLUMN ss_share TO donation_amount;

-- Add donation_rate (default 5%) and sponsor / Stripe references
ALTER TABLE donations ADD COLUMN IF NOT EXISTS donation_rate numeric DEFAULT 0.05;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS sponsor_id uuid
  REFERENCES sponsorships(id) ON DELETE SET NULL;
ALTER TABLE donations ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

-- Add Stripe PaymentIntent reference to sponsorships
ALTER TABLE sponsorships ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

-- Unique partial indexes — enforce uniqueness only when the PI is set,
-- so legacy rows without a PaymentIntent don't conflict with each other.
-- ADD CONSTRAINT IF NOT EXISTS is not valid PostgreSQL, so we use the
-- CREATE UNIQUE INDEX IF NOT EXISTS form for the idempotency guarantee.
CREATE UNIQUE INDEX IF NOT EXISTS sponsorships_stripe_pi_key
  ON sponsorships (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS donations_stripe_pi_key
  ON donations (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

COMMIT;
