'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface EnrollResult {
  enrolled: number
  already_members: number
  not_found: number
}

export default function EnrollForm() {
  const params = useParams<{ id: string }>()
  const id = params.id

  const [emailsText, setEmailsText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<EnrollResult | null>(null)
  const [error, setError] = useState('')

  const emailCount = emailsText
    .split('\n')
    .map((e) => e.trim())
    .filter(Boolean).length

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setResult(null)

    const emails = emailsText
      .split('\n')
      .map((e) => e.trim())
      .filter(Boolean)

    if (emails.length === 0) { setError('Enter at least one email address.'); return }
    if (emails.length > 50) { setError('Maximum 50 emails at a time.'); return }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/institution/${id}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.')
        return
      }
      setResult(data)
      if (data.enrolled > 0) setEmailsText('')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      {/* Portal header */}
      <header style={{ background: '#1a3a6b', borderBottom: '3px solid #112a4f', padding: '18px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/home" style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#fff', textDecoration: 'none' }}>
          Search Star
        </Link>
        <nav style={{ display: 'flex', gap: '4px' }}>
          {[
            { href: `/institution/${id}/dashboard`, label: 'Overview' },
            { href: `/institution/${id}/members`, label: 'Members' },
            { href: `/institution/${id}/enroll`, label: 'Enroll' },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                fontFamily: 'Roboto, sans-serif',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '7px 16px',
                borderRadius: '3px',
                color: 'rgba(255,255,255,0.75)',
                textDecoration: 'none',
                background: link.label === 'Enroll' ? 'rgba(255,255,255,0.12)' : 'transparent',
              }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '48px 32px 80px' }}>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#767676', marginBottom: '8px' }}>
          Institutional Portal
        </p>
        <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '32px', fontWeight: 700, color: '#1a1a1a', marginBottom: '8px' }}>
          Enroll members
        </h1>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#5a5a5a', lineHeight: '1.65', marginBottom: '36px' }}>
          Paste one email address per line. Members must already have a Search Star account.
          Up to 50 at a time.
        </p>

        {/* Result banner */}
        {result && (
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '3px', padding: '16px 20px', marginBottom: '24px' }}>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', fontWeight: 700, color: '#166534', margin: '0 0 6px' }}>
              Enrollment complete
            </p>
            <div style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#166534', display: 'flex', gap: '24px' }}>
              <span>{result.enrolled} enrolled</span>
              {result.already_members > 0 && <span>{result.already_members} already members</span>}
              {result.not_found > 0 && <span style={{ color: '#92400e' }}>{result.not_found} not found on Search Star</span>}
            </div>
          </div>
        )}

        <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '32px' }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#5a5a5a', display: 'block', marginBottom: '8px' }}>
                Email addresses
                {emailCount > 0 && (
                  <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: '8px', color: '#999' }}>
                    ({emailCount})
                  </span>
                )}
              </label>
              <textarea
                style={{
                  width: '100%',
                  height: '200px',
                  padding: '12px',
                  fontFamily: '"JetBrains Mono", "Courier New", monospace',
                  fontSize: '13px',
                  border: '1px solid #d4d4d4',
                  borderRadius: '3px',
                  background: '#fafafa',
                  color: '#1a1a1a',
                  outline: 'none',
                  resize: 'vertical',
                  lineHeight: '1.7',
                }}
                placeholder={'alice@company.org\nbob@company.org\ncarol@company.org'}
                value={emailsText}
                onChange={(e) => setEmailsText(e.target.value)}
                disabled={submitting}
              />
              <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#999', marginTop: '5px' }}>
                One email per line. Only accounts that already exist on Search Star will be enrolled.
              </p>
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '3px', padding: '12px 16px', marginBottom: '20px', fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#991b1b' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                type="submit"
                disabled={submitting || emailCount === 0}
                style={{
                  padding: '11px 28px',
                  background: submitting || emailCount === 0 ? '#b8b8b8' : '#1a3a6b',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '3px',
                  fontFamily: 'Roboto, sans-serif',
                  fontSize: '13px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: submitting || emailCount === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? 'Enrolling...' : `Enroll${emailCount > 0 ? ` ${emailCount}` : ''}`}
              </button>
              <Link
                href={`/institution/${id}/members`}
                style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#767676', textDecoration: 'underline' }}
              >
                View current members
              </Link>
            </div>
          </form>
        </div>

        {/* How it works */}
        <div style={{ marginTop: '32px', padding: '20px 24px', background: '#eef2f8', borderRadius: '3px', border: '1px solid #c8d6e8' }}>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1a3a6b', margin: '0 0 8px' }}>
            How enrollment works
          </p>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#3a5a8a', lineHeight: '1.65', margin: 0 }}>
            Enrolled members earn from your institution&apos;s budget when they complete
            sponsored 90-day practice commitments in eligible skill categories. Your
            institution appears as a sponsor alongside their personal supporters — but
            institutional sponsorship is kept separate from the private practice feed, so
            it never creates performance incentives. Members practice because they want
            to grow, not to impress you.
          </p>
        </div>
      </div>
    </div>
  )
}
