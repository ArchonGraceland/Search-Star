import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

async function getAdminClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch { /* server component */ }
        },
      },
    }
  )
}

async function checkAdmin(supabase: ReturnType<typeof createServerClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') return null
  return user
}

// PATCH — Update trust score
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await getAdminClient()
    const admin = await checkAdmin(supabase)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { profile_id, trust_score, reason } = body

    if (!profile_id || trust_score === undefined || !reason) {
      return NextResponse.json({ error: 'Missing required fields: profile_id, trust_score, reason' }, { status: 400 })
    }

    const score = parseInt(trust_score, 10)
    if (isNaN(score) || score < 0 || score > 100) {
      return NextResponse.json({ error: 'Trust score must be between 0 and 100' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ trust_score: score, updated_at: new Date().toISOString() })
      .eq('id', profile_id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, trust_score: score })
  } catch (err) {
    console.error('Admin trust update error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT — Update account status (suspend/unsuspend)
export async function PUT(request: NextRequest) {
  try {
    const supabase = await getAdminClient()
    const admin = await checkAdmin(supabase)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { profile_id, status } = body

    if (!profile_id || !status) {
      return NextResponse.json({ error: 'Missing required fields: profile_id, status' }, { status: 400 })
    }

    if (!['active', 'suspended'].includes(status)) {
      return NextResponse.json({ error: 'Status must be "active" or "suspended"' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', profile_id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, status })
  } catch (err) {
    console.error('Admin status update error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
