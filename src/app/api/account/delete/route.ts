import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceClient()

  // Delete profile and related data (cascade handles the rest via FK)
  await db.from('profiles').delete().eq('user_id', user.id)

  // Delete the auth user
  const { error } = await db.auth.admin.deleteUser(user.id)

  if (error) {
    console.error('Delete user error:', error)
    return NextResponse.json({ error: 'Failed to delete account.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
