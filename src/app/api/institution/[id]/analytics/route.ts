import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify caller is the institution contact or admin
  const { data: institution } = await supabase
    .from('institutions')
    .select('id, contact_email, budget_total, budget_spent')
    .eq('id', id)
    .single()

  if (!institution) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  const { data: authUser } = await supabase.auth.getUser()
  const callerEmail = authUser.user?.email ?? ''
  const isAdmin = authUser.user?.user_metadata?.role === 'admin'

  if (institution.contact_email !== callerEmail && !isAdmin) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })
  }

  // Member count
  const { count: member_count } = await supabase
    .from('institution_memberships')
    .select('*', { count: 'exact', head: true })
    .eq('institution_id', id)

  // Stage distribution
  const { data: members } = await supabase
    .from('institution_memberships')
    .select('user_id')
    .eq('institution_id', id)

  const memberIds = (members ?? []).map((m) => m.user_id)

  const stageDist: Record<string, number> = {
    seedling: 0,
    rooting: 0,
    growing: 0,
    established: 0,
    mature: 0,
  }

  if (memberIds.length > 0) {
    const { data: trustRows } = await supabase
      .from('trust_records')
      .select('stage')
      .in('user_id', memberIds)

    for (const row of trustRows ?? []) {
      if (row.stage in stageDist) {
        stageDist[row.stage]++
      }
    }
  }

  return NextResponse.json({
    member_count: member_count ?? 0,
    budget_total: institution.budget_total,
    budget_spent: institution.budget_spent,
    stage_distribution: stageDist,
  })
}
