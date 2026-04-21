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

  // Subscription effect.
  //
  // Supabase Realtime's websocket endpoint shows intermittent failures
  // (~10% on channel setup in observed testing — CHANNEL_ERROR usually,
  // occasionally TIMED_OUT; infra-side "DNS cache overflow" 503s on the
  // websocket upgrade). The original Session 3 subscribe() call had no
  // status callback, so a failed channel sat silently and liveness was
  // lost for the entire page lifetime. This rewrite:
  //
  //   1. Logs subscription status transitions with the channel name
  //      prefix so Vercel runtime / browser console shows what happened
  //      when Realtime breaks.
  //   2. On CHANNEL_ERROR or TIMED_OUT, removes the current channel and
  //      creates a fresh one after a backoff. Bounded to 4 attempts with
  //      doubling delays (1s, 2s, 4s, 8s). After the cap we stop trying;
  //      the visibility fallback below covers the worst case.
  //   3. Uses a visibilityState listener: when the tab becomes visible
  //      again (user returns to this tab after being elsewhere) we call
  //      router.refresh(). This resyncs via SSR regardless of channel
  //      health, so even a dead channel never means permanently-stale
  //      messages — just no intra-tab liveness.
  //
  // Channel name includes a timestamp so retried channels don't collide
  // with the server-side channel registry entry from a prior attempt.
  useEffect(() => {
    let attempt = 0
    let activeChannel: ReturnType<typeof supabase.channel> | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    const connect = () => {
      if (cancelled) return
      const channelName = `room:${roomId}:messages:${Date.now()}`
      const ch = supabase
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
        .subscribe((status, err) => {
          // eslint-disable-next-line no-console
          console.log(`[realtime ${channelName}] status: ${status}`, err ?? '')

          if (status === 'SUBSCRIBED') {
            // Reset backoff on success so a later drop+retry starts
            // from the short delay again.
            attempt = 0
            return
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            if (cancelled) return
            if (attempt >= 4) {
              // eslint-disable-next-line no-console
              console.warn(
                `[realtime ${channelName}] giving up after ${attempt} retries; ` +
                  `falling back to visibility-based router.refresh()`
              )
              return
            }
            const delayMs = 1000 * Math.pow(2, attempt)
            attempt += 1
            // Tear down the failed channel before scheduling the retry.
            supabase.removeChannel(ch)
            retryTimer = setTimeout(() => {
              retryTimer = null
              connect()
            }, delayMs)
          }
        })
      activeChannel = ch
    }

    connect()

    // Tab-foreground safety net. If Realtime missed anything while the
    // tab was backgrounded — or if the channel has been dead the whole
    // time — returning to the tab triggers an SSR refetch that fills
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
      if (retryTimer) clearTimeout(retryTimer)
      if (activeChannel) supabase.removeChannel(activeChannel)
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
