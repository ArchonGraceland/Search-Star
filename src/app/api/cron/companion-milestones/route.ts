import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateCompanionRoomMilestone } from '@/lib/companion/room'
import { summarizeCommitment } from '@/lib/companion/day90'

// GET /api/cron/companion-milestones
//
// Daily cron — runs at 09:00 UTC via vercel.json. For every active
// commitment whose day-number (floor((now - started_at) / 86400)) is
// currently at 30, 60, or 90, drops the corresponding Companion
// milestone marker into its room. At day 90, additionally computes the
// day-90 sponsor summary and flips commitments.status from 'active' to
// 'completed'.
//
// Auth: Authorization: Bearer $CRON_SECRET. Vercel's cron invocation
// signs the request with this header (set via project env var);
// external callers cannot spoof it without the secret.
//
// Dry-run: pass ?dry_run=1 to return the list of commitments that
// WOULD be processed, with the actions that would fire, without
// writing anything. Useful for cron debugging throughout the arc's
// life.
//
// ---------------------------------------------------------------------------
// Day-90 sequencing — see docs/chat-room-plan.md §6.5 and
// docs/bcd-arc.md Session 1 log.
//
// Three distinct surfaces fire on the same tick at day 90, in this
// order:
//
//   1. Milestone marker.  generateCompanionRoomMilestone produces a
//      "Day ninety." row in room_messages. Idempotency guard: count
//      existing companion_milestone rows for this commitment; only
//      fire if count < expected-milestones-so-far.
//
//   2. Day-90 summary.    summarizeCommitment reads the session record
//      and calls Anthropic; returns a longform summary. Currently
//      READ-ONLY — the summary is not persisted anywhere. The sponsor
//      completion page recomputes on view. We call it here anyway so
//      the Anthropic bill is taken once on the cron tick rather than
//      per-page-view, and so any failure shows up in cron logs rather
//      than hidden inside a sponsor's page load. The returned summary
//      is discarded. See "Flag for future work" at the bottom of this
//      file.
//
//   3. Status flip.       UPDATE commitments SET status='completed'
//      WHERE id=? AND status='active'. This is the load-bearing
//      action. The WHERE-status='active' clause is the idempotency
//      branch: if the cron re-fires on a later tick and this row is
//      already 'completed', zero rows update and we move on.
//
// The three steps are NOT wrapped in a transaction. Steps 1 and 2
// make Anthropic calls that cannot be rolled back, and step 2 reads
// a potentially-large context that should not hold a DB transaction
// open. Each step is independently idempotent and reconciles on the
// next cron tick if it failed mid-sequence:
//
//   - If (1) succeeds and (2)/(3) fail: next tick's milestone guard
//     sees count==1-expected-so-far, skips (1), retries (2) and (3).
//   - If (1) and (2) succeed and (3) fails: next tick sees status
//     still 'active', milestone guard still matches, retries (2)
//     and (3).
//   - If all three succeed: next tick sees status 'completed' (no
//     longer in the active-query), nothing happens.
//
// The milestone-row guard branches on the milestone row; the status-
// flip guard branches on commitments.status. Deliberately two
// separate guards: the admin endpoint from Session 1 is NOT
// idempotent and can create a duplicate milestone row without
// flipping status, so we can't use "milestone row exists" as a
// proxy for "status already flipped."
// ---------------------------------------------------------------------------

export const dynamic = 'force-dynamic'

const DAY_MS = 24 * 60 * 60 * 1000
const MILESTONE_DAYS = [30, 60, 90] as const
type MilestoneDay = (typeof MILESTONE_DAYS)[number]

type CommitmentRow = {
  id: string
  user_id: string
  room_id: string
  status: string
  started_at: string
}

type ProcessedAction = {
  commitment_id: string
  room_id: string
  day_number: number
  actions: {
    milestone?: 'fired' | 'skipped_duplicate' | 'failed'
    summary?: 'fired' | 'skipped_not_day_90' | 'failed'
    status_flip?: 'fired' | 'skipped_not_day_90' | 'skipped_already_completed' | 'failed'
  }
  milestone_message_id?: string
  notes?: string[]
}

