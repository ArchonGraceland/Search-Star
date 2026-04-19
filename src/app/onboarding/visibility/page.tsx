'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'

type Visibility = 'private' | 'network' | 'public'

const OPTIONS: { value: Visibility; title: string; description: string; badge?: string }[] = [
  {
    value: 'private',
    title: 'Private',
    description: 'Only your sponsors can see your session posts. Your profile is not publicly searchable.',
    badge: 'Recommended',
  },
  {
    value: 'network',
    title: 'Network',
    description: 'People you\'ve connected with on Search Star can see your profile.',
  },
  {
    value: 'public',
    title: 'Public',
    description: 'Your profile and practice record are publicly visible.',
  },
]

export default function VisibilityPage() {
  const [visibility, setVisibility] = useState<Visibility>('private')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch('/api/profiles', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibility }),
    })

    if (res.ok) {
      router.push('/dashboard')
    } else {
      const body = await res.json()
      setError(body.error || 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col">
      {/* Header */}
      <header className="bg-[#1a3a6b] border-b-[3px] border-[#112a4f] py-6 px-8">
        <div className="max-w-[1120px] mx-auto flex items-center gap-2.5">
          <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" className="w-[22px] h-[22px]">
            <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8"/>
            <polygon points="32,6 36,24 32,20 28,24" fill="#fff"/>
            <polygon points="32,6 36,24 32,28 28,24" fill="rgba(255,255,255,0.6)"/>
            <polygon points="58,32 40,28 44,32 40,36" fill="#fff" opacity="0.6"/>
            <polygon points="32,58 28,40 32,44 36,40" fill="#fff" opacity="0.6"/>
            <polygon points="6,32 24,36 20,32 24,28" fill="#fff" opacity="0.6"/>
            <circle cx="32" cy="32" r="3" fill="#fff"/>
          </svg>
          <Link href="/home" className="font-body text-xs font-medium tracking-[0.2em] uppercase text-white/60 no-underline hover:text-white/80">
            Search Star
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center pt-16 px-8 pb-16">
        <div className="bg-white border border-[#d4d4d4] rounded-[3px] shadow-sm p-12 w-full max-w-[520px]">
          {/* Progress */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '32px' }}>
            {[1, 2, 3, 4].map(n => (
              <div key={n} style={{
                height: '3px',
                flex: 1,
                borderRadius: '2px',
                background: '#1a3a6b',
              }} />
            ))}
          </div>

          <p className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">
            Step 4 of 4
          </p>
          <h1 className="font-heading text-[28px] font-bold mb-6">Who can see your practice?</h1>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '32px' }}>
              {OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  onClick={() => setVisibility(opt.value)}
                  style={{
                    display: 'block',
                    padding: '16px 18px',
                    border: `2px solid ${visibility === opt.value ? '#1a3a6b' : '#d4d4d4'}`,
                    borderRadius: '3px',
                    cursor: 'pointer',
                    background: visibility === opt.value ? '#f0f4fa' : '#fff',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <input
                      type="radio"
                      name="visibility"
                      value={opt.value}
                      checked={visibility === opt.value}
                      onChange={() => setVisibility(opt.value)}
                      style={{ accentColor: '#1a3a6b' }}
                    />
                    <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', fontWeight: 700, color: '#1a1a1a' }}>
                      {opt.title}
                    </span>
                    {opt.badge && (
                      <span style={{
                        fontFamily: 'Roboto, sans-serif',
                        fontSize: '10px',
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: '#1a3a6b',
                        background: '#dce8f8',
                        borderRadius: '2px',
                        padding: '2px 6px',
                      }}>
                        {opt.badge}
                      </span>
                    )}
                  </div>
                  <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#767676', margin: 0, paddingLeft: '20px', lineHeight: '1.5' }}>
                    {opt.description}
                  </p>
                </label>
              ))}
            </div>

            {error && (
              <div className="mb-4 p-3 bg-[#fef2f2] border-l-[3px] border-[#991b1b] rounded-[3px]">
                <p className="font-body text-sm text-[#991b1b] m-0">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Go to my dashboard →'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
