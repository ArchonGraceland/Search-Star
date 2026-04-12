import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { validator_email, note } = body

  if (!validator_email || typeof validator_email !== 'string' || !validator_email.includes('@')) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 })
  }

  // Store the pending invite email on the user's profile.
  // Phase 4 will use this when the first commitment is created to wire up the validator row.
  const { error } = await supabase
    .from('profiles')
    .update({
      pending_validator_email: validator_email.trim().toLowerCase(),
      ...(note ? { pending_validator_note: note.trim() } : {}),
    })
    .eq('user_id', user.id)

  if (error) {
    console.error('Error storing validator invite:', error)
    return NextResponse.json({ error: 'Failed to save validator invite.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
