import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'

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

// GET — Fetch current API key (masked)
export async function GET() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: platform } = await admin()
      .from('platform_accounts')
      .select('api_key')
      .eq('user_id', user.id)
      .single()

    if (!platform) {
      return NextResponse.json({ error: 'Platform account not found' }, { status: 404 })
    }

    const key = platform.api_key
    const masked = key.slice(0, 8) + '•'.repeat(Math.max(0, key.length - 12)) + key.slice(-4)

    return NextResponse.json({ api_key_masked: masked, api_key_full: key })
  } catch (err) {
    console.error('API key fetch error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST — Regenerate API key
export async function POST() {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const newKey = `sk_live_${randomUUID().replace(/-/g, '')}`

    const { error } = await admin()
      .from('platform_accounts')
      .update({ api_key: newKey })
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: 'Failed to regenerate key' }, { status: 500 })
    }

    const masked = newKey.slice(0, 8) + '•'.repeat(Math.max(0, newKey.length - 12)) + newKey.slice(-4)

    return NextResponse.json({ api_key_masked: masked, api_key_full: newKey, regenerated: true })
  } catch (err) {
    console.error('API key regenerate error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
