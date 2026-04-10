import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { commitment_id, post_id, day_number, media_urls } = body

  if (!commitment_id || !post_id || !day_number) {
    return NextResponse.json({ error: 'commitment_id, post_id, day_number required' }, { status: 400 })
  }
  if (!media_urls?.length) {
    return NextResponse.json({ error: 'At least one photo or video is required to validate a milestone' }, { status: 400 })
  }
  if (![10, 20, 30, 40].includes(Number(day_number))) {
    return NextResponse.json({ error: 'Evidence submission only required at milestone days (10, 20, 30, 40)' }, { status: 400 })
  }

  // Verify commitment ownership
  const { data: commitment } = await supabase
    .from('commitments')
    .select('id, user_id, status')
    .eq('id', commitment_id)
    .eq('user_id', user.id)
    .single()

  if (!commitment) return NextResponse.json({ error: 'Commitment not found' }, { status: 404 })

  // Check for existing submission for this day
  const { data: existing } = await supabase
    .from('evidence_submissions')
    .select('id, status')
    .eq('commitment_id', commitment_id)
    .eq('day_number', Number(day_number))
    .single()

  if (existing?.status === 'validated') {
    return NextResponse.json({ error: 'This milestone is already validated' }, { status: 400 })
  }
  if (existing?.status === 'pending') {
    return NextResponse.json({ error: 'Validation is already in progress for this milestone', evidence_id: existing.id }, { status: 400 })
  }

  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()

  const { data: evidence, error } = await supabase
    .from('evidence_submissions')
    .insert({
      commitment_id,
      post_id,
      user_id: user.id,
      day_number: Number(day_number),
      media_urls,
      status: 'pending',
      required_validators: 3,
      expires_at: expiresAt,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    evidence,
    message: '3 validators must confirm your evidence within 72 hours to release payments.',
    expires_at: expiresAt,
  })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const commitment_id = url.searchParams.get('commitment_id')

  // Fetch evidence where this user is the validator (witness or co-practitioner)
  // or where they are the commitment owner
  const { data: ownEvidence } = await supabase
    .from('evidence_submissions')
    .select('*, validations:milestone_validations(validator_id, confirmed, note, validated_at)')
    .eq('user_id', user.id)
    .order('submitted_at', { ascending: false })

  // Fetch evidence pending validation where user is a supporter
  const { data: pendingToValidate } = await supabase
    .from('evidence_submissions')
    .select(`
      *,
      commitment:commitments(habit, user_id),
      validations:milestone_validations(validator_id, confirmed)
    `)
    .eq('status', 'pending')
    .neq('user_id', user.id) // not their own

  // Filter to ones where user is a witness or co-practitioner
  const { data: supporterRelations } = await supabase
    .from('commitment_supporters')
    .select('commitment_id')
    .eq('supporter_id', user.id)

  const supportedIds = new Set((supporterRelations || []).map(s => s.commitment_id))

  const validatable = (pendingToValidate || []).filter(e =>
    supportedIds.has(e.commitment_id) &&
    !(e.validations || []).some((v: { validator_id: string }) => v.validator_id === user.id)
  )

  return NextResponse.json({
    own_evidence: commitment_id
      ? (ownEvidence || []).filter(e => e.commitment_id === commitment_id)
      : ownEvidence || [],
    pending_validation: validatable,
  })
}
