import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET — public lookup of a sponsor invitation by its opaque token. No auth
// required; the token is the gate. Used by /sponsor/invited/[invite_token]
// to pre-fill the pledge form.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const invite_token = searchParams.get('invite_token')

  if (!invite_token) {
    return NextResponse.json({ error: 'invite_token is required.' }, { status: 400 })
  }

  const db = createServiceClient()

  const { data: invitation, error } = await db
    .from('sponsor_invitations')
    .select('id, commitment_id, invitee_email, status, inviter_user_id')
    .eq('invite_token', invite_token)
    .maybeSingle()

  if (error || !invitation) {
    return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 })
  }

  // Load the commitment to expose the public-facing fields the pledge page needs.
  const { data: commitment } = await db
    .from('commitments')
    .select('id, status, started_at, practices(name)')
    .eq('id', invitation.commitment_id)
    .single()

  if (!commitment) {
    return NextResponse.json({ error: 'Commitment not found.' }, { status: 404 })
  }

  const { data: profile } = await db
    .from('profiles')
    .select('display_name')
    .eq('user_id', invitation.inviter_user_id)
    .single()

  const practice = commitment.practices as { name: string } | { name: string }[] | null
  const practice_name = practice
    ? (Array.isArray(practice) ? practice[0]?.name : practice.name) ?? null
    : null

  // v4 Decision #8: the commitment_title surface is retired; the practice
  // name is the commitment statement. streak_ends_at is computed from
  // started_at + 90 days (column dropped).
  const streakEndsAt = commitment.started_at
    ? new Date(new Date(commitment.started_at).getTime() + 90 * 24 * 60 * 60 * 1000).toISOString()
    : null

  return NextResponse.json({
    invitation_id: invitation.id,
    commitment_id: invitation.commitment_id,
    commitment_title: practice_name, // pragmatic alias — callers expect this key
    commitment_status: commitment.status,
    practitioner_name: profile?.display_name ?? 'the practitioner',
    practice_name,
    invitee_email: invitation.invitee_email,
    status: invitation.status,
    launch_ends_at: null, // retired — returned as null for legacy callers
    streak_ends_at: streakEndsAt,
  })
}
