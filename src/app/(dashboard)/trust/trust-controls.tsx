'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface TrustControlsProps {
  shareEnabled: boolean
  userId: string
  isPrivate: boolean
}

export function TrustControls({ shareEnabled, userId, isPrivate }: TrustControlsProps) {
  const router = useRouter()
  const [computing, setComputing] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [currentShareEnabled, setCurrentShareEnabled] = useState(shareEnabled)
  const [shareUrl, setShareUrl] = useState<string | null>(
    shareEnabled ? `${typeof window !== 'undefined' ? window.location.origin : 'https://www.searchstar.com'}/trust/${userId}` : null
  )
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleRecompute() {
    setComputing(true)
    setError(null)
    try {
      const res = await fetch('/api/trust/compute', { method: 'POST' })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Recompute failed.')
      } else {
        router.refresh()
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setComputing(false)
    }
  }

  async function handleToggleShare() {
    if (isPrivate) return
    setSharing(true)
    setError(null)
    try {
      const res = await fetch('/api/trust/share', { method: 'POST' })
      const d = await res.json()
      if (!res.ok) {
        setError(d.error ?? 'Could not update share settings.')
      } else {
        setCurrentShareEnabled(d.share_enabled)
        setShareUrl(d.share_url)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSharing(false)
    }
  }

  async function handleCopy() {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Recompute */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e0e0e0',
          borderRadius: '3px',
          padding: '24px',
        }}
      >
        <h3
          style={{
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '18px',
            fontWeight: 600,
            color: '#1a3a6b',
            margin: '0 0 8px',
          }}
        >
          Update Your Record
        </h3>
        <p
          style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: '14px',
            color: '#555',
            margin: '0 0 16px',
            lineHeight: '1.6',
          }}
        >
          Your Trust record is computed from all confirmed sessions, completed commitments, and active validators.
          Recompute to reflect your latest activity.
        </p>
        <button
          onClick={handleRecompute}
          disabled={computing}
          style={{
            background: computing ? '#8a9bb5' : '#1a3a6b',
            color: '#ffffff',
            border: 'none',
            borderRadius: '3px',
            padding: '10px 20px',
            fontFamily: 'Roboto, sans-serif',
            fontSize: '13px',
            fontWeight: 500,
            cursor: computing ? 'not-allowed' : 'pointer',
            letterSpacing: '0.03em',
          }}
        >
          {computing ? 'Recomputing...' : 'Recompute Now'}
        </button>
      </div>

      {/* Share */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e0e0e0',
          borderRadius: '3px',
          padding: '24px',
        }}
      >
        <h3
          style={{
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '18px',
            fontWeight: 600,
            color: '#1a3a6b',
            margin: '0 0 8px',
          }}
        >
          Share Your Trust Record
        </h3>

        {isPrivate ? (
          <p
            style={{
              fontFamily: 'Roboto, sans-serif',
              fontSize: '14px',
              color: '#555',
              margin: '0',
              lineHeight: '1.6',
            }}
          >
            Your profile is set to private. To share your Trust record,{' '}
            <a
              href="/account"
              style={{ color: '#1a3a6b', textDecoration: 'underline' }}
            >
              update your visibility settings
            </a>{' '}
            first.
          </p>
        ) : (
          <>
            <p
              style={{
                fontFamily: 'Roboto, sans-serif',
                fontSize: '14px',
                color: '#555',
                margin: '0 0 16px',
                lineHeight: '1.6',
              }}
            >
              {currentShareEnabled
                ? 'Your Trust record is publicly shareable. Anyone with the link can view your stage and practice summary.'
                : 'Generate a shareable link to let others see your Trust stage and practice summary.'}
            </p>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={handleToggleShare}
                disabled={sharing}
                style={{
                  background: currentShareEnabled ? '#f5f5f5' : '#1a3a6b',
                  color: currentShareEnabled ? '#333' : '#ffffff',
                  border: currentShareEnabled ? '1px solid #ccc' : 'none',
                  borderRadius: '3px',
                  padding: '10px 20px',
                  fontFamily: 'Roboto, sans-serif',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: sharing ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.03em',
                }}
              >
                {sharing
                  ? 'Updating...'
                  : currentShareEnabled
                  ? 'Disable sharing'
                  : 'Enable sharing'}
              </button>

              {currentShareEnabled && shareUrl && (
                <button
                  onClick={handleCopy}
                  style={{
                    background: 'transparent',
                    color: '#1a3a6b',
                    border: '1px solid #1a3a6b',
                    borderRadius: '3px',
                    padding: '10px 20px',
                    fontFamily: 'Roboto, sans-serif',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    letterSpacing: '0.03em',
                  }}
                >
                  {copied ? 'Copied!' : 'Copy link'}
                </button>
              )}
            </div>

            {currentShareEnabled && shareUrl && (
              <p
                style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '12px',
                  color: '#666',
                  margin: '12px 0 0',
                  wordBreak: 'break-all',
                }}
              >
                {shareUrl}
              </p>
            )}
          </>
        )}
      </div>

      {error && (
        <p
          style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: '13px',
            color: '#c0392b',
            margin: '0',
          }}
        >
          {error}
        </p>
      )}
    </div>
  )
}
