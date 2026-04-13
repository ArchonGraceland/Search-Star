'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface Sponsorship {
  id: string
  sponsor_name: string
  sponsor_email: string
  pledge_amount: number
  status: 'pledged' | 'paid' | 'refunded'
  pledged_at: string
  paid_at: string | null
}

const STATUS_BADGE = {
  pledged: { bg: '#eef2f8', color: '#1a3a6b', label: 'Pledged' },
  paid: { bg: '#edf7ed', color: '#2d6a2d', label: 'Paid' },
  refunded: { bg: '#fef2f2', color: '#991b1b', label: 'Refunded' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function SponsorsPage() {
  const params = useParams()
  const id = params.id as string

  const [sponsorships, setSponsorships] = useState<Sponsorship[]>([])
  const [commitmentTitle, setCommitmentTitle] = useState('')
  const [totalPledged, setTotalPledged] = useState(0)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/sponsorships/${id}`)
    if (res.ok) {
      const data = await res.json()
      setSponsorships(data.sponsorships ?? [])
      setCommitmentTitle(data.commitment_title ?? '')
      setTotalPledged(data.total_pledged ?? 0)
    } else {
      setNotFound(true)
    }
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div style={{ maxWidth: '720px' }}>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#767676' }}>Loading sponsors...</p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div style={{ maxWidth: '720px' }}>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#767676' }}>Commitment not found.</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '720px' }}>
      {/* Back link */}
      <Link
        href={`/commit/${id}`}
        style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#1a3a6b', textDecoration: 'none', fontWeight: 600, display: 'inline-block', marginBottom: '20px' }}
      >
        ← Back to commitment
      </Link>

      {/* Eyebrow */}
      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#767676', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>
        Sponsors
      </p>

      <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '28px', fontWeight: 700, margin: '0 0 4px' }}>
        {commitmentTitle}
      </h1>

      {/* Total pledged */}
      <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '16px 20px', marginTop: '20px', marginBottom: '28px', display: 'flex', gap: '32px' }}>
        <div>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#767676', margin: '0 0 2px' }}>
            Total pledged
          </p>
          <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '28px', fontWeight: 700, color: '#1a3a6b', margin: 0 }}>
            ${totalPledged.toFixed(2)}
          </p>
        </div>
        <div>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#767676', margin: '0 0 2px' }}>
            Sponsors
          </p>
          <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '28px', fontWeight: 700, color: '#1a3a6b', margin: 0 }}>
            {sponsorships.length}
          </p>
        </div>
      </div>

      {/* Pledge table */}
      {sponsorships.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '40px 28px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#b8b8b8', margin: 0 }}>
            No sponsors yet. Share your sponsor link to invite pledges.
          </p>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: '0', background: '#f5f5f5', borderBottom: '1px solid #d4d4d4', padding: '10px 20px' }}>
            {['Sponsor', 'Email', 'Amount', 'Status'].map((h) => (
              <span key={h} style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#767676' }}>
                {h}
              </span>
            ))}
          </div>
          {/* Rows */}
          {sponsorships.map((s, i) => {
            const badge = STATUS_BADGE[s.status] ?? STATUS_BADGE.pledged
            return (
              <div
                key={s.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr auto auto',
                  gap: '0',
                  padding: '14px 20px',
                  borderBottom: i < sponsorships.length - 1 ? '1px solid #f0f0f0' : 'none',
                  alignItems: 'center',
                }}
              >
                <div>
                  <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#1a1a1a', margin: '0 0 2px', fontWeight: 600 }}>
                    {s.sponsor_name}
                  </p>
                  <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', color: '#b8b8b8', margin: 0 }}>
                    {formatDate(s.pledged_at)}
                  </p>
                </div>
                <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#5a5a5a', margin: 0, paddingRight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.sponsor_email}
                </p>
                <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#1a3a6b', margin: 0, paddingRight: '16px', whiteSpace: 'nowrap' }}>
                  ${s.pledge_amount.toFixed(2)}
                </p>
                <span style={{
                  fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em',
                  textTransform: 'uppercase', background: badge.bg, color: badge.color, borderRadius: '2px', padding: '3px 8px', whiteSpace: 'nowrap',
                }}>
                  {badge.label}
                </span>
              </div>
            )
          })}
          {/* Total row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: '0', padding: '12px 20px', background: '#f5f5f5', borderTop: '2px solid #d4d4d4' }}>
            <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700, color: '#5a5a5a', gridColumn: '1 / 3' }}>
              Total
            </span>
            <span style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#1a3a6b' }}>
              ${totalPledged.toFixed(2)}
            </span>
            <span />
          </div>
        </div>
      )}
    </div>
  )
}
