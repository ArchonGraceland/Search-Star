'use client'

import { useRouter, useParams } from 'next/navigation'
import { useState } from 'react'
import StageShell from '@/components/stage-shell'

export default function StageMentor() {
  const router = useRouter()
  const params = useParams()
  const commitmentId = params.id as string
  const [loading, setLoading] = useState(false)

  const handleContinue = async () => {
    setLoading(true)
    // Mark mentor step seen so stage resolver advances past it
    await fetch('/api/profiles/mentor-step-seen', { method: 'POST' })
    router.push(`/start/launch/${commitmentId}`)
  }

  return (
    <StageShell stage={4}>
      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#767676', marginBottom: '12px' }}>
        Stage 4 of 7
      </p>
      <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '38px', fontWeight: 700, color: '#1a1a1a', lineHeight: 1.1, marginBottom: '10px' }}>
        Find a mentor.
      </h1>
      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '15px', color: '#5a5a5a', lineHeight: 1.65, marginBottom: '36px' }}>
        A mentor is an experienced practitioner in your field — someone who has walked further down the same road and is willing to guide your development. Mentors can also validate your sessions, and their attestation carries greater weight in your Trust record.
      </p>

      {/* Placeholder card */}
      <div style={{
        background: '#ffffff', border: '1px solid #d4d4d4', borderRadius: '3px',
        padding: '32px', marginBottom: '32px', textAlign: 'center',
      }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%',
          background: '#eef2f8', border: '2px solid #c8d4e8',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="4" stroke="#1a3a6b" strokeWidth="1.5"/>
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#1a3a6b" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '22px', fontWeight: 700, color: '#1a1a1a', marginBottom: '10px' }}>
          Mentor matching coming soon
        </h2>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#767676', lineHeight: 1.65, marginBottom: '20px', maxWidth: '380px', margin: '0 auto 20px' }}>
          As Search Star grows, verified mentors in your practice area will be available here. We'll notify you when mentors are active in your field.
        </p>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#b8b8b8', lineHeight: 1.65 }}>
          Already know someone who could mentor you? You can invite them as a validator — mentorship can emerge naturally from that relationship.
        </p>
      </div>

      <button
        onClick={handleContinue}
        disabled={loading}
        style={{
          width: '100%', padding: '14px', background: loading ? '#8a9fc0' : '#1a3a6b',
          color: '#fff', fontFamily: 'Roboto, sans-serif', fontSize: '13px', fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase', border: 'none',
          borderRadius: '3px', cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Continuing...' : 'Continue to launch →'}
      </button>
    </StageShell>
  )
}
