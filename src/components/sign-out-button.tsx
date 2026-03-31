'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function SignOutButton() {
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <button
      onClick={handleSignOut}
      className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-white/40 hover:text-white/80 transition-colors cursor-pointer bg-transparent border-none p-0"
    >
      Sign Out
    </button>
  )
}
