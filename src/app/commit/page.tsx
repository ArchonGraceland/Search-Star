'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function CommitPage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('daily')
  const [sessionsPerWeek, setSessionsPerWeek] = useState(5)
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const router = useRouter()

  // Gate: redirect to onboarding if no practice exists
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace('/login'); return }
      supabase.from('practices').select('id').eq('user_id', user.id).limit(1).then(({ data }) => {
        if (!data || data.length === 0) {
          router.replace('/start')
        } else {
          setChecking(false)
        }
      })
    })
  }, [router])

  if (checking) return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#767676' }}>Loading...</p>
    </div>
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setError('Please give your commitment a title.'); return }
    setLoading(true)
    setError(null)

    const res = await fetch('/api/commitments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || undefined,
        frequency,
        sessions_per_week: frequency === 'weekly' ? sessionsPerWeek : undefined,
        start_date: startDate,
      }),
    })

    if (res.ok) {
      const data = await res.json()
      router.push(`/commit/${data.id}`)
    } else {
      const data = await res.json()
      setError((data.error || 'Something went wrong.') + (data.detail ? ` (${data.detail})` : ''))
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
          <Link href="/dashboard" className="font-body text-xs font-medium tracking-[0.2em] uppercase text-white/60 no-underline hover:text-white/80">
            Search Star
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center pt-16 px-8 pb-16">
        <div className="bg-white border border-[#d4d4d4] rounded-[3px] shadow-sm p-12 w-full max-w-[560px]">
          <h1 className="font-heading text-[32px] font-bold mb-3">Declare a commitment.</h1>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '15px', color: '#5a5a5a', marginBottom: '36px', lineHeight: '1.6' }}>
            A commitment is a promise to practice for 90 days. You'll log each session here. Your validator circle will see your posts.
          </p>

          <form onSubmit={handleSubmit}>
            {/* Title */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', display: 'block', marginBottom: '6px' }}>
                Title <span style={{ color: '#c0392b' }}>*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={120}
                placeholder="e.g. 90 days of daily drawing sessions"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d4d4d4',
                  borderRadius: '3px',
                  fontFamily: 'Roboto, sans-serif',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#1a3a6b' }}
                onBlur={(e) => { e.target.style.borderColor = '#d4d4d4' }}
              />
            </div>

            {/* Description */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', display: 'block', marginBottom: '6px' }}>
                Description <span style={{ color: '#b8b8b8', fontWeight: 400 }}>(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="What does success look like? What are you building toward?"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d4d4d4',
                  borderRadius: '3px',
                  fontFamily: 'Roboto, sans-serif',
                  fontSize: '14px',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  lineHeight: '1.5',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#1a3a6b' }}
                onBlur={(e) => { e.target.style.borderColor = '#d4d4d4' }}
              />
              <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', color: '#b8b8b8', marginTop: '4px', textAlign: 'right' }}>
                {description.length}/500
              </p>
            </div>

            {/* Frequency */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', display: 'block', marginBottom: '8px' }}>
                Frequency
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { value: 'daily', title: 'Daily', desc: 'You commit to logging at least one session every day.' },
                  { value: 'weekly', title: 'Weekly', desc: 'You commit to a set number of sessions per week.' },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '12px 14px',
                      border: `1px solid ${frequency === opt.value ? '#1a3a6b' : '#d4d4d4'}`,
                      borderRadius: '3px',
                      cursor: 'pointer',
                      background: frequency === opt.value ? '#f0f4fa' : '#fff',
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                  >
                    <input
                      type="radio"
                      name="frequency"
                      value={opt.value}
                      checked={frequency === opt.value}
                      onChange={() => setFrequency(opt.value as 'daily' | 'weekly')}
                      style={{ marginTop: '2px', accentColor: '#1a3a6b' }}
                    />
                    <div>
                      <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', fontWeight: 700, display: 'block', color: '#1a1a1a' }}>
                        {opt.title}
                      </span>
                      <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#767676', marginTop: '2px', display: 'block' }}>
                        {opt.desc}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Sessions per week (weekly only) */}
            {frequency === 'weekly' && (
              <div style={{ marginBottom: '24px' }}>
                <label style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', display: 'block', marginBottom: '6px' }}>
                  Sessions per week
                </label>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={sessionsPerWeek}
                  onChange={(e) => setSessionsPerWeek(Math.min(7, Math.max(1, parseInt(e.target.value) || 1)))}
                  style={{
                    width: '80px',
                    padding: '10px 12px',
                    border: '1px solid #d4d4d4',
                    borderRadius: '3px',
                    fontFamily: 'Roboto, sans-serif',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#1a3a6b' }}
                  onBlur={(e) => { e.target.style.borderColor = '#d4d4d4' }}
                />
              </div>
            )}

            {/* Start date */}
            <div style={{ marginBottom: '32px' }}>
              <label style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', display: 'block', marginBottom: '6px' }}>
                Start date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                style={{
                  padding: '10px 12px',
                  border: '1px solid #d4d4d4',
                  borderRadius: '3px',
                  fontFamily: 'Roboto, sans-serif',
                  fontSize: '14px',
                  outline: 'none',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#1a3a6b' }}
                onBlur={(e) => { e.target.style.borderColor = '#d4d4d4' }}
              />
            </div>

            {error && (
              <div style={{ marginBottom: '16px', padding: '12px 14px', background: '#fef2f2', borderLeft: '3px solid #991b1b', borderRadius: '3px' }}>
                <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#991b1b', margin: 0 }}>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: loading ? '#8a9fc0' : '#1a3a6b',
                color: '#fff',
                fontFamily: 'Roboto, sans-serif',
                fontSize: '13px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                padding: '12px 20px',
                borderRadius: '3px',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {loading ? 'Declaring commitment...' : 'Declare commitment →'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
