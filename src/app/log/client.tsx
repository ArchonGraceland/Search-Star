'use client'

import { useState, useEffect, useRef } from 'react'

interface Props {
  commitmentId: string
  title: string
  dayNumber: number
  sessionsLogged: number
}

export default function LogClient({ commitmentId, title, dayNumber, sessionsLogged }: Props) {
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [logged, setLogged] = useState(false)
  const [sessionCount, setSessionCount] = useState(sessionsLogged)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-focus on mount — critical for instant keyboard on PWA launch
  useEffect(() => {
    const timer = setTimeout(() => {
      textareaRef.current?.focus()
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  const handleLog = async () => {
    if (submitting) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/commitments/${commitmentId}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: body.trim() || undefined }),
      })

      if (res.ok) {
        setSessionCount(c => c + 1)
        setLogged(true)
        setBody('')

        // Show success briefly, then reset for next entry
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
    // Cmd/Ctrl+Enter to submit
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleLog()
    }
  }

  const nextSession = sessionCount + 1

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#1a3a6b',
      display: 'flex',
      flexDirection: 'column',
      padding: '0',
      fontFamily: '"Crimson Text", Georgia, serif',
      color: '#ffffff',
      // Prevent iOS bounce
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
            fontFamily: '"Crimson Text", Georgia, serif',
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

      {/* Textarea — fills the middle */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 24px 16px' }}>
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
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '24px',
            lineHeight: 1.5,
            color: '#ffffff',
            caretColor: 'rgba(255,255,255,0.8)',
            // Placeholder color handled via CSS class
          }}
          className="log-textarea"
        />

        {error && (
          <p style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: '13px',
            color: 'rgba(255,120,120,0.9)',
            marginBottom: '8px',
          }}>
            {error}
          </p>
        )}
      </div>

      {/* Bottom button */}
      <div style={{ padding: '0 24px 32px', flexShrink: 0 }}>
        <button
          onClick={handleLog}
          disabled={submitting}
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
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting ? 0.7 : 1,
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
          ) : submitting ? (
            'Logging...'
          ) : (
            'Log Session'
          )}
        </button>

        <div style={{
          textAlign: 'center',
          marginTop: '12px',
          fontFamily: 'Roboto, sans-serif',
          fontSize: '11px',
          color: 'rgba(255,255,255,0.3)',
        }}>
          <a
            href={`/start`}
            style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}
          >
            Back to streak
          </a>
        </div>
      </div>

      <style>{`
        .log-textarea::placeholder {
          color: rgba(255,255,255,0.25);
        }
        .log-textarea:focus {
          outline: none;
        }
        * {
          -webkit-tap-highlight-color: transparent;
        }
      `}</style>
    </div>
  )
}
