'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// RoomComposer is the message-entry form at the bottom of the room.
// Three inputs that combine into one message:
//
// - text body
// - optional media (camera or gallery), single-item to keep the
//   initial UX tight; Cloudinary upload on change, preview while the
//   form is open, URL added to media_urls on submit
// - session-mark toggle: only meaningful for the practitioner. Hidden
//   for non-practitioners; disabled with an explanatory hint when the
//   practitioner has already marked a session today
//
// Session-mark true → the POST handler invokes the Companion inline,
// which can add multi-second latency. We show a "posting…" state that
// covers both the DB write and the Companion call.
//
// Successful post → router.refresh() so the server component re-renders
// with the new message in the stream.

interface Props {
  roomId: string
  myCommitmentId: string | null
  myName: string
  alreadyMarkedToday: boolean
  isPractitioner: boolean
}

async function uploadToCloudinary(file: File): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!
  const isVideo = file.type.startsWith('video/')
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', uploadPreset)
  formData.append('folder', 'searchstar/sessions')
  if (isVideo) formData.append('resource_type', 'video')
  const endpoint = isVideo ? 'video' : 'image'
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${endpoint}/upload`,
    { method: 'POST', body: formData }
  )
  if (!res.ok) throw new Error('Upload failed')
  const data = await res.json()
  return data.secure_url as string
}

export default function RoomComposer({
  roomId,
  myCommitmentId,
  alreadyMarkedToday,
  isPractitioner,
}: Props) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [mediaKind, setMediaKind] = useState<'image' | 'video' | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [markSession, setMarkSession] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const galleryRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const canMarkSession = isPractitioner && !alreadyMarkedToday

  async function handleMediaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // 50MB cap matches /log's policy. Phone videos over this need
    // transcode to be usable by Whisper anyway; reject early.
    if (file.size > 50 * 1024 * 1024) {
      setError('Media must be under 50MB.')
      e.target.value = ''
      return
    }

    setError(null)
    setUploading(true)
    try {
      const url = await uploadToCloudinary(file)
      setMediaUrl(url)
      setMediaKind(file.type.startsWith('video/') ? 'video' : 'image')
    } catch {
      setError('Upload failed. Try again.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function clearMedia() {
    setMediaUrl(null)
    setMediaKind(null)
  }

  // Enter posts, Shift+Enter inserts a newline. Skipped on coarse-
  // pointer (touch) devices so the phone "return" key keeps inserting
  // newlines rather than sending accidentally — phone users tap Post.
  // Also skipped during IME composition so accented/multi-byte input
  // (e.g., Italian é, à) doesn't send mid-composition.
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Enter' || e.shiftKey) return
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(pointer: coarse)').matches
    ) {
      return
    }
    e.preventDefault()
    void handleSubmit()
  }

  async function handleSubmit() {
    if (submitting || uploading) return
    const trimmed = body.trim()
    if (!trimmed && !mediaUrl) {
      setError('Write something or attach media.')
      return
    }

    setError(null)
    setSubmitting(true)
    try {
      const payload: {
        body: string
        media_urls: string[]
        commitment_id: string | null
        is_session: boolean
      } = {
        body: trimmed,
        media_urls: mediaUrl ? [mediaUrl] : [],
        commitment_id: myCommitmentId,
        is_session: markSession && canMarkSession,
      }
      const res = await fetch(`/api/rooms/${roomId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Failed to post.')
      }

      // Reset and refresh.
      setBody('')
      setMediaUrl(null)
      setMediaKind(null)
      setMarkSession(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to post.')
    } finally {
      setSubmitting(false)
    }
  }

  const posting = submitting || uploading

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #d4d4d4',
        borderRadius: '3px',
        padding: '16px 18px',
      }}
    >
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          isPractitioner
            ? alreadyMarkedToday
              ? "Post chat, or add to the room. Today's session is already marked."
              : 'Write about today — what you did, what went well, what stuck.'
            : 'Write into the room.'
        }
        disabled={posting}
        rows={4}
        style={{
          width: '100%',
          border: '1px solid #d4d4d4',
          borderRadius: '3px',
          padding: '10px 12px',
          fontFamily: '"Crimson Text", Georgia, serif',
          fontSize: '16px',
          lineHeight: 1.55,
          resize: 'vertical',
          color: '#1a1a1a',
          background: '#ffffff',
          outlineColor: '#1a3a6b',
          boxSizing: 'border-box',
        }}
      />

      {/* Media preview */}
      {mediaUrl && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginTop: '10px',
            padding: '8px',
            border: '1px solid #e8e8e8',
            borderRadius: '3px',
            background: '#f9f9f9',
          }}
        >
          {mediaKind === 'video' ? (
            <video
              src={mediaUrl}
              style={{
                width: '120px',
                height: '90px',
                objectFit: 'cover',
                borderRadius: '2px',
              }}
              muted
              playsInline
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaUrl}
              alt=""
              style={{
                width: '90px',
                height: '90px',
                objectFit: 'cover',
                borderRadius: '2px',
              }}
            />
          )}
          <button
            type="button"
            onClick={clearMedia}
            disabled={posting}
            style={{
              fontFamily: 'Roboto, sans-serif',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              padding: '6px 10px',
              borderRadius: '3px',
              border: '1px solid #d4d4d4',
              background: '#ffffff',
              color: '#5a5a5a',
              cursor: posting ? 'not-allowed' : 'pointer',
            }}
          >
            Remove
          </button>
        </div>
      )}

      <input
        ref={galleryRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleMediaChange}
        style={{ display: 'none' }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleMediaChange}
        style={{ display: 'none' }}
      />

      {/* Action row */}
      <div
        style={{
          marginTop: '12px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={posting || !!mediaUrl}
          style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            padding: '7px 12px',
            borderRadius: '3px',
            border: '1px solid #d4d4d4',
            background: '#ffffff',
            color: '#1a3a6b',
            cursor: posting || !!mediaUrl ? 'not-allowed' : 'pointer',
            opacity: posting || !!mediaUrl ? 0.5 : 1,
          }}
        >
          Camera
        </button>
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          disabled={posting || !!mediaUrl}
          style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            padding: '7px 12px',
            borderRadius: '3px',
            border: '1px solid #d4d4d4',
            background: '#ffffff',
            color: '#1a3a6b',
            cursor: posting || !!mediaUrl ? 'not-allowed' : 'pointer',
            opacity: posting || !!mediaUrl ? 0.5 : 1,
          }}
        >
          Gallery
        </button>

        {/* Session-mark toggle — practitioners only */}
        {isPractitioner && (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontFamily: 'Roboto, sans-serif',
              fontSize: '13px',
              color: canMarkSession ? '#1a1a1a' : '#b8b8b8',
              cursor: canMarkSession && !posting ? 'pointer' : 'not-allowed',
              marginLeft: '6px',
            }}
          >
            <input
              type="checkbox"
              checked={markSession && canMarkSession}
              onChange={(e) => setMarkSession(e.target.checked)}
              disabled={!canMarkSession || posting}
              style={{ cursor: 'inherit' }}
            />
            <span>Mark as today&rsquo;s session</span>
          </label>
        )}

        <div style={{ flex: 1 }} />

        <button
          type="button"
          onClick={handleSubmit}
          disabled={posting || (!body.trim() && !mediaUrl)}
          style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            padding: '10px 20px',
            borderRadius: '3px',
            border: 'none',
            background: posting ? '#5a5a5a' : '#1a3a6b',
            color: '#ffffff',
            cursor: posting ? 'wait' : 'pointer',
            opacity: posting || (!body.trim() && !mediaUrl) ? 0.7 : 1,
          }}
        >
          {uploading
            ? 'Uploading…'
            : submitting
              ? markSession
                ? 'Posting & inviting Companion…'
                : 'Posting…'
              : markSession && canMarkSession
                ? 'Post as session'
                : 'Post'}
        </button>
      </div>

      {/* Hint when practitioner has already marked today */}
      {isPractitioner && alreadyMarkedToday && (
        <p
          style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: '11px',
            color: '#767676',
            marginTop: '10px',
            marginBottom: 0,
          }}
        >
          Today&rsquo;s session is marked. Tap an earlier message to re-mark it
          as today&rsquo;s session instead.
        </p>
      )}

      {error && (
        <p
          style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: '12px',
            color: '#991b1b',
            marginTop: '10px',
            marginBottom: 0,
          }}
        >
          {error}
        </p>
      )}
    </div>
  )
}
