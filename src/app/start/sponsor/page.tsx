import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StageShell from '@/components/stage-shell'
import SponsorStepForm from './sponsor-step-form'

export default async function StageSponsor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Use the service client (filtered by user.id) instead of the RLS-authenticated
  // client. We were seeing production bounces where a commitment had just been
  // inserted via /api/commitments (service client) and then this page's RLS
  // read returned null a second later — some kind of auth-context propagation
  // race. Filtering by user.id on the service client gives us the same
  // privacy guarantee (the user can only ever see their own rows because
  // that's all we query for) without the timing issue.
  const service = createServiceClient()
  const { data: commitment } = await service
    .from('commitments')
    .select('id, title')
    .eq('user_id', user.id)
    .eq('status', 'launch')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!commitment) redirect('/start')

  return (
    <StageShell stage={3}>
      <p style={{
        fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700,
        letterSpacing: '0.18em', textTransform: 'uppercase', color: '#767676',
        marginBottom: '12px',
      }}>
        Stage 3 of 6
      </p>
      <h1 style={{
        fontFamily: '"Crimson Text", Georgia, serif', fontSize: '38px', fontWeight: 700,
        color: '#1a1a1a', lineHeight: 1.15, marginBottom: '14px',
      }}>
        Invite the people who will witness your 90 days.
      </h1>
      <p style={{
        fontFamily: 'Roboto, sans-serif', fontSize: '15px', color: '#5a5a5a',
        lineHeight: 1.65, marginBottom: '28px',
      }}>
        On Search Star, a sponsor is a witness. They pledge now, watch the practice unfold on a private feed, and release payment at day 90. That release is the attestation: the only people with standing to say the 90 days were real are the people who put money behind them.
      </p>

      {/* No-escape-hatch principle — prominent and unambiguous */}
      <div style={{
        background: '#fffbeb', border: '1px solid #f4d58d', borderLeft: '3px solid #92400e',
        borderRadius: '3px', padding: '18px 22px', marginBottom: '28px',
      }}>
        <p style={{
          fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700,
          letterSpacing: '0.14em', textTransform: 'uppercase', color: '#92400e',
          margin: '0 0 10px',
        }}>
          Read this before you invite
        </p>
        <p style={{
          fontFamily: '"Crimson Text", Georgia, serif', fontSize: '19px',
          color: '#1a1a1a', lineHeight: 1.5, margin: '0 0 10px', fontWeight: 600,
        }}>
          Any single sponsor veto ends the streak. For everyone.
        </p>
        <p style={{
          fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#3a3a3a',
          lineHeight: 1.65, margin: 0,
        }}>
          If a sponsor withdraws, goes silent, or vetoes at any point in the 90 days, the streak ends and you restart from the launch period with a new roster. There is no replacement mechanic. There is no appeal. Choose people who will actually stay present — keeping their belief across 90 days is part of the practice.
        </p>
      </div>

      {/* Commitment context */}
      <div style={{
        background: '#eef2f8', borderLeft: '3px solid #1a3a6b', borderRadius: '3px',
        padding: '14px 18px', marginBottom: '24px',
      }}>
        <p style={{
          fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1a3a6b',
          margin: '0 0 4px',
        }}>
          Inviting for
        </p>
        <p style={{
          fontFamily: '"Crimson Text", Georgia, serif', fontSize: '18px',
          fontWeight: 700, color: '#1a1a1a', margin: 0,
        }}>
          {commitment.title}
        </p>
      </div>

      <SponsorStepForm commitmentId={commitment.id} />

      <p style={{
        fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#b8b8b8',
        textAlign: 'center', marginTop: '32px', lineHeight: 1.65,
      }}>
        You can invite more sponsors any time during the launch window or the active streak.
      </p>
    </StageShell>
  )
}
