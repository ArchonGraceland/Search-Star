import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ commitment_id: string; post_id: string }> }
) {
  const { commitment_id, post_id } = await params
  const supabase = createServiceClient()

  const body = await request.json()
  const { validator_token, quality_note } = body

  if (!validator_token) {
    return NextResponse.json({ error: 'validator_token is required.' }, { status: 400 })
  }

  // Look up validator by token + commitment
  const { data: validator, error: validatorError } = await supabase
    .from('validators')
    .select('id, status')
    .eq('invite_token', validator_token)
    .eq('commitment_id', commitment_id)
    .single()

  if (validatorError || !validator) {
    return NextResponse.json({ error: 'Invalid or expired validator token.' }, { status: 403 })
  }

  if (validator.status !== 'active') {
    return NextResponse.json({ error: 'Validator invitation has not been accepted.' }, { status: 403 })
  }

  // Verify the post belongs to this commitment
  const { data: post, error: postError } = await supabase
    .from('commitment_posts')
    .select('id')
    .eq('id', post_id)
    .eq('commitment_id', commitment_id)
    .single()

  if (postError || !post) {
    return NextResponse.json({ error: 'Post not found for this commitment.' }, { status: 404 })
  }

  // Upsert confirmation
  const { data: confirmation, error: upsertError } = await supabase
    .from('post_confirmations')
    .upsert(
      {
        post_id,
        validator_id: validator.id,
        confirmed_at: new Date().toISOString(),
        ...(quality_note ? { quality_note } : {}),
      },
      { onConflict: 'post_id,validator_id' }
    )
    .select('id')
    .single()

  if (upsertError || !confirmation) {
    console.error('Error upserting confirmation:', upsertError)
    return NextResponse.json({ error: 'Failed to confirm session.' }, { status: 500 })
  }

  return NextResponse.json({ id: confirmation.id })
}
