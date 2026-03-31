'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState, useCallback } from 'react'

interface PlatformAccount {
  id: string
  name: string
  credit_balance: number
  auto_refill: boolean
  auto_refill_threshold: number | null
  auto_refill_target: number | null
  billing_email: string
  company_url: string
  created_at: string
}

interface Transaction {
  id: string
  type: string
  amount: number
  balance_after: number
  description: string
  created_at: string
}

export default function PlatformDashboard() {
  const [account, setAccount] = useState<PlatformAccount | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [txTotal, setTxTotal] = useState(0)
  const [txFilter, setTxFilter] = useState('')
  const [txPage, setTxPage] = useState(1)
  const [apiKey, setApiKey] = useState({ masked: '', full: '' })
  const [showFullKey, setShowFullKey] = useState(false)
  const [depositAmount, setDepositAmount] = useState('')
  const [depositLoading, setDepositLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Auto-refill state
  const [autoRefill, setAutoRefill] = useState(false)
  const [threshold, setThreshold] = useState('')
  const [target, setTarget] = useState('')

  const fetchAccount = useCallback(async () => {
    const res = await fetch('/api/platform')
    if (res.ok) {
      const data = await res.json()
      setAccount(data.platform)
      setAutoRefill(data.platform.auto_refill || false)
      setThreshold(data.platform.auto_refill_threshold?.toString() || '')
      setTarget(data.platform.auto_refill_target?.toString() || '')
    }
  }, [])

  const fetchTransactions = useCallback(async () => {
    const params = new URLSearchParams({ page: txPage.toString(), limit: '20' })
    if (txFilter) params.set('type', txFilter)
    const res = await fetch(`/api/platform/credits?${params}`)
    if (res.ok) {
      const data = await res.json()
      setTransactions(data.transactions)
      setTxTotal(data.total)
    }
  }, [txPage, txFilter])

  const fetchApiKey = useCallback(async () => {
    const res = await fetch('/api/platform/api-key')
    if (res.ok) {
      const data = await res.json()
      setApiKey({ masked: data.api_key_masked, full: data.api_key_full })
    }
  }, [])

  useEffect(() => {
    Promise.all([fetchAccount(), fetchTransactions(), fetchApiKey()]).then(() => setLoading(false))
  }, [fetchAccount, fetchTransactions, fetchApiKey])

  useEffect(() => {
    fetchTransactions()
  }, [txFilter, txPage, fetchTransactions])

  const handleDeposit = async () => {
    const amt = parseFloat(depositAmount)
    if (!amt || amt <= 0) return
    setDepositLoading(true)
    setMessage(null)
    const res = await fetch('/api/platform/credits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amt }),
    })
    const data = await res.json()
    if (res.ok) {
      setMessage({ type: 'success', text: `$${amt.toFixed(2)} added. New balance: $${data.new_balance.toFixed(2)}` })
      setDepositAmount('')
      fetchAccount()
      fetchTransactions()
    } else {
      setMessage({ type: 'error', text: data.error })
    }
    setDepositLoading(false)
  }

  const handleRegenerateKey = async () => {
    if (!confirm('Regenerate your API key? The old key will stop working immediately.')) return
    const res = await fetch('/api/platform/api-key', { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      setApiKey({ masked: data.api_key_masked, full: data.api_key_full })
      setMessage({ type: 'success', text: 'API key regenerated successfully' })
    }
  }

  const handleSaveAutoRefill = async () => {
    const res = await fetch('/api/platform', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auto_refill: autoRefill,
        auto_refill_threshold: threshold ? parseFloat(threshold) : null,
        auto_refill_target: target ? parseFloat(target) : null,
      }),
    })
    if (res.ok) {
      setMessage({ type: 'success', text: 'Auto-refill settings saved' })
      fetchAccount()
    }
  }

  const copyKey = () => {
    navigator.clipboard.writeText(apiKey.full)
    setMessage({ type: 'success', text: 'API key copied to clipboard' })
  }

  const exportCSV = () => {
    if (transactions.length === 0) return
    const headers = 'Date,Type,Amount,Balance After,Description\n'
    const rows = transactions.map(t =>
      `${new Date(t.created_at).toISOString()},${t.type},${t.amount},${t.balance_after},"${t.description || ''}"`
    ).join('\n')
    const blob = new Blob([headers + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'transactions.csv'
    a.click()
  }

  const typeLabel = (type: string) => {
    const labels: Record<string, { text: string; color: string }> = {
      deposit: { text: 'Deposit', color: '#166534' },
      query_debit: { text: 'Query', color: '#1a3a6b' },
      marketing_debit: { text: 'Marketing', color: '#92400e' },
      refund: { text: 'Refund', color: '#0d9488' },
    }
    return labels[type] || { text: type, color: '#767676' }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="font-body text-sm text-[#767676]">Loading platform dashboard...</div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-[1100px]">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-heading text-[28px] font-bold mb-1">Platform Dashboard</h1>
        <p className="font-body text-sm text-[#767676]">
          Manage credits, API access, and platform settings.
        </p>
      </div>

      {message && (
        <div className={`mb-6 p-3 border-l-[3px] rounded-[3px] ${message.type === 'success' ? 'bg-[#f0fdfa] border-[#0d9488]' : 'bg-[#fef2f2] border-[#991b1b]'}`}>
          <p className={`font-body text-sm m-0 ${message.type === 'success' ? 'text-[#0d9488]' : 'text-[#991b1b]'}`}>{message.text}</p>
        </div>
      )}

      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Balance Card */}
        <div className="card-grace p-6">
          <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-2">Credit Balance</div>
          <div className="font-mono text-[32px] font-medium text-[#166534]">
            ${account ? Number(account.credit_balance).toFixed(2) : '0.00'}
          </div>
          <div className="font-body text-xs text-[#767676] mt-1">
            Member since {account ? new Date(account.created_at).toLocaleDateString() : '—'}
          </div>
        </div>

        {/* Add Credits */}
        <div className="card-grace p-6">
          <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-3">Add Credits</div>
          <div className="flex gap-2">
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="Amount"
              min="1"
              step="0.01"
              className="flex-1 px-3 py-2 border border-[#d4d4d4] rounded-[3px] font-mono text-sm outline-none focus:border-[#0d9488]"
            />
            <button
              onClick={handleDeposit}
              disabled={depositLoading || !depositAmount}
              className="btn-platform !py-2 !px-4 !text-[11px] disabled:opacity-50"
            >
              {depositLoading ? '...' : 'Add'}
            </button>
          </div>
          <div className="font-body text-[10px] text-[#767676] mt-2 italic">
            Stripe integration coming soon
          </div>
        </div>

        {/* Auto-Refill */}
        <div className="card-grace p-6">
          <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-3">Auto-Refill</div>
          <label className="flex items-center gap-2 mb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefill}
              onChange={(e) => setAutoRefill(e.target.checked)}
              className="w-4 h-4 accent-[#0d9488]"
            />
            <span className="font-body text-sm">Enable auto-refill</span>
          </label>
          {autoRefill && (
            <div className="space-y-2">
              <input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="Threshold ($)"
                className="w-full px-2 py-1.5 border border-[#d4d4d4] rounded-[3px] font-mono text-xs outline-none focus:border-[#0d9488]"
              />
              <input
                type="number"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="Refill to ($)"
                className="w-full px-2 py-1.5 border border-[#d4d4d4] rounded-[3px] font-mono text-xs outline-none focus:border-[#0d9488]"
              />
              <button onClick={handleSaveAutoRefill} className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#0d9488] hover:underline cursor-pointer bg-transparent border-none p-0">
                Save Settings
              </button>
            </div>
          )}
        </div>
      </div>

      {/* API Key */}
      <div className="card-grace p-6 mb-8">
        <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-3">API Key</div>
        <div className="flex items-center gap-3">
          <code className="flex-1 bg-[#f5f5f5] px-4 py-2.5 rounded-[3px] font-mono text-sm border border-[#d4d4d4] select-all">
            {showFullKey ? apiKey.full : apiKey.masked}
          </code>
          <button onClick={() => setShowFullKey(!showFullKey)} className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#0d9488] hover:text-[#14b8a6] cursor-pointer bg-transparent border-none">
            {showFullKey ? 'Hide' : 'Show'}
          </button>
          <button onClick={copyKey} className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#0d9488] hover:text-[#14b8a6] cursor-pointer bg-transparent border-none">
            Copy
          </button>
          <button onClick={handleRegenerateKey} className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#991b1b] hover:text-[#b91c1c] cursor-pointer bg-transparent border-none">
            Regenerate
          </button>
        </div>
      </div>

      {/* Transaction History */}
      <div className="card-grace p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676]">
            Transaction History <span className="text-[#0d9488]">({txTotal})</span>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={txFilter}
              onChange={(e) => { setTxFilter(e.target.value); setTxPage(1) }}
              className="font-body text-xs px-2 py-1.5 border border-[#d4d4d4] rounded-[3px] outline-none"
            >
              <option value="">All Types</option>
              <option value="deposit">Deposits</option>
              <option value="query_debit">Queries</option>
              <option value="marketing_debit">Marketing</option>
              <option value="refund">Refunds</option>
            </select>
            <button onClick={exportCSV} className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#0d9488] hover:underline cursor-pointer bg-transparent border-none">
              Export CSV
            </button>
          </div>
        </div>

        {transactions.length === 0 ? (
          <div className="py-8 text-center font-body text-sm text-[#767676]">
            No transactions yet. Add credits to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e8e8e8]">
                  <th className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] text-left py-2 px-3">Date</th>
                  <th className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] text-left py-2 px-3">Type</th>
                  <th className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] text-right py-2 px-3">Amount</th>
                  <th className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] text-right py-2 px-3">Balance</th>
                  <th className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] text-left py-2 px-3">Description</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const label = typeLabel(tx.type)
                  return (
                    <tr key={tx.id} className="border-b border-[#f0f0f0] hover:bg-[#fafafa]">
                      <td className="font-body text-xs text-[#5a5a5a] py-2.5 px-3">
                        {new Date(tx.created_at).toLocaleDateString()} {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-body text-[10px] font-bold tracking-[0.08em] uppercase px-2 py-0.5 rounded-[2px]" style={{ color: label.color, background: `${label.color}10` }}>
                          {label.text}
                        </span>
                      </td>
                      <td className={`font-mono text-sm text-right py-2.5 px-3 ${tx.amount >= 0 ? 'text-[#166534]' : 'text-[#991b1b]'}`}>
                        {tx.amount >= 0 ? '+' : ''}{Number(tx.amount).toFixed(2)}
                      </td>
                      <td className="font-mono text-sm text-right py-2.5 px-3 text-[#5a5a5a]">
                        ${Number(tx.balance_after).toFixed(2)}
                      </td>
                      <td className="font-body text-xs text-[#767676] py-2.5 px-3 max-w-[200px] truncate">
                        {tx.description}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {txTotal > 20 && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#e8e8e8]">
            <button
              onClick={() => setTxPage(p => Math.max(1, p - 1))}
              disabled={txPage === 1}
              className="font-body text-xs text-[#0d9488] disabled:text-[#d4d4d4] cursor-pointer disabled:cursor-not-allowed bg-transparent border-none"
            >
              ← Previous
            </button>
            <span className="font-body text-xs text-[#767676]">Page {txPage} of {Math.ceil(txTotal / 20)}</span>
            <button
              onClick={() => setTxPage(p => p + 1)}
              disabled={txPage * 20 >= txTotal}
              className="font-body text-xs text-[#0d9488] disabled:text-[#d4d4d4] cursor-pointer disabled:cursor-not-allowed bg-transparent border-none"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
