import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { computeAndPersistTrust } from '@/lib/trust-compute'

// POST /api/trust/compute — recompute and persist the caller's Trust Record.
//
// v4 Phase 6: Depth/Breadth/Durability come from completed sponsored streaks
// weighted by sponsor count, diversity, and reliability. See
// src/lib/trust-compute.ts for the full algorithm and v1 calibration notes.
//
// Intentionally scoped to the caller; there is no admin variant here. If we
// need to recompute on someone else's behalf (e.g. from the release-action
// route), we call computeAndPersistTrust directly with the service client.
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await computeAndPersistTrust(supabase, user.id)
    return NextResponse.json({
      stage: result.stage,
      depth_score: result.depth_score,
      breadth_score: result.breadth_score,
      durability_score: result.durability_score,
      completed_streaks: result.completed_streaks,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Trust compute failed'
    console.error('[trust/compute] failed for user', user.id, ':', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
