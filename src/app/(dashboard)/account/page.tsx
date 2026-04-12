import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SignOutButton } from '@/components/sign-out-button'

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, location, bio, trust_stage')
    .eq('user_id', user.id)
    .single()

  return (
    <div style={{ maxWidth: '560px' }}>
      <p
        style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#767676', textTransform: 'uppercase', fontWeight: 700, marginBottom: '12px' }}
      >
        Account
      </p>
      <h1
        style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '32px', fontWeight: 700, marginBottom: '32px' }}
      >
        Your Account
      </h1>

      <div
        style={{
          background: '#ffffff',
          border: '1px solid #d4d4d4',
          borderRadius: '3px',
          padding: '28px',
          marginBottom: '24px',
        }}
      >
        <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>
          Profile
        </h2>
        <table style={{ width: '100%', fontSize: '15px' }}>
          <tbody>
            {[
              { label: 'Display name', value: profile?.display_name || '—' },
              { label: 'Email', value: user.email },
              { label: 'Trust stage', value: profile?.trust_stage || 'seedling' },
              { label: 'Location', value: profile?.location || '—' },
            ].map((row) => (
              <tr key={row.label} style={{ borderBottom: '1px solid #e8e8e8' }}>
                <td style={{ padding: '10px 0', color: '#767676', fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', width: '140px' }}>
                  {row.label}
                </td>
                <td style={{ padding: '10px 0' }}>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        style={{
          background: '#ffffff',
          border: '1px solid #d4d4d4',
          borderRadius: '3px',
          padding: '28px',
        }}
      >
        <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>
          Session
        </h2>
        <SignOutButton />
      </div>
    </div>
  )
}
