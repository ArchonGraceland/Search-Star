import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StageShell from '@/components/stage-shell'
import CompanionContinueButton from './companion-continue-button'

export default async function StageCompanion() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Look up the user's active launch commitment so we can hand its id
  // to the continue button and navigate directly to /start/launch/{id}
  // after the companion step is acknowledged. Going direct bypasses the
  // stage resolver and the Router Cache, both of which have caused users
  // to bounce back to earlier stages in production.
  const { data: commitment } = await supabase
    .from('commitments')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'launch')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!commitment) redirect('/start')

  return (
    <StageShell stage={4}>
      <p style={{
        fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700,
        letterSpacing: '0.18em', textTransform: 'uppercase', color: '#767676',
        marginBottom: '12px',
      }}>
        Stage 4 of 6
      </p>
      <h1 style={{
        fontFamily: '"Crimson Text", Georgia, serif', fontSize: '38px', fontWeight: 700,
        color: '#1a1a1a', lineHeight: 1.15, marginBottom: '14px',
      }}>
        Meet your Companion.
      </h1>
      <p style={{
        fontFamily: 'Roboto, sans-serif', fontSize: '15px', color: '#5a5a5a',
        lineHeight: 1.65, marginBottom: '28px',
      }}>
        Search Star gives every practitioner an AI Companion — a daily presence that accompanies you through the work. Not a coach, not a judge. Something closer to a good study partner who happens to be paying attention.
      </p>

      {/* What it does */}
      <div style={{
        background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px',
        padding: '22px 26px', marginBottom: '20px',
      }}>
        <p style={{
          fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700,
          letterSpacing: '0.12em', textTransform: 'uppercase', color: '#767676',
          margin: '0 0 14px',
        }}>
          What the Companion does
        </p>
        <p style={{
          fontFamily: '"Crimson Text", Georgia, serif', fontSize: '17px', color: '#1a1a1a',
          lineHeight: 1.6, margin: '0 0 12px',
        }}>
          It asks the questions a good teacher would ask. It notices patterns across your sessions. It helps you write up what happened when you want help, and stays out of the way when you don’t.
        </p>
        <p style={{
          fontFamily: '"Crimson Text", Georgia, serif', fontSize: '17px', color: '#1a1a1a',
          lineHeight: 1.6, margin: 0,
        }}>
          At day 90, it writes a summary of the work for your sponsors — a reading aid for their release decision. That summary is the end of its role, not the start.
        </p>
      </div>

      {/* What it does NOT do — the no-authority principle */}
      <div style={{
        background: '#eef2f8', borderLeft: '3px solid #1a3a6b', borderRadius: '3px',
        padding: '18px 22px', marginBottom: '28px',
      }}>
        <p style={{
          fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700,
          letterSpacing: '0.14em', textTransform: 'uppercase', color: '#1a3a6b',
          margin: '0 0 10px',
        }}>
          What the Companion does not do
        </p>
        <p style={{
          fontFamily: '"Crimson Text", Georgia, serif', fontSize: '17px',
          color: '#1a1a1a', lineHeight: 1.55, margin: '0 0 8px', fontWeight: 600,
        }}>
          It has no authority over your Trust Record.
        </p>
        <p style={{
          fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#3a3a3a',
          lineHeight: 1.65, margin: 0,
        }}>
          It does not confirm your sessions. It does not mark your streak complete. It cannot advance a Trust Stage. Every consequential attestation flows through your sponsors — the humans who put money behind your word. The Companion is the teacher. The sponsors are the witnesses.
        </p>
      </div>

      <CompanionContinueButton commitmentId={commitment.id} />
    </StageShell>
  )
}
