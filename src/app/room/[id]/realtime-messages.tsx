'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import RoomMessage from './room-message'
import type { MessageType, RoomMessageData } from './types'

// RealtimeMessages wraps the server-rendered message list and subscribes
// to new INSERTs on public.room_messages filtered to this room_id.
//
// Session 3 (C-1) scope: INSERTs only. Affirmation toggles remain a
// client mutation against /api/rooms/[id]/messages/[msg_id]/affirm and
// update local state optimistically via the RoomMessage component;
// Realtime does not yet carry affirmation changes. A future C-2 session
// can extend this to affirmations if the affirmations count needs to
// feel live for spectators. For now the count on a given message is
// accurate for the viewer (optimistic) and "at render time" for others.
//
// The Supabase Realtime subscription is authorized by the viewer's JWT
// against the existing "room_messages: members read" RLS policy. Even
// though the filter says room_id=eq.<id>, a client who is not a member
// of that room will receive nothing, because the SELECT policy evaluates
// before every delivery.
//
// Deduplication. Three paths can put a message into local state:
//   (a) initialMessages from SSR (render or router.refresh())
//   (b) the Realtime INSERT echo for a message the current client just
//       POSTed (arrives shortly after POST response returns)
//   (c) the Realtime INSERT for a message posted by another client
// We keep a Map<id, RoomMessageData> and upsert from all three sources.
// Order is sorted by posted_at ascending on render.

interface Props {
  initialMessages: RoomMessageData[]
  roomId: string
  viewerUserId: string
  nameMap: Record<string, string>
  mySponsoredCommitmentIds: string[]
  emptyStateText: string
}

// Shape the payload from a postgres_changes INSERT into the same
// RoomMessageData the server-rendered initialMessages use. Affirmation
// count is zero for brand-new rows. viewer_can_affirm is computed here
// from the sponsored-commitment set passed down from the server.
function shapeIncoming(
  row: {
    id: string
    user_id: string
    commitment_id: string | null
    message_type: string
    body: string | null
    media_urls: string[] | null
    transcript: string | null
    is_session: boolean
    posted_at: string
  },
  viewerUserId: string,
  nameMap: Record<string, string>,
  sponsoredSet: Set<string>
): RoomMessageData {
  const isCompanion =
    row.message_type === 'companion_response' ||
    row.message_type === 'companion_welcome' ||
    row.message_type === 'companion_milestone' ||
    row.message_type === 'companion_moderation'

  const canAffirm =
    row.is_session &&
    row.message_type === 'practitioner_post' &&
    !!row.commitment_id &&
    sponsoredSet.has(row.commitment_id) &&
    row.user_id !== viewerUserId

  return {
    id: row.id,
    user_id: row.user_id,
    commitment_id: row.commitment_id,
    message_type: row.message_type as MessageType,
    body: row.body,
    media_urls: row.media_urls ?? [],
    transcript: row.transcript,
    is_session: row.is_session,
    posted_at: row.posted_at,
    author_name: isCompanion ? 'Companion' : (nameMap[row.user_id] ?? 'A member'),
    affirmation_count: 0,
    viewer_affirmed: false,
    viewer_can_affirm: canAffirm,
  }
}

