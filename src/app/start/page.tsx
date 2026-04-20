import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { resolveStage } from '@/lib/stage'

// Force dynamic on every visit. /start is a stage router: its output (which
// sub-page to redirect the user to) depends entirely on live database state
// — whether a practice exists, whether a commitment exists, what status it
// has, whether sponsors have been invited, whether the Companion intro has
// been seen. Any caching, server- or client-side, produces the stage-2 loop
// we hit in production: user creates a commitment, router.push('/start')
// serves a cached "no commitment yet" decision, user lands back on stage 2
// with blank fields. Opting out of caching is the cheap structural fix.
export const dynamic = 'force-dynamic'

export default async function StartPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const stage = await resolveStage()

  // v4 Decision #8 simplification: three stages → three destinations.
  // Step 3 takes the practitioner directly into their room, where the
  // sponsor-invite surface now lives.
  if (stage.step === 1) redirect('/start/practice')
  if (stage.step === 2) redirect('/start/commitment')
  if (stage.step === 3) redirect(`/room/${stage.roomId}`)

  redirect('/dashboard')
}
