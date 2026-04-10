import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch all commitments for this user
  const { data: commitments, error } = await supabase
    .from('commitments')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!commitments?.length) return NextResponse.json({ commitments: [] })

  // Fetch recent posts for each commitment (last 5)
  const ids = commitments.map(c => c.id)

  const { data: posts } = await supabase
    .from('commitment_posts')
    .select('*')
    .in('commitment_id', ids)
    .order('posted_at', { ascending: false })

  // Fetch supporters for each commitment
  const { data: supporters } = await supabase
    .from('commitment_supporters')
    .select('commitment_id, supporter_id, role')
    .in('commitment_id', ids)

  // Fetch active sponsorships
  const { data: sponsorships } = await supabase
    .from('practice_sponsorships')
    .select('id, commitment_id, sponsor_label, bounty_day10, bounty_day20, bounty_day30, bounty_day40, escrow_remaining, weekly_rate, gated_offer_threshold, gated_offer_delivered, status')
    .in('commitment_id', ids)
    .eq('status', 'active')

  // Attach posts and supporters to each commitment
  const enriched = commitments.map(c => ({
    ...c,
    posts: (posts || []).filter(p => p.commitment_id === c.id).slice(0, 10),
    supporters: (supporters || []).filter(s => s.commitment_id === c.id),
    sponsorships: (sponsorships || []).filter(s => s.commitment_id === c.id),
  }))

  return NextResponse.json({ commitments: enriched })
}
