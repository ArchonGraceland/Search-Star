import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PracticeClient } from './practice-client'
import { ValidationQueue } from './validation-queue'

export default async function PracticePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/practice')

  return (
    <div className="p-8 max-w-[860px]">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-heading text-[32px] font-bold mb-1">Practice</h1>
          <p className="font-body text-sm text-[#767676]">Your commitments, fundraises, and validation queue.</p>
        </div>
        <Link
          href="/commitment"
          className="font-body text-[11px] font-bold tracking-[0.1em] uppercase px-5 py-2.5 bg-[#1a3a6b] text-white rounded-[3px] no-underline hover:bg-[#112a4f] transition-colors"
        >
          + new commitment
        </Link>
      </div>

      <div className="space-y-10">
        <section>
          <PracticeClient />
        </section>

        <section>
          <h2 className="font-heading text-xl font-bold mb-1">Validate others</h2>
          <p className="font-body text-sm text-[#767676] mb-4">
            People you support who have posted milestone evidence. Three confirmations release their payments.
          </p>
          <ValidationQueue />
        </section>
      </div>
    </div>
  )
}
