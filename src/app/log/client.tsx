'use client'

import { useState, useEffect, useRef } from 'react'

interface Post {
  id: string
  body: string | null
  session_number: number
  posted_at: string
  media_urls: string[] | null
}

interface Props {
  commitmentId: string
  title: string
  dayNumber: number
  sessionsLogged: number
  recentPosts: Post[]
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

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function isVideo(url: string) {
  return /\.(mp4|mov|avi|webm|mkv)/i.test(url) || url.includes('/video/upload/')
}

export default function LogClient({
  commitmentId, title, dayNumber, sessionsLogged, recentPosts,
}: Props) {
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [logged, setLogged] = useState(false)
  const [sessionCount, setSessionCount] = useState(sessionsLogged)
  const [error, setError] = useState<string | null>(null)
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [mediaIsVideo, setMediaIsVideo] = useState(false)
  const [posts, setPosts] = useState<Post[]>(recentPosts)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => textareaRef.current?.focus(), 50)
    return () => clearTimeout(timer)
  }, [])

  const handleMediaChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isVid = file.type.startsWith('video/')
    setMediaIsVideo(isVid)
    setError(null)

    // Size gate: 50MB
    if (file.size > 50 * 1024 * 1024) {
      setError(isVid ? 'Video too large — keep it under 15 seconds.' : 'Photo too large.')
      e.target.value = ''
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setMediaPreview(objectUrl)
    setMediaUrl(null)
    setUploading(true)

    try {
      const url = await uploadToCloudinary(file)
      setMediaUrl(url)
    } catch {
      setError('Upload failed. Try again.')
      setMediaPreview(null)
    } finally {
      setUploading(false)
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }

  const removeMedia = () => {
    setMediaUrl(null)
    setMediaPreview(null)
    setMediaIsVideo(false)
    if (galleryInputRef.current) galleryInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  const hasContent = body.trim().length > 0 || mediaUrl !== null
  const isReady = hasContent && !submitting && !uploading

  const handleLog = async () => {
    if (!isReady) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/commitments/${commitmentId}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: body.trim() || undefined,
          media_urls: mediaUrl ? [mediaUrl] : undefined,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const newPost: Post = {
          id: data.id,
          body: body.trim() || null,
          session_number: sessionCount + 1,
          posted_at: new Date().toISOString(),
          media_urls: mediaUrl ? [mediaUrl] : null,
        }
        setPosts(prev => [newPost, ...prev].slice(0, 5))
        setSessionCount(c => c + 1)
        setLogged(true)
        setBody('')
        setMediaUrl(null)
        setMediaPreview(null)
        setMediaIsVideo(false)
        if (galleryInputRef.current) galleryInputRef.current.value = ''
        if (cameraInputRef.current) cameraInputRef.current.value = ''

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

  const btnStyle = {
    flex: 1,
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: '6px',
    padding: '10px 12px',
    borderRadius: '3px',
    cursor: 'pointer' as const,
    fontFamily: 'Roboto, sans-serif',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    userSelect: 'none' as const,
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#1a3a6b',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '"Crimson Text", Georgia, serif',
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
          fontFamily: 'Roboto, sans-serif', fontSize: '13px', fontWeight: 700,
          letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)',
        }}>
          Search Star
        </span>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700,
            letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)',
          }}>
            Day {dayNumber} &middot; Session {sessionCount + 1}
          </div>
          <div style={{
            fontSize: '14px', color: 'rgba(255,255,255,0.55)', marginTop: '2px',
            maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {title}
          </div>
        </div>
      </div>

      {/* Compose area — fixed height, not flex-fill */}
      <div style={{ padding: '16px 24px 0', flexShrink: 0 }}>
        <textarea
          ref={textareaRef}
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What did you work on?"
          autoFocus
          style={{
            width: '100%',
            height: '120px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '3px',
            outline: 'none',
            resize: 'none',
            padding: '12px 14px',
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '20px',
            lineHeight: 1.5,
            color: '#ffffff',
            caretColor: 'rgba(255,255,255,0.8)',
          }}
          className="log-textarea"
        />

        {/* Media preview */}
        {mediaPreview && (
          <div style={{ marginTop: '10px', position: 'relative', display: 'inline-block' }}>
            {mediaIsVideo ? (
              <video
                src={mediaPreview}
                style={{ width: '140px', height: '100px', objectFit: 'cover', borderRadius: '3px', opacity: uploading ? 0.5 : 1, display: 'block' }}
                muted playsInline
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaPreview}
                alt="Session media"
                style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '3px', opacity: uploading ? 0.5 : 1 }}
              />
            )}
            {uploading && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(26,58,107,0.5)', borderRadius: '3px' }}>
                <div className="upload-spinner" />
              </div>
            )}
            {!uploading && (
              <>
                {mediaIsVideo && (
                  <div style={{ position: 'absolute', bottom: '5px', left: '5px', background: 'rgba(0,0,0,0.6)', borderRadius: '2px', padding: '2px 5px', fontFamily: 'Roboto, sans-serif', fontSize: '9px', fontWeight: 700, color: '#fff', letterSpacing: '0.05em' }}>
                    VIDEO
                  </div>
                )}
                <button onClick={removeMedia} style={{ position: 'absolute', top: '-8px', right: '-8px', width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(0,0,0,0.7)', border: '1.5px solid rgba(255,255,255,0.4)', color: '#fff', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                  ×
                </button>
              </>
            )}
          </div>
        )}

        {error && (
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: 'rgba(255,120,120,0.9)', marginTop: '8px', marginBottom: 0 }}>
            {error}
          </p>
        )}
      </div>

      {/* Controls */}
      <div style={{ padding: '12px 24px 0', flexShrink: 0 }}>

        {/* Hidden inputs */}
        <input ref={galleryInputRef} type="file" accept="image/*,video/*" onChange={handleMediaChange} style={{ display: 'none' }} id="gallery-input" />
        <input ref={cameraInputRef} type="file" accept="image/*,video/*" capture="environment" onChange={handleMediaChange} style={{ display: 'none' }} id="camera-input" />

        {/* Media buttons */}
        {!mediaPreview && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <label htmlFor="camera-input" style={{ ...btnStyle, border: '1px solid rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.07)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              Camera
            </label>
            <label htmlFor="gallery-input" style={{ ...btnStyle, border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.5)', background: 'transparent' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              Gallery
            </label>
          </div>
        )}
        {mediaPreview && !uploading && (
          <div style={{ marginBottom: '10px' }}>
            <label htmlFor="gallery-input" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 10px', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '3px', cursor: 'pointer', fontFamily: 'Roboto, sans-serif', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', userSelect: 'none' }}>
              Replace media
            </label>
          </div>
        )}

        {/* Log button */}
        <button
          onClick={handleLog}
          disabled={!isReady}
          style={{
            width: '100%',
            padding: '16px',
            background: logged ? 'rgba(255,255,255,0.15)' : isReady ? '#ffffff' : 'rgba(255,255,255,0.2)',
            color: logged ? '#ffffff' : isReady ? '#1a3a6b' : 'rgba(255,255,255,0.4)',
            border: logged ? '2px solid rgba(255,255,255,0.3)' : 'none',
            borderRadius: '3px',
            fontFamily: 'Roboto, sans-serif', fontSize: '14px', fontWeight: 700,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            cursor: isReady ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}
        >
          {logged ? (
            <>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8l4 4 6-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Logged
            </>
          ) : uploading ? 'Uploading...' : submitting ? 'Logging...' : 'Log Session'}
        </button>

        <div style={{ textAlign: 'center', marginTop: '10px' }}>
          <a href="/start" style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>
            Back to streak
          </a>
        </div>
      </div>

      {/* Recent sessions */}
      {posts.length > 0 && (
        <div style={{ flex: 1, padding: '20px 24px 32px', overflowY: 'auto' }}>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '12px' }}>
            Recent sessions
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {posts.map(post => (
              <div key={post.id} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '3px', padding: '10px 12px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                {/* Thumbnail if media */}
                {post.media_urls && post.media_urls[0] && (
                  <div style={{ flexShrink: 0 }}>
                    {isVideo(post.media_urls[0]) ? (
                      <div style={{ width: '44px', height: '44px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                        </svg>
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.media_urls[0]} alt="" style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '2px', display: 'block' }} />
                    )}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Roboto, sans-serif', fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginBottom: '3px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Session {post.session_number}</span>
                    <span>{formatTime(post.posted_at)}</span>
                  </div>
                  {post.body && (
                    <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.4, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {post.body}
                    </p>
                  )}
                  {!post.body && post.media_urls && post.media_urls[0] && (
                    <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', color: 'rgba(255,255,255,0.3)', margin: 0, fontStyle: 'italic' }}>
                      {isVideo(post.media_urls[0]) ? 'Video' : 'Photo'}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .log-textarea::placeholder { color: rgba(255,255,255,0.25); }
        .log-textarea:focus { outline: none; }
        * { -webkit-tap-highlight-color: transparent; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .upload-spinner { width: 24px; height: 24px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #ffffff; border-radius: 50%; animation: spin 0.7s linear infinite; }
      `}</style>
    </div>
  )
}
