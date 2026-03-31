'use client'

import { useState, useEffect, useCallback } from 'react'

interface Profile {
  id: string
  profile_number: string
  handle: string
  display_name: string
  location: string
  age_cohort: string
  presence_score: number
  trust_score: number
  skills_count: number
  interests_tags: string[]
  price_public: number
  price_private: number
  price_marketing: number
  tagline: string
  has_financial: boolean
  has_dating: boolean
  has_content_feed: boolean
}

interface QueryResult {
  profile: Record<string, unknown>
  query_cost: number
  balance_remaining: number
}

export default function PlatformDirectory() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [location, setLocation] = useState('')
  const [ageCohort, setAgeCohort] = useState('')
  const [minPresence, setMinPresence] = useState('0')
  const [maxPresence, setMaxPresence] = useState('100')
  const [interest, setInterest] = useState('')

  // Expanded profile
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Query result modal
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null)
  const [querying, setQuerying] = useState<string | null>(null)

  // Marketing message modal
  const [messageTarget, setMessageTarget] = useState<Profile | null>(null)
  const [messageBody, setMessageBody] = useState('')
  const [messageSending, setMessageSending] = useState(false)
  const [messageResult, setMessageResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchProfiles = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: page.toString() })
    if (search) params.set('search', search)
    if (location) params.set('location', location)
    if (ageCohort) params.set('age_cohort', ageCohort)
    if (minPresence !== '0') params.set('min_presence', minPresence)
    if (maxPresence !== '100') params.set('max_presence', maxPresence)
    if (interest) params.set('interest', interest)

    const res = await fetch(`/api/platform/directory?${params}`)
    if (res.ok) {
      const data = await res.json()
      setProfiles(data.profiles)
      setTotal(data.total)
      setTotalPages(data.total_pages)
    }
    setLoading(false)
  }, [page, search, location, ageCohort, minPresence, maxPresence, interest])

  useEffect(() => {
    fetchProfiles()
  }, [fetchProfiles])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchProfiles()
  }

  const handleQuery = async (profileId: string) => {
    setQuerying(profileId)
    setQueryResult(null)
    const res = await fetch('/api/platform/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_id: profileId }),
    })
    const data = await res.json()
    if (res.ok) {
      setQueryResult(data)
    } else {
      setQueryResult(null)
      alert(data.error || 'Query failed')
    }
    setQuerying(null)
  }

  const handleSendMessage = async () => {
    if (!messageTarget || !messageBody.trim()) return
    setMessageSending(true)
    setMessageResult(null)

    const res = await fetch('/api/platform/send-marketing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient_profile_id: messageTarget.id,
        message: messageBody,
      }),
    })
    const data = await res.json()
    if (res.ok) {
      setMessageResult({ type: 'success', text: `Message sent! Cost: $${data.price_charged?.toFixed(2)}. Balance: $${data.balance_remaining?.toFixed(2)}` })
      setMessageBody('')
      setTimeout(() => setMessageTarget(null), 2000)
    } else {
      setMessageResult({ type: 'error', text: data.error || 'Failed to send message' })
    }
    setMessageSending(false)
  }

  return (
    <div className="p-8 max-w-[1100px]">
      <div className="mb-6">
        <h1 className="font-heading text-[28px] font-bold mb-1">Profile Directory</h1>
        <p className="font-body text-sm text-[#767676]">
          Search, query, and message profiles in the Search Star network. <span className="font-mono text-[#0d9488]">{total}</span> active profiles.
        </p>
      </div>

      {/* Search & Filters */}
      <form onSubmit={handleSearch} className="card-grace p-5 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="col-span-2">
            <label className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] block mb-1">Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, handle, or profile number..."
              className="w-full px-3 py-2 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#0d9488]"
            />
          </div>
          <div>
            <label className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] block mb-1">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City, state..."
              className="w-full px-3 py-2 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#0d9488]"
            />
          </div>
          <div>
            <label className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] block mb-1">Age Cohort</label>
            <select
              value={ageCohort}
              onChange={(e) => setAgeCohort(e.target.value)}
              className="w-full px-3 py-2 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none"
            >
              <option value="">Any</option>
              <option value="18-24">18-24</option>
              <option value="25-34">25-34</option>
              <option value="35-44">35-44</option>
              <option value="45-54">45-54</option>
              <option value="55-64">55-64</option>
              <option value="65+">65+</option>
            </select>
          </div>
          <div>
            <label className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] block mb-1">Min Presence</label>
            <input type="number" value={minPresence} onChange={(e) => setMinPresence(e.target.value)} min="0" max="100" className="w-full px-3 py-2 border border-[#d4d4d4] rounded-[3px] font-mono text-sm outline-none focus:border-[#0d9488]" />
          </div>
          <div>
            <label className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] block mb-1">Max Presence</label>
            <input type="number" value={maxPresence} onChange={(e) => setMaxPresence(e.target.value)} min="0" max="100" className="w-full px-3 py-2 border border-[#d4d4d4] rounded-[3px] font-mono text-sm outline-none focus:border-[#0d9488]" />
          </div>
          <div>
            <label className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] block mb-1">Interest Tag</label>
            <input type="text" value={interest} onChange={(e) => setInterest(e.target.value)} placeholder="e.g. AI" className="w-full px-3 py-2 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#0d9488]" />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-platform !py-2 w-full">Search</button>
          </div>
        </div>
      </form>

      {/* Results */}
      {loading ? (
        <div className="py-12 text-center font-body text-sm text-[#767676]">Searching directory...</div>
      ) : profiles.length === 0 ? (
        <div className="card-grace p-12 text-center">
          <div className="font-body text-sm text-[#767676]">No profiles match your search criteria.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {profiles.map((p) => (
            <div key={p.id} className="card-grace">
              <div
                className="p-4 flex items-center gap-4 cursor-pointer hover:bg-[#fafafa] transition-colors"
                onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
              >
                {/* Presence Score Badge */}
                <div className="w-12 h-12 rounded-full bg-[#0f2e2b] flex items-center justify-center flex-shrink-0">
                  <span className="font-mono text-sm font-bold text-[#5eead4]">{p.presence_score}</span>
                </div>

                {/* Name + Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-heading text-lg font-bold">{p.display_name}</span>
                    <span className="font-mono text-xs text-[#767676]">{p.profile_number}</span>
                  </div>
                  <div className="font-body text-xs text-[#767676]">
                    {p.location || 'Location not set'} · {p.age_cohort || 'Age N/A'} · Trust: {p.trust_score}
                  </div>
                </div>

                {/* Tags */}
                <div className="hidden md:flex flex-wrap gap-1 max-w-[200px]">
                  {(p.interests_tags || []).slice(0, 3).map((tag, i) => (
                    <span key={i} className="font-body text-[10px] font-bold tracking-[0.08em] uppercase px-2 py-0.5 rounded-[2px] bg-[#f0fdfa] text-[#0d9488]">
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Pricing */}
                <div className="text-right flex-shrink-0">
                  <div className="font-mono text-sm text-[#1a1a1a]">${Number(p.price_public).toFixed(2)}</div>
                  <div className="font-body text-[10px] text-[#767676] uppercase">per query</div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleQuery(p.id) }}
                    disabled={querying === p.id}
                    className="font-body text-[10px] font-bold tracking-[0.08em] uppercase px-3 py-1.5 bg-[#0d9488] text-white rounded-[3px] hover:bg-[#14b8a6] disabled:opacity-50 cursor-pointer border-none"
                  >
                    {querying === p.id ? '...' : 'Query'}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setMessageTarget(p); setMessageResult(null); setMessageBody('') }}
                    className="font-body text-[10px] font-bold tracking-[0.08em] uppercase px-3 py-1.5 bg-[#92400e] text-white rounded-[3px] hover:bg-[#a85b1b] cursor-pointer border-none"
                  >
                    Message
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedId === p.id && (
                <div className="px-4 pb-4 pt-0 border-t border-[#f0f0f0]">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                    <div>
                      <div className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676]">Handle</div>
                      <div className="font-mono text-sm">{p.handle || '—'}</div>
                    </div>
                    <div>
                      <div className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676]">Skills</div>
                      <div className="font-mono text-sm">{p.skills_count}</div>
                    </div>
                    <div>
                      <div className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676]">Financial Data</div>
                      <div className="font-body text-sm">{p.has_financial ? 'Yes' : 'No'}</div>
                    </div>
                    <div>
                      <div className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676]">Dating Data</div>
                      <div className="font-body text-sm">{p.has_dating ? 'Yes' : 'No'}</div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">Tagline</div>
                    <div className="font-body text-sm text-[#5a5a5a]">{p.tagline || 'No tagline set'}</div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <div className="p-2 bg-[#eef2f8] rounded-[3px] text-center">
                      <div className="font-body text-[9px] font-bold tracking-[0.1em] uppercase text-[#767676]">Public</div>
                      <div className="font-mono text-sm font-medium text-[#1a3a6b]">${Number(p.price_public).toFixed(2)}</div>
                    </div>
                    <div className="p-2 bg-[#eef2f8] rounded-[3px] text-center">
                      <div className="font-body text-[9px] font-bold tracking-[0.1em] uppercase text-[#767676]">Private</div>
                      <div className="font-mono text-sm font-medium text-[#1a3a6b]">${Number(p.price_private).toFixed(2)}</div>
                    </div>
                    <div className="p-2 bg-[#fffbeb] rounded-[3px] text-center">
                      <div className="font-body text-[9px] font-bold tracking-[0.1em] uppercase text-[#767676]">Marketing</div>
                      <div className="font-mono text-sm font-medium text-[#92400e]">${Number(p.price_marketing).toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {(p.interests_tags || []).map((tag, i) => (
                      <span key={i} className="font-body text-[10px] font-bold tracking-[0.08em] uppercase px-2 py-0.5 rounded-[2px] bg-[#f0fdfa] text-[#0d9488]">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-platform-secondary !py-2 !px-4 !text-[11px] disabled:opacity-30">
            ← Previous
          </button>
          <span className="font-body text-xs text-[#767676]">
            Page {page} of {totalPages} · {total} results
          </span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} className="btn-platform-secondary !py-2 !px-4 !text-[11px] disabled:opacity-30">
            Next →
          </button>
        </div>
      )}

      {/* Query Result Modal */}
      {queryResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setQueryResult(null)}>
          <div className="bg-white rounded-[3px] shadow-lg max-w-[600px] w-full max-h-[80vh] overflow-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-xl font-bold">Query Result</h2>
              <button onClick={() => setQueryResult(null)} className="text-[#767676] hover:text-[#1a1a1a] text-lg cursor-pointer bg-transparent border-none">✕</button>
            </div>
            <div className="p-3 bg-[#f0fdfa] border-l-[3px] border-[#0d9488] rounded-[3px] mb-4">
              <span className="font-body text-sm text-[#0d9488]">
                Charged: <span className="font-mono font-medium">${queryResult.query_cost.toFixed(2)}</span> · Remaining: <span className="font-mono font-medium">${queryResult.balance_remaining.toFixed(2)}</span>
              </span>
            </div>
            <pre className="bg-[#1a1a1a] text-[#5eead4] p-4 rounded-[3px] font-mono text-xs overflow-auto whitespace-pre-wrap">
              {JSON.stringify(queryResult.profile, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Marketing Message Modal */}
      {messageTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setMessageTarget(null)}>
          <div className="bg-white rounded-[3px] shadow-lg max-w-[520px] w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-xl font-bold">Send Marketing Message</h2>
              <button onClick={() => setMessageTarget(null)} className="text-[#767676] hover:text-[#1a1a1a] text-lg cursor-pointer bg-transparent border-none">✕</button>
            </div>

            <div className="p-3 bg-[#fffbeb] border-l-[3px] border-[#92400e] rounded-[3px] mb-4">
              <div className="font-body text-sm text-[#92400e]">
                Sending to <strong>{messageTarget.display_name}</strong> ({messageTarget.profile_number})
              </div>
              <div className="font-mono text-sm text-[#92400e] mt-1">
                Cost: ${Number(messageTarget.price_marketing).toFixed(2)} · <strong>No refunds</strong>
              </div>
            </div>

            <div className="mb-4">
              <label className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] block mb-1">
                Message <span className="text-[#0d9488]">({messageBody.length}/500)</span>
              </label>
              <textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value.slice(0, 500))}
                rows={5}
                placeholder="Write your message..."
                className="w-full px-3 py-2 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#0d9488] resize-none"
              />
            </div>

            {messageResult && (
              <div className={`mb-4 p-3 border-l-[3px] rounded-[3px] ${messageResult.type === 'success' ? 'bg-[#f0fdfa] border-[#0d9488]' : 'bg-[#fef2f2] border-[#991b1b]'}`}>
                <p className={`font-body text-sm m-0 ${messageResult.type === 'success' ? 'text-[#0d9488]' : 'text-[#991b1b]'}`}>{messageResult.text}</p>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button onClick={() => setMessageTarget(null)} className="btn-platform-secondary !py-2 !px-4 !text-[11px]">
                Cancel
              </button>
              <button
                onClick={handleSendMessage}
                disabled={messageSending || !messageBody.trim()}
                className="font-body text-[11px] font-bold tracking-[0.08em] uppercase px-4 py-2 bg-[#92400e] text-white rounded-[3px] hover:bg-[#a85b1b] disabled:opacity-50 cursor-pointer border-none"
              >
                {messageSending ? 'Sending...' : `Send — $${Number(messageTarget.price_marketing).toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
