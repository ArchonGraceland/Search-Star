import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminApi } from '@/lib/auth'
import { generateCommitmentCompletionSummary } from '@/lib/companion/curator'

// POST /api/admin/companion/curator
//
// Admin-only manual trigger for the Memory Curator agent. Body:
// { commitment_id: uuid }. Runs the Curator synchronously (no after()
// here — the operator wants to see the result in the response) and
// returns the generated summary plus token usage.
//
// Auth via the canonical `requireAdminApi` helper. Service client used
// throughout — Curator writes to commitments.completion_summary which
// has no RLS policy for user auth contexts.
//
// Use cases:
//
// 1. **End-to-end exercise without a real day-90 release.** No
//    commitment has organically completed yet, so the production
//    release-route Curator path has never fired. This endpoint lets us
//    run the Curator against a synthetic-completed commitment in the
//    dev DB to verify the full path works end-to-end.
//
// 2. **Failure-isolation verification.** Per plan §3.4, "Curator's
//    failure does not affect any synchronous room interaction —
//    verified by deliberately simulating a Curator failure during the
//    test commitment's completion and confirming the room continues to
//    function." Run this against a known-bad input (commitment with no
//    messages, or while ANTHROPIC_API_KEY is rotated to invalid) to
//    confirm the failure surfaces cleanly without affecting other
//    paths.
//
// 3. **Re-running after prompt revisions.** When chat-room-plan §6.7.4
//    is updated and a fresh prompt ships in src/lib/anthropic.ts, this
//    lets us regenerate completion_summary on existing completed
//    commitments without faking a release.
//
// Idempotency: this endpoint always overwrites completion_summary on
// the target commitment. The release-route Curator path is naturally
// once-only (status flips to 'completed' guard the entry), but admin
// triggers are explicit and operator-aware.

export async function POST(request: NextRequest) {
  try {
    const guard = await requireAdminApi()
    if (guard instanceof NextResponse) return guard

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { commitment_id } = (body ?? {}) as { commitment_id?: unknown }
    if (typeof commitment_id !== 'string' || commitment_id.length === 0) {
      return NextResponse.json(
        { error: 'commitment_id (string) is required' },
        { status: 400 }
      )
    }

    const db = createServiceClient()
    const result = await generateCommitmentCompletionSummary({
      db,
      commitmentId: commitment_id,
    })

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      commitment_id,
      summary: result.summary,
      message_count: result.messageCount,
      truncated: result.truncated,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
    })
  } catch (err) {
    console.error('[admin/companion/curator] unhandled error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
