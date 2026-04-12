import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, trust_stage')
    .eq('user_id', user.id)
    .single()

  const name = profile?.display_name || 'Practitioner'

  return (
    <div style={{ maxWidth: '720px' }}>
      <p
        style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#767676', textTransform: 'uppercase', fontWeight: 700, marginBottom: '12px' }}
      >
        Dashboard
      </p>
      <h1
        style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '32px', fontWeight: 700, marginBottom: '8px' }}
      >
        Welcome, {name}.
      </h1>
      <p style={{ color: '#5a5a5a', fontSize: '17px', marginBottom: '40px' }}>
        Your practices will appear here as you build them.
      </p>

      <div
        style={{
          background: '#eef2f8',
          border: '1px solid #d4d4d4',
          borderLeft: '3px solid #1a3a6b',
          borderRadius: '3px',
          padding: '20px 24px',
          fontSize: '16px',
          color: '#1a1a1a',
        }}
      >
        <strong>Search Star v3.0 — Phase 0 complete.</strong> The database foundation is live.
        Onboarding, commitment mechanics, and the validator feed are coming in the next phases.
      </div>
    </div>
  )
}
