'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
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

      {/* Login Form */}
      <main className="flex-1 flex items-start justify-center pt-16 px-8">
        <div className="bg-white border border-[#d4d4d4] rounded-[3px] shadow-sm p-12 w-full max-w-[440px]">
          <h1 className="font-heading text-[28px] font-bold mb-1">Sign in</h1>
          <p className="font-body text-sm text-[#767676] mb-8">
            Access your Search Star dashboard.
          </p>

          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] block mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#1a3a6b] transition-colors"
                placeholder="you@example.com"
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
                className="w-full px-3 py-2.5 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#1a3a6b] transition-colors"
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
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="font-body text-sm text-[#767676] mt-6 text-center">
            Don&apos;t have a profile?{' '}
            <Link href="/signup" className="text-[#1a3a6b] font-medium no-underline hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
