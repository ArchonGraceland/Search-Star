'use client'

import { useState, useEffect, useCallback } from 'react'

interface CommitmentResult {
  id: string
  habit: string
  status: string
  logged_days: number
  current_streak: number
  supporter_count: number
  started_at: string
  already_sponsored: boolean
}

interface SponsorForm {
  bounty_day10: string
  bounty_day20: string
  bounty_day30: string
  bounty_day40: string
  weekly_rate: string
  gated_offer_body: string
  gated_offer_threshold: string
  gated_offer_price: string
  sponsor_label: string
}

interface Sponsorship {
  id: string
  commitment_id: string
  status: string
  bounty_day10: number
  bounty_day20: number
  bounty_day30: number
  bounty_day40: number
  escrow_remaining: number
  escrow_total: number
  weekly_rate: number
  gated_offer_delivered: boolean
  gated_offer_threshold: number
  sponsor_label: string | null
  created_at: string
  commitment: { habit: string; status: string; logged_days: number; current_streak: number } | null
  milestone_payments: { day_number: number; gross_amount: number; paid_at: string }[]
  total_paid: number
}

function ArcMini({ filled }: { filled: number }) {
  return (
    <div className="flex flex-wrap gap-[2px]">
      {Array.from({ length: 40 }).map((_, i) => (
        <div key={i} style={{ width: 7, height: 7, borderRadius: 1, flexShrink: 0 }}
          className={i < Math.min(filled, 40) ? 'bg-[#639922]' : 'bg-[#f0f0f0] border border-[#d4d4d4]'} />
      ))}
    </div>
  )
}

const BLANK_FORM: SponsorForm = {
  bounty_day10: '', bounty_day20: '', bounty_day30: '', bounty_day40: '',
  weekly_rate: '', gated_offer_body: '', gated_offer_threshold: '40',
  gated_offer_price: '', sponsor_label: '',
}

