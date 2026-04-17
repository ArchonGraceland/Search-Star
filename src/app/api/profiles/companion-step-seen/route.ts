import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST — marks the authenticated user's companion onboarding step as seen.
// Idempotent. Called from /start/companion when the practitioner clicks Continue.
// The Companion itself does not ship until Phase 7; this flag only unblocks the
// stage resolver from step 4 → step 5.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ companion_step_seen: true })
    .eq('user_id', user.id)

  if (error) {
    console.error('Error setting companion_step_seen:', error)
    return NextResponse.json({ error: 'Failed to update profile.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
