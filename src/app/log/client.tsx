'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

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
  daysRemaining: number
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
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${endpoint}/upload`, {
    method: 'POST', body: formData,
  })
  if (!res.ok) throw new Error('Upload failed')
  const data = await res.json()
  return data.secure_url as string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function isVideoUrl(url: string) {
  return /\.(mp4|mov|avi|webm|mkv)/i.test(url) || url.includes('/video/upload/')
}

export default function LogClient({
  commitmentId, title, dayNumber, daysRemaining, sessionsLogged, recentPosts,
}: Props) {
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [logged, setLogged] = useState(false)
  const [lastLoggedAt, setLastLoggedAt] = useState<string | null>(null)
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
        setPosts(prev => [newPost, ...prev].slice(0, 10))
        setSessionCount(c => c + 1)
        setLogged(true)
        setLastLoggedAt(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))
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
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handleLog() }
  }

  const pct = Math.min(100, Math.round((dayNumber / 90) * 100))

  const label: React.CSSProperties = {
    fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700,
    letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)',
  }

  const labelDark: React.CSSProperties = {
    fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700,
    letterSpacing: '0.12em', textTransform: 'uppercase', color: '#767676',
  }

  return (
    <>
      {/* Full-screen navy shell */}
      <div style={{
        minHeight: '100dvh',
        background: '#1a3a6b',
        fontFamily: '"Crimson Text", Georgia, serif',
        color: '#ffffff',
      }}>
        {/* Centered content column — narrow on mobile, wider on desktop */}
        <div style={{
          maxWidth: '960px',
          margin: '0 auto',
          padding: 'clamp(16px, 4vw, 48px) clamp(16px, 4vw, 48px)',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: '0',
        }}>

          {/* TOP BAR */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '28px',
          }}>
            <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
              Search Star
            </span>
            <Link href="/dashboard" style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>
              Dashboard
            </Link>
          </div>

          {/* TWO-COLUMN LAYOUT on wide screens */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)',
            gap: '40px',
            alignItems: 'start',
          }} className="log-grid">

            {/* LEFT — compose + progress */}
            <div>
              {/* Title + progress */}
              <div style={{ marginBottom: '24px' }}>
                <p style={label}>Active streak</p>
                <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 700, color: '#ffffff', lineHeight: 1.15, margin: '6px 0 16px' }}>
                  {title}
                </h1>
                {/* Progress bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                  <span style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '22px', fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
                    Day {dayNumber}
                  </span>
                  <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>
                    {daysRemaining} days remaining
                  </span>
                </div>
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: '#ffffff', borderRadius: '2px', transition: 'width 0.3s ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
                  <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>Day 1</span>
                  <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>{sessionCount} sessions logged</span>
                  <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>Day 90</span>
                </div>
              </div>

              {/* Success banner */}
              {lastLoggedAt && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', padding: '10px 14px', background: 'rgba(45,106,45,0.3)', border: '1px solid rgba(45,106,45,0.5)', borderRadius: '3px' }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="7" fill="#4ade80"/><path d="M4 7l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: 'rgba(255,255,255,0.8)' }}>
                    Session logged at {lastLoggedAt}
                  </span>
                </div>
              )}

              {/* Compose box */}
              <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '3px', padding: '16px', marginBottom: '12px' }}>
                <textarea
                  ref={textareaRef}
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="What did you work on?"
                  autoFocus
                  style={{
                    width: '100%', height: '110px',
                    background: 'transparent', border: 'none', outline: 'none', resize: 'none',
                    fontFamily: '"Crimson Text", Georgia, serif', fontSize: '20px',
                    lineHeight: 1.5, color: '#ffffff', caretColor: 'rgba(255,255,255,0.8)',
                  }}
                  className="log-textarea"
                />

                {/* Media preview */}
                {mediaPreview && (
                  <div style={{ marginTop: '8px', position: 'relative', display: 'inline-block' }}>
                    {mediaIsVideo ? (
                      <video src={mediaPreview} style={{ width: '120px', height: '90px', objectFit: 'cover', borderRadius: '3px', opacity: uploading ? 0.5 : 1, display: 'block' }} muted playsInline />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaPreview} alt="" style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: '3px', opacity: uploading ? 0.5 : 1, display: 'block' }} />
                    )}
                    {uploading && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(26,58,107,0.5)', borderRadius: '3px' }}>
                        <div className="upload-spinner" />
                      </div>
                    )}
                    {!uploading && (
                      <>
                        {mediaIsVideo && <div style={{ position: 'absolute', bottom: '4px', left: '4px', background: 'rgba(0,0,0,0.6)', borderRadius: '2px', padding: '1px 4px', fontFamily: 'Roboto, sans-serif', fontSize: '9px', fontWeight: 700, color: '#fff' }}>VIDEO</div>}
                        <button onClick={removeMedia} style={{ position: 'absolute', top: '-7px', right: '-7px', width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.4)', color: '#fff', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>×</button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {error && <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: 'rgba(255,120,120,0.9)', marginBottom: '10px' }}>{error}</p>}

              {/* Hidden file inputs */}
              <input ref={galleryInputRef} type="file" accept="image/*,video/*" onChange={handleMediaChange} style={{ display: 'none' }} id="gallery-input" />
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleMediaChange} style={{ display: 'none' }} id="camera-input" />

              {/* Controls row */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {/* Camera */}
                {!mediaPreview && (
                  <label htmlFor="camera-input" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '8px 14px', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '3px', cursor: 'pointer', fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.06)', userSelect: 'none' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
                    </svg>
                    Camera
                  </label>
                )}
                {/* Gallery */}
                {!mediaPreview && (
                  <label htmlFor="gallery-input" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '8px 14px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '3px', cursor: 'pointer', fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', userSelect: 'none' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                    </svg>
                    Gallery
                  </label>
                )}
                {mediaPreview && !uploading && (
                  <label htmlFor="gallery-input" style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 12px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '3px', cursor: 'pointer', fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', userSelect: 'none' }}>
                    Replace
                  </label>
                )}

                {/* Spacer */}
                <div style={{ flex: 1 }} />

                {/* Log button */}
                <button
                  onClick={handleLog}
                  disabled={!isReady}
                  style={{
                    padding: '10px 24px',
                    background: logged ? 'rgba(255,255,255,0.15)' : isReady ? '#ffffff' : 'rgba(255,255,255,0.18)',
                    color: logged ? '#ffffff' : isReady ? '#1a3a6b' : 'rgba(255,255,255,0.35)',
                    border: logged ? '1px solid rgba(255,255,255,0.3)' : 'none',
                    borderRadius: '3px',
                    fontFamily: 'Roboto, sans-serif', fontSize: '13px', fontWeight: 700,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    cursor: isReady ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0,
                  }}
                >
                  {logged ? (
                    <><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>Logged</>
                  ) : uploading ? 'Uploading...' : submitting ? 'Logging...' : 'Log Session'}
                </button>
              </div>
            </div>

            {/* RIGHT — recent sessions + three jobs */}
            <div>
              {/* Recent sessions */}
              {posts.length > 0 && (
                <div style={{ marginBottom: '28px' }}>
                  <p style={{ ...label, marginBottom: '12px' }}>Recent sessions</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {posts.map(post => (
                      <div key={post.id} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '3px', padding: '10px 12px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        {post.media_urls?.[0] && (
                          <div style={{ flexShrink: 0 }}>
                            {isVideoUrl(post.media_urls[0]) ? (
                              <div style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
                              </div>
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={post.media_urls[0]} alt="" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '2px', display: 'block' }} />
                            )}
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', gap: '8px' }}>
                            <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>
                              {post.session_number > 0 ? `Session ${post.session_number}` : 'Start ritual'}
                            </span>
                            <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '10px', color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>
                              {formatDate(post.posted_at)}
                            </span>
                          </div>
                          {post.body ? (
                            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.4, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                              {post.body}
                            </p>
                          ) : (
                            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', color: 'rgba(255,255,255,0.25)', margin: 0, fontStyle: 'italic' }}>
                              {post.media_urls?.[0] ? (isVideoUrl(post.media_urls[0]) ? 'Video' : 'Photo') : 'Session logged'}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Three jobs */}
              <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '3px', padding: '20px' }}>
                <p style={{ ...label, marginBottom: '14px' }}>Your three jobs</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {[
                    { n: '01', text: 'Come back tomorrow and log your session. Every day for 90 days.' },
                    { n: '02', text: "Share your sponsor link with people who believe in what you're building.", link: `/sponsor/${commitmentId}`, linkText: 'Copy sponsor link →' },
                    { n: '03', text: 'Invite more validators — people who will witness the work is real.', link: `/start/validator/${commitmentId}`, linkText: 'Invite a validator →' },
                  ].map(item => (
                    <div key={item.n} style={{ display: 'flex', gap: '12px' }}>
                      <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.25)', flexShrink: 0, paddingTop: '2px', minWidth: '18px' }}>{item.n}</span>
                      <div>
                        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: 'rgba(255,255,255,0.65)', margin: '0 0 4px', lineHeight: 1.55 }}>{item.text}</p>
                        {item.link && (
                          <Link href={item.link} style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.55)', textDecoration: 'none', borderBottom: '1px solid rgba(255,255,255,0.25)' }}>
                            {item.linkText}
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer links */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px', marginTop: '20px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <Link href="/dashboard" style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Dashboard →</Link>
                <Link href={`/start/launch/${commitmentId}`} style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Sponsors & validators →</Link>
              </div>
            </div>

          </div>{/* end grid */}
        </div>{/* end content column */}
      </div>{/* end shell */}

      <style>{`
        .log-textarea::placeholder { color: rgba(255,255,255,0.22); }
        .log-textarea:focus { outline: none; }
        * { -webkit-tap-highlight-color: transparent; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .upload-spinner { width: 22px; height: 22px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }

        /* Single column on mobile/tablet portrait */
        @media (max-width: 700px) {
          .log-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  )
}
