'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import StageShell from '@/components/stage-shell'

const LABELS = [
  { value: 'skill', title: 'Skill', description: 'A defined capability you\'re building — a language, an instrument, a technique.' },
  { value: 'craft', title: 'Craft', description: 'A making discipline with a tangible output — woodworking, cooking, ceramics.' },
  { value: 'pursuit', title: 'Pursuit', description: 'An ongoing practice without a single end goal — running, meditation, reading.' },
]

interface Category { id: string; name: string }

export default function StagePractice() {
  const [name, setName] = useState('')
  const [label, setLabel] = useState<'skill' | 'craft' | 'pursuit'>('skill')
  const [categoryId, setCategoryId] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    createClient()
      .from('skill_categories').select('id, name').order('name')
      .then(({ data }) => {
        if (data?.length) { setCategories(data); setCategoryId(data[0].id) }
      })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Please name your practice.'); return }
    if (!categoryId) { setError('Please select a category.'); return }
    setLoading(true); setError(null)

    const res = await fetch('/api/practices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), label, category_id: categoryId }),
    })

    if (res.ok) {
      // Hard navigation to the next stage to bypass the Router Cache.
      // See /start/commitment for the full rationale.
      window.location.assign('/start/commitment')
    } else {
      const data = await res.json()
      setError(data.error || 'Something went wrong.')
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '11px 14px', border: '1px solid #d4d4d4',
    borderRadius: '3px', fontFamily: 'Roboto, sans-serif', fontSize: '15px',
    outline: 'none', boxSizing: 'border-box' as const,
  }

  return (
    <StageShell stage={1}>
      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#767676', marginBottom: '12px' }}>
        Stage 1 of 6
      </p>
      <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '38px', fontWeight: 700, color: '#1a1a1a', lineHeight: 1.1, marginBottom: '10px' }}>
        What do you want to practice?
      </h1>
      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '15px', color: '#5a5a5a', lineHeight: 1.65, marginBottom: '36px' }}>
        You arrive here as a practitioner. Identity on Search Star comes from what you commit to doing, not what you say about yourself.
      </p>

      <form onSubmit={handleSubmit}>
        {/* Practice name */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', display: 'block', marginBottom: '8px' }}>
            Name your practice
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            maxLength={80}
            placeholder="e.g. Italian, woodworking, distance running"
            style={inputStyle}
            onFocus={e => { e.target.style.borderColor = '#1a3a6b' }}
            onBlur={e => { e.target.style.borderColor = '#d4d4d4' }}
          />
        </div>

        {/* Category */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', display: 'block', marginBottom: '8px' }}>
            Category
          </label>
          <select
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
            style={{ ...inputStyle, background: '#fff', cursor: 'pointer' }}
            onFocus={e => { e.target.style.borderColor = '#1a3a6b' }}
            onBlur={e => { e.target.style.borderColor = '#d4d4d4' }}
          >
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Label */}
        <div style={{ marginBottom: '32px' }}>
          <label style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', display: 'block', marginBottom: '8px' }}>
            What do you call it?
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {LABELS.map(opt => (
              <label key={opt.value} style={{
                display: 'flex', alignItems: 'flex-start', gap: '12px',
                padding: '12px 16px', border: `1px solid ${label === opt.value ? '#1a3a6b' : '#d4d4d4'}`,
                borderRadius: '3px', cursor: 'pointer',
                background: label === opt.value ? '#eef2f8' : '#fff',
              }}>
                <input
                  type="radio" name="label" value={opt.value}
                  checked={label === opt.value}
                  onChange={() => setLabel(opt.value as 'skill' | 'craft' | 'pursuit')}
                  style={{ marginTop: '2px', accentColor: '#1a3a6b' }}
                />
                <div>
                  <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', fontWeight: 700, color: '#1a1a1a', display: 'block' }}>{opt.title}</span>
                  <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#767676' }}>{opt.description}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: '16px', padding: '12px 16px', background: '#fef2f2', borderLeft: '3px solid #991b1b', borderRadius: '3px' }}>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#991b1b', margin: 0 }}>{error}</p>
          </div>
        )}

        <button type="submit" disabled={loading} style={{
          width: '100%', padding: '14px', background: loading ? '#8a9fc0' : '#1a3a6b',
          color: '#fff', fontFamily: 'Roboto, sans-serif', fontSize: '13px', fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase', border: 'none',
          borderRadius: '3px', cursor: loading ? 'not-allowed' : 'pointer',
        }}>
          {loading ? 'Saving...' : 'Name my practice →'}
        </button>
      </form>
    </StageShell>
  )
}
