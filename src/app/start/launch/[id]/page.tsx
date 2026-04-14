import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import StageShell from '@/components/stage-shell'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function daysUntil(d: string) {
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
  return Math.max(0, diff)
}

export default async function StageLaunch({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: commitment } = await supabase
    .from('commitments')
    .select('id, title, description, frequency, status, launch_ends_at, streak_starts_at, streak_ends_at')
    .eq('id', id).eq('user_id', user.id).single()

  if (!commitment) redirect('/start')

  const { data: validators } = await supabase
    .from('validators').select('id, status, validator_email').eq('commitment_id', id)

  const { data: sponsorships } = await supabase
    .from('sponsorships').select('id, sponsor_name, pledge_amount').eq('commitment_id', id).eq('status', 'pledged')

  const totalPledged = (sponsorships ?? []).reduce((s, p) => s + Number(p.pledge_amount), 0)
  const activeValidators = (validators ?? []).filter(v => v.status === 'active').length
  const daysLeft = daysUntil(commitment.streak_starts_at)
  const shareUrl = `https://searchstar.com/sponsor/${id}`

  const labelStyle = {
    fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700,
    letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#767676', marginBottom: '4px',
  }
  const valueStyle = {
    fontFamily: '"Crimson Text", Georgia, serif', fontSize: '32px', fontWeight: 700, color: '#1a3a6b',
  }

  return (
    <StageShell stage={5}>
      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#767676', marginBottom: '12px' }}>
        Stage 5 of 7
      </p>
      <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '38px', fontWeight: 700, color: '#1a1a1a', lineHeight: 1.1, marginBottom: '10px' }}>
        Your launch window is open.
      </h1>
      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '15px', color: '#5a5a5a', lineHeight: 1.65, marginBottom: '32px' }}>
        Share your commitment. Sponsors pledge now and pay only when you complete 90 days. Your streak begins on {formatDate(commitment.streak_starts_at)}.
      </p>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '28px' }}>
        <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '18px 16px' }}>
          <p style={labelStyle}>Days until start</p>
          <p style={valueStyle}>{daysLeft}</p>
        </div>
        <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '18px 16px' }}>
          <p style={labelStyle}>Validators</p>
          <p style={valueStyle}>{activeValidators}</p>
        </div>
        <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '18px 16px' }}>
          <p style={labelStyle}>Pledged</p>
          <p style={valueStyle}>${totalPledged > 0 ? totalPledged.toLocaleString() : '0'}</p>
        </div>
      </div>

      {/* Share link */}
      <div style={{ background: '#eef2f8', border: '1px solid #c8d4e8', borderRadius: '3px', padding: '20px 24px', marginBottom: '28px' }}>
        <p style={{ ...labelStyle, color: '#1a3a6b', marginBottom: '8px' }}>Your sponsor link</p>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#3a3a3a', marginBottom: '12px', lineHeight: 1.6 }}>
          Send this to anyone who might back you. They can pledge without creating an account.
        </p>
        <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '10px 14px', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px', color: '#1a1a1a', wordBreak: 'break-all' }}>
          {shareUrl}
        </div>
      </div>

      {/* Validators */}
      {(validators ?? []).length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '20px 24px', marginBottom: '28px' }}>
          <p style={{ ...labelStyle, marginBottom: '12px' }}>Validators</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(validators ?? []).map(v => (
              <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#1a1a1a' }}>{v.validator_email}</span>
                <span style={{
                  fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700,
                  padding: '3px 8px', borderRadius: '2px',
                  background: v.status === 'active' ? '#edf7ed' : '#f5f5f5',
                  color: v.status === 'active' ? '#2d6a2d' : '#767676',
                }}>
                  {v.status === 'active' ? 'Confirmed' : 'Invited'}
                </span>
              </div>
            ))}
          </div>
          <Link href={`/start/validator/${id}`} style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#1a3a6b', textDecoration: 'none', display: 'inline-block', marginTop: '14px', borderBottom: '1px solid #1a3a6b' }}>
            + Invite another validator
          </Link>
        </div>
      )}

      {/* Sponsors */}
      {(sponsorships ?? []).length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '20px 24px', marginBottom: '28px' }}>
          <p style={{ ...labelStyle, marginBottom: '12px' }}>Sponsors</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(sponsorships ?? []).map(s => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#1a1a1a' }}>{s.sponsor_name}</span>
                <span style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#1a3a6b' }}>${Number(s.pledge_amount).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Begin button */}
      <div style={{ background: '#1a3a6b', borderRadius: '3px', padding: '24px', textAlign: 'center' }}>
        <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '20px', color: 'rgba(255,255,255,0.85)', marginBottom: '16px', lineHeight: 1.4 }}>
          Ready to begin your 90 days?
        </p>
        <Link
          href={`/start/ritual/${id}`}
          style={{
            display: 'inline-block', padding: '13px 32px', background: '#ffffff',
            color: '#1a3a6b', fontFamily: 'Roboto, sans-serif', fontSize: '13px',
            fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            borderRadius: '3px', textDecoration: 'none',
          }}
        >
          Perform the start ritual →
        </Link>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginTop: '10px' }}>
          This starts your 90-day streak clock.
        </p>
      </div>
    </StageShell>
  )
}
