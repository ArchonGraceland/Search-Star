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
  // Admin role lives in user_metadata in v3
  if (user.user_metadata?.role !== 'admin') return null
  return user
}

const VALID_STAGES = ['seedling', 'rooting', 'growing', 'established', 'mature']

// PATCH — update trust_stage (mentor_role was retired in v4; profiles.mentor_role column is dormant)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await getAdminClient()
    const admin = await checkAdmin(supabase)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

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

    const { error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', user_id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    // Mirror trust_stage to trust_records if updated
    if (updates.trust_stage) {
      await supabase
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
