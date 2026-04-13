import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(new URL('/validate/invalid', request.url))
  }

  const supabase = await createClient()

  const { data: validator, error } = await supabase
    .from('validators')
    .select('id, commitment_id, status, invite_expires_at')
    .eq('invite_token', token)
    .maybeSingle()

  if (error || !validator) {
    return NextResponse.redirect(new URL('/validate/invalid', request.url))
  }

  // Check expiry
  if (new Date(validator.invite_expires_at) < new Date()) {
    return NextResponse.redirect(new URL('/validate/expired', request.url))
  }

  // Already accepted — go straight to validator view
  if (validator.status === 'active') {
    return NextResponse.redirect(
      new URL(`/validate/${validator.commitment_id}?token=${token}`, request.url)
    )
  }

  // Try to capture user_id if logged in
  const { data: { user } } = await supabase.auth.getUser()

  const updatePayload: Record<string, string> = {
    status: 'active',
    accepted_at: new Date().toISOString(),
  }
  if (user) {
    updatePayload.validator_user_id = user.id
  }

  const { error: updateErr } = await supabase
    .from('validators')
    .update(updatePayload)
    .eq('id', validator.id)

  if (updateErr) {
    console.error('Error accepting validator invite:', updateErr)
    return NextResponse.redirect(new URL('/validate/invalid', request.url))
  }

  return NextResponse.redirect(
    new URL(`/validate/${validator.commitment_id}?token=${token}`, request.url)
  )
}
