import { createClient } from '@/lib/supabase/server'

export type Stage =
  | { step: 1 }                          // no practice
  | { step: 2 }                          // practice, no commitment
  | { step: 3; commitmentId: string }    // commitment exists, sponsor step not yet satisfied
  | { step: 4; commitmentId: string }    // sponsor step satisfied, Companion intro unseen
  | { step: 5; commitmentId: string }    // launch window (Companion intro seen)
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

  // Completed or abandoned — back to step 2 for a new commitment
  if (c.status === 'completed' || c.status === 'abandoned') return { step: 2 }

  // Commitment is in 'launch' status. Step 3 is satisfied by ANY of:
  //   - a sponsor_invitation sent by this user (the invite flow), OR
  //   - a sponsorship on this commitment (the direct-pledge-link flow), OR
  //   - profiles.sponsor_step_seen = true (user clicked "I'll invite later").
  // All three are honest paths through the sponsor step.
  const [{ data: invites }, { data: sponsors }, { data: profile }] = await Promise.all([
    supabase
      .from('sponsor_invitations')
      .select('id')
      .eq('inviter_user_id', user.id)
      .limit(1),
    supabase
      .from('sponsorships')
      .select('id')
      .eq('commitment_id', c.id)
      .limit(1),
    supabase
      .from('profiles')
      .select('sponsor_step_seen, companion_step_seen')
      .eq('user_id', user.id)
      .single(),
  ])

  const sponsorStepSatisfied =
    (invites?.length ?? 0) > 0 ||
    (sponsors?.length ?? 0) > 0 ||
    profile?.sponsor_step_seen === true

  if (!sponsorStepSatisfied) return { step: 3, commitmentId: c.id }

  // Step 4: Companion intro must be seen. No auto-skip — the page is live now.
  if (!profile?.companion_step_seen) return { step: 4, commitmentId: c.id }

  // Step 5: launch window, both onboarding steps complete.
  return { step: 5, commitmentId: c.id }
}
