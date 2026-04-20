import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { summarizeCommitment, isDay90Reached } from '@/lib/companion/day90'

// POST /api/companion/day90-summary
//
// Dual-auth. The endpoint accepts two kinds of caller:
//
//   1. The practitioner (authenticated Supabase session). Allowed at any
//      time — a practitioner can preview what their sponsors will see.
//   2. A sponsor arriving through their /sponsor/[commitment_id]/[token]
//      link. Gated to day 90 or later (or commitment.status='completed').
//      The summary is a completion artifact; sponsors do not get mid-stream
//      access to it.
//
// Body: { commitment_id: string, token?: string }
//
// No rate limit on this route — unlike /reflect, day-90 summary is not a
// render-loop risk surface. It's called at most once per sponsor per
// commitment, and the practitioner's preview is a conscious action.

export async function POST(request: Request) {
  let body: { commitment_id?: string; token?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { commitment_id, token } = body
  if (!commitment_id || typeof commitment_id !== 'string') {
    return NextResponse.json({ error: 'commitment_id is required.' }, { status: 400 })
  }

  const db = createServiceClient()

  if (token && typeof token === 'string' && token.length > 0) {
    const { data: sponsorship, error: spErr } = await db
      .from('sponsorships')
      .select('id, access_token, commitment_id')
      .eq('access_token', token)
      .eq('commitment_id', commitment_id)
      .maybeSingle()

    if (spErr || !sponsorship) {
      return NextResponse.json({ error: 'Not found.' }, { status: 404 })
    }

    const { data: commitment } = await db
      .from('commitments')
      .select('status, started_at')
      .eq('id', commitment_id)
      .single()

    if (!commitment) {
      return NextResponse.json({ error: 'Not found.' }, { status: 404 })
    }

    // Day 90 is started_at + 90 days in v4 (streak_ends_at column retired).
    const streakEndsAt = commitment.started_at
      ? new Date(new Date(commitment.started_at).getTime() + 90 * 24 * 60 * 60 * 1000).toISOString()
      : null

    if (!isDay90Reached(commitment.status, streakEndsAt)) {
      return NextResponse.json(
        {
          error:
            'The Companion summary is available after the 90-day streak has reached completion.',
        },
        { status: 403 }
      )
    }
  } else {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: commitment, error: commErr } = await db
      .from('commitments')
      .select('user_id')
      .eq('id', commitment_id)
      .single()

    if (commErr || !commitment) {
      return NextResponse.json({ error: 'Not found.' }, { status: 404 })
    }

    if (commitment.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found.' }, { status: 404 })
    }
  }

  const result = await summarizeCommitment(commitment_id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({
    summary: result.summary,
    truncated: result.truncated,
    post_count: result.postCount,
  })
}
