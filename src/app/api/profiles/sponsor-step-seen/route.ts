import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST — marks the authenticated user's sponsor onboarding step as seen.
// Idempotent. Called from /start/sponsor when the practitioner either invites
// a sponsor (captured separately via /api/sponsors/invite) or clicks
// "I'll invite sponsors later". The stage resolver treats this flag as one
// branch of an OR condition with the presence of sponsor_invitations or
// sponsorships — either satisfies step 3.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ sponsor_step_seen: true })
    .eq('user_id', user.id)

  if (error) {
    console.error('Error setting sponsor_step_seen:', error)
    return NextResponse.json({ error: 'Failed to update profile.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
