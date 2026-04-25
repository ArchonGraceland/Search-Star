import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

// The earnings page is purely derived from live DB state for the current user;
// nothing on it should ever be cached. Same reasoning as the dashboard.
export const dynamic = 'force-dynamic'

// v4 earnings view. Columns: Commitment / Pledged / Released.
// The retired v3 contributions table (mentor/coach/cb/pl four-way split) is gone.
// Voluntary donations to Search Star are separate from the practitioner's
// earnings and are paid by the sponsor, never deducted from what was promised.
interface CommitmentEarning {
  id: string
  title: string
  completed_at: string | null
  status: string
  total_pledged: number
  total_released: number
}

export default async function EarningsPage() {
  // getUser() via SSR client reads the session cookie. Data reads go through
  // the service client — see commit 0710ce4 for the full writeup. All
  // queries are scoped by user.id; ownership is enforced at app layer.
  const ssr = await createClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) redirect('/login')

  const supabase = createServiceClient()

  // All commitments the user has ever started. We include active/completed/
  // vetoed/abandoned so the practitioner can see the full arc of their
  // sponsorship activity — not just commitments that reached day 90.
  type CommitmentEarningsRow = {
    id: string
    completed_at: string | null
    status: string
    created_at: string
    practices: { name: string } | { name: string }[] | null
  }
  const { data: commitments } = await supabase
    .from('commitments')
    .select('id, completed_at, status, created_at, practices(name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .returns<CommitmentEarningsRow[]>()

  const earnings: CommitmentEarning[] = []
  let grandTotalPledged = 0
  let grandTotalReleased = 0
  let completedCount = 0

  for (const c of commitments ?? []) {
    const { data: sponsorships } = await supabase
      .from('sponsorships')
      .select('pledge_amount, status')
      .eq('commitment_id', c.id)

    let pledged = 0
    let released = 0
    for (const s of sponsorships ?? []) {
      const amount = s.pledge_amount ?? 0
      // Pledged bucket: anything not vetoed/refunded counts as currently
      // pledged against this commitment. Released + paid are realised
      // earnings the practitioner has actually received or will receive.
      if (s.status === 'pledged' || s.status === 'released' || s.status === 'paid') {
        pledged += amount
      }
      if (s.status === 'released' || s.status === 'paid') {
        released += amount
      }
    }

    const practiceJoin = Array.isArray(c.practices) ? c.practices[0] : c.practices
    const practiceName = practiceJoin?.name ?? 'Untitled commitment'

    earnings.push({
      id: c.id,
      title: practiceName,
      completed_at: c.completed_at,
      status: c.status,
      total_pledged: pledged,
      total_released: released,
    })

    grandTotalPledged += pledged
    grandTotalReleased += released
    if (c.status === 'completed') completedCount += 1
  }

  function formatDate(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div style={{ maxWidth: '800px' }}>
      {/* Eyebrow */}
      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#767676', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>
        Earnings
      </p>
      <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '32px', fontWeight: 700, margin: '0 0 6px' }}>
        Your earnings
      </h1>
      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#767676', margin: '0 0 32px', lineHeight: '1.5' }}>
        Pledges are authorized when sponsors join during the 90 days and released at day 90 if the streak completes.
      </p>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '32px' }}>
        {[
          { label: 'Total released', value: `$${grandTotalReleased.toFixed(2)}`, color: '#1a3a6b' },
          { label: 'Total pledged', value: `$${grandTotalPledged.toFixed(2)}`, color: '#2d6a6a' },
          { label: 'Completed commitments', value: String(completedCount), color: '#7a5c00' },
        ].map((card) => (
          <div key={card.label} style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '16px 20px', flex: '1', minWidth: '160px' }}>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#767676', margin: '0 0 4px' }}>
              {card.label}
            </p>
            <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '28px', fontWeight: 700, color: card.color, margin: 0 }}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Earnings table */}
      {earnings.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '48px 28px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#b8b8b8', margin: 0 }}>
            No commitments yet. Declare a commitment to begin your record.
          </p>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr auto auto', gap: '0', background: '#f5f5f5', borderBottom: '1px solid #d4d4d4', padding: '10px 20px' }}>
            {['Commitment', 'Pledged', 'Released'].map((h) => (
              <span key={h} style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#767676' }}>
                {h}
              </span>
            ))}
          </div>

          {earnings.map((e, i) => (
            <div
              key={e.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr auto auto',
                gap: '0',
                padding: '16px 20px',
                borderBottom: i < earnings.length - 1 ? '1px solid #f0f0f0' : 'none',
                alignItems: 'center',
              }}
            >
              <div>
                <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', fontWeight: 600, color: '#1a1a1a', margin: '0 0 2px' }}>
                  {e.title}
                </p>
                <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', color: '#b8b8b8', margin: 0 }}>
                  {e.status === 'completed'
                    ? `Completed ${formatDate(e.completed_at)}`
                    : e.status === 'vetoed'
                    ? 'Ended by sponsor'
                    : e.status === 'abandoned'
                    ? 'Abandoned'
                    : e.status === 'active'
                    ? 'Active'
                    : 'Launch window'}
                </p>
              </div>

              <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#2d6a6a', margin: 0, paddingRight: '24px', whiteSpace: 'nowrap' }}>
                ${e.total_pledged.toFixed(2)}
              </p>

              <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#1a3a6b', margin: 0, whiteSpace: 'nowrap' }}>
                ${e.total_released.toFixed(2)}
              </p>
            </div>
          ))}

          {/* Total row */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr auto auto', gap: '0', padding: '12px 20px', background: '#f5f5f5', borderTop: '2px solid #d4d4d4', alignItems: 'center' }}>
            <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700, color: '#5a5a5a' }}>
              Total
            </span>
            <span style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#2d6a6a', paddingRight: '24px' }}>
              ${grandTotalPledged.toFixed(2)}
            </span>
            <span style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#1a3a6b' }}>
              ${grandTotalReleased.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#b8b8b8', marginTop: '20px', lineHeight: '1.5' }}>
        Pledges are authorized when sponsors join during the 90 days and released at day 90 if the streak completes. Voluntary donations to Search Star are separate from your earnings and are paid by the sponsor, never deducted from what was promised.
      </p>
    </div>
  )
}
