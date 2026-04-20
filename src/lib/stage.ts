import { createClient, createServiceClient } from '@/lib/supabase/server'

// v4 Decision #8 retires the 14-day launch period and the "start ritual"
// concept. A commitment's streak begins immediately at declaration. The
// stage resolver simplifies to three states:
//   - step 1: no practice yet (→ /start)
//   - step 2: practice, no active commitment (→ /commit)
//   - step 3: active commitment (→ /room/[id])
//
// Retired: step 4 (sponsor-step-seen gate), step 5 (companion intro), step 6
// (active streak separately from launch). The sponsor-invite surface now
// lives inside the room itself per Decision #8, so the resolver no longer
// needs to gate onboarding on sponsor invitation.
export type Stage =
  | { step: 1 }
  | { step: 2 }
  | { step: 3; commitmentId: string; roomId: string }

// getUser() reads the session cookie via the SSR client. Data reads run
// through the service client — see commit 0710ce4 for the full root-cause
// writeup. Every read below is filtered by user.id (which we've verified
// from getUser()), so ownership is enforced at the application layer —
// going through the service client is safe.
export async function resolveStage(): Promise<Stage> {
  const ssr = await createClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) return { step: 1 }

  const supabase = createServiceClient()

  const { data: practices } = await supabase
    .from('practices').select('id').eq('user_id', user.id).limit(1)
  if (!practices?.length) return { step: 1 }

  const { data: commitments } = await supabase
    .from('commitments')
    .select('id, status, room_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)

  if (!commitments?.length) return { step: 2 }

  return { step: 3, commitmentId: commitments[0].id, roomId: commitments[0].room_id }
}
