import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ commitment_id: string }> }
) {
  const { commitment_id } = await params
  const token = new URL(request.url).searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Token is required.' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Verify token is valid for this commitment
  const { data: validator } = await supabase
    .from('validators')
    .select('id')
    .eq('invite_token', token)
    .eq('commitment_id', commitment_id)
    .single()

  if (!validator) {
    return NextResponse.json({ error: 'Invalid token.' }, { status: 404 })
  }

  const { data: commitment } = await supabase
    .from('commitments')
    .select('title, status, user_id')
    .eq('id', commitment_id)
    .single()

  if (!commitment) {
    return NextResponse.json({ error: 'Commitment not found.' }, { status: 404 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('user_id', commitment.user_id)
    .single()

  return NextResponse.json({
    title: commitment.title,
    status: commitment.status,
    practitioner_name: profile?.display_name ?? 'the practitioner',
  })
}
