import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Profile self-update route.
//
// Pass 4 §3 (F24): the SSR client is retained for `auth.getUser()`
// (cookie-bound — that's correct), but the UPDATE itself runs on the
// service client. Authorization is by the explicit `user.id` carried
// into the WHERE clause — RLS is defense-in-depth, not the primary
// gate. This mirrors the Pass 3d migration shape at
// /api/admin/users (commit b3fe91c) and the broader SSR-bug sweep
// in commits 0710ce4 / 1dccc46 / 501d976 / 0f28db9.

export async function PATCH(request: Request) {
  const ssr = await createClient()
  const { data: { user } } = await ssr.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { display_name, location, bio } = body

  const updates: Record<string, string> = {}
  if (display_name !== undefined) updates.display_name = display_name
  if (location !== undefined) updates.location = location
  if (bio !== undefined) {
    if (bio.length > 280) {
      return NextResponse.json({ error: 'Bio must be 280 characters or fewer.' }, { status: 400 })
    }
    updates.bio = bio
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: true })
  }

  const db = createServiceClient()
  const { error } = await db
    .from('profiles')
    .update(updates)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json({ error: 'Failed to update profile.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
