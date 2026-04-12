'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const TRUST_STAGES = ['seedling', 'rooting', 'growing', 'established', 'mature']
const MENTOR_ROLES = ['', 'mentor', 'coach', 'community_builder', 'practice_leader']

export function AdminUserActions({
  userId,
  currentTrustStage,
  currentMentorRole,
}: {
  userId: string
  currentTrustStage: string
  currentMentorRole: string | null
}) {
  const router = useRouter()
  const [trustStage, setTrustStage] = useState(currentTrustStage)
  const [mentorRole, setMentorRole] = useState(currentMentorRole || '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          trust_stage: trustStage,
          mentor_role: mentorRole || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to update.' })
      } else {
        setMessage({ type: 'success', text: 'Profile updated.' })
        router.refresh()
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {message && (
        <div className={`mb-5 px-4 py-3 rounded-[3px] border-l-[3px] font-body text-sm ${
          message.type === 'success'
            ? 'bg-[#f0fdf4] border-[#166534] text-[#166534]'
            : 'bg-[#fef2f2] border-[#991b1b] text-[#991b1b]'
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <label className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] block mb-2">
            Trust Stage
          </label>
          <select
            value={trustStage}
            onChange={(e) => setTrustStage(e.target.value)}
            className="w-full font-body text-sm px-3 py-2.5 border border-[#d4d4d4] rounded-[3px] outline-none focus:border-[#1a3a6b] bg-white"
          >
            {TRUST_STAGES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] block mb-2">
            Mentor Role
          </label>
          <select
            value={mentorRole}
            onChange={(e) => setMentorRole(e.target.value)}
            className="w-full font-body text-sm px-3 py-2.5 border border-[#d4d4d4] rounded-[3px] outline-none focus:border-[#1a3a6b] bg-white"
          >
            {MENTOR_ROLES.map((r) => (
              <option key={r} value={r}>{r ? r.replace('_', ' ') : 'None'}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="btn-primary disabled:opacity-50"
        style={{ padding: '10px 24px', fontSize: '11px' }}
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  )
}
