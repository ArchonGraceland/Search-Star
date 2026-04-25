'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function TicketForm({ userId }: { userId: string }) {
  const router = useRouter()
  const [subject, setSubject] = useState('')
  const [priority, setPriority] = useState('normal')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSubmit() {
    if (!subject.trim()) {
      setMessage({ type: 'error', text: 'Please enter a subject.' })
      return
    }
    if (!body.trim()) {
      setMessage({ type: 'error', text: 'Please describe your issue.' })
      return
    }

    setSending(true)
    setMessage(null)
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          subject: subject.trim(),
          priority,
          body: body.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Failed to submit ticket.' })
      } else {
        setMessage({ type: 'success', text: 'Ticket submitted! We\'ll respond as soon as possible.' })
        setSubject('')
        setBody('')
        setPriority('normal')
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

      <div className="space-y-4">
        <div>
          <label className="font-body text-xs font-bold text-[#767676] block mb-1">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Brief description of your issue"
            className="w-full font-body text-sm px-4 py-2.5 border border-[#d4d4d4] rounded-[3px] outline-none focus:border-[#1a3a6b] transition-colors"
          />
        </div>

        <div>
          <label className="font-body text-xs font-bold text-[#767676] block mb-1">Priority</label>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="priority"
                value="normal"
                checked={priority === 'normal'}
                onChange={() => setPriority('normal')}
                className="accent-[#1a3a6b]"
              />
              <span className="font-body text-sm text-[#1a1a1a]">Normal</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="priority"
                value="urgent"
                checked={priority === 'urgent'}
                onChange={() => setPriority('urgent')}
                className="accent-[#991b1b]"
              />
              <span className="font-body text-sm text-[#991b1b]">Urgent</span>
            </label>
          </div>
        </div>

        <div>
          <label className="font-body text-xs font-bold text-[#767676] block mb-1">Description</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Describe the issue in detail..."
            rows={5}
            className="w-full font-body text-sm px-4 py-3 border border-[#d4d4d4] rounded-[3px] outline-none focus:border-[#1a3a6b] resize-y"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={sending}
          className="btn-primary disabled:opacity-50"
          style={{ padding: '10px 24px', fontSize: '11px' }}
        >
          {sending ? 'Submitting...' : 'Submit Ticket'}
        </button>
      </div>
    </div>
  )
}
