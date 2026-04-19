'use client'

import { useState } from 'react'

// CompanionPanel
//
// The practitioner's daily surface for the Companion. Rendered on /commit/[id]
// (light theme) and /log (dark theme on the navy shell), for launch and
// active commitments.
//
// Two theme variants live in the same component so the contract — collapsed
// until tapped, opening reflection on first expand, single-column chat with
// serif Companion voice, follow-up turns — cannot drift between surfaces.
// The `variant` prop picks a `theme` object; every color/border/background
// reads from there. Structure and behavior are identical either way.
//
// The collapsed-state copy adapts to the commitment status: during active
// the Companion has read the session record, during launch there are no
// sessions yet so the framing is forward-looking (what are you about to
// begin?). The opening-reflection call itself is identical either way —
// the server side picks the right system prompt from the commitment's
// status, so the client just has to get the pre-open copy right.
//
// Visual conventions (worth calling out because they're deliberate):
//
// - The panel itself uses Roboto/sans for chrome (the eyebrow label, the
//   expand button, error states, the input textarea).
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

type Theme = {
  panelBg: string
  panelBorder: string
  panelAccent: string
  eyebrow: string
  collapsedCopy: string
  userTurn: string
  assistantTurn: string
  loadingText: string
  errorText: string
  textareaBg: string
  textareaBgDisabled: string
  textareaBorder: string
  textareaText: string
  textareaPlaceholderClass: string
  primaryBg: string
  primaryBgDisabled: string
  primaryText: string
}

const LIGHT_THEME: Theme = {
  panelBg: '#fafaf8',
  panelBorder: '1px solid #d4d4d4',
  panelAccent: '3px solid #1a3a6b',
  eyebrow: '#767676',
  collapsedCopy: '#3a3a3a',
  userTurn: '#3a3a3a',
  assistantTurn: '#1a1a1a',
  loadingText: '#b8b8b8',
  errorText: '#991b1b',
  textareaBg: '#fff',
  textareaBgDisabled: '#f5f5f5',
  textareaBorder: '1px solid #d4d4d4',
  textareaText: '#1a1a1a',
  textareaPlaceholderClass: 'companion-textarea-light',
  primaryBg: '#1a3a6b',
  primaryBgDisabled: '#b8b8b8',
  primaryText: '#fff',
}

// Dark variant lives on the /log navy shell (#1a3a6b background). A solid
// white panel would read as a popup, so the panel is a subtle translucent
// lift of the navy, matching the tokens /log's other cards use
// (rgba(255,255,255,0.06) bg, 0.1 border, 0.45 label). The primary button
// inverts to white-on-navy-text to stay readable against the shell.
const DARK_THEME: Theme = {
  panelBg: 'rgba(255,255,255,0.06)',
  panelBorder: '1px solid rgba(255,255,255,0.1)',
  panelAccent: '3px solid rgba(255,255,255,0.5)',
  eyebrow: 'rgba(255,255,255,0.45)',
  collapsedCopy: 'rgba(255,255,255,0.75)',
  userTurn: 'rgba(255,255,255,0.7)',
  assistantTurn: '#ffffff',
  loadingText: 'rgba(255,255,255,0.4)',
  errorText: 'rgba(255,150,150,0.9)',
  textareaBg: 'rgba(255,255,255,0.08)',
  textareaBgDisabled: 'rgba(255,255,255,0.04)',
  textareaBorder: '1px solid rgba(255,255,255,0.15)',
  textareaText: '#ffffff',
  textareaPlaceholderClass: 'companion-textarea-dark',
  primaryBg: '#ffffff',
  primaryBgDisabled: 'rgba(255,255,255,0.18)',
  primaryText: '#1a3a6b',
}

interface CompanionPanelProps {
  commitmentId: string
  status?: 'launch' | 'active'
  variant?: 'light' | 'dark'
}

export default function CompanionPanel({
  commitmentId,
  status = 'active',
  variant = 'light',
}: CompanionPanelProps) {
  const theme = variant === 'dark' ? DARK_THEME : LIGHT_THEME

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
        background: theme.panelBg,
        border: theme.panelBorder,
        borderLeft: theme.panelAccent,
        borderRadius: '3px',
        padding: '20px 24px',
        marginBottom: variant === 'dark' ? '24px' : '40px',
      }}
    >
      <p
        style={{
          fontFamily: 'Roboto, sans-serif',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: theme.eyebrow,
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
              color: theme.collapsedCopy,
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
              background: theme.primaryBg,
              color: theme.primaryText,
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
                      color: theme.userTurn,
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
                      color: theme.assistantTurn,
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
                  color: theme.loadingText,
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
                  color: theme.errorText,
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
              className={theme.textareaPlaceholderClass}
              style={{
                fontFamily: 'Roboto, sans-serif',
                fontSize: '14px',
                color: theme.textareaText,
                padding: '10px 12px',
                border: theme.textareaBorder,
                borderRadius: '3px',
                resize: 'vertical',
                lineHeight: '1.5',
                background: loading ? theme.textareaBgDisabled : theme.textareaBg,
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleSubmit}
                disabled={loading || draft.trim().length === 0}
                style={{
                  background:
                    loading || draft.trim().length === 0 ? theme.primaryBgDisabled : theme.primaryBg,
                  color: theme.primaryText,
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

          {/* Inline styles can't target pseudo-elements, so the class hook
              on the textarea above drives placeholder color per variant. */}
          <style>{`
            .companion-textarea-light::placeholder { color: #b8b8b8; }
            .companion-textarea-dark::placeholder { color: rgba(255,255,255,0.3); }
          `}</style>
        </>
      )}
    </div>
  )
}
