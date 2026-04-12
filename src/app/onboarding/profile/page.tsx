'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect } from 'react'

export default function ProfilePage() {
  const [displayName, setDisplayName] = useState('')
  const [location, setLocation] = useState('')
  const [bio, setBio] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.user_metadata?.display_name) {
        setDisplayName(user.user_metadata.display_name)
      }
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch('/api/profiles', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name: displayName.trim() || undefined,
        location: location.trim() || undefined,
        bio: bio.trim() || undefined,
      }),
    })

    if (res.ok) {
      router.push('/onboarding/visibility')
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
          <Link href="/" className="font-body text-xs font-medium tracking-[0.2em] uppercase text-white/60 no-underline hover:text-white/80">
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
                background: n <= 3 ? '#1a3a6b' : '#d4d4d4',
              }} />
            ))}
          </div>

          <p className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">
            Step 3 of 4
          </p>
          <h1 className="font-heading text-[28px] font-bold mb-6">A bit about you.</h1>

          <form onSubmit={handleSubmit}>
            <div className="mb-5">
              <label className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] block mb-1.5">
                Display name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2.5 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#1a3a6b] transition-colors"
                placeholder="Your name as others will see it"
              />
            </div>

            <div className="mb-5">
              <label className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] block mb-1.5">
                Location <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2.5 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#1a3a6b] transition-colors"
                placeholder="City, region, country"
              />
            </div>

            <div className="mb-8">
              <label className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] block mb-1.5">
                One sentence about yourself <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 280))}
                rows={3}
                className="w-full px-3 py-2.5 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#1a3a6b] transition-colors resize-none"
                placeholder="e.g. Woodworker and part-time cook based in Vermont."
              />
              <p className="font-body text-[11px] text-[#b8b8b8] mt-1">{bio.length}/280 characters</p>
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
              {loading ? 'Saving...' : 'Continue →'}
            </button>
          </form>

          <p className="text-center mt-4">
            <Link
              href="/onboarding/visibility"
              className="font-body text-sm text-[#767676] no-underline hover:text-[#1a3a6b] hover:underline"
            >
              Skip for now
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
