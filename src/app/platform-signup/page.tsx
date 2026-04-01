'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'

export default function PlatformSignup() {
  const [companyName, setCompanyName] = useState('')
  const [billingEmail, setBillingEmail] = useState('')
  const [companyUrl, setCompanyUrl] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/platform/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: companyName,
          billing_email: billingEmail,
          company_url: companyUrl,
          password,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Signup failed')
        setLoading(false)
        return
      }

      // Sign in with the new account
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: billingEmail,
        password,
      })

      if (signInError) {
        setError('Account created but sign-in failed. Please go to login.')
        setLoading(false)
        return
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/platform')
        router.refresh()
      }, 1500)
    } catch {
      setError('Network error — please try again')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col">
      {/* Header */}
      <header className="bg-[#0f2e2b] border-b-[3px] border-[#0a1f1d] py-6 px-8">
        <div className="max-w-[1120px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
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
            <span className="ml-2 bg-[#0d9488] text-white font-body text-[9px] font-bold tracking-[0.15em] uppercase px-2 py-0.5 rounded-[2px]">
              Platform
            </span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/login" className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-white/50 no-underline hover:text-white/80 transition-colors">
              Sign In
            </Link>
            <Link href="/" className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-white/50 no-underline hover:text-white/80 transition-colors">
              Home
            </Link>
          </nav>
        </div>
      </header>

      {/* Signup Form */}
      <main className="flex-1 flex items-start justify-center pt-16 px-8">
        <div className="w-full max-w-[520px]">
          <div className="bg-white border border-[#d4d4d4] rounded-[3px] shadow-sm p-12">
            <h1 className="font-heading text-[28px] font-bold mb-1">Platform Registration</h1>
            <p className="font-body text-sm text-[#767676] mb-8">
              Register your platform to query the Search Star directory, send marketing messages, and access sovereign personal data via API.
            </p>

            {success ? (
              <div className="p-4 bg-[#f0fdfa] border-l-[3px] border-[#0d9488] rounded-[3px]">
                <p className="font-body text-sm text-[#0d9488] m-0 font-medium">
                  Account created successfully! Redirecting to your dashboard...
                </p>
              </div>
            ) : (
              <form onSubmit={handleSignup}>
                <div className="mb-4">
                  <label className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] block mb-1.5">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#0d9488] transition-colors"
                    placeholder="Acme Corp"
                  />
                </div>

                <div className="mb-4">
                  <label className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] block mb-1.5">
                    Billing Email
                  </label>
                  <input
                    type="email"
                    value={billingEmail}
                    onChange={(e) => setBillingEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#0d9488] transition-colors"
                    placeholder="billing@company.com"
                  />
                </div>

                <div className="mb-4">
                  <label className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] block mb-1.5">
                    Company URL
                  </label>
                  <input
                    type="url"
                    value={companyUrl}
                    onChange={(e) => setCompanyUrl(e.target.value)}
                    className="w-full px-3 py-2.5 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#0d9488] transition-colors"
                    placeholder="https://company.com"
                  />
                </div>

                <div className="mb-6">
                  <label className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] block mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-3 py-2.5 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#0d9488] transition-colors"
                    placeholder="••••••••"
                  />
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-[#fef2f2] border-l-[3px] border-[#991b1b] rounded-[3px]">
                    <p className="font-body text-sm text-[#991b1b] m-0">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-platform disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating Account...' : 'Register Platform'}
                </button>
              </form>
            )}

            <p className="font-body text-sm text-[#767676] mt-6 text-center">
              Already have a platform account?{' '}
              <Link href="/login" className="text-[#0d9488] font-medium no-underline hover:underline">
                Sign in
              </Link>
            </p>
          </div>

          {/* Info Card */}
          <div className="mt-6 p-5 bg-[#f0fdfa] border border-[#0d9488]/20 rounded-[3px]">
            <h3 className="font-heading text-lg font-bold mb-2">What you get</h3>
            <div className="font-body text-sm text-[#5a5a5a] leading-relaxed space-y-2">
              <p className="m-0"><strong className="text-[#0f2e2b]">Directory Access</strong> — Search and query sovereign personal data profiles in the Search Star network.</p>
              <p className="m-0"><strong className="text-[#0f2e2b]">Marketing Messages</strong> — Send paid messages directly to profile owners. No refunds, no spam filters — they see your message.</p>
              <p className="m-0"><strong className="text-[#0f2e2b]">API Key</strong> — Programmatic access to query profiles at scale. Pay-per-query pricing set by individual profile owners.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#1a1a1a] text-white/55 py-8 mt-12">
        <div className="max-w-[1120px] mx-auto px-8">
          <div className="font-body text-xs flex justify-between">
            <div><strong className="text-white/80">Search Star</strong> — Specification v1.0 · MIT License</div>
            <div className="flex gap-6">
              <a href="https://github.com/ArchonGraceland/Search-Star" className="text-white/50 no-underline font-medium tracking-[0.1em] uppercase hover:text-white/80">GitHub</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
