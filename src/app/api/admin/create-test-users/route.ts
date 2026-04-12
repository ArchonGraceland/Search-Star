import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Creates minimal test practitioners for development
const TEST_USERS = [
  { email: 'testuser.alice@test.searchstar.dev', password: 'TestPass123!', display_name: 'Alice Testworth' },
  { email: 'testuser.bob@test.searchstar.dev',   password: 'TestPass123!', display_name: 'Bob Fakeman' },
  { email: 'testuser.carol@test.searchstar.dev', password: 'TestPass123!', display_name: 'Carol Placeholder' },
]

export async function POST() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const results: { email: string; status: string; error?: string }[] = []

  for (const user of TEST_USERS) {
    try {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { display_name: user.display_name },
      })

      if (createError) {
        if (createError.message.includes('already been registered')) {
          results.push({ email: user.email, status: 'exists' })
        } else {
          results.push({ email: user.email, status: 'error', error: createError.message })
        }
        continue
      }

      // Profile is auto-created by trigger; update display_name explicitly
      if (created.user) {
        await admin
          .from('profiles')
          .update({ display_name: user.display_name })
          .eq('user_id', created.user.id)
      }

      results.push({ email: user.email, status: 'created' })
    } catch (err) {
      results.push({ email: user.email, status: 'error', error: String(err) })
    }
  }

  return NextResponse.json({ results })
}
