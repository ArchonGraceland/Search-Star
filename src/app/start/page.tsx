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
  if (stage.step === 3) redirect('/start/validator')
  if (stage.step === 4) redirect(`/start/launch/${stage.commitmentId}`)
  if (stage.step === 5) redirect(`/start/ritual/${stage.commitmentId}`)
  if (stage.step === 6) redirect(`/start/active/${stage.commitmentId}`)

  redirect('/dashboard')
}
