-- Session 4.3 (2026-04-21). Fix silent Realtime delivery failure.
--
-- Symptom: room page shows channel SUBSCRIBED cleanly, but inserts
-- never arrive via Realtime unless the tab is switched away and back
-- (which triggers router.refresh() via visibilitychange). Server-side
-- RLS via the service client works fine; SSR reads work fine; only
-- Realtime delivery was broken.
--
-- Root cause: the SELECT policy on public.room_messages joins through
-- public.room_memberships:
--   room_id IN (SELECT room_id FROM room_memberships WHERE user_id = auth.uid())
-- and the room_memberships SELECT policy was itself self-referential:
--   room_id IN (SELECT room_id FROM room_memberships WHERE user_id = auth.uid())
-- Supabase Realtime runs the room_messages SELECT policy on every
-- delivery as the subscriber's role. The subquery on room_memberships
-- triggers that table's own recursive SELECT policy, which fails to
-- resolve cleanly in the Realtime authorization context (works in
-- ordinary Postgres RLS evaluation; fails in the constrained evaluation
-- Realtime uses per-delivery). Net: every delivery check returns "no
-- rows" and Realtime silently drops the event.
--
-- The recursive policy was protecting nothing used by the app: every
-- read of room_memberships in the codebase goes through the service
-- client (bypasses RLS) or through an SSR query scoped to the current
-- user. No client-facing code reads OTHER users' memberships via the
-- SSR client. The recursive subquery in the policy is pure vestigial
-- complexity.
--
-- Fix: replace with a direct policy. A user can read their own
-- room_memberships rows. That's all. This resolves trivially in
-- Realtime's authorization context because there's no subquery
-- against a table with its own recursive policy. All existing
-- application reads of room_memberships go through the service
-- client and are unaffected.
--
-- Verified before shipping: grep across src/ confirms every
-- from('room_memberships') call site either uses createServiceClient()
-- or scopes by user_id to the current user. The simpler policy
-- breaks nothing.

drop policy if exists "room_memberships: members read" on public.room_memberships;

create policy "room_memberships: own rows read"
on public.room_memberships
for select
using (user_id = auth.uid());
