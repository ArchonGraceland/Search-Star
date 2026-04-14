import { createClient } from '@/lib/supabase/server'

export type Stage =
  | { step: 1 }                          // no practice
  | { step: 2 }                          // practice, no commitment
  | { step: 3; commitmentId: string }    // commitment exists, no validator
  | { step: 4; commitmentId: string }    // has validator (mentor placeholder)
  | { step: 5; commitmentId: string }    // launch window
  | { step: 6; commitmentId: string }    // start ritual
  | { step: 7; commitmentId: string }    // active streak

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
  if (c.status === 'active') return { step: 7, commitmentId: c.id }

  // Completed or abandoned — back to step 2 for new commitment
  if (c.status === 'completed' || c.status === 'abandoned') return { step: 2 }

  // Launch — check for validator
  const { data: validators } = await supabase
    .from('validators').select('id').eq('commitment_id', c.id).limit(1)
  if (!validators?.length) return { step: 3, commitmentId: c.id }

  // Has validator — check if start ritual done (streak_starts_at set and in past)
  if (c.streak_starts_at && new Date(c.streak_starts_at) <= new Date()) {
    return { step: 7, commitmentId: c.id }
  }

  // mentor placeholder (step 4) — show once then advance to launch
  // We use a profile flag to track if they've seen mentor step
  const { data: profile } = await supabase
    .from('profiles').select('mentor_step_seen').eq('user_id', user.id).single()
  if (!profile?.mentor_step_seen) return { step: 4, commitmentId: c.id }

  // Launch window
  return { step: 5, commitmentId: c.id }
}
