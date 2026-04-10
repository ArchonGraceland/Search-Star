import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: commitment } = await supabase
    .from('commitments')
    .select('id, user_id, status')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!commitment) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (commitment.status === 'ongoing') {
    return NextResponse.json({ error: 'Cannot abandon an ongoing streak' }, { status: 400 })
  }

  const { error } = await supabase
    .from('commitments')
    .update({ status: 'restart_eligible', current_streak: 0 })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ status: 'restart_eligible' })
}
