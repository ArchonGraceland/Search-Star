import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { commitment_id, invitee, role = 'witness' } = body

  if (!commitment_id || !invitee) {
    return NextResponse.json({ error: 'commitment_id and invitee are required' }, { status: 400 })
  }

  if (!['witness', 'co_practitioner', 'stakeholder'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  // Verify commitment ownership
  const { data: commitment } = await supabase
    .from('commitments')
    .select('id')
    .eq('id', commitment_id)
    .eq('user_id', user.id)
    .single()

  if (!commitment) {
    return NextResponse.json({ error: 'Commitment not found' }, { status: 404 })
  }

  // Look up invitee by email or handle (display_name)
  const isEmail = invitee.includes('@')
  let inviteeUserId: string | null = null

  if (isEmail) {
    // Look up by email in profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('email', invitee)
      .single()
    inviteeUserId = profile?.user_id || null
  } else {
    // Look up by display_name
    const handle = invitee.startsWith('@') ? invitee.slice(1) : invitee
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id')
      .ilike('display_name', handle)
      .single()
    inviteeUserId = profile?.user_id || null
  }

  // If user not found, store as pending invite (just return success for now)
  // In production this would send an email invitation
  if (!inviteeUserId) {
    return NextResponse.json({
      status: 'pending',
      message: 'Invitation will be sent when they join Search Star',
      invitee,
      role,
    })
  }

  // Insert supporter record
  const { data, error } = await supabase
    .from('commitment_supporters')
    .upsert({
      commitment_id,
      supporter_id: inviteeUserId,
      role,
    }, { onConflict: 'commitment_id,supporter_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ supporter: data, status: 'added' })
}
