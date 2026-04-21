-- Session 3 (C-1): add room_messages to the supabase_realtime publication
-- so INSERT events are broadcast to subscribed clients.
--
-- Authorization for subscriptions is enforced by the existing
-- "room_messages: members read" SELECT policy — Realtime evaluates
-- that policy per client JWT before delivering any row.
--
-- REPLICA IDENTITY stays at DEFAULT. INSERT payloads always include
-- the full new row regardless of replica identity; only UPDATE/DELETE
-- payloads need REPLICA IDENTITY FULL to include old-row data, and we
-- only subscribe to INSERTs.
--
-- Idempotent: pg_publication_tables is checked before adding so a
-- re-run is a no-op.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'room_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages';
  END IF;
END $$;
