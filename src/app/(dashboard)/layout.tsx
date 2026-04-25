import { createClient } from '@/lib/supabase/server'
import { isCurrentUserAdmin } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SignOutButton } from '@/components/sign-out-button'
import MobileNavToggle from './mobile-nav-toggle'
import { isInstitutionalPortalEnabled } from '@/lib/feature-flags'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, institution_id')
    .eq('user_id', user.id)
    .single()

  // Pass 3d (Cluster 3, F27): admin bit via the canonical helper —
  // service-client read of profiles.role, defends against the
  // @supabase/ssr JWT-propagation bug.
  const isAdmin = await isCurrentUserAdmin()

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/start', label: 'Practice' },
    { href: '/trust', label: 'Trust' },
    { href: '/earnings', label: 'Earnings' },
    { href: '/account', label: 'Account' },
    { href: '/support', label: 'Support' },
    ...(isInstitutionalPortalEnabled() && profile?.institution_id ? [{ href: `/institution/${profile.institution_id}/dashboard`, label: 'My Institution' }] : []),
    ...(isAdmin ? [{ href: '/admin', label: 'Admin' }] : []),
  ]

  return (
    <MobileNavToggle navLinks={navLinks} displayName={profile?.display_name ?? null}>
      {children}
    </MobileNavToggle>
  )
}
