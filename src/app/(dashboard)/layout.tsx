import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SignOutButton } from '@/components/sign-out-button'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const displayName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'User'

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex">
      {/* Sidebar */}
      <aside className="w-[240px] bg-[#1a3a6b] text-white flex flex-col min-h-screen fixed">
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
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4">
          <NavLink href="/dashboard" label="Dashboard" icon="📊" />
          <NavLink href="/profile-builder" label="Register Profile" icon="⚡" />
          <NavLink href="/feed" label="Feed" icon="💬" />
          <NavLink href="/account" label="Account" icon="👤" />
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

function NavLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-[3px] text-white/70 no-underline font-body text-sm transition-all hover:bg-white/10 hover:text-white mb-0.5"
    >
      <span className="text-base">{icon}</span>
      {label}
    </Link>
  )
}
