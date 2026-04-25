'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function AdminTicketActions({
  ticketId,
  currentStatus,
}: {
  ticketId: string
  currentStatus: string
}) {
  const router = useRouter()
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleReply() {
    if (!reply.trim()) {
      setMessage({ type: 'error', text: 'Please enter a response.' })
      return
    }

    setSending(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: ticketId,
          body: reply.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to send reply.' })
      } else {
        setMessage({ type: 'success', text: 'Reply sent.' })
        setReply('')
        router.refresh()
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error.' })
    } finally {
      setSending(false)
    }
  }

  async function handleStatusChange(newStatus: string) {
    setStatusLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: ticketId, status: newStatus }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to update status.' })
      } else {
        setMessage({ type: 'success', text: `Status updated to ${newStatus === 'in_progress' ? 'In Progress' : newStatus}.` })
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

      {/* Reply form */}
      <div className="card-grace p-6 mb-6" style={{ borderTop: '3px solid #991b1b' }}>
        <h2 className="font-heading text-xl font-bold mb-4">Reply</h2>
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Type your response to the user..."
          rows={4}
          className="w-full font-body text-sm px-4 py-3 border border-[#d4d4d4] rounded-[3px] outline-none focus:border-[#1a3a6b] resize-y mb-3"
        />
        <button
          onClick={handleReply}
          disabled={sending}
          className="btn-primary disabled:opacity-50"
          style={{ padding: '10px 24px', fontSize: '11px' }}
        >
          {sending ? 'Sending...' : 'Send Response'}
        </button>
      </div>

      {/* Status change */}
      <div className="card-grace p-6">
        <h2 className="font-heading text-xl font-bold mb-4">Change Status</h2>
        <div className="flex gap-3">
          {currentStatus !== 'open' && (
            <button
              onClick={() => handleStatusChange('open')}
              disabled={statusLoading}
              className="font-body text-[11px] font-bold tracking-[0.1em] uppercase px-4 py-2 rounded-[3px] border border-[#92400e] text-[#92400e] bg-[#fffbeb] hover:bg-[#92400e] hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            >
              Reopen
            </button>
          )}
          {currentStatus !== 'in_progress' && (
            <button
              onClick={() => handleStatusChange('in_progress')}
              disabled={statusLoading}
              className="font-body text-[11px] font-bold tracking-[0.1em] uppercase px-4 py-2 rounded-[3px] border border-[#1a3a6b] text-[#1a3a6b] bg-[#eef2f8] hover:bg-[#1a3a6b] hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            >
              In Progress
            </button>
          )}
          {currentStatus !== 'resolved' && (
            <button
              onClick={() => handleStatusChange('resolved')}
              disabled={statusLoading}
              className="font-body text-[11px] font-bold tracking-[0.1em] uppercase px-4 py-2 rounded-[3px] border border-[#166534] text-[#166534] bg-[#f0fdf4] hover:bg-[#166534] hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            >
              Resolve
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
