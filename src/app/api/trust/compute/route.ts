import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// v4 Phase 1 — minimum-viable trust compute.
//
// v3 computed Depth from post_confirmations (table dropped) and included
// active_validators and mentees_formed (columns dropped). Phase 6 rebuilds
// Depth from completed sponsored streaks weighted by sponsor count / diversity
// / reliability. Until then this endpoint computes what is still computable
// (breadth, durability, completed_streaks) and leaves depth at zero.
//
// Single-user-is-the-founder situation makes it fine for trust_records to
// read low or stale for a few phases; the row is disposable per decisions #6.

function assignStage(depth: number): string {
  if (depth < 10) return 'seedling'
  if (depth < 30) return 'rooting'
  if (depth < 75) return 'growing'
  if (depth < 150) return 'established'
  return 'mature'
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = user.id

  // Depth: deferred to Phase 6 (was driven by post_confirmations).
  const depth_score = 0

  // Breadth: distinct skill_categories across active/completed practices.
  const { data: commitmentRows } = await supabase
    .from('commitments')
    .select('practice_id')
    .eq('user_id', userId)
    .in('status', ['active', 'completed'])

  let breadth_score = 0
  if (commitmentRows && commitmentRows.length > 0) {
    const practiceIds = [...new Set(commitmentRows.map((r: { practice_id: string }) => r.practice_id).filter(Boolean))]
    if (practiceIds.length > 0) {
      const { data: practices } = await supabase
        .from('practices')
        .select('category_id')
        .in('id', practiceIds)
      if (practices) {
        const distinctCategories = new Set(practices.map((p: { category_id: string }) => p.category_id).filter(Boolean))
        breadth_score = distinctCategories.size
      }
    }
  }

  // Durability: completed streak days + partial credit for active.
  const { data: allCommitments } = await supabase
    .from('commitments')
    .select('status, streak_starts_at, completed_at, sessions_logged')
    .eq('user_id', userId)

  let durability = 0
  let completed_streaks = 0

  if (allCommitments) {
    for (const c of allCommitments) {
      if (c.status === 'completed') {
        completed_streaks++
        if (c.streak_starts_at && c.completed_at) {
          const days = (new Date(c.completed_at).getTime() - new Date(c.streak_starts_at).getTime()) / (1000 * 60 * 60 * 24)
          durability += Math.max(0, days)
        }
      } else if (c.status === 'active') {
        durability += Math.min(90, c.sessions_logged ?? 0)
      }
    }
  }
  const durability_score = Math.round(durability * 10) / 10

  const stage = assignStage(depth_score)

  const { error: upsertError } = await supabase
    .from('trust_records')
    .upsert({
      user_id: userId,
      stage,
      depth_score,
      breadth_score,
      durability_score,
      completed_streaks,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  // Keep profiles.trust_stage in sync
  await supabase
    .from('profiles')
    .update({ trust_stage: stage })
    .eq('user_id', userId)

  return NextResponse.json({
    stage,
    depth_score,
    breadth_score,
    durability_score,
    completed_streaks,
  })
}
