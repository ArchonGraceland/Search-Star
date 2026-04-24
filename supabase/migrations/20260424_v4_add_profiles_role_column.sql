-- Cluster 2 (Pass 3a, F11 + F33) — admin-role schema repair
--
-- Applied to production via Supabase MCP as migration
-- `20260424225245__add_profiles_role_column`. This file is the repo-side
-- mirror for audit history; do NOT re-apply.
--
-- Repairs F11 (app-layer `profiles.role === 'admin'` checks) and F33
-- (DB-layer `is_admin()` function) atomically. Both have been reading
-- a column that did not exist since the v3→v4 transition; every admin
-- surface was structurally unreachable prior to this migration.
--
-- Shape per pass-2-reconciliation.md Cluster 2 direction: nullable text
-- with a minimal CHECK (`IS NULL OR = 'admin'`). NULL = non-admin.
-- Widen the CHECK later by DROPping `profiles_role_check` and replacing
-- if role vocabulary expands.

ALTER TABLE public.profiles
  ADD COLUMN role text;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IS NULL OR role = 'admin');

-- Backfill the principal's row. All other rows remain NULL, which is
-- the correct non-admin state.
UPDATE public.profiles
SET role = 'admin'
WHERE user_id = 'c5370edf-8505-441a-a60e-4d9a5ef0d7e0';