export default function RealtimeMessages({
  initialMessages,
  roomId,
  viewerUserId,
  nameMap,
  mySponsoredCommitmentIds,
  emptyStateText,
}: Props) {
  // Stable set for the canAffirm predicate.
  const sponsoredSet = useMemo(
    () => new Set(mySponsoredCommitmentIds),
    [mySponsoredCommitmentIds]
  )

  // State is a Map keyed by id. Initial seed from props; merged with
  // Realtime inserts; re-merged on any prop update (router.refresh()
  // re-SSRs and passes a fresh initialMessages).
  const [byId, setById] = useState<Map<string, RoomMessageData>>(
    () => new Map(initialMessages.map((m) => [m.id, m]))
  )

  // Upsert new SSR-delivered messages without losing Realtime-only
  // entries. Intentionally a shallow merge — SSR always carries fresh
  // affirmation_count / viewer_affirmed for known rows, so SSR wins
  // on the fields that matter for already-known ids.
  useEffect(() => {
    setById((prev) => {
      const next = new Map(prev)
      for (const m of initialMessages) next.set(m.id, m)
      return next
    })
  }, [initialMessages])

  // The supabase client is a browser singleton per page; instantiate
  // once and keep across re-renders with useRef.
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  if (supabaseRef.current === null) {
    supabaseRef.current = createClient()
  }
  const supabase = supabaseRef.current

  const router = useRouter()

  // Shared INSERT handler hoisted so both the initial subscription and
  // any retry path use the same logic. payload.new is the raw inserted
  // row; Supabase delivers snake_case columns matching the table.
  const handleInsert = (payload: { new: unknown }) => {
    const row = payload.new as {
      id: string
      user_id: string
      commitment_id: string | null
      message_type: string
      body: string | null
      media_urls: string[] | null
      transcript: string | null
      is_session: boolean
      posted_at: string
    }
    setById((prev) => {
      // Dedup: if this id is already known (typically our own
      // just-POSTed row, already upserted via router.refresh()
      // or a prior tick), leave the fuller SSR-shaped version
      // in place. Only insert if absent.
      if (prev.has(row.id)) return prev
      const next = new Map(prev)
      next.set(row.id, shapeIncoming(row, viewerUserId, nameMap, sponsoredSet))
      return next
    })
  }

  // Shared affirmation handlers. An affirmation INSERT or DELETE
  // mutates the target message's affirmation_count and, if the
  // affirming sponsor is the current viewer, their viewer_affirmed
  // flag. Realtime delivers the full old row on DELETE because the
  // table was set to REPLICA IDENTITY FULL in migration
  // 20260421_v4_message_affirmations_replica_identity.sql —
  // without that, DELETE payloads carry only the primary key and
  // we'd have no way to locate the target message.
  //
  // Deduplication and the optimistic-update interaction: the affirm
  // button in room-message.tsx optimistically increments/decrements
  // affirmation_count before the POST/DELETE returns. When the
  // authoritative Realtime echo arrives, naively applying it would
  // double-count. We avoid this by letting room-message.tsx hold
  // local state and sync from prop changes only when its own mutation
  // is not in flight. See the syncing useEffect in room-message.tsx
  // for the full contract.
  const handleAffirmationInsert = (payload: { new: unknown }) => {
    const row = payload.new as {
      id: string
      message_id: string
      sponsor_user_id: string
      affirmed_at: string
    }
    setById((prev) => {
      const existing = prev.get(row.message_id)
      if (!existing) return prev
      const next = new Map(prev)
      next.set(row.message_id, {
        ...existing,
        affirmation_count: existing.affirmation_count + 1,
        viewer_affirmed:
          row.sponsor_user_id === viewerUserId
            ? true
            : existing.viewer_affirmed,
      })
      return next
    })
  }

  const handleAffirmationDelete = (payload: { old: unknown }) => {
    const row = payload.old as {
      id: string
      message_id?: string
      sponsor_user_id?: string
      affirmed_at?: string
    }
    // With REPLICA IDENTITY FULL these fields are present. Defensive
    // check anyway: if message_id is missing for any reason (a future
    // replica-identity regression, an unexpected schema drift), we
    // silently skip rather than break the room page.
    if (!row.message_id) return
    const messageId = row.message_id
    setById((prev) => {
      const existing = prev.get(messageId)
      if (!existing) return prev
      const next = new Map(prev)
      next.set(messageId, {
        ...existing,
        affirmation_count: Math.max(0, existing.affirmation_count - 1),
        viewer_affirmed:
          row.sponsor_user_id === viewerUserId
            ? false
            : existing.viewer_affirmed,
      })
      return next
    })
  }

  // Subscription effect.
  //
  // Session 4.2 (2026-04-21). Session 4.1 attempted to layer custom
  // retry logic for CLOSED events on top of the Supabase SDK's own
  // internal reconnection. The two fought each other, producing an
  // "Uncaught (in promise) Error: cannot add postgres_changes
  // callbacks ... after subscribe()" error and rapid-fire SUBSCRIBED
  // events at millisecond intervals. Symptom: liveness still broken
  // plus a noisy console full of errors.
  //
  // This rewrite takes a different approach: don't fight the SDK.
  //
  //   1. On mount, prime auth (fire-and-forget), create the channel,
  //      attach handlers, subscribe. Single channel for the lifetime
  //      of the component.
  //
  //   2. Listen to auth state changes. On TOKEN_REFRESHED or SIGNED_IN,
  //      call supabase.realtime.setAuth(token). This rotates the
  //      Realtime socket's authorization without tearing down the
  //      channel — the SDK re-authorizes the existing channel on the
  //      next server heartbeat.
  //
  //   3. Status callback is diagnostic only. Log every transition
  //      with time-in-SUBSCRIBED on drops, but do not attempt custom
  //      reconnection. The SDK's internal logic handles CHANNEL_ERROR
  //      and TIMED_OUT with its own exponential backoff; any custom
  //      retry layered on top causes the race we saw in 4.1.
  //
  //   4. The visibilityState fallback remains the ultimate safety
  //      net. If the SDK fails to recover for any reason — and in
  //      practice, sometimes it does — returning to the tab triggers
  //      router.refresh() and pulls missed messages via SSR. Liveness
  //      lost temporarily; eventual consistency preserved.
  //
  // This is a strictly simpler surface than 4.1. Diagnostic logging is
  // richer (setAuth log lines, time-in-SUBSCRIBED on drops). Retry
  // behavior is entirely delegated to the SDK, which is the only
  // sensible choice after observing the 4.1 race. If SDK reconnection
  // proves insufficient in production use, the next iteration can
  // address that with a pattern that doesn't conflict with the SDK —
  // e.g. tearing down and fully recreating the component via a key
  // change on the parent, or using supabase.realtime.channels iteration.
  useEffect(() => {
    let cancelled = false

    // Fire-and-forget: push the current access token to the Realtime
    // client before the channel opens. This closes a race where the
    // channel could otherwise open with the anon token (if the session
    // hadn't loaded yet) or a stale token (if the session rotated).
    const primeRealtimeAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (token) {
          supabase.realtime.setAuth(token)
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[realtime] primeRealtimeAuth failed:', err)
      }
    }
    void primeRealtimeAuth()

    // Keep the Realtime socket's auth fresh across session rotations.
    // Without this, the server sees a token that will eventually
    // expire and close the socket.
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
          const token = session?.access_token
          if (token) {
            // eslint-disable-next-line no-console
            console.log(`[realtime] setAuth on ${event}`)
            supabase.realtime.setAuth(token)
          }
        }
      }
    )

    // Single channel for the lifetime of this component instance.
    // Channel name includes Date.now() so a React effect re-run (rare
    // in production; happens in dev strict mode) gets a distinct name.
    const channelName = `room:${roomId}:messages:${Date.now()}`
    let subscribedAt: number | null = null

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_messages',
          filter: `room_id=eq.${roomId}`,
        },
        handleInsert
      )
      // Affirmation liveness (added Session 4, 2026-04-21). The
      // postgres_changes filter is one-column equality only, and
      // message_affirmations has no room_id. We subscribe without
      // a filter and rely on RLS — the SELECT policy
      // "affirmations: members read" joins through room_memberships
      // to scope deliveries to rooms the viewer is a member of.
      // Incoming events for messages NOT in our local byId map are
      // dropped by the handlers (existing check on prev.get).
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_affirmations',
        },
        handleAffirmationInsert
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'message_affirmations',
        },
        handleAffirmationDelete
      )
      .subscribe((status, err) => {
        if (cancelled) return

        // eslint-disable-next-line no-console
        console.log(`[realtime ${channelName}] status: ${status}`, err ?? '')

        if (status === 'SUBSCRIBED') {
          subscribedAt = Date.now()
        } else if (
          (status === 'CHANNEL_ERROR' ||
            status === 'TIMED_OUT' ||
            status === 'CLOSED') &&
          subscribedAt !== null
        ) {
          const upMs = Date.now() - subscribedAt
          // eslint-disable-next-line no-console
          console.log(
            `[realtime ${channelName}] was SUBSCRIBED for ${Math.round(upMs / 1000)}s before ${status}`
          )
          subscribedAt = null
        }
      })

    // Tab-foreground safety net. If Realtime missed anything while the
    // tab was backgrounded — or if the channel has been dead at any
    // point — returning to the tab triggers an SSR refetch that fills
    // in any gaps. Cheap and covers all channel-health failure modes.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        router.refresh()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      authListener.subscription.unsubscribe()
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, roomId, viewerUserId, nameMap, sponsoredSet, router])

  // Render sorted by posted_at ascending, same as the server does.
  const ordered = useMemo(() => {
    const arr = Array.from(byId.values())
    arr.sort((a, b) => a.posted_at.localeCompare(b.posted_at))
    return arr
  }, [byId])

  if (ordered.length === 0) {
    return (
      <div
        style={{
          background: '#ffffff',
          border: '1px dashed #b8b8b8',
          borderRadius: '3px',
          padding: '32px 28px',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '18px',
            color: '#5a5a5a',
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {emptyStateText}
        </p>
      </div>
    )
  }

  return (
    <ul
      style={{
        listStyle: 'none',
        padding: 0,
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      {ordered.map((m) => (
        <RoomMessage
          key={m.id}
          message={m}
          roomId={roomId}
          viewerUserId={viewerUserId}
        />
      ))}
    </ul>
  )
}
