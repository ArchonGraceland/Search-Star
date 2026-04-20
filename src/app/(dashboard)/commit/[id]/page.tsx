import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

// v4 Decision #8 retires the per-commitment /commit/[id] surface. The room
// is the primary surface; commitments happen inside rooms. Anyone landing
// here via an old link gets redirected to the correct room. This file is
// intentionally thin — it exists only for URL backward-compat.
export const dynamic = 'force-dynamic'

export default async function RetiredCommitPage({
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
    .single()

  if (!commitment) redirect('/dashboard')
  redirect(`/room/${commitment.room_id}`)
}
