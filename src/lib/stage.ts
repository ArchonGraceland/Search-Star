import { createClient } from '@/lib/supabase/server'

export type Stage =
  | { step: 1 }                          // no practice
  | { step: 2 }                          // practice, no commitment
  | { step: 3; commitmentId: string }    // commitment, no sponsor yet
  | { step: 4; commitmentId: string }    // sponsor present, Companion intro unseen
  | { step: 5; commitmentId: string }    // launch window (Companion seen)
  | { step: 6; commitmentId: string }    // active streak

export async function resolveStage(): Promise<Stage> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { step: 1 }

  // Step 1: practice exists?
  const { data: practices } = await supabase
    .from('practices').select('id').eq('user_id', user.id).limit(1)
  if (!practices?.length) return { step: 1 }

  // Step 2: commitment exists?
  const { data: commitments } = await supabase
    .from('commitments')
    .select('id, status, streak_starts_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
  if (!commitments?.length) return { step: 2 }

  const c = commitments[0]

  // Active streak
  if (c.status === 'active') return { step: 6, commitmentId: c.id }

  // Completed or abandoned — back to step 2 for new commitment
  if (c.status === 'completed' || c.status === 'abandoned') return { step: 2 }

  // Launch status — check for at least one sponsor pledge on this commitment.
  // In Phase 1, sponsors are the only signal a "sponsor has been brought in"
  // because sponsor_invitations doesn't exist until Phase 2. After Phase 2,
  // switch this query to sponsor_invitations so pending invites also count.
  const { data: sponsors } = await supabase
    .from('sponsorships').select('id').eq('commitment_id', c.id).limit(1)
  if (!sponsors?.length) return { step: 3, commitmentId: c.id }

  // Has at least one sponsor — Companion intro step.
  // Phase 1: no Companion intro page exists yet (Phase 3 builds it). Auto-flip
  // companion_step_seen=true the first time we pass through here so users
  // don't get stuck on a dead step-4 route. When Phase 3 ships, remove the
  // auto-flip and let users land on /start/companion/[id] until they read it.
  const { data: profile } = await supabase
    .from('profiles').select('companion_step_seen').eq('user_id', user.id).single()
  if (!profile?.companion_step_seen) {
    await supabase.from('profiles').update({ companion_step_seen: true }).eq('user_id', user.id)
    return { step: 5, commitmentId: c.id }
  }

  // Launch window (post-Companion intro)
  return { step: 5, commitmentId: c.id }
}
