'use client'

import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useState } from 'react'

// Self-serve password recovery. A user who mistyped their signup password
// or has simply forgotten it lands here to request a reset email. We call
// Supabase's resetPasswordForEmail directly from the browser so the request
// origin matches the user's current environment (searchstar.com in prod,
// preview-*.vercel.app on preview deploys). The redirectTo target is
// /auth/reset — the Supabase default recovery email template routes through
// /auth/confirm first (which calls verifyOtp and establishes a session),
// then hands control to /auth/reset with the session cookie already set.
//
// We always show the "check your email" confirmation, whether or not the
// email matches a real account. This is standard practice: leaking account
// existence via a different message would enable enumeration attacks and
// offers no real benefit to legitimate users.

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const redirectTo = `${window.location.origin}/auth/reset`

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo }
    )

    // We intentionally do not surface resetError to the user when it exists —
    // in most cases it means the email doesn't match an account, and we don't
    // want to confirm that either way. The only thing we show is that the
    // request was received. If Supabase is down, the user will notice when
    // no email arrives and can try again.
    if (resetError) {
      console.error('resetPasswordForEmail failed:', resetError.message)
    }

    setLoading(false)
    setSubmitted(true)
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

            {!submitted ? (
              <>
                <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '36px', fontWeight: 700, color: '#1a1a1a', marginBottom: '6px', lineHeight: 1.1 }}>
                  Reset your password
                </h1>
                <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#767676', marginBottom: '36px' }}>
                  Enter your email and we&apos;ll send you a link to set a new password.
                </p>

                <form onSubmit={handleSubmit}>
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', display: 'block', marginBottom: '6px' }}>
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #d4d4d4', borderRadius: '3px', fontFamily: 'Roboto, sans-serif', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                      placeholder="you@example.com"
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
                    {loading ? 'Sending...' : 'Send reset link'}
                  </button>
                </form>

                <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#767676', marginTop: '24px', textAlign: 'center' }}>
                  Remembered it?{' '}
                  <Link href="/login" style={{ color: '#1a3a6b', fontWeight: 500, textDecoration: 'none' }}>
                    Back to sign in
                  </Link>
                </p>
              </>
            ) : (
              <>
                <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '36px', fontWeight: 700, color: '#1a1a1a', marginBottom: '6px', lineHeight: 1.1 }}>
                  Check your email
                </h1>
                <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#767676', marginBottom: '24px', lineHeight: 1.6 }}>
                  If an account exists for <strong style={{ color: '#1a1a1a' }}>{email}</strong>, a password reset link is on its way. The link will expire in one hour.
                </p>
                <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#767676', marginBottom: '36px', lineHeight: 1.6 }}>
                  Didn&apos;t receive it? Check your spam folder, or try again with a different email.
                </p>

                <Link
                  href="/login"
                  style={{
                    display: 'block', textAlign: 'center',
                    width: '100%', padding: '12px', background: '#1a3a6b', color: '#ffffff',
                    fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700,
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                    borderRadius: '3px', textDecoration: 'none', boxSizing: 'border-box',
                  }}
                >
                  Back to sign in
                </Link>
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
