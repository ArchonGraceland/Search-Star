-- ═══════════════════════════════════════════════════
-- Phase 13: Background Jobs + Feed Items
-- 20260408_background_jobs.sql
-- ═══════════════════════════════════════════════════

-- background_jobs
CREATE TABLE IF NOT EXISTS background_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  profile_id uuid REFERENCES directory(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  run_after timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  error text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bj_pending ON background_jobs(status, run_after)
  WHERE status = 'pending';

-- feed_items
CREATE TABLE IF NOT EXISTS feed_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES directory(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  title text NOT NULL,
  body text,
  action_url text,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fi_profile ON feed_items(profile_id, created_at DESC);

-- RLS: background_jobs — service role only (cron uses service key)
ALTER TABLE background_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_bj" ON background_jobs
  FOR ALL USING (auth.role() = 'service_role');

-- RLS: feed_items — service role write, anon can read their own by profile_id
ALTER TABLE feed_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_fi" ON feed_items
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "anon_read_fi" ON feed_items
  FOR SELECT USING (true);
