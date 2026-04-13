'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface AccountFormProps {
  displayName: string
  location: string
  bio: string
  visibility: string
  trustStage: string
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontFamily: 'Roboto, sans-serif',
  fontSize: '14px',
  padding: '9px 12px',
  border: '1px solid #d4d4d4',
  borderRadius: '3px',
  background: '#fff',
  color: '#1a1a1a',
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'Roboto, sans-serif',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: '#767676',
  marginBottom: '6px',
}

const STAGE_LABELS: Record<string, string> = {
  seedling: 'Seedling',
  rooting: 'Rooting',
  growing: 'Growing',
  established: 'Established',
  mature: 'Mature',
}

const STAGE_COLORS: Record<string, string> = {
  seedling: '#5a8a5a',
  rooting: '#2d6a6a',
  growing: '#1a3a6b',
  established: '#7a4a1a',
  mature: '#4a1a6b',
}

export function AccountForm({ displayName, location, bio, visibility, trustStage }: AccountFormProps) {
  const router = useRouter()

  // Profile form state
  const [name, setName] = useState(displayName)
  const [loc, setLoc] = useState(location)
  const [bioText, setBio] = useState(bio)
  const [saving, setSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Visibility state
  const [vis, setVis] = useState<'public' | 'private'>(visibility === 'public' ? 'public' : 'private')
  const [visUpdating, setVisUpdating] = useState(false)
  const [visMsg, setVisMsg] = useState<string | null>(null)

  async function saveProfile() {
    if (!name.trim()) {
      setProfileMsg({ ok: false, text: 'Display name is required.' })
      return
    }
    setSaving(true)
    setProfileMsg(null)
    try {
      const res = await fetch('/api/profiles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: name.trim(), location: loc.trim(), bio: bioText.trim() }),
      })
      if (!res.ok) {
        const d = await res.json()
        setProfileMsg({ ok: false, text: d.error ?? 'Save failed.' })
      } else {
        setProfileMsg({ ok: true, text: 'Profile saved.' })
        router.refresh()
      }
    } catch {
      setProfileMsg({ ok: false, text: 'Network error. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  async function updateVisibility(newVis: 'public' | 'private') {
    setVisUpdating(true)
    setVisMsg(null)
    try {
      const res = await fetch('/api/profiles/visibility', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: newVis }),
      })
      if (!res.ok) {
        const d = await res.json()
        setVisMsg(d.error ?? 'Update failed.')
      } else {
        setVis(newVis)
        setVisMsg(`Visibility set to ${newVis}.`)
        router.refresh()
      }
    } catch {
      setVisMsg('Network error. Please try again.')
    } finally {
      setVisUpdating(false)
    }
  }

  return (
    <>
      {/* Profile section */}
      <div style={{
        background: '#fff',
        border: '1px solid #d4d4d4',
        borderRadius: '3px',
        padding: '28px',
        marginBottom: '20px',
      }}>
        <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '22px', fontWeight: 700, marginBottom: '20px' }}>
          Profile
        </h2>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Display Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            style={inputStyle}
            maxLength={80}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Location</label>
          <input
            type="text"
            value={loc}
            onChange={(e) => setLoc(e.target.value)}
            placeholder="City, Country"
            style={inputStyle}
            maxLength={120}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>Bio <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>({280 - bioText.length} remaining)</span></label>
          <textarea
            value={bioText}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A brief description in your own words."
            rows={3}
            maxLength={280}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.5' }}
          />
        </div>

        {profileMsg && (
          <p style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: '13px',
            color: profileMsg.ok ? '#166534' : '#991b1b',
            marginBottom: '12px',
          }}>
            {profileMsg.text}
          </p>
        )}

        <button
          onClick={saveProfile}
          disabled={saving}
          style={{
            background: saving ? '#767676' : '#1a3a6b',
            color: '#fff',
            fontFamily: 'Roboto, sans-serif',
            fontSize: '13px',
            fontWeight: 600,
            padding: '9px 18px',
            borderRadius: '3px',
            border: 'none',
            cursor: saving ? 'not-allowed' : 'pointer',
            letterSpacing: '0.02em',
          }}
        >
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
      </div>

      {/* Visibility section */}
      <div style={{
        background: '#fff',
        border: '1px solid #d4d4d4',
        borderRadius: '3px',
        padding: '28px',
        marginBottom: '20px',
      }}>
        <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>
          Visibility
        </h2>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#5a5a5a', marginBottom: '20px', lineHeight: '1.6' }}>
          {vis === 'private'
            ? 'Your profile is private. Only your validator circle can see your practice and Trust record. Switch to public when you are ready to share your record with employers, schools, or sponsors.'
            : 'Your profile is public. Anyone can view your Trust stage and practice record. Switch to private at any time to restrict visibility to your validator circle only.'}
        </p>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => vis !== 'private' && updateVisibility('private')}
            disabled={visUpdating}
            style={{
              background: vis === 'private' ? '#1a3a6b' : '#fff',
              color: vis === 'private' ? '#fff' : '#1a3a6b',
              fontFamily: 'Roboto, sans-serif',
              fontSize: '13px',
              fontWeight: 600,
              padding: '9px 18px',
              borderRadius: '3px',
              border: '1px solid #1a3a6b',
              cursor: vis === 'private' || visUpdating ? 'default' : 'pointer',
              letterSpacing: '0.02em',
            }}
          >
            Private
          </button>
          <button
            onClick={() => vis !== 'public' && updateVisibility('public')}
            disabled={visUpdating}
            style={{
              background: vis === 'public' ? '#1a3a6b' : '#fff',
              color: vis === 'public' ? '#fff' : '#1a3a6b',
              fontFamily: 'Roboto, sans-serif',
              fontSize: '13px',
              fontWeight: 600,
              padding: '9px 18px',
              borderRadius: '3px',
              border: '1px solid #1a3a6b',
              cursor: vis === 'public' || visUpdating ? 'default' : 'pointer',
              letterSpacing: '0.02em',
            }}
          >
            Public
          </button>
        </div>

        {visMsg && (
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#5a5a5a', marginTop: '12px' }}>
            {visMsg}
          </p>
        )}
      </div>

      {/* Trust stage — read only */}
      <div style={{
        background: '#fff',
        border: '1px solid #d4d4d4',
        borderRadius: '3px',
        padding: '28px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
      }}>
        <div>
          <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '22px', fontWeight: 700, marginBottom: '10px' }}>
            Trust Stage
          </h2>
          <span style={{
            display: 'inline-block',
            fontFamily: 'Roboto, sans-serif',
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            background: STAGE_COLORS[trustStage] ?? '#1a3a6b',
            color: '#fff',
            borderRadius: '2px',
            padding: '4px 12px',
          }}>
            {STAGE_LABELS[trustStage] ?? 'Seedling'}
          </span>
        </div>
        <a
          href="/trust"
          style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: '13px',
            fontWeight: 600,
            color: '#1a3a6b',
            textDecoration: 'none',
            borderBottom: '1px solid #1a3a6b',
            paddingBottom: '1px',
          }}
        >
          View full record →
        </a>
      </div>
    </>
  )
}
