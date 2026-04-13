import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { visibility } = body

  if (visibility !== 'public' && visibility !== 'private') {
    return NextResponse.json({ error: 'visibility must be "public" or "private".' }, { status: 400 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ visibility })
    .eq('user_id', user.id)

  if (error) {
    console.error('Error updating visibility:', error)
    return NextResponse.json({ error: 'Failed to update visibility.' }, { status: 500 })
  }

  return NextResponse.json({ visibility })
}
