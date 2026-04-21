import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

// v4 Decision #8 retires the "Meet your Companion" onboarding stage. The
// Companion is no longer introduced as a gated step between declaration
// and the streak — the streak begins immediately at declaration and the
// Companion presence lives inside the room. Anyone landing here via an
// old link or bookmark should be sent directly to their room.
//
// Pattern mirrors src/app/start/sponsor/page.tsx: look up the user's
// most recent active commitment and redirect to its room, falling back
// to /dashboard if nothing resolves.
export const dynamic = 'force-dynamic'

export default async function RetiredCompanionStep() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = createServiceClient()
  const { data: commitment } = await service
    .from('commitments')
    .select('room_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (commitment?.room_id) redirect(`/room/${commitment.room_id}`)
  redirect('/dashboard')
}
