'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const INSTITUTION_TYPES = [
  { value: 'employer', label: 'Employer' },
  { value: 'university', label: 'University' },
  { value: 'trade_program', label: 'Trade Program' },
  { value: 'foundation', label: 'Foundation' },
  { value: 'civic', label: 'Civic Organization' },
  { value: 'brand', label: 'Brand' },
]

const labelStyle: React.CSSProperties = {
  fontFamily: 'Roboto, sans-serif',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#5a5a5a',
  display: 'block',
  marginBottom: '6px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontFamily: 'Roboto, sans-serif',
  fontSize: '14px',
  border: '1px solid #d4d4d4',
  borderRadius: '3px',
  background: '#fff',
  color: '#1a1a1a',
  outline: 'none',
}

export default function InstitutionSignupPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    type: '',
    contact_name: '',
    contact_email: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) { setError('Institution name is required.'); return }
    if (!form.type) { setError('Please select an institution type.'); return }
    if (!form.contact_email.trim()) { setError('Contact email is required.'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/institution/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          type: form.type,
          contact_name: form.contact_name.trim() || null,
          contact_email: form.contact_email.trim().toLowerCase(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.')
        return
      }
      router.push(`/institution/${data.id}/dashboard?welcome=1`)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: '#1a3a6b', borderBottom: '3px solid #112a4f', padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '22px', fontWeight: 700, color: '#fff', textDecoration: 'none' }}>
          Search Star
        </Link>
        <Link href="/login" style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)', textDecoration: 'none' }}>
          Sign in
        </Link>
      </header>

      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '56px 24px 80px' }}>
        <div style={{ width: '100%', maxWidth: '520px' }}>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#767676', marginBottom: '10px' }}>
            Institutional Portal
          </p>
          <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '36px', fontWeight: 700, color: '#1a1a1a', marginBottom: '10px', lineHeight: 1.2 }}>
            Set up your institution
          </h1>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#5a5a5a', lineHeight: '1.65', marginBottom: '36px' }}>
            Deploy Search Star as an employee benefit, academic program, or community
            initiative. Allocate a sponsorship budget, enroll members, and track genuine
            skill development across your community — without leaderboards or performance
            incentives.
          </p>

          <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '36px 32px' }}>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Institution name</label>
                <input style={inputStyle} type="text" placeholder="Acme Corp, State University, etc." value={form.name} onChange={(e) => set('name', e.target.value)} disabled={submitting} />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Institution type</label>
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.type} onChange={(e) => set('type', e.target.value)} disabled={submitting}>
                  <option value="">Select a type</option>
                  {INSTITUTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Contact name</label>
                <input style={inputStyle} type="text" placeholder="Jane Smith (optional)" value={form.contact_name} onChange={(e) => set('contact_name', e.target.value)} disabled={submitting} />
              </div>

              <div style={{ marginBottom: '28px' }}>
                <label style={labelStyle}>Contact email</label>
                <input style={inputStyle} type="email" placeholder="jane@institution.org" value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} disabled={submitting} />
                <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#999', marginTop: '5px' }}>
                  Sign in with this email to access your portal.
                </p>
              </div>

              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '3px', padding: '12px 16px', marginBottom: '20px', fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#991b1b' }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                style={{ width: '100%', padding: '13px 20px', background: submitting ? '#b8b8b8' : '#1a3a6b', color: '#fff', border: 'none', borderRadius: '3px', fontFamily: 'Roboto, sans-serif', fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: submitting ? 'not-allowed' : 'pointer' }}
              >
                {submitting ? 'Creating portal...' : 'Create portal'}
              </button>
            </form>
          </div>

          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#999', marginTop: '20px', textAlign: 'center', lineHeight: '1.6' }}>
            Already have a portal?{' '}
            <Link href="/login" style={{ color: '#1a3a6b', textDecoration: 'underline' }}>Sign in</Link>
            {' '}with your contact email.
          </p>
        </div>
      </div>
    </div>
  )
}
