import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Profile-visibility self-update route.
//
// Pass 4 §3 (F24): SSR client for `auth.getUser()` (cookie-bound),
// service client for the UPDATE. WHERE-clause filter on `user.id`
// authorizes the write; RLS is defense-in-depth. Mirrors the Pass 3d
// migration at /api/admin/users (commit b3fe91c).

export async function PATCH(request: Request) {
  const ssr = await createClient()
  const { data: { user } } = await ssr.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { visibility } = body

  if (visibility !== 'public' && visibility !== 'private') {
    return NextResponse.json({ error: 'visibility must be "public" or "private".' }, { status: 400 })
  }

  const db = createServiceClient()
  const { error } = await db
    .from('profiles')
    .update({ visibility })
    .eq('user_id', user.id)

  if (error) {
    console.error('Error updating visibility:', error)
    return NextResponse.json({ error: 'Failed to update visibility.' }, { status: 500 })
  }

  return NextResponse.json({ visibility })
}
