import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminApi } from '@/lib/auth'
import { generateCompanionRoomMilestone } from '@/lib/companion/room'

// POST /api/admin/companion/milestone
//
// Admin-only manual trigger for dropping a Companion milestone marker
// into a room. Body: { commitment_id: uuid, day_number: 30 | 60 | 90 }.
// Derives the room_id from the commitment server-side so the client
// cannot inject a mismatched pair.
//
// Auth via the canonical `requireAdminApi` helper (Pass 3d Cluster 3
// consolidation): service-client read of profiles.role, defends
// against the @supabase/ssr JWT-propagation bug. Service client also
// handles the actual write (Companion message types have no RLS
// insert policy for user auth contexts — only the server can write
// companion_* rows).
//
// Non-idempotent by design. Calling twice produces two rows; the
// operator can see both in the room and delete one. Session 2's cron
// adds the idempotency guard when retries become a real problem.
//
// Does not use `after()` — unlike the founding welcome, there is no
// user-facing latency to protect here. The operator wants to see the
// result of their call before moving on.

const ALLOWED_DAYS = [30, 60, 90] as const
type AllowedDay = typeof ALLOWED_DAYS[number]

function isAllowedDay(n: unknown): n is AllowedDay {
  return typeof n === 'number' && (ALLOWED_DAYS as readonly number[]).includes(n)
}

export async function POST(request: NextRequest) {
  try {
    // Admin gate via the canonical helper.
    const guard = await requireAdminApi()
    if (guard instanceof NextResponse) return guard

    // Parse body.
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { commitment_id, day_number } = (body ?? {}) as {
      commitment_id?: unknown
      day_number?: unknown
    }

    if (typeof commitment_id !== 'string' || commitment_id.length === 0) {
      return NextResponse.json(
        { error: 'commitment_id (string) is required' },
        { status: 400 }
      )
    }
    if (!isAllowedDay(day_number)) {
      return NextResponse.json(
        { error: 'day_number must be 30, 60, or 90' },
        { status: 400 }
      )
    }

    // Derive room_id from the commitment server-side. Service client
    // from here on out — the Companion insert has no RLS policy that
    // covers it under user auth, and even this read benefits from not
    // being subject to the cookie client's JWT propagation quirks.
    const db = createServiceClient()
    const { data: commitment, error: commErr } = await db
      .from('commitments')
      .select('id, room_id, status')
      .eq('id', commitment_id)
      .maybeSingle<{ id: string; room_id: string; status: string }>()

    if (commErr) {
      console.error('[admin/companion/milestone] commitment lookup failed:', commErr)
      return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
    }
    if (!commitment) {
      return NextResponse.json(
        { error: 'Commitment not found' },
        { status: 404 }
      )
    }

    // Allow admin to drop milestones on non-active commitments (useful
    // for backfilling or testing against historical commitments) but
    // surface the status in the response so the operator knows what
    // they're doing.
    const messageId = await generateCompanionRoomMilestone({
      db,
      roomId: commitment.room_id,
      commitmentId: commitment.id,
      dayNumber: day_number,
    })

    if (!messageId) {
      return NextResponse.json(
        { error: 'Milestone generation failed — see server logs' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      message_id: messageId,
      commitment_id: commitment.id,
      room_id: commitment.room_id,
      day_number,
      commitment_status: commitment.status,
    })
  } catch (err) {
    console.error('[admin/companion/milestone] unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
