import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminApi } from '@/lib/auth'

// Admin user-management route.
//
// Pass 3d (Cluster 3, F34/F38): the inline `user_metadata.role` check
// and the inline anon-client writes are replaced with `requireAdminApi`
// (canonical service-client role read) plus service-client writes. The
// previous shape silently no-op'd because `profiles` RLS is owner-only
// and the SSR anon client's auth.uid() never matched the target row.

const VALID_STAGES = ['seedling', 'rooting', 'growing', 'established', 'mature']

// PATCH — update trust_stage (mentor_role was retired in v4; profiles.mentor_role column is dormant)
export async function PATCH(request: NextRequest) {
  try {
    const guard = await requireAdminApi()
    if (guard instanceof NextResponse) return guard

    const body = await request.json()
    const { user_id, trust_stage } = body

    if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

    const updates: Record<string, unknown> = {}

    if (trust_stage !== undefined) {
      if (!VALID_STAGES.includes(trust_stage)) {
        return NextResponse.json({ error: 'Invalid trust_stage' }, { status: 400 })
      }
      updates.trust_stage = trust_stage
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const db = createServiceClient()

    const { error: updateError } = await db
      .from('profiles')
      .update(updates)
      .eq('user_id', user_id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    // Mirror trust_stage to trust_records if updated
    if (updates.trust_stage) {
      await db
        .from('trust_records')
        .update({ stage: updates.trust_stage, updated_at: new Date().toISOString() })
        .eq('user_id', user_id)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Admin user update error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
