import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get all active mentees
  const { data: menteeRels } = await supabase
    .from('mentor_relationships')
    .select('id, mentee_user_id, started_at')
    .eq('mentor_user_id', user.id)
    .eq('status', 'active')

  if (!menteeRels || menteeRels.length === 0) {
    return NextResponse.json({ mentees: [] })
  }

  const mentees = []

  for (const rel of menteeRels) {
    // Profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', rel.mentee_user_id)
      .single()

    // Active commitment
    const { data: commitment } = await supabase
      .from('commitments')
      .select('id, title, status, sessions_logged, created_at')
      .eq('user_id', rel.mentee_user_id)
      .in('status', ['active', 'completed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Recent posts (last 3, for this mentee's active commitment)
    let recentPosts: Array<{
      id: string
      commitment_id: string
      body: string
      session_number: number
      posted_at: string
      confirmed: boolean
    }> = []

    if (commitment) {
      const { data: posts } = await supabase
        .from('commitment_posts')
        .select('id, commitment_id, body, session_number, posted_at')
        .eq('commitment_id', commitment.id)
        .order('posted_at', { ascending: false })
        .limit(3)

      if (posts) {
        // Check which are confirmed by this mentor (as validator)
        const { data: validators } = await supabase
          .from('validators')
          .select('id')
          .eq('commitment_id', commitment.id)
          .eq('user_id', user.id)
          .eq('status', 'active')

        const validatorId = validators?.[0]?.id ?? null

        for (const post of posts) {
          let confirmed = false
          if (validatorId) {
            const { data: conf } = await supabase
              .from('post_confirmations')
              .select('id')
              .eq('post_id', post.id)
              .eq('validator_id', validatorId)
              .maybeSingle()
            confirmed = !!conf
          }
          recentPosts.push({ ...post, confirmed })
        }
      }
    }

    // Last session date
    const lastSession = recentPosts[0]?.posted_at ?? null

    mentees.push({
      relationship_id: rel.id,
      mentee_user_id: rel.mentee_user_id,
      display_name: profile?.display_name ?? null,
      started_at: rel.started_at,
      commitment: commitment ?? null,
      last_session_at: lastSession,
      recent_posts: recentPosts,
    })
  }

  return NextResponse.json({ mentees })
}
