import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ commitment_id: string; post_id: string }> }
) {
  const { commitment_id, post_id } = await params
  const supabase = await createClient()

  const body = await request.json()
  const { validator_token, quality_note } = body

  if (!validator_token) {
    return NextResponse.json({ error: 'validator_token is required.' }, { status: 400 })
  }

  // Look up validator by invite_token and commitment_id
  const { data: validator, error: valErr } = await supabase
    .from('validators')
    .select('id, status')
    .eq('invite_token', validator_token)
    .eq('commitment_id', commitment_id)
    .maybeSingle()

  if (valErr || !validator) {
    return NextResponse.json({ error: 'Invalid validator token.' }, { status: 403 })
  }

  if (validator.status !== 'active') {
    return NextResponse.json({ error: 'Validator invitation has not been accepted.' }, { status: 403 })
  }

  // Verify post belongs to this commitment
  const { data: post, error: postErr } = await supabase
    .from('commitment_posts')
    .select('id')
    .eq('id', post_id)
    .eq('commitment_id', commitment_id)
    .maybeSingle()

  if (postErr || !post) {
    return NextResponse.json({ error: 'Post not found.' }, { status: 404 })
  }

  // Upsert confirmation (unique on post_id + validator_id)
  const { data: confirmation, error: upsertErr } = await supabase
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

  if (upsertErr || !confirmation) {
    console.error('Error upserting confirmation:', upsertErr)
    return NextResponse.json({ error: 'Failed to confirm session.' }, { status: 500 })
  }

  return NextResponse.json({ id: confirmation.id })
}