// How many milestone markers should have been emitted by now given the
// day number. Day 0-29 → 0. Day 30-59 → 1. Day 60-89 → 2. Day 90+ → 3.
function expectedMilestonesSoFar(dayNumber: number): number {
  if (dayNumber >= 90) return 3
  if (dayNumber >= 60) return 2
  if (dayNumber >= 30) return 1
  return 0
}

function computeDayNumber(startedAt: string, now: Date): number {
  const start = new Date(startedAt).getTime()
  const elapsed = now.getTime() - start
  return Math.floor(elapsed / DAY_MS)
}

export async function GET(request: NextRequest) {
  // Auth. CRON_SECRET is an env var shared between Vercel's cron
  // invocation and this handler.
  const authHeader = request.headers.get('authorization')
  const expected = `Bearer ${process.env.CRON_SECRET}`
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const dryRun = url.searchParams.get('dry_run') === '1'

  const db = createServiceClient()
  const now = new Date()

  // Pull all active commitments. Filtering by day-number in SQL is
  // awkward (would need generated column or CASE WHEN) and the active
  // commitment set is small enough that client-side filtering is
  // fine. At 10k active commitments this still returns in <1s.
  const { data: activeCommitments, error: queryErr } = await db
    .from('commitments')
    .select('id, user_id, room_id, status, started_at')
    .eq('status', 'active')
    .returns<CommitmentRow[]>()

  if (queryErr) {
    console.error('[cron/companion-milestones] active-commitments query failed:', queryErr)
    return NextResponse.json(
      { error: 'Failed to load active commitments' },
      { status: 500 }
    )
  }

  const candidates = (activeCommitments ?? []).filter((c) => {
    const day = computeDayNumber(c.started_at, now)
    return (MILESTONE_DAYS as readonly number[]).includes(day)
  })

  // Nothing to do. Return a structured response so cron logs are
  // consistent whether or not there's work.
  if (candidates.length === 0) {
    return NextResponse.json({
      ok: true,
      dry_run: dryRun,
      processed: [],
      candidate_count: 0,
      checked_at: now.toISOString(),
      total_active: activeCommitments?.length ?? 0,
    })
  }

  const processed: ProcessedAction[] = []

  for (const commitment of candidates) {
    const dayNumber = computeDayNumber(commitment.started_at, now) as MilestoneDay
    const action: ProcessedAction = {
      commitment_id: commitment.id,
      room_id: commitment.room_id,
      day_number: dayNumber,
      actions: {},
      notes: [],
    }

    // ---- Idempotency guard 1: milestone-row count match -----------
    //
    // Count existing companion_milestone rows for this commitment.
    // expectedMilestonesSoFar(dayNumber) tells us how many should
    // exist by now. If count >= expected, we've already fired for
    // this day-number boundary (or an earlier one that covers it),
    // so skip the milestone step.
    const { count: existingMilestoneCount, error: countErr } = await db
      .from('room_messages')
      .select('id', { count: 'exact', head: true })
      .eq('commitment_id', commitment.id)
      .eq('message_type', 'companion_milestone')

    if (countErr) {
      console.error('[cron/companion-milestones] milestone-count query failed:', {
        commitmentId: commitment.id,
        error: countErr,
      })
      action.actions.milestone = 'failed'
      action.notes?.push('milestone count query failed')
      processed.push(action)
      continue
    }

    const existingCount = existingMilestoneCount ?? 0
    const expected = expectedMilestonesSoFar(dayNumber)
    const milestoneAlreadyFired = existingCount >= expected

    if (dryRun) {
      action.actions.milestone = milestoneAlreadyFired ? 'skipped_duplicate' : 'fired'
      if (dayNumber === 90) {
        action.actions.summary = 'fired'
        action.actions.status_flip =
          commitment.status === 'active' ? 'fired' : 'skipped_already_completed'
      } else {
        action.actions.summary = 'skipped_not_day_90'
        action.actions.status_flip = 'skipped_not_day_90'
      }
      action.notes?.push(
        `dry-run: existing_milestone_count=${existingCount}, expected=${expected}`
      )
      processed.push(action)
      continue
    }

    // ---- Step 1: milestone marker --------------------------------
    if (!milestoneAlreadyFired) {
      const messageId = await generateCompanionRoomMilestone({
        db,
        roomId: commitment.room_id,
        commitmentId: commitment.id,
        dayNumber,
      })
      if (messageId) {
        action.actions.milestone = 'fired'
        action.milestone_message_id = messageId
      } else {
        action.actions.milestone = 'failed'
        action.notes?.push('generateCompanionRoomMilestone returned null')
        // Hard stop for this commitment: if the milestone didn't
        // land, don't proceed to summary+status flip. Next tick
        // will retry the whole sequence.
        processed.push(action)
        continue
      }
    } else {
      action.actions.milestone = 'skipped_duplicate'
      action.notes?.push(
        `existing_milestone_count=${existingCount} >= expected=${expected}`
      )
    }

    // ---- Steps 2 & 3: day-90 only --------------------------------
    if (dayNumber !== 90) {
      action.actions.summary = 'skipped_not_day_90'
      action.actions.status_flip = 'skipped_not_day_90'
      processed.push(action)
      continue
    }

    // Step 2: summary. Read-only call; the result is discarded. If
    // this fails, log and continue — step 3 is the load-bearing
    // action, and next tick's cron will retry this step because
    // status is still 'active'.
    try {
      const result = await summarizeCommitment(commitment.id)
      if (result.ok) {
        action.actions.summary = 'fired'
        action.notes?.push(
          `summary generated, postCount=${result.postCount}, truncated=${result.truncated}, length=${result.summary.length}chars (not persisted)`
        )
      } else {
        action.actions.summary = 'failed'
        action.notes?.push(`summary error: ${result.error}`)
      }
    } catch (err) {
      console.error('[cron/companion-milestones] summarizeCommitment threw:', {
        commitmentId: commitment.id,
        error: err instanceof Error ? err.message : String(err),
      })
      action.actions.summary = 'failed'
      action.notes?.push('summarizeCommitment threw')
    }

    // Step 3: status flip. WHERE status='active' is the idempotency
    // branch — if the admin endpoint or a prior tick already flipped
    // this, zero rows update and we move on. The load-bearing action.
    const { data: flipped, error: flipErr } = await db
      .from('commitments')
      .update({ status: 'completed', completed_at: now.toISOString() })
      .eq('id', commitment.id)
      .eq('status', 'active')
      .select('id')
      .maybeSingle()

    if (flipErr) {
      console.error('[cron/companion-milestones] status flip failed:', {
        commitmentId: commitment.id,
        error: flipErr,
      })
      action.actions.status_flip = 'failed'
      action.notes?.push(`status flip error: ${flipErr.message}`)
    } else if (flipped) {
      action.actions.status_flip = 'fired'
    } else {
      action.actions.status_flip = 'skipped_already_completed'
    }

    processed.push(action)
  }

  return NextResponse.json({
    ok: true,
    dry_run: dryRun,
    processed,
    candidate_count: candidates.length,
    total_active: activeCommitments?.length ?? 0,
    checked_at: now.toISOString(),
  })
}

// ---------------------------------------------------------------------------
// Flag for future work
// ---------------------------------------------------------------------------
//
// summarizeCommitment is read-only. Every sponsor viewing the
// completion page triggers a fresh Anthropic call. At current scale
// (one live user, few sponsors) this is tolerable. Once sponsor
// traffic to the completion page matters, the right fix is to
// persist the summary — likely a new column on commitments or a
// separate commitment_summaries table, written once on first
// successful generation (from this cron path), read on subsequent
// page views. Punt until there's a reason. Noted in Session 2 log
// of docs/bcd-arc.md so Session 3+ sees it.
