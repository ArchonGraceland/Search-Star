-- Phase 5.1: replay guard for the webhook's pledge-email dispatch.
-- payment_intent.amount_capturable_updated can refire (Stripe retries on
-- non-2xx, dashboard-initiated resends, etc). Without a guard, each retry
-- would send a duplicate sponsor confirmation + practitioner notification.
-- This timestamp is set after both emails dispatch; subsequent replays
-- observe the value and no-op.
--
-- Already applied to prod via Supabase MCP on 2026-04-17. File committed as
-- historical record.
ALTER TABLE sponsorships ADD COLUMN IF NOT EXISTS pledged_notified_at timestamptz;
