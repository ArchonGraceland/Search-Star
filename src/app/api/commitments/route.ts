import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { after } from 'next/server'
import { generateCompanionRoomWelcome } from '@/lib/companion/room'

// v4 Decision #8: declaring a commitment creates a room implicitly (if the
// practitioner doesn't already have one) and starts the streak immediately.
// There is no launch period, no start ritual, no "preparation" window. The
// room is the primary surface; commitments happen inside it.
//
// The founding-moment path (first-time practitioner, no room yet):
//   1. Create a new rooms row owned by the practitioner
//   2. Create room_memberships row for the practitioner with state='active'
//   3. Create the commitment row with room_id + started_at=now, status='active'
//   4. Fire-and-forget Companion welcome via next/server's `after` — the
//      welcome insert happens after the response is sent, so declaration
//      latency stays tight (<200ms) and the room renders with the welcome
//      by the time the user arrives.
//
// The subsequent-commitment path (practitioner already has a room):
//   1. Reuse the existing room (first row we find)
//   2. Create the commitment inside it
//   3. No welcome — the room isn't new, the Companion has been present.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // The declaration form currently posts title/description/frequency; under
  // Decision #8 these are retired from commitments (see migration
  // 20260420_v4_rooms_and_messages). We still accept a commitment_statement
  // text blob so the UI can capture the practitioner's own words, but we
  // don't persist it separately — the practice name IS the commitment
  // statement. If in a later phase we decide to keep a commitment_statement
  // column, it lives then.
  const body = await request.json().catch(() => ({}))
  // Soft-accept legacy fields without persisting them; log for awareness.
  const legacyTitle = typeof body.title === 'string' ? body.title : null
  if (legacyTitle) {
    console.log('[commitments/POST] received legacy title (ignored):', legacyTitle.slice(0, 80))
  }

  const db = createServiceClient()

  // Look up the user's practice
  const { data: practice } = await db
    .from('practices')
    .select('id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!practice) {
    return NextResponse.json({ error: 'No practice found. Please complete onboarding first.' }, { status: 400 })
  }

  // Room: reuse an existing room the user is a member of, or create one.
  // Track whether this is a brand-new room so we can fire the founding
  // welcome exactly once.
  const { data: existingMembership } = await db
    .from('room_memberships')
    .select('room_id')
    .eq('user_id', user.id)
    .eq('state', 'active')
    .limit(1)
    .maybeSingle()

  let roomId: string
  let roomIsNew = false
  if (existingMembership?.room_id) {
    roomId = existingMembership.room_id
  } else {
    const { data: newRoom, error: roomErr } = await db
      .from('rooms')
      .insert({ creator_user_id: user.id })
      .select('id')
      .single()

    if (roomErr || !newRoom) {
      console.error('[commitments/POST] room create failed:', roomErr)
      return NextResponse.json({ error: 'Failed to create room.' }, { status: 500 })
    }
    roomId = newRoom.id
    roomIsNew = true

    const { error: memErr } = await db
      .from('room_memberships')
      .insert({ room_id: roomId, user_id: user.id, state: 'active' })

    if (memErr) {
      console.error('[commitments/POST] membership create failed:', memErr)
      // Room exists but no membership — best effort cleanup
      await db.from('rooms').delete().eq('id', roomId)
      return NextResponse.json({ error: 'Failed to create room membership.' }, { status: 500 })
    }
  }

  // Create the commitment. Streak begins immediately at declaration.
  const now = new Date().toISOString()
  const { data: commitment, error: commErr } = await db
    .from('commitments')
    .insert({
      user_id: user.id,
      practice_id: practice.id,
      room_id: roomId,
      started_at: now,
      status: 'active',
    })
    .select('id, room_id')
    .single()

  if (commErr || !commitment) {
    console.error('[commitments/POST] commitment create failed:', JSON.stringify({
      message: commErr?.message,
      code: commErr?.code,
      details: commErr?.details,
      hint: commErr?.hint,
    }))
    return NextResponse.json({
      error: 'Failed to create commitment.',
      detail: commErr?.message,
    }, { status: 500 })
  }

  // Fire the founding welcome — only for fresh rooms, only after the
  // response is sent. `after()` guarantees the work completes even
  // though we've already returned, without blocking the declaration
  // latency on a multi-second Anthropic call.
  if (roomIsNew) {
    after(async () => {
      await generateCompanionRoomWelcome({
        db,
        roomId,
        commitmentId: commitment.id,
      })
    })
  }

  return NextResponse.json({ id: commitment.id, room_id: commitment.room_id })
}
