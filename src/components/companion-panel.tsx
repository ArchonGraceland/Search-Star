'use client'

import { useState } from 'react'

// CompanionPanel
//
// The practitioner's daily surface for the Companion. Rendered on /commit/[id]
// below the session history, for launch and active commitments.
//
// The collapsed-state copy adapts to the commitment status: during active the
// Companion has read the session record, during launch there are no sessions
// yet so the framing is forward-looking (what are you about to begin?). The
// opening-reflection call itself is identical either way — the server side
// picks the right system prompt from the commitment's status, so the client
// just has to get the pre-open copy right.
//
// Visual conventions (worth calling out because they're deliberate):
//
// - The panel itself uses Roboto/sans for chrome (the eyebrow label, the
//   expand button, error states, the input textarea) — same as the rest of
//   the dashboard.
// - The Companion's own speech is Crimson Text serif at 16px with relaxed
//   line-height. This is the visual equivalent of a different voice speaking.
//   Every other text on the page is sans; when the Companion talks, the font
//   shifts. A practitioner should feel the change without being told.
// - User turns in the chat are also Roboto/sans — so the visual distinction
//   between the practitioner's own words and the Companion's is consistent
//   with the rest of the page's logic (user writes in sans, Companion speaks
//   in serif).
// - Collapsed by default. The Companion is a voluntary surface, not an
//   interruption. A practitioner opens it when they want it.

type ChatTurn = { role: 'user' | 'assistant'; content: string }

interface CompanionPanelProps {
  commitmentId: string
  status?: 'launch' | 'active'
}

export default function CompanionPanel({ commitmentId, status = 'active' }: CompanionPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  async function callReflect(userMessage?: string) {
    setLoading(true)
    setError(null)
    try {
      // Pass only prior turns as history — not the one we're about to send.
      const payload: {
        commitment_id: string
        user_message?: string
        history?: ChatTurn[]
      } = { commitment_id: commitmentId }
      if (userMessage) {
        payload.user_message = userMessage
        payload.history = turns
      }

      const res = await fetch('/api/companion/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        if (res.status === 429) {
          setError('Companion rate limit reached. Try again next hour.')
        } else {
          setError('The Companion is unreachable right now.')
        }
        return
      }

      const data = await res.json()
      if (typeof data?.text !== 'string' || data.text.trim().length === 0) {
        setError('The Companion is unreachable right now.')
        return
      }

      const nextTurns: ChatTurn[] = []
      if (userMessage) {
        nextTurns.push({ role: 'user', content: userMessage })
      }
      nextTurns.push({ role: 'assistant', content: data.text })
      setTurns((prev) => [...prev, ...nextTurns])
    } catch {
      setError('The Companion is unreachable right now.')
    } finally {
      setLoading(false)
    }
  }

  function handleExpand() {
    setExpanded(true)
    // Fire the opening reflection on first expand only.
    if (turns.length === 0 && !loading) {
      void callReflect()
    }
  }

  function handleSubmit() {
    const text = draft.trim()
    if (!text || loading) return
    setDraft('')
    void callReflect(text)
  }

  return (
    <div
      style={{
        background: '#fafaf8',
        border: '1px solid #d4d4d4',
        borderLeft: '3px solid #1a3a6b',
        borderRadius: '3px',
        padding: '20px 24px',
        marginBottom: '40px',
      }}
    >
      <p
        style={{
          fontFamily: 'Roboto, sans-serif',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#767676',
          marginBottom: '12px',
          marginTop: 0,
        }}
      >
        Companion
      </p>

      {!expanded ? (
        <>
          <p
            style={{
              fontFamily: 'Roboto, sans-serif',
              fontSize: '14px',
              color: '#3a3a3a',
              marginBottom: '14px',
              lineHeight: '1.5',
              marginTop: 0,
            }}
          >
            {status === 'launch'
              ? 'The Companion can talk through what you\u2019re about to begin \u2014 what you\u2019re committing to, how you\u2019d explain it to someone who doesn\u2019t know you, or what day 90 might look like.'
              : 'The Companion has read your session record. It can ask a question, notice a pattern, or just listen if you want to think out loud.'}
          </p>
          <button
            onClick={handleExpand}
            style={{
              background: '#1a3a6b',
              color: '#fff',
              fontFamily: 'Roboto, sans-serif',
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              padding: '10px 20px',
              borderRadius: '3px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {status === 'launch' ? 'Talk about what I\u2019m starting' : 'Reflect on my practice'}
          </button>
        </>
      ) : (
        <>
          {/* Conversation */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              marginBottom: '20px',
            }}
          >
            {turns.map((turn, i) => (
              <div key={i}>
                {turn.role === 'user' ? (
                  <p
                    style={{
                      fontFamily: 'Roboto, sans-serif',
                      fontSize: '14px',
                      color: '#3a3a3a',
                      margin: 0,
                      lineHeight: '1.5',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {turn.content}
                  </p>
                ) : (
                  <p
                    style={{
                      fontFamily: "'Crimson Text', Georgia, serif",
                      fontSize: '16px',
                      color: '#1a1a1a',
                      margin: 0,
                      lineHeight: '1.7',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {turn.content}
                  </p>
                )}
              </div>
            ))}
            {loading && (
              <p
                style={{
                  fontFamily: 'Roboto, sans-serif',
                  fontSize: '13px',
                  color: '#b8b8b8',
                  margin: 0,
                  fontStyle: 'italic',
                }}
              >
                Thinking...
              </p>
            )}
            {error && (
              <p
                style={{
                  fontFamily: 'Roboto, sans-serif',
                  fontSize: '13px',
                  color: '#991b1b',
                  margin: 0,
                }}
              >
                {error}
              </p>
            )}
          </div>

          {/* Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
              placeholder="Write to the Companion..."
              rows={3}
              disabled={loading}
              style={{
                fontFamily: 'Roboto, sans-serif',
                fontSize: '14px',
                color: '#1a1a1a',
                padding: '10px 12px',
                border: '1px solid #d4d4d4',
                borderRadius: '3px',
                resize: 'vertical',
                lineHeight: '1.5',
                background: loading ? '#f5f5f5' : '#fff',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleSubmit}
                disabled={loading || draft.trim().length === 0}
                style={{
                  background:
                    loading || draft.trim().length === 0 ? '#b8b8b8' : '#1a3a6b',
                  color: '#fff',
                  fontFamily: 'Roboto, sans-serif',
                  fontSize: '13px',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  padding: '8px 18px',
                  borderRadius: '3px',
                  border: 'none',
                  cursor:
                    loading || draft.trim().length === 0 ? 'default' : 'pointer',
                }}
              >
                Send
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
