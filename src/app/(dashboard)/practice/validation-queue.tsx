'use client'

import { useState, useEffect, useCallback } from 'react'

interface EvidenceItem {
  id: string
  commitment_id: string
  day_number: number
  media_urls: string[]
  status: string
  validator_count: number
  required_validators: number
  submitted_at: string
  expires_at: string
  commitment: { habit: string; user_id: string } | null
  validations: { validator_id: string; confirmed: boolean }[]
}

function timeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return 'expired'
  const h = Math.floor(diff / 3600000)
  if (h >= 24) return `${Math.floor(h / 24)}d left`
  return `${h}h left`
}

export function ValidationQueue() {
  const [items, setItems] = useState<EvidenceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/evidence/submit')
      const data = await res.json()
      setItems(data.pending_validation || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function validate(evidenceId: string, confirmed: boolean, note?: string) {
    setSubmitting(evidenceId)
    try {
      const res = await fetch('/api/evidence/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evidence_id: evidenceId, confirmed, note }),
      })
      const data = await res.json()
      if (res.ok) {
        setItems(prev => prev.filter(i => i.id !== evidenceId))
        if (data.validated && data.total_earned > 0) {
          alert(`✓ Validated. $${data.total_earned.toFixed(2)} released to the practitioner.`)
        }
      }
    } finally {
      setSubmitting(null)
    }
  }

  if (loading) return <p className="font-body text-sm text-[#767676] py-4">Checking for evidence to validate…</p>

  if (items.length === 0) return (
    <div className="bg-white border border-[#d4d4d4] rounded-[3px] p-6 text-center">
      <p className="font-body text-sm text-[#767676]">No evidence pending your validation.</p>
      <p className="font-body text-xs text-[#b8b8b8] mt-1">When people you support post milestone evidence, it will appear here.</p>
    </div>
  )

  return (
    <div className="space-y-4">
      {items.map(item => (
        <div key={item.id} className="bg-white border border-[#1a3a6b] rounded-[3px] shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#d4d4d4] flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-body text-[10px] font-bold tracking-[0.08em] uppercase px-2 py-0.5 rounded-full bg-[#EAF3DE] text-[#3B6D11]">
                  Day {item.day_number} milestone
                </span>
                <span className="font-body text-[11px] text-[#767676]">{timeLeft(item.expires_at)}</span>
              </div>
              <p className="font-heading text-base text-[#1a1a1a]">{item.commitment?.habit}</p>
            </div>
            <div className="text-right">
              <div className="font-body text-[10px] font-bold uppercase tracking-[0.08em] text-[#767676]">Confirmations</div>
              <div className="font-heading text-2xl font-bold text-[#1a3a6b]">
                {item.validator_count}<span className="font-body text-sm font-normal text-[#767676]">/{item.required_validators}</span>
              </div>
            </div>
          </div>

          {/* Evidence media */}
          {item.media_urls?.length > 0 && (
            <div className="px-6 py-4 border-b border-[#d4d4d4]">
              <p className="font-body text-[11px] font-bold tracking-[0.08em] uppercase text-[#767676] mb-2">Evidence</p>
              <div className="flex gap-3 flex-wrap">
                {item.media_urls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                    className="block w-20 h-20 bg-[#f5f5f5] border border-[#d4d4d4] rounded-[3px] overflow-hidden hover:border-[#1a3a6b] transition-colors">
                    <img src={url} alt={`Evidence ${i + 1}`} className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Validation actions */}
          <div className="px-6 py-4 flex items-center justify-between gap-4">
            <p className="font-body text-xs text-[#767676] leading-relaxed max-w-[360px]">
              Do you confirm this person actually did what they claimed on day {item.day_number}? Your validation is a reputational stake.
            </p>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => validate(item.id, false)}
                disabled={submitting === item.id}
                className="font-body text-[11px] font-bold tracking-[0.08em] uppercase px-4 py-2 border border-[#d4d4d4] text-[#767676] rounded-[3px] hover:border-[#991b1b] hover:text-[#991b1b] transition-colors disabled:opacity-50"
              >
                Reject
              </button>
              <button
                onClick={() => validate(item.id, true)}
                disabled={submitting === item.id}
                className="font-body text-[11px] font-bold tracking-[0.08em] uppercase px-4 py-2 bg-[#1a3a6b] text-white rounded-[3px] hover:bg-[#112a4f] disabled:opacity-50 transition-colors"
              >
                {submitting === item.id ? 'Confirming…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
