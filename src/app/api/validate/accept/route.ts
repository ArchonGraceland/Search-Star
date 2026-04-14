import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(new URL('/validate/invalid', request.url))
  }

  const supabase = createServiceClient()

  const { data: validator, error } = await supabase
    .from('validators')
    .select('id, commitment_id, status, invite_expires_at')
    .eq('invite_token', token)
    .single()

  if (error || !validator) {
    return NextResponse.redirect(new URL('/validate/invalid', request.url))
  }

  if (validator.invite_expires_at && new Date(validator.invite_expires_at) < new Date()) {
    return NextResponse.redirect(new URL('/validate/expired', request.url))
  }

  if (validator.status === 'active') {
    return NextResponse.redirect(
      new URL(`/validate/${validator.commitment_id}/${token}`, request.url)
    )
  }

  // Check if user is logged in — capture user_id if so
  const { data: { user } } = await supabase.auth.getUser()

  const updateData: Record<string, unknown> = {
    status: 'active',
    accepted_at: new Date().toISOString(),
  }
  if (user) {
    updateData.validator_user_id = user.id
  }

  const { error: updateError } = await supabase
    .from('validators')
    .update(updateData)
    .eq('id', validator.id)

  if (updateError) {
    console.error('Error accepting validator invite:', updateError)
    return NextResponse.redirect(new URL('/validate/invalid', request.url))
  }

  return NextResponse.redirect(
    new URL(`/validate/${validator.commitment_id}/${token}`, request.url)
  )
}
