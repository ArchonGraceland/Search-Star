'use client'

import { useState, useEffect } from 'react'

interface SentMessage {
  id: string
  recipient_name: string
  subject: string
  body: string
  price_paid: number
  blocked: boolean
  created_at: string
}

export default function PlatformMessages() {
  const [messages, setMessages] = useState<SentMessage[]>([])
  const [total, setTotal] = useState(0)
  const [blockRate, setBlockRate] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true)
      const res = await fetch(`/api/platform/messages?page=${page}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages)
        setTotal(data.total)
        setBlockRate(data.block_rate)
      }
      setLoading(false)
    }
    fetchMessages()
  }, [page])

  const totalSpent = messages.reduce((sum, m) => sum + Number(m.price_paid || 0), 0)

  return (
    <div className="p-8 max-w-[1100px]">
      <div className="mb-6">
        <h1 className="font-heading text-[28px] font-bold mb-1">Sent Messages</h1>
        <p className="font-body text-sm text-[#767676]">
          Marketing messages sent from your platform account.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card-grace p-5">
          <div className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">Total Sent</div>
          <div className="font-mono text-2xl font-medium text-[#1a1a1a]">{total}</div>
        </div>
        <div className="card-grace p-5">
          <div className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">Total Spent</div>
          <div className="font-mono text-2xl font-medium text-[#92400e]">${totalSpent.toFixed(2)}</div>
        </div>
        <div className="card-grace p-5">
          <div className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">Block Rate</div>
          <div className={`font-mono text-2xl font-medium ${blockRate > 20 ? 'text-[#991b1b]' : blockRate > 10 ? 'text-[#92400e]' : 'text-[#166534]'}`}>
            {blockRate.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Messages List */}
      <div className="card-grace">
        {loading ? (
          <div className="p-8 text-center font-body text-sm text-[#767676]">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="p-8 text-center font-body text-sm text-[#767676]">
            No messages sent yet. Visit the Directory to send marketing messages.
          </div>
        ) : (
          <div>
            {messages.map((msg) => (
              <div key={msg.id} className="border-b border-[#f0f0f0] last:border-b-0">
                <div
                  className="p-4 flex items-center gap-4 cursor-pointer hover:bg-[#fafafa] transition-colors"
                  onClick={() => setExpandedId(expandedId === msg.id ? null : msg.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-body text-sm font-medium">{msg.recipient_name}</span>
                      {msg.blocked && (
                        <span className="font-body text-[9px] font-bold tracking-[0.1em] uppercase px-1.5 py-0.5 bg-[#fef2f2] text-[#991b1b] rounded-[2px]">
                          Blocked
                        </span>
                      )}
                    </div>
                    <div className="font-body text-xs text-[#767676] truncate">{msg.subject}</div>
                  </div>
                  <div className="font-mono text-sm text-[#92400e] flex-shrink-0">
                    ${Number(msg.price_paid).toFixed(2)}
                  </div>
                  <div className="font-body text-xs text-[#767676] flex-shrink-0 w-[120px] text-right">
                    {new Date(msg.created_at).toLocaleDateString()}
                  </div>
                </div>
                {expandedId === msg.id && (
                  <div className="px-4 pb-4 border-t border-[#f0f0f0]">
                    <div className="mt-3 p-3 bg-[#f5f5f5] rounded-[3px]">
                      <div className="font-body text-sm text-[#5a5a5a] whitespace-pre-wrap">{msg.body}</div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > 20 && (
          <div className="flex items-center justify-between p-4 border-t border-[#e8e8e8]">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="font-body text-xs text-[#0d9488] disabled:text-[#d4d4d4] cursor-pointer disabled:cursor-not-allowed bg-transparent border-none">
              ← Previous
            </button>
            <span className="font-body text-xs text-[#767676]">Page {page} of {Math.ceil(total / 20)}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total} className="font-body text-xs text-[#0d9488] disabled:text-[#d4d4d4] cursor-pointer disabled:cursor-not-allowed bg-transparent border-none">
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
