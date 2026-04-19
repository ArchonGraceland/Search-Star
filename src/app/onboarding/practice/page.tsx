'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect } from 'react'

const LABELS = [
  {
    value: 'skill',
    title: 'Skill',
    description: 'A defined capability you\'re building — a language, an instrument, a technique.',
  },
  {
    value: 'craft',
    title: 'Craft',
    description: 'A making discipline with a tangible output — woodworking, cooking, ceramics.',
  },
  {
    value: 'pursuit',
    title: 'Pursuit',
    description: 'An ongoing practice without a single end goal — running, meditation, reading.',
  },
]

interface Category {
  id: string
  name: string
  slug: string
}

export default function PracticePage() {
  const [name, setName] = useState('')
  const [label, setLabel] = useState<'skill' | 'craft' | 'pursuit'>('skill')
  const [categoryId, setCategoryId] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('skill_categories')
      .select('id, name, slug')
      .order('name')
      .then(({ data }) => {
        if (data && data.length > 0) {
          setCategories(data)
          setCategoryId(data[0].id)
        }
      })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Please name your practice.'); return }
    if (!categoryId) { setError('Please select a category.'); return }
    setLoading(true)
    setError(null)

    const res = await fetch('/api/practices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), label, category_id: categoryId }),
    })

    if (res.ok) {
      router.push('/onboarding/profile')
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
                background: n <= 1 ? '#1a3a6b' : '#d4d4d4',
              }} />
            ))}
          </div>

          <p className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">
            Step 1 of 4
          </p>
          <h1 className="font-heading text-[28px] font-bold mb-6">Name your practice.</h1>

          <form onSubmit={handleSubmit}>
            {/* Practice name */}
            <div className="mb-6">
              <label className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] block mb-1.5">
                What do you want to practice?
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#1a3a6b] transition-colors"
                placeholder="e.g. Learning woodworking"
              />
            </div>

            {/* Label */}
            <div className="mb-6">
              <label className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] block mb-2">
                Label
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {LABELS.map((opt) => (
                  <label
                    key={opt.value}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '12px 14px',
                      border: `1px solid ${label === opt.value ? '#1a3a6b' : '#d4d4d4'}`,
                      borderRadius: '3px',
                      cursor: 'pointer',
                      background: label === opt.value ? '#f0f4fa' : '#fff',
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                  >
                    <input
                      type="radio"
                      name="label"
                      value={opt.value}
                      checked={label === opt.value}
                      onChange={() => setLabel(opt.value as 'skill' | 'craft' | 'pursuit')}
                      style={{ marginTop: '2px', accentColor: '#1a3a6b' }}
                    />
                    <div>
                      <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', fontWeight: 700, display: 'block', color: '#1a1a1a' }}>
                        {opt.title}
                      </span>
                      <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#767676', marginTop: '2px', display: 'block' }}>
                        {opt.description}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Category */}
            <div className="mb-8">
              <label className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] block mb-1.5">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#1a3a6b] transition-colors bg-white"
              >
                {categories.length === 0 && (
                  <option value="">Loading categories...</option>
                )}
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-[#fef2f2] border-l-[3px] border-[#991b1b] rounded-[3px]">
                <p className="font-body text-sm text-[#991b1b] m-0">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || categories.length === 0}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Continue →'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
