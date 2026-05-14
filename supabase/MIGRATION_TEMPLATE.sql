-- Migration template for new tables in public.
--
-- Starting Oct 30, 2026 the Supabase Data API will no longer auto-grant
-- access to new tables in the public schema. Every new table needs explicit
-- GRANTs to anon / authenticated / service_role for supabase-js, REST, and
-- GraphQL clients to see it. Existing tables are grandfathered; this matters
-- for every CREATE TABLE from now on.
--
-- Reference: supabase email "Data API exposure becoming explicit", May 2026.

-- ─────────────────────────────────────────────
-- example_table
-- One-paragraph purpose statement: what this table is for, who writes,
-- who reads. Mention any non-obvious relationship to other tables.
-- ─────────────────────────────────────────────
create table if not exists example_table (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  -- domain columns here
  created_at  timestamptz not null default now()
);

-- Grants: required from Oct 30, 2026 onward.
-- Adjust per-role as needed; defaults match the email's recommendation.
grant select on public.example_table to anon;
grant select, insert, update, delete on public.example_table to authenticated;
grant select, insert, update, delete on public.example_table to service_role;

alter table public.example_table enable row level security;

-- Owner-scoped read + write. Drop this and replace if the table is shared
-- across users (e.g., a directory) or admin-only.
create policy "example_table: owner full access"
  on public.example_table for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
