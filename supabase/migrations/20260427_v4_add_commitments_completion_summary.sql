-- Phase 10A — Cross-commitment memory.
-- Adds a nullable text column for the Memory Curator agent's
-- completion summary (filled when a commitment transitions
-- 'active' → 'completed'). The Companion's room context layer
-- prepends these summaries to its working memory so subsequent
-- commitments in the same room can be discussed against the prior
-- arc — see docs/companion-v2-plan.md §3.2 / §3.3.

ALTER TABLE commitments
  ADD COLUMN IF NOT EXISTS completion_summary text;

COMMENT ON COLUMN commitments.completion_summary IS
  'Memory Curator agent output: a few-sentences arc summary written when status flips to completed. Read by the Companion as cross-commitment memory. Null until the Curator runs (or for legacy completions). See docs/companion-v2-plan.md §3.';