export default function PlatformSponsorships() {
  const [tab, setTab] = useState<'search' | 'portfolio'>('search')
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<CommitmentResult[]>([])
  const [searching, setSearching] = useState(false)
  const [sponsoring, setSponsoring] = useState<string | null>(null)
  const [form, setForm] = useState<SponsorForm>(BLANK_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [sponsorships, setSponsorships] = useState<Sponsorship[]>([])
  const [summary, setSummary] = useState({ total_escrowed: 0, total_paid: 0, active_count: 0 })
  const [portfolioLoading, setPortfolioLoading] = useState(false)

  const search = useCallback(async () => {
    setSearching(true)
    try {
      const res = await fetch(`/api/platform/commitments?q=${encodeURIComponent(keyword)}`)
      const data = await res.json()
      setResults(data.commitments || [])
    } finally {
      setSearching(false)
    }
  }, [keyword])

  const loadPortfolio = useCallback(async () => {
    setPortfolioLoading(true)
    try {
      const res = await fetch('/api/platform/sponsorship')
      const data = await res.json()
      setSponsorships(data.sponsorships || [])
      setSummary(data.summary || { total_escrowed: 0, total_paid: 0, active_count: 0 })
    } finally {
      setPortfolioLoading(false)
    }
  }, [])

  useEffect(() => { search() }, [search])
  useEffect(() => { if (tab === 'portfolio') loadPortfolio() }, [tab, loadPortfolio])

  async function submitSponsor(commitmentId: string) {
    setSubmitting(true); setFormError('')
    try {
      const res = await fetch('/api/platform/sponsorship/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commitment_id: commitmentId,
          bounty_day10: form.bounty_day10 ? parseFloat(form.bounty_day10) : 0,
          bounty_day20: form.bounty_day20 ? parseFloat(form.bounty_day20) : 0,
          bounty_day30: form.bounty_day30 ? parseFloat(form.bounty_day30) : 0,
          bounty_day40: form.bounty_day40 ? parseFloat(form.bounty_day40) : 0,
          weekly_rate: form.weekly_rate ? parseFloat(form.weekly_rate) : 0,
          gated_offer_body: form.gated_offer_body || null,
          gated_offer_threshold: parseInt(form.gated_offer_threshold) || 40,
          gated_offer_price: form.gated_offer_price ? parseFloat(form.gated_offer_price) : 0,
          sponsor_label: form.sponsor_label || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create sponsorship')
      setSponsoring(null)
      setForm(BLANK_FORM)
      setResults(prev => prev.map(c => c.id === commitmentId ? { ...c, already_sponsored: true } : c))
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSubmitting(false) }
  }

  const escrowPreview = [
    parseFloat(form.bounty_day10) || 0,
    parseFloat(form.bounty_day20) || 0,
    parseFloat(form.bounty_day30) || 0,
    parseFloat(form.bounty_day40) || 0,
  ].reduce((a, b) => a + b, 0)

  return (
    <div className="p-8 max-w-[900px]">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-heading text-[28px] font-bold mb-1">Practice Sponsorships</h1>
          <p className="font-body text-sm text-[#767676]">Back people who keep their word. Milestone bounties, streak payments, gated offers.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(['search', 'portfolio'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`font-body text-[11px] font-bold tracking-[0.08em] uppercase px-4 py-2 rounded-[3px] border transition-colors ${tab === t ? 'bg-[#1a3a6b] text-white border-[#1a3a6b]' : 'bg-white text-[#767676] border-[#d4d4d4] hover:border-[#1a3a6b]'}`}>
            {t === 'search' ? 'Find commitments' : `Portfolio${summary.active_count > 0 ? ` (${summary.active_count})` : ''}`}
          </button>
        ))}
      </div>

      {/* ── Search tab ── */}
      {tab === 'search' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input value={keyword} onChange={e => setKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="Search by habit keyword — reading, BJJ, Latin, running…"
              className="flex-1 px-4 py-2.5 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#1a3a6b]" />
            <button onClick={search} disabled={searching}
              className="font-body text-[11px] font-bold tracking-[0.08em] uppercase px-5 py-2.5 bg-[#1a3a6b] text-white rounded-[3px] hover:bg-[#112a4f] disabled:opacity-60">
              {searching ? '…' : 'Search'}
            </button>
          </div>

          {results.length === 0 && !searching && (
            <p className="font-body text-sm text-[#767676] py-6 text-center">No public active commitments found{keyword ? ` for "${keyword}"` : ''}.</p>
          )}

          {results.map(c => (
            <div key={c.id} className="bg-white border border-[#d4d4d4] rounded-[3px] shadow-sm overflow-hidden">
              <div className="px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="font-body text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#EAF3DE] text-[#3B6D11]">
                        {c.status === 'ongoing' ? 'ongoing streak' : `day ${c.logged_days} of 40`}
                      </span>
                      {c.supporter_count > 0 && (
                        <span className="font-body text-[11px] text-[#767676]">{c.supporter_count} supporter{c.supporter_count !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                    <p className="font-heading text-lg text-[#1a1a1a] leading-snug mb-3">{c.habit}</p>
                    <ArcMini filled={c.logged_days} />
                  </div>
                  <div className="flex-shrink-0">
                    {c.already_sponsored ? (
                      <span className="font-body text-[11px] text-[#639922] font-bold">✓ Sponsored</span>
                    ) : (
                      <button onClick={() => { setSponsoring(sponsoring === c.id ? null : c.id); setForm(BLANK_FORM); setFormError('') }}
                        className="font-body text-[11px] font-bold tracking-[0.08em] uppercase px-4 py-2 border border-[#1a3a6b] text-[#1a3a6b] rounded-[3px] hover:bg-[#1a3a6b] hover:text-white transition-colors">
                        {sponsoring === c.id ? 'cancel' : 'sponsor'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Sponsor form */}
              {sponsoring === c.id && (
                <div className="border-t border-[#d4d4d4] px-6 py-5 bg-[#f5f5f5] space-y-5">

                  {/* Sponsor label */}
                  <div>
                    <label className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] block mb-1.5">Sponsor label (shown on posts)</label>
                    <input value={form.sponsor_label} onChange={e => setForm(f => ({ ...f, sponsor_label: e.target.value }))}
                      placeholder="Supported by Acme"
                      className="w-full px-3 py-2 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#1a3a6b] bg-white" />
                  </div>

                  {/* Milestone bounties */}
                  <div>
                    <label className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] block mb-1.5">Milestone bounties — escrowed now, released when day is posted</label>
                    <div className="grid grid-cols-4 gap-2">
                      {([10, 20, 30, 40] as const).map(day => {
                        const key = `bounty_day${day}` as keyof SponsorForm
                        return (
                          <div key={day}>
                            <div className="font-body text-[10px] text-[#767676] mb-1">Day {day}</div>
                            <div className="flex items-center gap-1">
                              <span className="font-mono text-xs text-[#767676]">$</span>
                              <input type="number" min="0" step="0.01" value={form[key]}
                                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                                placeholder="0"
                                className="w-full px-2 py-1.5 border border-[#d4d4d4] rounded-[3px] font-mono text-sm outline-none focus:border-[#1a3a6b] bg-white" />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {escrowPreview > 0 && (
                      <p className="font-body text-xs text-[#1a3a6b] mt-1.5">${escrowPreview.toFixed(2)} will be held in escrow. Unreleased amounts are returned if the commitment is abandoned.</p>
                    )}
                  </div>

                  {/* Weekly rate */}
                  <div>
                    <label className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] block mb-1.5">Weekly streak payment — charged while streak holds</label>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-[#767676]">$</span>
                      <input type="number" min="0" step="0.01" value={form.weekly_rate}
                        onChange={e => setForm(f => ({ ...f, weekly_rate: e.target.value }))}
                        placeholder="0.00"
                        className="w-32 px-3 py-2 border border-[#d4d4d4] rounded-[3px] font-mono text-sm outline-none focus:border-[#1a3a6b] bg-white" />
                      <span className="font-body text-xs text-[#767676]">per week</span>
                    </div>
                  </div>

                  {/* Gated offer */}
                  <div>
                    <label className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] block mb-1.5">Gated offer — delivered only when threshold is reached</label>
                    <textarea value={form.gated_offer_body} onChange={e => setForm(f => ({ ...f, gated_offer_body: e.target.value }))}
                      rows={3} placeholder="Write your offer message here…"
                      className="w-full px-3 py-2 border border-[#d4d4d4] rounded-[3px] font-body text-sm outline-none focus:border-[#1a3a6b] resize-none bg-white" />
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-2">
                        <span className="font-body text-xs text-[#767676]">Unlock at day</span>
                        <input type="number" min="1" max="40" value={form.gated_offer_threshold}
                          onChange={e => setForm(f => ({ ...f, gated_offer_threshold: e.target.value }))}
                          className="w-16 px-2 py-1 border border-[#d4d4d4] rounded-[3px] font-mono text-sm outline-none focus:border-[#1a3a6b] bg-white" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-body text-xs text-[#767676]">Delivery price $</span>
                        <input type="number" min="0" step="0.01" value={form.gated_offer_price}
                          onChange={e => setForm(f => ({ ...f, gated_offer_price: e.target.value }))}
                          placeholder="5.00"
                          className="w-20 px-2 py-1 border border-[#d4d4d4] rounded-[3px] font-mono text-sm outline-none focus:border-[#1a3a6b] bg-white" />
                      </div>
                    </div>
                  </div>

                  {formError && <p className="font-body text-sm text-[#991b1b]">{formError}</p>}

                  <div className="flex items-center justify-between pt-2">
                    <p className="font-body text-xs text-[#767676]">
                      Total escrowed now: <strong>${escrowPreview.toFixed(2)}</strong>
                    </p>
                    <button onClick={() => submitSponsor(c.id)} disabled={submitting}
                      className="font-body text-[11px] font-bold tracking-[0.08em] uppercase px-6 py-2.5 bg-[#1a3a6b] text-white rounded-[3px] hover:bg-[#112a4f] disabled:opacity-60">
                      {submitting ? 'Creating…' : 'Create sponsorship'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Portfolio tab ── */}
      {tab === 'portfolio' && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-2">
            {[
              { label: 'Active sponsorships', value: summary.active_count },
              { label: 'In escrow', value: `$${summary.total_escrowed.toFixed(2)}` },
              { label: 'Total paid out', value: `$${summary.total_paid.toFixed(2)}` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white border border-[#d4d4d4] rounded-[3px] shadow-sm p-5">
                <div className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">{label}</div>
                <div className="font-heading text-2xl font-bold text-[#1a3a6b]">{value}</div>
              </div>
            ))}
          </div>

          {portfolioLoading && <p className="font-body text-sm text-[#767676] py-6 text-center">Loading…</p>}

          {!portfolioLoading && sponsorships.length === 0 && (
            <div className="bg-white border border-[#d4d4d4] rounded-[3px] p-10 text-center">
              <p className="font-heading text-lg text-[#1a1a1a] mb-2">No sponsorships yet.</p>
              <p className="font-body text-sm text-[#767676]">Search for active commitments and back people who keep their word.</p>
            </div>
          )}

          {sponsorships.map(s => (
            <div key={s.id} className="bg-white border border-[#d4d4d4] rounded-[3px] shadow-sm overflow-hidden">
              <div className="px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`font-body text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        s.status === 'active' ? 'bg-[#EAF3DE] text-[#3B6D11]' :
                        s.status === 'completed' ? 'bg-[#E6F1FB] text-[#185FA5]' :
                        'bg-[#FAEEDA] text-[#854F0B]'
                      }`}>{s.status}</span>
                      {s.sponsor_label && <span className="font-body text-[11px] text-[#767676]">{s.sponsor_label}</span>}
                    </div>
                    <p className="font-heading text-lg text-[#1a1a1a] leading-snug">
                      {s.commitment?.habit || 'Commitment not found'}
                    </p>
                    {s.commitment && (
                      <div className="mt-2">
                        <ArcMini filled={s.commitment.logged_days} />
                        <p className="font-body text-[11px] text-[#767676] mt-1">
                          Day {s.commitment.logged_days}{s.commitment.status === 'active' ? ' of 40' : ''} · streak {s.commitment.current_streak}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-body text-[10px] font-bold tracking-[0.08em] uppercase text-[#767676]">Escrow remaining</div>
                    <div className="font-heading text-xl font-bold text-[#1a3a6b]">${Number(s.escrow_remaining).toFixed(2)}</div>
                    <div className="font-body text-[10px] text-[#767676]">of ${Number(s.escrow_total).toFixed(2)}</div>
                  </div>
                </div>

                {/* Milestone progress */}
                {(s.bounty_day10 || s.bounty_day20 || s.bounty_day30 || s.bounty_day40) > 0 && (
                  <div className="mt-4 flex gap-3">
                    {([10, 20, 30, 40] as const).map(day => {
                      const bountyKey = `bounty_day${day}` as keyof Sponsorship
                      const amount = Number(s[bountyKey] || 0)
                      if (!amount) return null
                      const paid = s.milestone_payments.some(p => p.day_number === day)
                      const reached = (s.commitment?.logged_days || 0) >= day
                      return (
                        <div key={day} className={`flex-1 p-2.5 rounded-[3px] text-center border ${
                          paid ? 'bg-[#f0fdf4] border-[#166534]/20' :
                          reached ? 'bg-[#eef2f8] border-[#1a3a6b]/20' :
                          'bg-[#f5f5f5] border-[#d4d4d4]'
                        }`}>
                          <div className="font-body text-[10px] font-bold uppercase tracking-[0.06em] text-[#767676]">Day {day}</div>
                          <div className={`font-mono text-sm font-medium ${paid ? 'text-[#166534]' : 'text-[#1a1a1a]'}`}>${amount.toFixed(2)}</div>
                          {paid && <div className="font-body text-[9px] text-[#166534]">✓ paid</div>}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Gated offer status */}
                {s.gated_offer_delivered !== undefined && s.gated_offer_threshold > 0 && (
                  <div className={`mt-3 px-3 py-2 rounded-[3px] flex items-center justify-between ${s.gated_offer_delivered ? 'bg-[#f0fdf4]' : 'bg-[#f5f5f5]'}`}>
                    <span className="font-body text-xs text-[#767676]">
                      Gated offer — unlocks at day {s.gated_offer_threshold}
                    </span>
                    <span className={`font-body text-[10px] font-bold ${s.gated_offer_delivered ? 'text-[#166534]' : 'text-[#767676]'}`}>
                      {s.gated_offer_delivered ? '✓ delivered' : 'waiting'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
