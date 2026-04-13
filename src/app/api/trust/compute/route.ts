import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

  // --- depth_score ---
  // Count confirmed post_confirmations for this user's commitment_posts
  // quality_note present = 1.2 multiplier per post
  const { data: confirmations } = await supabase
    .from('post_confirmations')
    .select('quality_note, commitment_posts!inner(user_id)')
    .eq('commitment_posts.user_id', userId)

  let depth = 0
  if (confirmations && confirmations.length > 0) {
    // Group by post_id to apply per-post multiplier
    // Each confirmation row = 1 base; quality_note on ANY confirmation for that post = 1.2
    // Simplest: treat each confirmation row as 1.0 or 1.2
    for (const c of confirmations) {
      depth += c.quality_note ? 1.2 : 1.0
    }
  }
  const depth_score = Math.round(depth * 10) / 10

  // --- breadth_score ---
  // COUNT of distinct skill_categories across active/completed practices linked via commitments
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

  // --- durability_score ---
  // SUM of (completed_at - streak_starts_at) in days for completed commitments
  // + partial credit for active commitments: sessions_logged / 90 * 90 days = sessions_logged days
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
        // partial: sessions_logged / 90 * 90 = sessions_logged days
        durability += Math.min(90, c.sessions_logged ?? 0)
      }
    }
  }
  const durability_score = Math.round(durability * 10) / 10

  // --- active_validators ---
  const { data: validatorRows } = await supabase
    .from('validators')
    .select('validator_user_id, commitment_id, commitments!inner(user_id)')
    .eq('status', 'active')
    .eq('commitments.user_id', userId)

  const activeValidators = validatorRows
    ? new Set(validatorRows.map((v: { validator_user_id: string }) => v.validator_user_id).filter(Boolean)).size
    : 0

  // --- mentees_formed ---
  const { count: menteesFormed } = await supabase
    .from('mentor_relationships')
    .select('*', { count: 'exact', head: true })
    .eq('mentor_user_id', userId)
    .eq('status', 'active')

  const stage = assignStage(depth_score)

  // Upsert trust_records
  const { error: upsertError } = await supabase
    .from('trust_records')
    .upsert({
      user_id: userId,
      stage,
      depth_score,
      breadth_score,
      durability_score,
      completed_streaks,
      active_validators: activeValidators,
      mentees_formed: menteesFormed ?? 0,
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
    active_validators: activeValidators,
    mentees_formed: menteesFormed ?? 0,
  })
}
