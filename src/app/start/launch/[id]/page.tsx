import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

// v4 Decision #8 retires the 14-day launch window. A commitment's streak
// begins immediately at declaration — there is no preparatory period.
// Anything still linking here is stale; redirect to the correct surface
// based on whether the user has an active commitment.
export const dynamic = 'force-dynamic'

export default async function RetiredLaunchPage({
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
