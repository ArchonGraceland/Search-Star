import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

interface CommitmentEarning {
  id: string
  title: string
  completed_at: string
  total_pledged: number
  contribution_amount: number | null
  net_kept: number
}

export default async function EarningsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch all completed commitments for this user
  const { data: commitments } = await supabase
    .from('commitments')
    .select('id, title, completed_at')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })

  const earnings: CommitmentEarning[] = []
  let grandTotalPledged = 0
  let grandTotalContributed = 0
  let grandTotalKept = 0

  for (const c of commitments ?? []) {
    // Get pledges
    const { data: pledges } = await supabase
      .from('sponsorships')
      .select('pledge_amount')
      .eq('commitment_id', c.id)
      .in('status', ['pledged', 'paid'])

    const total_pledged = (pledges ?? []).reduce((sum, p) => sum + (p.pledge_amount ?? 0), 0)

    // Get contribution if any
    const { data: contribution } = await supabase
      .from('contributions')
      .select('gross_amount')
      .eq('commitment_id', c.id)
      .maybeSingle()

    const contribution_amount = contribution?.gross_amount ?? null
    const net_kept = total_pledged // practitioner always keeps 100% of pledges; contribution is separate

    earnings.push({
      id: c.id,
      title: c.title,
      completed_at: c.completed_at ?? '',
      total_pledged,
      contribution_amount,
      net_kept,
    })

    grandTotalPledged += total_pledged
    if (contribution_amount) grandTotalContributed += contribution_amount
    grandTotalKept += net_kept
  }

  function formatDate(iso: string) {
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
        Payment collection coming soon. All amounts shown are recorded pledges.
      </p>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '32px' }}>
        {[
          { label: 'Total pledged', value: `$${grandTotalPledged.toFixed(2)}`, color: '#1a3a6b' },
          { label: 'Total contributed', value: grandTotalContributed > 0 ? `$${grandTotalContributed.toFixed(2)}` : '—', color: '#2d6a6a' },
          { label: 'Completed commitments', value: String(earnings.length), color: '#7a5c00' },
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
            No completed commitments yet. Complete a commitment to see your earnings here.
          </p>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr auto auto auto', gap: '0', background: '#f5f5f5', borderBottom: '1px solid #d4d4d4', padding: '10px 20px' }}>
            {['Commitment', 'Pledged', 'Contributed', 'Net kept'].map((h) => (
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
                gridTemplateColumns: '2fr auto auto auto',
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
                  Completed {formatDate(e.completed_at)}
                </p>
              </div>

              <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#1a3a6b', margin: 0, paddingRight: '24px', whiteSpace: 'nowrap' }}>
                ${e.total_pledged.toFixed(2)}
              </p>

              <div style={{ paddingRight: '24px' }}>
                {e.contribution_amount !== null ? (
                  <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#2d6a6a', margin: 0, whiteSpace: 'nowrap' }}>
                    ${e.contribution_amount.toFixed(2)}
                  </p>
                ) : (
                  <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#b8b8b8', margin: 0 }}>
                    No contribution
                  </p>
                )}
              </div>

              <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#1a3a6b', margin: 0, whiteSpace: 'nowrap' }}>
                ${e.net_kept.toFixed(2)}
              </p>
            </div>
          ))}

          {/* Total row */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr auto auto auto', gap: '0', padding: '12px 20px', background: '#f5f5f5', borderTop: '2px solid #d4d4d4', alignItems: 'center' }}>
            <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700, color: '#5a5a5a' }}>
              Total
            </span>
            <span style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#1a3a6b', paddingRight: '24px' }}>
              ${grandTotalPledged.toFixed(2)}
            </span>
            <span style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#2d6a6a', paddingRight: '24px' }}>
              {grandTotalContributed > 0 ? `$${grandTotalContributed.toFixed(2)}` : '—'}
            </span>
            <span style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#1a3a6b' }}>
              ${grandTotalKept.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#b8b8b8', marginTop: '20px', lineHeight: '1.5' }}>
        Payment collection coming soon. All amounts are recorded pledges. Contributions are voluntary amounts given back to the mentor community.
      </p>
    </div>
  )
}
