-- Companion v1.5: cache Whisper transcripts of video session posts so
-- the Companion's /api/companion/reflect and /api/companion/day90-summary
-- don't re-transcribe the same video on every call. A post can have at
-- most one video (current log flow enforces single-media per post), so a
-- single nullable column is enough — if the multi-media flow ever lands,
-- this becomes a JSONB keyed by media_url.
--
-- Already applied to prod via Supabase MCP on 2026-04-18. File committed
-- as historical record.
ALTER TABLE commitment_posts ADD COLUMN IF NOT EXISTS transcript text;
