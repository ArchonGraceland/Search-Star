import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, trust_stage')
    .eq('user_id', user.id)
    .single()

  const { data: practices } = await supabase
    .from('practices')
    .select('id, name, label, skill_categories(name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)

  const name = profile?.display_name || 'Practitioner'
  const practice = practices?.[0] ?? null

  // Edge case: no practice defined (shouldn't happen after Phase 2 onboarding, but handle gracefully)
  if (!practice) {
    return (
      <div style={{ maxWidth: '720px' }}>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#767676', textTransform: 'uppercase', fontWeight: 700, marginBottom: '12px' }}>
          Dashboard
        </p>
        <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '32px', fontWeight: 700, marginBottom: '8px' }}>
          Welcome, {name}.
        </h1>
        <p style={{ color: '#5a5a5a', fontSize: '17px', marginBottom: '32px' }}>
          You haven't named a practice yet.
        </p>
        <Link
          href="/onboarding/practice"
          style={{
            display: 'inline-block',
            background: '#1a3a6b',
            color: '#fff',
            fontFamily: 'Roboto, sans-serif',
            fontSize: '13px',
            fontWeight: 600,
            padding: '10px 20px',
            borderRadius: '3px',
            textDecoration: 'none',
            letterSpacing: '0.02em',
          }}
        >
          Name your practice →
        </Link>
      </div>
    )
  }

  const cat = practice.skill_categories
  const categoryName = (Array.isArray(cat) ? (cat[0] as { name: string } | undefined)?.name : (cat as { name: string } | null)?.name) ?? '—'
  const labelCap = practice.label.charAt(0).toUpperCase() + practice.label.slice(1)

  return (
    <div style={{ maxWidth: '720px' }}>
      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#767676', textTransform: 'uppercase', fontWeight: 700, marginBottom: '12px' }}>
        Dashboard
      </p>
      <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '32px', fontWeight: 700, marginBottom: '32px' }}>
        Welcome, {name}.
      </h1>

      {/* Practice card */}
      <div style={{
        background: '#fff',
        border: '1px solid #d4d4d4',
        borderLeft: '3px solid #1a3a6b',
        borderRadius: '3px',
        padding: '24px 28px',
        marginBottom: '24px',
      }}>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', marginBottom: '8px' }}>
          Your Practice
        </p>
        <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '24px', fontWeight: 700, color: '#1a1a1a', marginBottom: '8px' }}>
          {practice.name}
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <span style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#1a3a6b',
            background: '#eef2f8',
            borderRadius: '2px',
            padding: '3px 8px',
          }}>
            {labelCap}
          </span>
          <span style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#5a5a5a',
            background: '#f0f0f0',
            borderRadius: '2px',
            padding: '3px 8px',
          }}>
            {categoryName}
          </span>
        </div>
      </div>

      {/* Commitments — placeholder */}
      <div style={{
        background: '#fff',
        border: '1px solid #d4d4d4',
        borderRadius: '3px',
        padding: '24px 28px',
      }}>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', marginBottom: '8px' }}>
          Your Commitments
        </p>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#767676', marginBottom: '12px' }}>
          No commitments yet.
        </p>
        <span style={{
          display: 'inline-block',
          fontFamily: 'Roboto, sans-serif',
          fontSize: '13px',
          fontWeight: 600,
          color: '#b8b8b8',
          padding: '8px 16px',
          border: '1px solid #d4d4d4',
          borderRadius: '3px',
          cursor: 'not-allowed',
        }}>
          Declare your first 90-day commitment
        </span>
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', color: '#b8b8b8', marginTop: '8px' }}>
          Coming in Phase 3
        </p>
      </div>
    </div>
  )
}
