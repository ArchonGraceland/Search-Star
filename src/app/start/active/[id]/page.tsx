import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

// v4 Decision #8 retires the /start/active stage. The streak begins
// immediately at declaration — there is no separate "active" step in
// onboarding — and the session surface is the room, not /log. Anything
// still linking here is stale (old bookmark, email link, screenshot OCR);
// resolve directly to the correct surface instead of double-hopping via
// /log the way the previous stub did.
//
// Pattern mirrors src/app/start/launch/[id]/page.tsx: look up the
// commitment by the :id param (with a user.id ownership check) and
// redirect to its room. Fallback to /dashboard if nothing resolves.
export const dynamic = 'force-dynamic'

export default async function RetiredActivePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ssr = await createClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) redirect('/login')

  const db = createServiceClient()
  const { data: commitment } = await db
    .from('commitments')
    .select('room_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (commitment?.room_id) redirect(`/room/${commitment.room_id}`)
  redirect('/dashboard')
}
