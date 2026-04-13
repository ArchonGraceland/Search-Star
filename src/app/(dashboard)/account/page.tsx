import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SignOutButton } from '@/components/sign-out-button'
import { AccountForm } from './account-form'

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, location, bio, trust_stage, visibility')
    .eq('user_id', user.id)
    .single()

  return (
    <div style={{ maxWidth: '560px' }}>
      <p style={{
        fontFamily: 'Roboto, sans-serif',
        fontSize: '11px',
        letterSpacing: '0.2em',
        color: '#767676',
        textTransform: 'uppercase',
        fontWeight: 700,
        marginBottom: '12px',
      }}>
        Account
      </p>
      <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '32px', fontWeight: 700, marginBottom: '32px' }}>
        Your Account
      </h1>

      <AccountForm
        displayName={profile?.display_name ?? ''}
        location={profile?.location ?? ''}
        bio={profile?.bio ?? ''}
        visibility={profile?.visibility ?? 'private'}
        trustStage={profile?.trust_stage ?? 'seedling'}
      />

      {/* Danger zone */}
      <div style={{
        background: '#fff',
        border: '1px solid #d4d4d4',
        borderRadius: '3px',
        padding: '28px',
      }}>
        <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '22px', fontWeight: 700, marginBottom: '16px' }}>
          Session
        </h2>
        <SignOutButton />
      </div>
    </div>
  )
}
