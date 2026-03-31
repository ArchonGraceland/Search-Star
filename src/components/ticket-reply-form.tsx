'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function TicketReplyForm({ ticketId, authorId }: { ticketId: string; authorId: string }) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSubmit() {
    if (!body.trim()) {
      setMessage({ type: 'error', text: 'Please enter a message.' })
      return
    }

    setSending(true)
    setMessage(null)
    try {
      const res = await fetch('/api/tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: ticketId,
          author_id: authorId,
          body: body.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to send reply.' })
      } else {
        setMessage({ type: 'success', text: 'Reply sent.' })
        setBody('')
        router.refresh()
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error.' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      {message && (
        <div className={`mb-4 px-4 py-3 rounded-[3px] border-l-[3px] font-body text-sm ${
          message.type === 'success'
            ? 'bg-[#f0fdf4] border-[#166534] text-[#166534]'
            : 'bg-[#fef2f2] border-[#991b1b] text-[#991b1b]'
        }`}>
          {message.text}
        </div>
      )}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add more details or respond..."
        rows={3}
        className="w-full font-body text-sm px-4 py-3 border border-[#d4d4d4] rounded-[3px] outline-none focus:border-[#1a3a6b] resize-y mb-3"
      />
      <button
        onClick={handleSubmit}
        disabled={sending}
        className="btn-primary disabled:opacity-50"
        style={{ padding: '10px 24px', fontSize: '11px' }}
      >
        {sending ? 'Sending...' : 'Send Reply'}
      </button>
    </div>
  )
}
