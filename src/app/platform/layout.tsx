import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SignOutButton } from '@/components/sign-out-button'

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check platform role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, display_name')
    .eq('user_id', user.id)
    .single()

  if (!profile || (profile.role !== 'platform' && profile.role !== 'admin')) {
    redirect('/dashboard')
  }

  // Get platform account info
  const { data: platformAccount } = await supabase
    .from('platform_accounts')
    .select('name, credit_balance')
    .eq('user_id', user.id)
    .single()

  const displayName = platformAccount?.name || profile.display_name || user.email?.split('@')[0] || 'Platform'
  const balance = platformAccount?.credit_balance ?? 0

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex">
      {/* Platform Sidebar */}
      <aside className="w-[240px] bg-[#0f2e2b] text-white flex flex-col min-h-screen fixed">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
              <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8"/>
              <polygon points="32,6 36,24 32,20 28,24" fill="#fff"/>
              <polygon points="32,6 36,24 32,28 28,24" fill="rgba(255,255,255,0.6)"/>
              <polygon points="58,32 40,28 44,32 40,36" fill="#fff" opacity="0.6"/>
              <polygon points="32,58 28,40 32,44 36,40" fill="#fff" opacity="0.6"/>
              <polygon points="6,32 24,36 20,32 24,28" fill="#fff" opacity="0.6"/>
              <circle cx="32" cy="32" r="3" fill="#fff"/>
            </svg>
            <span className="font-body text-[11px] font-bold tracking-[0.15em] uppercase text-white/70">
              Search Star
            </span>
          </div>
          <div className="mt-2 inline-block bg-[#0d9488] text-white font-body text-[9px] font-bold tracking-[0.15em] uppercase px-2 py-0.5 rounded-[2px]">
            Platform
          </div>
        </div>

        {/* Balance */}
        <div className="px-6 py-3 border-b border-white/10">
          <div className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-white/40 mb-1">Credit Balance</div>
          <div className="font-mono text-lg font-medium text-[#5eead4]">${Number(balance).toFixed(2)}</div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4">
          <div className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-white/30 px-3 mb-2">
            Platform
          </div>
          <PlatformNavLink href="/platform" label="Dashboard" icon="📊" />
          <PlatformNavLink href="/platform/directory" label="Directory" icon="🔍" />
          <PlatformNavLink href="/platform/messages" label="Messages" icon="✉️" />
          <PlatformNavLink href="/platform/analytics" label="Analytics" icon="📈" />
          <PlatformNavLink href="/platform/sponsorships" label="Sponsorships" icon="🌱" />

          {profile.role === 'admin' && (
            <>
              <div className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-white/30 px-3 mb-2 mt-6">
                Admin
              </div>
              <PlatformNavLink href="/admin" label="Admin Panel" icon="🛡️" />
              <PlatformNavLink href="/dashboard" label="User Dashboard" icon="👤" />
            </>
          )}
        </nav>

        {/* User */}
        <div className="px-6 py-4 border-t border-white/10">
          <div className="font-body text-xs text-white/50 mb-1">Signed in as</div>
          <div className="font-body text-sm font-medium text-white/90 truncate mb-3">{displayName}</div>
          <SignOutButton />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-[240px]">
        {children}
      </main>
    </div>
  )
}

function PlatformNavLink({ href, label, icon, badge }: { href: string; label: string; icon: string; badge?: number }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-[3px] text-white/70 no-underline font-body text-sm transition-all hover:bg-white/10 hover:text-white mb-0.5"
    >
      <span className="text-base">{icon}</span>
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="bg-[#0d9488] text-white font-body text-[10px] font-bold min-w-[20px] h-5 flex items-center justify-center rounded-full px-1.5">
          {badge}
        </span>
      )}
    </Link>
  )
}
