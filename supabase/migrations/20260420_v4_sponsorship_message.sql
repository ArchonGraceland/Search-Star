-- Phase 5.1: persist the sponsor's optional message so the practitioner
-- notification email (now fired from the webhook's amount_capturable_updated
-- branch) can include it. Previously the message was only passed through the
-- POST body and used inline; moving the email send to the webhook means the
-- webhook needs to look up the message the same way it looks up pledge amount.
--
-- Already applied to prod via Supabase MCP on 2026-04-17. File committed as
-- historical record.
ALTER TABLE sponsorships ADD COLUMN IF NOT EXISTS message text;
