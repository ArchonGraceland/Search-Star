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
  // Session 4.1 (2026-04-21). Earlier iterations of this component
  // shipped with two narrower treatments of Realtime failure modes:
  //
  //   Session 3: assume .subscribe() either succeeds or silently fails;
  //              no retry, no observability.
  //   Session 3.5: handle 'CHANNEL_ERROR' and 'TIMED_OUT' on initial
  //              setup, bounded retry with backoff (1/2/4/8s, cap 4),
  //              visibilityState fallback. Fixed the ~10% first-load
  //              subscribe failure class.
  //
  // Session 4 shipped to production and David reported the practitioner
  // browser not receiving inserts live — messages only appeared after
  // he next submitted (which triggers router.refresh() in the composer
  // and re-runs SSR). The desktop console log revealed the actual
  // pattern: channels go SUBSCRIBED → CLOSED → new channel SUBSCRIBED →
  // CLOSED repeatedly, each cycle only seconds long. The Session 3.5
  // retry code only handled CHANNEL_ERROR and TIMED_OUT, so CLOSED was
  // a no-op — the SDK's internal reconnect was creating fresh channels
  // on its own but also landing in CLOSED.
  //
  // This rewrite:
  //
  //   1. Treats CLOSED as a retry trigger on equal footing with
  //      CHANNEL_ERROR and TIMED_OUT. Any non-SUBSCRIBED terminal status
  //      tears down the current channel and reconnects with backoff.
  //      This matches the pattern Supabase staff recommend for
  //      post-SUBSCRIBED drops (github discussions #22153, #27513).
  //
  //   2. Raises the retry cap from 4 to 10. With CLOSED now counted as
  //      a retry reason, and with expected causes including mobile
  //      network flips, tab backgrounding resumes, and JWT expiry,
  //      sticking to 4 would falsely give up in common conditions.
  //      10 consecutive failures with no SUBSCRIBED between them is
  //      still a reasonable ceiling; the counter resets on every
  //      SUBSCRIBED, so a flaky-but-recovering connection can retry
  //      indefinitely over a long session.
  //
  //   3. Logs time-since-SUBSCRIBED on CLOSED events. If a channel
  //      stays up ~60 minutes before closing, that's JWT expiry. If it
  //      stays up seconds, it's something else. This line goes into
  //      browser console alongside the existing status log so future
  //      diagnosis gets both signals in one place.
  //
  //   4. Propagates the current auth access token to the Realtime
  //      client via supabase.realtime.setAuth(token) both at mount
  //      (closing a race where the channel can be created before the
  //      auth session is loaded) and on every TOKEN_REFRESHED event
  //      from the auth state listener. Without this, Realtime's server
  //      evaluates RLS with whatever token the socket was opened with,
  //      which goes stale as the session rotates and eventually causes
  //      the server to close the channel.
  //
  //   5. Keeps the visibilityState safety net unchanged. Even if every
  //      retry in (1) fails and we've given up, returning to the tab
  //      still triggers router.refresh() and pulls missed messages via
  //      SSR. Liveness lost; eventual consistency preserved.
  //
  // Channel name includes Date.now() so retried channels don't collide
  // with the server-side channel registry entry from a prior attempt.
  useEffect(() => {
    let attempt = 0
    let activeChannel: ReturnType<typeof supabase.channel> | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let subscribedAt: number | null = null
    let cancelled = false

    // Propagate current auth token to Realtime before opening channel.
    // Without this the channel opens with whatever token the SDK has
    // cached at construction time, which can be anon (if auth session
    // hadn't loaded yet) or stale (if the session rotated since).
    // supabase.auth.getSession() returns the current session from the
    // cookie storage without a server round-trip.
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

    // Listen for auth token rotations. When the cookie-based session
    // refreshes (every ~55 minutes with default 1-hour JWT expiry),
    // emit the new token to Realtime so the server sees a fresh token
    // on its next authorization check. Without this, the server closes
    // the socket at the original token's expiry, producing the CLOSED
    // churn David observed.
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
          // eslint-disable-next-line no-console
          console.log(`[realtime ${channelName}] status: ${status}`, err ?? '')

          if (status === 'SUBSCRIBED') {
            subscribedAt = Date.now()
            // Reset backoff on success so a later drop+retry starts
            // from the short delay again.
            attempt = 0
            return
          }

          // Any non-SUBSCRIBED terminal status: CHANNEL_ERROR,
          // TIMED_OUT, or CLOSED. The cause doesn't matter for the
          // recovery action — tear down and reconnect with backoff.
          // (Per Supabase staff guidance in github discussions
          // #22153: "if the status is NOT subscribed then
          // removeChannel and subscribe again. The actual reason for
          // the error is unimportant.")
          if (
            status === 'CHANNEL_ERROR' ||
            status === 'TIMED_OUT' ||
            status === 'CLOSED'
          ) {
            if (cancelled) return

            // Diagnostic: how long were we up before the drop? Helps
            // distinguish JWT expiry (~60min) from network blips
            // (seconds) from server-side disconnects (minutes).
            if (subscribedAt !== null) {
              const upMs = Date.now() - subscribedAt
              // eslint-disable-next-line no-console
              console.log(
                `[realtime ${channelName}] was SUBSCRIBED for ${Math.round(upMs / 1000)}s before ${status}`
              )
              subscribedAt = null
            }

            if (attempt >= 10) {
              // eslint-disable-next-line no-console
              console.warn(
                `[realtime ${channelName}] giving up after ${attempt} consecutive retries; ` +
                  `falling back to visibility-based router.refresh()`
              )
              return
            }
            // Exponential backoff capped at 8s per attempt — keeps
            // reconnects reasonably responsive even during a long
            // failure tail, while not hammering the server.
            const delayMs = Math.min(8000, 1000 * Math.pow(2, attempt))
            attempt += 1
            supabase.removeChannel(ch)
            retryTimer = setTimeout(() => {
              retryTimer = null
              // Re-prime auth on every retry. Cheap, and covers the
              // case where the token rotated while we were between
              // attempts.
              primeRealtimeAuth().then(() => connect())
            }, delayMs)
          }
        })
      activeChannel = ch
    }

    // Prime auth then connect. Awaited via then() so the channel
    // always opens with a fresh token.
    primeRealtimeAuth().then(() => connect())

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
      authListener.subscription.unsubscribe()
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
