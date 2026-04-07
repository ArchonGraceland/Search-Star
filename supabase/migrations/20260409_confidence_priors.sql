-- ═══════════════════════════════════════════════════
-- Phase 14: Learned Confidence Priors
-- Materialized view computed from discovery_corrections
-- Refreshed by cron after each deep-mode job completes
-- ═══════════════════════════════════════════════════

-- Materialized view: per-source accuracy from corrections data
CREATE MATERIALIZED VIEW IF NOT EXISTS source_confidence_priors AS
SELECT
  source,
  COUNT(*) AS total_observations,
  COUNT(*) FILTER (WHERE action = 'confirmed') AS confirmed_count,
  COUNT(*) FILTER (WHERE action = 'corrected') AS corrected_count,
  COUNT(*) FILTER (WHERE action = 'removed')   AS removed_count,
  ROUND(
    COUNT(*) FILTER (WHERE action = 'confirmed')::numeric / NULLIF(COUNT(*), 0),
    4
  ) AS confirmed_rate,
  ROUND(
    COUNT(*) FILTER (WHERE action = 'removed')::numeric / NULLIF(COUNT(*), 0),
    4
  ) AS removed_rate,
  -- Learned confidence: weighted accuracy score, only trusted if >= 10 observations
  CASE
    WHEN COUNT(*) >= 10 THEN ROUND(
      (COUNT(*) FILTER (WHERE action = 'confirmed')::numeric / NULLIF(COUNT(*), 0)) * 0.9
      + (1 - COUNT(*) FILTER (WHERE action = 'removed')::numeric / NULLIF(COUNT(*), 0)) * 0.1,
      4
    )
    ELSE NULL  -- NULL = insufficient data, use hardcoded prior
  END AS learned_confidence,
  MAX(created_at) AS last_updated
FROM discovery_corrections
GROUP BY source
WITH DATA;

-- Unique index required for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_scp_source ON source_confidence_priors(source);

-- RPC function called by the cron handler to refresh the view
-- Uses CONCURRENTLY so reads aren't blocked during refresh
CREATE OR REPLACE FUNCTION refresh_confidence_priors()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY source_confidence_priors;
END;
$$;
