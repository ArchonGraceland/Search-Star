import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

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

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json({ error: 'Failed to update profile.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
