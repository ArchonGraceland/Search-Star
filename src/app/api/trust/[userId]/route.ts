import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params

  // Public endpoint — no getUser() here. Authorization is visibility-based
  // (private profiles return 404 below). Service client sidesteps the
  // @supabase/ssr JWT-propagation race documented in commits 0710ce4 /
  // 1dccc46 / 501d976 / 0f28db9.
  const db = createServiceClient()

  // Check profile visibility
  const { data: profile } = await db
    .from('profiles')
    .select('visibility, display_name')
    .eq('user_id', userId)
    .single()

  if (!profile || profile.visibility === 'private') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: trust } = await db
    .from('trust_records')
    .select('stage, depth_score, breadth_score, durability_score, completed_streaks, updated_at')
    .eq('user_id', userId)
    .single()

  if (!trust) {
    return NextResponse.json({ error: 'No trust record found' }, { status: 404 })
  }

  return NextResponse.json({
    stage: trust.stage,
    depth_score: trust.depth_score,
    breadth_score: trust.breadth_score,
    durability_score: trust.durability_score,
    completed_streaks: trust.completed_streaks,
    updated_at: trust.updated_at,
    display_name: profile.display_name,
  })
}
