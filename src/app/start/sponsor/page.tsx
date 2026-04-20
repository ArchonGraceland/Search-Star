import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

// v4 Decision #8 retires the /start/sponsor onboarding step. The
// sponsor-invite surface now lives inside the room itself. Anyone
// landing here via an old link is redirected to their room (or to
// /dashboard if they have no active commitment).
export const dynamic = 'force-dynamic'

export default async function RetiredSponsorStep() {
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
