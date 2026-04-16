'use client'

import { useState } from 'react'

type QualityChoice = 'showed_up' | 'pushed_further' | 'breakthrough'

interface ExistingConfirmation {
  id: string
  quality_choice: string | null
  witness_note: string | null
  confirmed_at: string
}

interface Props {
  validatorId: string
  token: string
  commitmentId: string
  postId: string
  commitmentTitle: string
  practitionerName: string
  sessionNumber: number
  postBody: string | null
  mediaUrls: string[]
  postedAt: string
  existingConfirmation: ExistingConfirmation | null
}

function isVideoUrl(url: string) {
  return /\.(mp4|mov|avi|webm|mkv)/i.test(url) || url.includes('/video/upload/')
}

const qualityOptions: { value: QualityChoice; label: string; sub: string }[] = [
  { value: 'showed_up', label: 'Showed up and did the work', sub: 'Consistent, present, following through' },
  { value: 'pushed_further', label: 'Pushed past where they were comfortable', sub: 'Beyond the minimum — reaching' },
  { value: 'breakthrough', label: 'Something shifted here', sub: 'This feels like a breakthrough' },
]

export default function WitnessClient({
  validatorId,
  postId,
  commitmentTitle,
  practitionerName,
  sessionNumber,
  postBody,
  mediaUrls,
  postedAt,
  existingConfirmation,
}: Props) {
  const [witnessNote, setWitnessNote] = useState('')
  const [qualityChoice, setQualityChoice] = useState<QualityChoice | null>(null)
  const [privateMessage, setPrivateMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sessionLabel = sessionNumber > 0 ? `Session ${sessionNumber}` : 'Start ritual'
  const postedDate = new Date(postedAt).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  const notePlaceholder =
    sessionNumber <= 7
      ? `What do you see in how ${practitionerName} is approaching this?`
      : sessionNumber <= 30
      ? `What's changed since you started watching ${practitionerName}'s practice?`
      : `What does this practice mean to ${practitionerName} now?`

  const isReady = witnessNote.trim().length >= 20 && qualityChoice !== null && !submitting

  const handleSubmit = async () => {
    if (!isReady) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/confirmations/${postId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          validator_id: validatorId,
          quality_choice: qualityChoice,
          witness_note: witnessNote.trim(),
          private_message: privateMessage.trim() || undefined,
        }),
      })
      if (res.ok) {
        setSubmitted(true)
      } else {
        const data = await res.json()
        setError(data.error || 'Something went wrong. Try again.')
      }
    } catch {
      setError('Network error. Try again.')
    }
    setSubmitting(false)
  }

  const label: React.CSSProperties = {
    fontFamily: 'Roboto, sans-serif',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#767676',
  }

  if (submitted || existingConfirmation) {
    const alreadyDone = !!existingConfirmation && !submitted
    return (
      <div style={{ minHeight: '100dvh', background: '#f5f5f5', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', fontFamily: '"Crimson Text", Georgia, serif' }}>
        <div style={{ maxWidth: '480px', width: '100%', background: '#ffffff', border: '1px solid #d4d4d4', borderRadius: '6px', padding: '40px 36px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ width: '56px', height: '56px', background: '#f0fdf4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="12" fill="rgba(74,222,128,0.2)" />
              <path d="M6 12l4 4 8-9" stroke="#166534" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 style={{ fontSize: '26px', fontWeight: 700, color: '#1a1a1a', marginBottom: '8px' }}>
            {alreadyDone ? "You've already witnessed this session" : `You've witnessed ${practitionerName}'s session.`}
          </h2>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#767676', lineHeight: 1.6 }}>
            {alreadyDone
              ? `Your attestation for ${sessionLabel} is already recorded.`
              : `${practitionerName} will be notified. Your witness is part of their record.`}
          </p>
          {existingConfirmation?.witness_note && (
            <div style={{ marginTop: '20px', padding: '14px 16px', background: '#f5f5f5', borderRadius: '3px', textAlign: 'left' }}>
              <p style={{ ...label, marginBottom: '6px' }}>Your witness note</p>
              <p style={{ fontSize: '16px', color: '#1a1a1a', lineHeight: 1.6, margin: 0 }}>{existingConfirmation.witness_note}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <div style={{ minHeight: '100dvh', background: '#f5f5f5', fontFamily: '"Crimson Text", Georgia, serif', padding: '0 0 80px' }}>
        {/* Header */}
        <div style={{ background: '#1a3a6b', padding: '20px 24px' }}>
          <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>
            Search Star
          </span>
        </div>

        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '40px 24px 0' }}>

          {/* Title */}
          <div style={{ marginBottom: '32px' }}>
            <p style={{ ...label, marginBottom: '8px' }}>You&apos;re witnessing a session</p>
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1a1a1a', lineHeight: 1.2, margin: '0 0 4px' }}>
              {practitionerName}
            </h1>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#767676', margin: 0 }}>
              {commitmentTitle} &middot; {sessionLabel} &middot; {postedDate}
            </p>
          </div>

          {/* Evidence */}
          {(postBody || mediaUrls.length > 0) && (
            <div style={{ marginBottom: '32px' }}>
              <p style={{ ...label, marginBottom: '12px' }}>What they shared</p>

              {mediaUrls[0] && (
                <div style={{ marginBottom: postBody ? '16px' : '0', borderRadius: '6px', overflow: 'hidden' }}>
                  {isVideoUrl(mediaUrls[0]) ? (
                    <video
                      src={mediaUrls[0]}
                      controls
                      style={{ width: '100%', display: 'block', borderRadius: '6px' }}
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mediaUrls[0]}
                      alt=""
                      style={{ width: '100%', display: 'block', borderRadius: '6px' }}
                    />
                  )}
                </div>
              )}

              {postBody && (
                <div style={{ background: '#eef2f8', borderLeft: '3px solid #1a3a6b', borderRadius: '0 3px 3px 0', padding: '20px 24px' }}>
                  <p style={{ fontSize: '22px', color: '#1a1a1a', lineHeight: 1.6, margin: 0 }}>
                    {postBody}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Witness form */}
          <div style={{ background: '#ffffff', border: '1px solid #d4d4d4', borderRadius: '6px', padding: '32px 28px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>

            {/* A — witness note */}
            <div style={{ marginBottom: '28px' }}>
              <label style={{ ...label, display: 'block', marginBottom: '8px' }}>
                What did you notice?
              </label>
              <textarea
                value={witnessNote}
                onChange={e => setWitnessNote(e.target.value)}
                placeholder={notePlaceholder}
                rows={4}
                style={{
                  width: '100%',
                  fontFamily: '"Crimson Text", Georgia, serif',
                  fontSize: '18px',
                  lineHeight: 1.6,
                  color: '#1a1a1a',
                  background: '#f5f5f5',
                  border: '1px solid #e8e8e8',
                  borderRadius: '3px',
                  padding: '12px 14px',
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {witnessNote.trim().length > 0 && witnessNote.trim().length < 20 && (
                <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#92400e', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '3px', padding: '6px 10px', margin: '6px 0 0', fontWeight: 500 }}>
                  {20 - witnessNote.trim().length} more characters needed in your witness note
                </p>
              )}
            </div>

            {/* B — quality choice */}
            <div style={{ marginBottom: '28px' }}>
              <label style={{ ...label, display: 'block', marginBottom: '10px' }}>
                How would you characterise this session?
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {qualityOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setQualityChoice(opt.value)}
                    style={{
                      textAlign: 'left',
                      padding: '14px 16px',
                      border: qualityChoice === opt.value ? '2px solid #1a3a6b' : '1px solid #d4d4d4',
                      borderRadius: '3px',
                      background: qualityChoice === opt.value ? 'rgba(26,58,107,0.06)' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      marginTop: qualityChoice === opt.value ? '-1px' : '0',
                    }}
                  >
                    <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '18px', fontWeight: 600, color: '#1a1a1a', margin: '0 0 2px', lineHeight: 1.3 }}>
                      {opt.label}
                    </p>
                    <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#767676', margin: 0 }}>
                      {opt.sub}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* C — private note */}
            <div style={{ marginBottom: '28px' }}>
              <label style={{ ...label, display: 'block', marginBottom: '4px' }}>
                A private note to {practitionerName}
              </label>
              <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#b8b8b8', margin: '0 0 8px' }}>
                Only {practitionerName} will see this — not part of the attestation record.
              </p>
              <textarea
                value={privateMessage}
                onChange={e => setPrivateMessage(e.target.value)}
                placeholder="Optional — something just for them"
                rows={3}
                style={{
                  width: '100%',
                  fontFamily: '"Crimson Text", Georgia, serif',
                  fontSize: '17px',
                  lineHeight: 1.6,
                  color: '#1a1a1a',
                  background: '#f5f5f5',
                  border: '1px solid #e8e8e8',
                  borderRadius: '3px',
                  padding: '10px 14px',
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {error && (
              <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#991b1b', marginBottom: '12px' }}>
                {error}
              </p>
            )}

            {!isReady && !submitting && (witnessNote.trim().length > 0 || qualityChoice) && (
              <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#92400e', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '3px', padding: '8px 12px', marginBottom: '12px' }}>
                {witnessNote.trim().length < 20
                  ? `Witness note needs ${20 - witnessNote.trim().length} more characters`
                  : 'Choose how you would characterise this session'}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={!isReady}
              style={{
                width: '100%',
                padding: '16px 24px',
                background: isReady ? '#1a3a6b' : '#e8e8e8',
                color: isReady ? '#ffffff' : '#b8b8b8',
                border: 'none',
                borderRadius: '3px',
                fontFamily: 'Roboto, sans-serif',
                fontSize: '13px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                cursor: isReady ? 'pointer' : 'not-allowed',
                transition: 'background 0.2s',
              }}
            >
              {submitting ? 'Witnessing...' : 'Witness this session'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        textarea::placeholder { color: #b8b8b8; }
        textarea:focus { border-color: #1a3a6b !important; background: #ffffff !important; }
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </>
  )
}
