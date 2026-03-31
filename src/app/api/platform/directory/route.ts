import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

let _admin: SupabaseClient | null = null
function admin() {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _admin
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const location = searchParams.get('location') || ''
    const ageCohort = searchParams.get('age_cohort') || ''
    const minPresence = parseInt(searchParams.get('min_presence') || '0')
    const maxPresence = parseInt(searchParams.get('max_presence') || '100')
    const skill = searchParams.get('skill') || ''
    const interest = searchParams.get('interest') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = 20

    let query = admin()
      .from('profiles')
      .select('id, profile_number, handle, display_name, location, age_cohort, presence_score, trust_score, skills_count, interests_tags, price_public, price_private, price_marketing, tagline, has_financial, has_dating, has_family, has_content_feed, feed_topics, status, role', { count: 'exact' })
      .eq('status', 'active')
      .neq('role', 'platform')
      .gte('presence_score', minPresence)
      .lte('presence_score', maxPresence)
      .order('presence_score', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (search) {
      query = query.or(`display_name.ilike.%${search}%,handle.ilike.%${search}%,profile_number.ilike.%${search}%`)
    }

    if (location) {
      query = query.ilike('location', `%${location}%`)
    }

    if (ageCohort) {
      query = query.eq('age_cohort', ageCohort)
    }

    if (interest) {
      query = query.contains('interests_tags', [interest])
    }

    const { data: profiles, count, error } = await query

    if (error) {
      console.error('Directory search error:', error)
      return NextResponse.json({ error: 'Search failed' }, { status: 500 })
    }

    return NextResponse.json({
      profiles: profiles || [],
      total: count || 0,
      page,
      limit,
      total_pages: Math.ceil((count || 0) / limit),
    })
  } catch (err) {
    console.error('Directory API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
