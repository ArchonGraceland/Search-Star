'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'

// New password form, landed here from the recovery email link.
//
// Flow: user clicks link in email → /auth/v1/verify (Supabase) → /auth/confirm
// on our domain (which calls verifyOtp and establishes a session cookie) →
// redirects here with `next=/auth/reset`. So by the time this page mounts,
// the user already has a valid session and we can call updateUser directly
// from the browser without any extra token exchange.
//
// The session established by the recovery link is a real logged-in session.
// If the user closes the tab without completing the reset, they stay logged
// in on the next visit. That's the Supabase-intended behavior and fine for
// our purposes — they can still complete the reset from account settings
// or sign out and try again.
//
// If someone navigates to this page without a valid session (e.g., they
// bookmarked it, or their session expired between clicking the link and
// loading this page), we show a friendly redirect back to the forgot
// password page rather than a broken form.

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setHasSession(!!user)
      setChecking(false)
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    // On success, send the user through the stage resolver. Middleware on /
    // will route logged-in users to /log or /start depending on commitment
    // state; going to /log directly skips a hop.
    router.push('/log')
    router.refresh()
  }

  return (
    <div className="login-shell">

      {/* ── Left: Form ── */}
      <div className="login-form-panel">
        {/* Logo */}
        <div style={{ padding: '32px 48px', borderBottom: '1px solid #e8e8e8' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" style={{ width: 22, height: 22 }}>
              <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(26,58,107,0.2)" strokeWidth="0.8"/>
              <polygon points="32,6 36,24 32,20 28,24" fill="#1a3a6b"/>
              <polygon points="32,6 36,24 32,28 28,24" fill="rgba(26,58,107,0.5)"/>
              <polygon points="58,32 40,28 44,32 40,36" fill="#1a3a6b" opacity="0.5"/>
              <polygon points="32,58 28,40 32,44 36,40" fill="#1a3a6b" opacity="0.5"/>
              <polygon points="6,32 24,36 20,32 24,28" fill="#1a3a6b" opacity="0.5"/>
              <circle cx="32" cy="32" r="3" fill="#1a3a6b"/>
            </svg>
            <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#1a3a6b' }}>
              Search Star
            </span>
          </Link>
        </div>

        {/* Form */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
          <div style={{ width: '100%', maxWidth: '360px' }}>

            {checking ? (
              <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#767676' }}>
                Loading...
              </p>
            ) : !hasSession ? (
              <>
                <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '36px', fontWeight: 700, color: '#1a1a1a', marginBottom: '6px', lineHeight: 1.1 }}>
                  Link expired
                </h1>
                <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#767676', marginBottom: '36px', lineHeight: 1.6 }}>
                  This reset link has expired or has already been used. Request a new one to continue.
                </p>

                <Link
                  href="/auth/forgot-password"
                  style={{
                    display: 'block', textAlign: 'center',
                    width: '100%', padding: '12px', background: '#1a3a6b', color: '#ffffff',
                    fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700,
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                    borderRadius: '3px', textDecoration: 'none', boxSizing: 'border-box',
                  }}
                >
                  Request new link
                </Link>
              </>
            ) : (
              <>
                <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '36px', fontWeight: 700, color: '#1a1a1a', marginBottom: '6px', lineHeight: 1.1 }}>
                  Set a new password
                </h1>
                <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#767676', marginBottom: '36px' }}>
                  Choose something you&apos;ll remember. At least 8 characters.
                </p>

                <form onSubmit={handleSubmit}>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', display: 'block', marginBottom: '6px' }}>
                      New password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '3px', fontFamily: 'Roboto, sans-serif', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                      placeholder="••••••••"
                    />
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', display: 'block', marginBottom: '6px' }}>
                      Confirm password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '3px', fontFamily: 'Roboto, sans-serif', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                      placeholder="••••••••"
                    />
                  </div>

                  {error && (
                    <div style={{ marginBottom: '16px', padding: '12px 16px', background: '#fef2f2', borderLeft: '3px solid #991b1b', borderRadius: '3px' }}>
                      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#991b1b', margin: 0 }}>{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      width: '100%', padding: '12px', background: '#1a3a6b', color: '#ffffff',
                      fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700,
                      letterSpacing: '0.12em', textTransform: 'uppercase', border: 'none',
                      borderRadius: '3px', cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.6 : 1,
                    }}
                  >
                    {loading ? 'Saving...' : 'Save new password'}
                  </button>
                </form>
              </>
            )}

          </div>
        </div>
      </div>

      {/* ── Right: Image ── */}
      <div className="login-image-panel" style={{
        backgroundImage: 'url(/images/hero/table-v2-wider.jpg)',
        backgroundSize: 'cover', backgroundPosition: 'center 40%',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(17,42,79,0.75) 0%, rgba(26,58,107,0.65) 100%)',
        }} />
        <div style={{
          position: 'absolute', bottom: '60px', left: '60px', right: '60px', zIndex: 1,
        }}>
          <p style={{
            fontFamily: '"Crimson Text", Georgia, serif', fontSize: 'clamp(22px, 2.5vw, 30px)',
            fontStyle: 'italic', color: 'rgba(255,255,255,0.9)', lineHeight: 1.55,
            marginBottom: '16px',
          }}>
            &ldquo;Gaming the metric produces the virtue.&rdquo;
          </p>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
            The Convergence Principle — Search Star
          </p>
        </div>
      </div>

    </div>
  )
}
