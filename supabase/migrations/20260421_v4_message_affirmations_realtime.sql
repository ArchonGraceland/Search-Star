-- B/C/D arc Session 4 (C-i, 2026-04-21): add message_affirmations to the
-- supabase_realtime publication so the room page can subscribe to live
-- INSERT/DELETE events on affirmations. Spectator-side affirmation
-- counts will tick live when a sponsor clicks "good job" on a session-
-- marked message, without requiring a page refresh.
--
-- RLS is already room-scoped on message_affirmations (SELECT policy
-- "affirmations: members read" filters by room_memberships), so adding
-- the table to the publication delivers to members only — the Realtime
-- server evaluates SELECT policy per delivery. No RLS changes needed.
--
-- Idempotent by check. The publication is managed by Supabase infra;
-- re-adding a table that is already a member raises an error, so we
-- guard with a conditional.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'message_affirmations'
  ) then
    alter publication supabase_realtime add table public.message_affirmations;
  end if;
end
$$;
