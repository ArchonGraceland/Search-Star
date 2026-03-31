'use client'

import { useState } from 'react'

export function EndpointManager({ currentUrl, currentDomain }: { currentUrl: string | null; currentDomain: string | null }) {
  const [editing, setEditing] = useState(false)
  const [url, setUrl] = useState(currentUrl || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedUrl, setSavedUrl] = useState(currentUrl)
  const [savedDomain, setSavedDomain] = useState(currentDomain)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint_url: url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update')
      setSavedUrl(data.endpoint_url)
      setSavedDomain(data.domain)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint_url: '' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update')
      setSavedUrl(null)
      setSavedDomain(null)
      setUrl('')
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <div>
        {savedUrl ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">Endpoint URL</div>
                <div className="font-mono text-sm text-[#1a3a6b] break-all">{savedUrl}</div>
                <div className="font-body text-[11px] text-[#b8b8b8] mt-0.5">Domain: {savedDomain}</div>
              </div>
              <div className="flex gap-2 shrink-0 ml-4">
                <button
                  onClick={() => setEditing(true)}
                  className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#1a3a6b] cursor-pointer bg-transparent border-none hover:underline"
                >
                  Edit
                </button>
                <button
                  onClick={handleRemove}
                  disabled={saving}
                  className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#991b1b] cursor-pointer bg-transparent border-none hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
            <div className="p-3 bg-[#f0fdf4] border-l-[3px] border-[#166534] rounded-[3px] mt-3">
              <p className="font-body text-[12px] text-[#5a5a5a] m-0">
                Your profile is self-hosted. Platforms query your endpoint directly through the Search Star directory.
              </p>
            </div>
          </div>
        ) : (
          <div>
            <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-2">Endpoint URL</div>
            <p className="font-body text-sm text-[#b8b8b8] mb-3">No endpoint set — your profile data is stored in the Search Star directory only.</p>
            <div className="p-3 bg-[#eef2f8] border-l-[3px] border-[#1a3a6b] rounded-[3px] mb-3">
              <p className="font-body text-[12px] text-[#5a5a5a] m-0">
                For full data sovereignty, host your profile JSON-LD at your own domain and register the URL here.
                Platforms will query your endpoint directly.{' '}
                <a href="/setup.html" target="_blank" className="text-[#1a3a6b] font-bold no-underline hover:underline">
                  Setup guide →
                </a>
              </p>
            </div>
            <button
              onClick={() => setEditing(true)}
              className="font-body text-[11px] font-bold tracking-[0.1em] uppercase px-4 py-2 bg-transparent border border-[#1a3a6b] text-[#1a3a6b] rounded-[3px] cursor-pointer hover:bg-[#1a3a6b] hover:text-white transition-all"
            >
              Add Endpoint URL
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1.5">
        Endpoint URL
      </div>
      <p className="font-body text-[12px] text-[#767676] mb-3">
        The URL where your self-hosted profile JSON-LD is served. Must be HTTPS.
      </p>
      <div className="flex gap-2">
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://yourname.com/profile.json"
          className="flex-1 px-3 py-2.5 border border-[#d4d4d4] rounded-[3px] font-mono text-sm outline-none focus:border-[#1a3a6b] transition-colors"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="font-body text-[11px] font-bold tracking-[0.1em] uppercase px-4 py-2 bg-[#1a3a6b] text-white rounded-[3px] cursor-pointer border-none disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={() => { setEditing(false); setUrl(savedUrl || ''); setError(null) }}
          className="font-body text-[11px] font-bold tracking-[0.1em] uppercase px-4 py-2 bg-transparent border border-[#d4d4d4] text-[#767676] rounded-[3px] cursor-pointer hover:border-[#1a3a6b]"
        >
          Cancel
        </button>
      </div>
      {error && (
        <div className="mt-2 p-2 bg-[#fef2f2] border-l-[3px] border-[#991b1b] rounded-[3px]">
          <p className="font-body text-[12px] text-[#991b1b] m-0">{error}</p>
        </div>
      )}
      <p className="font-body text-[11px] text-[#b8b8b8] mt-1.5 mb-0">
        Not sure how to host?{' '}
        <a href="/setup.html" target="_blank" className="text-[#1a3a6b] no-underline hover:underline">Read the setup guide</a>
      </p>
    </div>
  )
}
