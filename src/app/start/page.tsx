import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { resolveStage } from '@/lib/stage'

export default async function StartPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const stage = await resolveStage()

  if (stage.step === 1) redirect('/start/practice')
  if (stage.step === 2) redirect('/start/commitment')
  // Step 3 (sponsor invitation) and step 4 (Companion intro) don't have dedicated routes yet in v4.
  // Phase 2 builds the sponsor invitation page; Phase 3 builds the Companion intro. Until then,
  // send users to the launch page where they can share their pledge link to invite sponsors.
  if (stage.step === 3) redirect(`/start/launch/${stage.commitmentId}`)
  if (stage.step === 4) redirect(`/start/launch/${stage.commitmentId}`)
  if (stage.step === 5) redirect(`/start/launch/${stage.commitmentId}`)
  if (stage.step === 6) redirect(`/start/active/${stage.commitmentId}`)

  redirect('/dashboard')
}
