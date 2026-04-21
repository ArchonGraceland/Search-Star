'use client'

import { useEffect, useState } from 'react'
import type { RoomMessageData } from './types'

// RoomMessage renders one message bubble. It branches on message_type
// for author styling and on viewer_can_affirm to show the Affirm
// button. The Affirm button mutates message_affirmations via the
// /affirm route and updates local state optimistically.
//
// Visual convention (Project Graceland):
// - practitioner_post: white card, navy accent bar on the left if
//   session-marked, no accent otherwise
// - sponsor_message: soft cream card, no accent
// - companion_*: light navy tint with italic body, no avatar, clearly
//   distinct from practitioner/sponsor posts
// - system: muted gray, small, centered
//
// Images render as a simple grid; videos show their URL as a link
// (a full video player is out of scope for the minimum room build).

interface Props {
  message: RoomMessageData
  roomId: string
  viewerUserId: string
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const timeStr = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${dateStr} · ${timeStr}`
}

function isVideoUrl(u: string): boolean {
  const lower = u.toLowerCase().split('?')[0]
  return /\.(mp4|mov|webm|m4v)$/.test(lower)
}
function isImageUrl(u: string): boolean {
  const lower = u.toLowerCase().split('?')[0]
  return /\.(png|jpg|jpeg|gif|webp|avif|heic)$/.test(lower)
}

export default function RoomMessage({ message, roomId, viewerUserId }: Props) {
  const [affirmed, setAffirmed] = useState(message.viewer_affirmed)
  const [affirmCount, setAffirmCount] = useState(message.affirmation_count)
  const [affirming, setAffirming] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Sync affirmation state from props when the parent updates them
  // (Realtime affirmation events flow through realtime-messages.tsx's
  // handleAffirmationInsert/Delete, which mutate the byId Map entry
  // for this message, which re-renders us with fresh props). We skip
  // the sync while an optimistic mutation is in flight: the local
  // state is intentionally ahead of the server in that window, and
  // clobbering it with prop values would cause a visual flicker when
  // our own request's Realtime echo arrives. Once affirming returns
  // to false, authoritative state is back in charge.
  //
  // Depends on the actual primitive values, not `message` identity,
  // so unrelated re-renders don't retrigger.
  useEffect(() => {
    if (affirming) return
    setAffirmed(message.viewer_affirmed)
    setAffirmCount(message.affirmation_count)
  }, [message.viewer_affirmed, message.affirmation_count, affirming])

  const isCompanion =
    message.message_type === 'companion_response' ||
    message.message_type === 'companion_welcome' ||
    message.message_type === 'companion_milestone' ||
    message.message_type === 'companion_moderation'
  const isSystem = message.message_type === 'system'
  const isPractitioner = message.message_type === 'practitioner_post'
  const isOwn = message.user_id === viewerUserId

  async function toggleAffirm() {
    if (affirming) return
    setAffirming(true)
    setErr(null)

    const method = affirmed ? 'DELETE' : 'POST'
    // Optimistic update
    const nextAffirmed = !affirmed
    setAffirmed(nextAffirmed)
    setAffirmCount((c) => c + (nextAffirmed ? 1 : -1))

    try {
      const res = await fetch(
        `/api/rooms/${roomId}/messages/${message.id}/affirm`,
        { method }
      )
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Failed')
      }
    } catch (e) {
      // Roll back
      setAffirmed(!nextAffirmed)
      setAffirmCount((c) => c + (nextAffirmed ? -1 : 1))
      setErr(e instanceof Error ? e.message : 'Failed')
    } finally {
      setAffirming(false)
    }
  }

  // ---------- system-line rendering ----------
  if (isSystem) {
    return (
      <li
        style={{
          textAlign: 'center',
          fontFamily: 'Roboto, sans-serif',
          fontSize: '11px',
          color: '#767676',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          padding: '8px 0',
        }}
      >
        {message.body}
      </li>
    )
  }

  // ---------- card variant selection ----------
  const cardBase: React.CSSProperties = {
    background: '#ffffff',
    border: '1px solid #d4d4d4',
    borderRadius: '3px',
    padding: '14px 18px',
    position: 'relative',
  }
  const sessionAccent: React.CSSProperties = message.is_session
    ? { borderLeft: '3px solid #1a3a6b', paddingLeft: '15px' }
    : {}

  const cardStyle: React.CSSProperties = isCompanion
    ? { ...cardBase, background: '#eef2f8', border: '1px solid #c7d4e8' }
    : message.message_type === 'sponsor_message'
      ? { ...cardBase, background: '#fdfcf9', border: '1px solid #e4dfd2' }
      : { ...cardBase, ...sessionAccent }

  const authorLabel = isCompanion ? 'Companion' : message.author_name

  return (
    <li style={cardStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '8px',
          marginBottom: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', minWidth: 0 }}>
          <p
            style={{
              fontFamily: 'Roboto, sans-serif',
              fontSize: '13px',
              fontWeight: 700,
              color: isCompanion ? '#1a3a6b' : '#1a1a1a',
              margin: 0,
            }}
          >
            {authorLabel}
            {isOwn && !isCompanion && (
              <span style={{ fontWeight: 400, color: '#767676', fontSize: '12px' }}>
                {' '}
                (you)
              </span>
            )}
          </p>
          {message.is_session && isPractitioner && (
            <span
              style={{
                fontFamily: 'Roboto, sans-serif',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#1a3a6b',
                background: '#ffffff',
                border: '1px solid #1a3a6b',
                borderRadius: '2px',
                padding: '2px 6px',
              }}
            >
              Session
            </span>
          )}
        </div>
        <p
          style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: '11px',
            color: '#767676',
            margin: 0,
            whiteSpace: 'nowrap',
          }}
        >
          {formatTimestamp(message.posted_at)}
        </p>
      </div>

      {message.body && (
        <p
          style={{
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '16px',
            color: '#1a1a1a',
            lineHeight: 1.6,
            margin: 0,
            whiteSpace: 'pre-wrap',
            fontStyle: isCompanion ? 'italic' : 'normal',
          }}
        >
          {message.body}
        </p>
      )}

      {message.media_urls && message.media_urls.length > 0 && (
        <div
          style={{
            marginTop: '10px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: '6px',
          }}
        >
          {message.media_urls.map((u) =>
            isImageUrl(u) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={u}
                src={u}
                alt=""
                style={{
                  width: '100%',
                  height: '160px',
                  objectFit: 'cover',
                  borderRadius: '2px',
                  border: '1px solid #e8e8e8',
                }}
              />
            ) : isVideoUrl(u) ? (
              <video
                key={u}
                src={u}
                controls
                preload="metadata"
                style={{
                  width: '100%',
                  height: '160px',
                  objectFit: 'cover',
                  borderRadius: '2px',
                  border: '1px solid #e8e8e8',
                  background: '#000',
                }}
              />
            ) : (
              <a
                key={u}
                href={u}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: 'Roboto, sans-serif',
                  fontSize: '12px',
                  color: '#1a3a6b',
                  textDecoration: 'underline',
                  wordBreak: 'break-all',
                }}
              >
                {u}
              </a>
            )
          )}
        </div>
      )}

      {message.transcript && (
        <p
          style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: '12px',
            color: '#5a5a5a',
            fontStyle: 'italic',
            marginTop: '10px',
            padding: '8px 12px',
            borderLeft: '2px solid #b8b8b8',
            background: '#f9f9f9',
            lineHeight: 1.55,
          }}
        >
          <span
            style={{
              fontStyle: 'normal',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#767676',
              marginRight: '6px',
            }}
          >
            Transcript
          </span>
          {message.transcript}
        </p>
      )}

      {/* Affirm row — visible only on session-marked practitioner posts.
          Shows the count to everyone; the button toggles only for sponsors. */}
      {message.is_session && isPractitioner && (
        <div
          style={{
            marginTop: '10px',
            paddingTop: '10px',
            borderTop: '1px dashed #e8e8e8',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          {message.viewer_can_affirm ? (
            <button
              type="button"
              onClick={toggleAffirm}
              disabled={affirming}
              style={{
                fontFamily: 'Roboto, sans-serif',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                padding: '6px 12px',
                borderRadius: '3px',
                border: affirmed ? '1px solid #1a3a6b' : '1px solid #d4d4d4',
                background: affirmed ? '#1a3a6b' : '#ffffff',
                color: affirmed ? '#ffffff' : '#1a3a6b',
                cursor: affirming ? 'wait' : 'pointer',
              }}
            >
              {affirmed ? 'Affirmed ✓' : 'Affirm'}
            </button>
          ) : null}
          <p
            style={{
              fontFamily: 'Roboto, sans-serif',
              fontSize: '11px',
              color: '#767676',
              margin: 0,
            }}
          >
            {affirmCount === 0
              ? 'No affirmations yet'
              : affirmCount === 1
                ? '1 affirmation'
                : `${affirmCount} affirmations`}
          </p>
          {err && (
            <p
              style={{
                fontFamily: 'Roboto, sans-serif',
                fontSize: '11px',
                color: '#991b1b',
                margin: 0,
              }}
            >
              {err}
            </p>
          )}
        </div>
      )}
    </li>
  )
}
