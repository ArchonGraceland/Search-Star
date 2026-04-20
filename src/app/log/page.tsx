import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

// /log is retired as a distinct surface in v4 Decision #8. The room
// (/room/[id]) is the post-login home; it contains the chat stream where
// sessions are marked by toggling is_session=true on a practitioner
// message. This page exists only to route legacy links:
//
//   - Authenticated user with an active commitment → /room/[room_id]
//   - Authenticated user with no active commitment → splash → /start
//   - Unauthenticated → /login
//
// LogClient and its embedded session-logging form are obsolete. Any direct
// call to /log will bounce through this router; no content renders here.
export default async function LogPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const db = createServiceClient()
  const { data: commitment } = await db
    .from('commitments')
    .select('id, status, room_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (commitment?.room_id) {
    redirect(`/room/${commitment.room_id}`)
  }

  // No active commitment — send to dashboard which handles the no-active
  // case with the proper CTA.
  redirect('/dashboard')
}
