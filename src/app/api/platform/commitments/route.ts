import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify platform role
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('user_id', user.id)
    .single()

  if (!profile || profile.role !== 'platform') {
    return NextResponse.json({ error: 'Platform account required' }, { status: 403 })
  }

  const url = new URL(request.url)
  const keyword = url.searchParams.get('q')?.trim() || ''
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50)

  // Search public active commitments
  let query = supabase
    .from('commitments')
    .select(`
      id,
      habit,
      status,
      logged_days,
      current_streak,
      longest_streak,
      started_at,
      user_id
    `)
    .in('status', ['active', 'ongoing'])
    .eq('visibility', 'public')
    .order('logged_days', { ascending: false })
    .limit(limit)

  if (keyword) {
    query = query.ilike('habit', `%${keyword}%`)
  }

  const { data: commitments, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // For each commitment, check if already sponsored by this platform
  const ids = (commitments || []).map(c => c.id)
  const { data: existing } = await supabase
    .from('practice_sponsorships')
    .select('commitment_id, status')
    .eq('platform_id', profile.id)
    .in('commitment_id', ids)

  const sponsoredIds = new Set((existing || []).filter(s => s.status === 'active').map(s => s.commitment_id))

  // Fetch supporter counts
  const { data: supporters } = await supabase
    .from('commitment_supporters')
    .select('commitment_id')
    .in('commitment_id', ids)

  const supporterCounts = (supporters || []).reduce<Record<string, number>>((acc, s) => {
    acc[s.commitment_id] = (acc[s.commitment_id] || 0) + 1
    return acc
  }, {})

  const enriched = (commitments || []).map(c => ({
    ...c,
    supporter_count: supporterCounts[c.id] || 0,
    already_sponsored: sponsoredIds.has(c.id),
  }))

  return NextResponse.json({ commitments: enriched, keyword })
}
