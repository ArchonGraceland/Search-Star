'use client'

import { useState, useEffect, useRef } from 'react'

interface Props {
  commitmentId: string
  title: string
  dayNumber: number
  sessionsLogged: number
}

async function uploadToCloudinary(file: File): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', uploadPreset)
  formData.append('folder', 'searchstar/sessions')

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) throw new Error('Photo upload failed')
  const data = await res.json()
  return data.secure_url as string
}

export default function LogClient({ commitmentId, title, dayNumber, sessionsLogged }: Props) {
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [logged, setLogged] = useState(false)
  const [sessionCount, setSessionCount] = useState(sessionsLogged)
  const [error, setError] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      textareaRef.current?.focus()
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const objectUrl = URL.createObjectURL(file)
    setPhotoPreview(objectUrl)
    setPhotoUrl(null)
    setUploading(true)
    setError(null)

    try {
      const url = await uploadToCloudinary(file)
      setPhotoUrl(url)
    } catch {
      setError('Photo upload failed. Try again.')
      setPhotoPreview(null)
    } finally {
      setUploading(false)
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }

  const removePhoto = () => {
    setPhotoUrl(null)
    setPhotoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleLog = async () => {
    if (submitting || uploading) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/commitments/${commitmentId}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: body.trim() || undefined,
          media_urls: photoUrl ? [photoUrl] : undefined,
        }),
      })

      if (res.ok) {
        setSessionCount(c => c + 1)
        setLogged(true)
        setBody('')
        setPhotoUrl(null)
        setPhotoPreview(null)
        if (fileInputRef.current) fileInputRef.current.value = ''

        setTimeout(() => {
          setLogged(false)
          setTimeout(() => textareaRef.current?.focus(), 50)
        }, 1500)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to log session.')
      }
    } catch {
      setError('Network error. Try again.')
    }

    setSubmitting(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleLog()
    }
  }

  const nextSession = sessionCount + 1
  const isReady = !submitting && !uploading

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#1a3a6b',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '\"Crimson Text\", Georgia, serif',
      color: '#ffffff',
      overscrollBehavior: 'none',
    }}>

      {/* Top bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: '20px 24px 0',
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: 'Roboto, sans-serif',
          fontSize: '13px',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.5)',
        }}>
          Search Star
        </span>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.4)',
          }}>
            Day {dayNumber} &middot; Session {nextSession}
          </div>
          <div style={{
            fontFamily: '\"Crimson Text\", Georgia, serif',
            fontSize: '14px',
            color: 'rgba(255,255,255,0.55)',
            marginTop: '2px',
            maxWidth: '200px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {title}
          </div>
        </div>
      </div>

      {/* Textarea */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 24px 12px' }}>
        <textarea
          ref={textareaRef}
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What did you work on?"
          autoFocus
          style={{
            flex: 1,
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            resize: 'none',
            fontFamily: '\"Crimson Text\", Georgia, serif',
            fontSize: '24px',
            lineHeight: 1.5,
            color: '#ffffff',
            caretColor: 'rgba(255,255,255,0.8)',
          }}
          className="log-textarea"
        />

        {/* Photo preview */}
        {photoPreview && (
          <div style={{ marginTop: '12px', position: 'relative', alignSelf: 'flex-start' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoPreview}
              alt="Session photo"
              style={{
                width: '120px',
                height: '120px',
                objectFit: 'cover',
                borderRadius: '3px',
                opacity: uploading ? 0.5 : 1,
                transition: 'opacity 0.2s',
              }}
            />
            {uploading && (
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <div className="upload-spinner" />
              </div>
            )}
            {!uploading && (
              <button
                onClick={removePhoto}
                style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '-8px',
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,0.7)',
                  border: '1.5px solid rgba(255,255,255,0.4)',
                  color: '#fff',
                  fontSize: '14px',
                  lineHeight: '1',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                }}
              >
                ×
              </button>
            )}
          </div>
        )}

        {error && (
          <p style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: '13px',
            color: 'rgba(255,120,120,0.9)',
            marginTop: '8px',
            marginBottom: 0,
          }}>
            {error}
          </p>
        )}
      </div>

      {/* Bottom controls */}
      <div style={{ padding: '0 24px 32px', flexShrink: 0 }}>

        {/* Photo buttons — Take photo + Upload from gallery */}
        {!photoPreview && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            {/* Hidden inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              style={{ display: 'none' }}
              id="photo-gallery-input"
            />
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoChange}
              style={{ display: 'none' }}
              id="photo-camera-input"
            />

            {/* Take photo */}
            <label
              htmlFor="photo-camera-input"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '10px 12px',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '3px',
                cursor: 'pointer',
                fontFamily: 'Roboto, sans-serif',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.7)',
                background: 'rgba(255,255,255,0.07)',
                userSelect: 'none',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              Take photo
            </label>

            {/* Upload from gallery */}
            <label
              htmlFor="photo-gallery-input"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '10px 12px',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '3px',
                cursor: 'pointer',
                fontFamily: 'Roboto, sans-serif',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.5)',
                background: 'transparent',
                userSelect: 'none',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              Gallery
            </label>
          </div>
        )}

        {/* After photo is attached — show replace option */}
        {photoPreview && !uploading && (
          <div style={{ marginBottom: '12px' }}>
            <label
              htmlFor="photo-gallery-input"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '3px',
                cursor: 'pointer',
                fontFamily: 'Roboto, sans-serif',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.4)',
                userSelect: 'none',
              }}
            >
              Replace photo
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              style={{ display: 'none' }}
              id="photo-gallery-input"
            />
          </div>
        )}

        {/* Log button */}
        <button
          onClick={handleLog}
          disabled={!isReady}
          style={{
            width: '100%',
            padding: '18px',
            background: logged ? 'rgba(255,255,255,0.15)' : '#ffffff',
            color: logged ? '#ffffff' : '#1a3a6b',
            border: logged ? '2px solid rgba(255,255,255,0.3)' : 'none',
            borderRadius: '3px',
            fontFamily: 'Roboto, sans-serif',
            fontSize: '14px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            cursor: isReady ? 'pointer' : 'not-allowed',
            opacity: isReady ? 1 : 0.6,
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          {logged ? (
            <>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8l4 4 6-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Logged
            </>
          ) : uploading ? (
            'Uploading photo...'
          ) : submitting ? (
            'Logging...'
          ) : (
            'Log Session'
          )}
        </button>

        <div style={{ textAlign: 'center', marginTop: '12px' }}>
          <a href="/start" style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>
            Back to streak
          </a>
        </div>
      </div>

      <style>{`
        .log-textarea::placeholder { color: rgba(255,255,255,0.25); }
        .log-textarea:focus { outline: none; }
        * { -webkit-tap-highlight-color: transparent; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .upload-spinner {
          width: 24px; height: 24px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
      `}</style>
    </div>
  )
}
