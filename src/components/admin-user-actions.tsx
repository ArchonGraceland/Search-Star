'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function AdminUserActions({
  profileId,
  currentTrustScore,
  currentStatus,
}: {
  profileId: string
  currentTrustScore: number
  currentStatus: string
}) {
  const router = useRouter()
  const [trustScore, setTrustScore] = useState(currentTrustScore.toString())
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleTrustUpdate() {
    const score = parseInt(trustScore, 10)
    if (isNaN(score) || score < 0 || score > 100) {
      setMessage({ type: 'error', text: 'Trust score must be between 0 and 100.' })
      return
    }
    if (!reason.trim()) {
      setMessage({ type: 'error', text: 'Please provide a reason for the adjustment.' })
      return
    }

    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: profileId, trust_score: score, reason: reason.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to update trust score.' })
      } else {
        setMessage({ type: 'success', text: `Trust score updated to ${score}.` })
        setReason('')
        router.refresh()
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusToggle() {
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended'
    const confirmMsg = newStatus === 'suspended'
      ? 'Are you sure you want to suspend this user? They will lose access to all features.'
      : 'Are you sure you want to unsuspend this user?'

    if (!confirm(confirmMsg)) return

    setStatusLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: profileId, status: newStatus }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to update status.' })
      } else {
        setMessage({ type: 'success', text: `Account ${newStatus === 'suspended' ? 'suspended' : 'reactivated'}.` })
        router.refresh()
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error.' })
    } finally {
      setStatusLoading(false)
    }
  }

  return (
    <div>
      {/* Status message */}
      {message && (
        <div className={`mb-5 px-4 py-3 rounded-[3px] border-l-[3px] font-body text-sm ${
          message.type === 'success'
            ? 'bg-[#f0fdf4] border-[#166534] text-[#166534]'
            : 'bg-[#fef2f2] border-[#991b1b] text-[#991b1b]'
        }`}>
          {message.text}
        </div>
      )}

      {/* Trust Score Adjustment */}
      <div className="mb-6">
        <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-3">
          Adjust Trust Score
        </div>
        <div className="flex gap-3 mb-3">
          <div className="flex-shrink-0">
            <label className="font-body text-xs text-[#767676] block mb-1">Score (0–100)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={trustScore}
              onChange={(e) => setTrustScore(e.target.value)}
              className="w-[100px] font-mono text-sm px-3 py-2 border border-[#d4d4d4] rounded-[3px] outline-none focus:border-[#1a3a6b]"
            />
          </div>
          <div className="flex-1">
            <label className="font-body text-xs text-[#767676] block mb-1">Reason</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Verified identity documents"
              className="w-full font-body text-sm px-3 py-2 border border-[#d4d4d4] rounded-[3px] outline-none focus:border-[#1a3a6b]"
            />
          </div>
        </div>
        <button
          onClick={handleTrustUpdate}
          disabled={saving}
          className="btn-primary disabled:opacity-50"
          style={{ padding: '10px 24px', fontSize: '11px' }}
        >
          {saving ? 'Saving...' : 'Update Trust Score'}
        </button>
      </div>

      {/* Suspend / Unsuspend */}
      <div className="pt-5 border-t border-[#f0f0f0]">
        <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-3">
          Account Status
        </div>
        <p className="font-body text-sm text-[#767676] mb-3">
          {currentStatus === 'suspended'
            ? 'This account is currently suspended. The user cannot access any features.'
            : 'This account is active. Suspending will block access to all features.'}
        </p>
        <button
          onClick={handleStatusToggle}
          disabled={statusLoading}
          className={`font-body text-[12px] font-bold tracking-[0.1em] uppercase px-6 py-2.5 rounded-[3px] border transition-all cursor-pointer disabled:opacity-50 ${
            currentStatus === 'suspended'
              ? 'bg-[#f0fdf4] border-[#166534] text-[#166534] hover:bg-[#166534] hover:text-white'
              : 'bg-[#fef2f2] border-[#991b1b] text-[#991b1b] hover:bg-[#991b1b] hover:text-white'
          }`}
        >
          {statusLoading ? 'Processing...' : currentStatus === 'suspended' ? 'Unsuspend Account' : 'Suspend Account'}
        </button>
      </div>
    </div>
  )
}
