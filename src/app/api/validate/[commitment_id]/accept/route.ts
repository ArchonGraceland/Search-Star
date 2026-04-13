import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ commitment_id: string }> }
) {
  const { commitment_id } = await params
  const { token } = await request.json()

  if (!token) {
    return NextResponse.json({ error: 'Token is required.' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: validator, error } = await supabase
    .from('validators')
    .select('id, status')
    .eq('invite_token', token)
    .eq('commitment_id', commitment_id)
    .single()

  if (error || !validator) {
    return NextResponse.json({ error: 'Invalid token.' }, { status: 404 })
  }

  if (validator.status === 'active') {
    return NextResponse.json({ ok: true }) // already accepted
  }

  const { error: updateError } = await supabase
    .from('validators')
    .update({ status: 'active', accepted_at: new Date().toISOString() })
    .eq('id', validator.id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to accept invitation.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
