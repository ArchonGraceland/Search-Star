import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SignOutButton } from '@/components/sign-out-button'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Check admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, mentor_role')
    .eq('user_id', user.id)
    .single()

  // Admin check via metadata
  const isAdmin = user.user_metadata?.role === 'admin'

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/commit', label: 'Commit' },
    { href: '/earnings', label: 'Earnings' },
    { href: '/account', label: 'Account' },
    { href: '/support', label: 'Support' },
    ...(isAdmin ? [{ href: '/admin', label: 'Admin' }] : []),
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f5f5' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: '220px',
          background: '#1a3a6b',
          borderRight: '3px solid #112a4f',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px 0',
          flexShrink: 0,
        }}
      >
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Link
            href="/"
            style={{
              fontFamily: '"Crimson Text", Georgia, serif',
              fontSize: '20px',
              fontWeight: 700,
              color: '#ffffff',
              textDecoration: 'none',
            }}
          >
            Search Star
          </Link>
          {profile?.display_name && (
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', marginTop: '4px', fontFamily: 'Roboto, sans-serif' }}>
              {profile.display_name}
            </p>
          )}
        </div>

        <nav style={{ flex: 1, padding: '16px 0' }}>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                display: 'block',
                padding: '10px 20px',
                fontFamily: 'Roboto, sans-serif',
                fontSize: '13px',
                fontWeight: 500,
                color: 'rgba(255,255,255,0.75)',
                textDecoration: 'none',
                letterSpacing: '0.02em',
              }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <SignOutButton />
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
