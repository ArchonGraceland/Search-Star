import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runDeepMode } from '@/lib/activate/synthesis/deep-mode'
import { verifyClaims } from '@/lib/activate/synthesis/verify'
import { LockedIdentity } from '@/lib/activate/synthesis/types'

// ═══════════════════════════════════════════════════
// GET /api/cron/deep-mode
// Vercel cron — fires every minute.
// Picks ONE pending deep-mode job, runs it, saves
// results to profile_fields, creates a feed item.
//
// Auth: Authorization: Bearer <CRON_SECRET>
// ═══════════════════════════════════════════════════

const CRON_SECRET = process.env.CRON_SECRET

export async function GET(request: NextRequest) {
  // ── Authenticate ──────────────────────────────
  const auth = request.headers.get('authorization') || ''
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  // ── Claim one pending job ─────────────────────
  // Use update-where-status=pending to avoid races
  const { data: jobs, error: pickErr } = await supabase
    .from('background_jobs')
    .select('*')
    .eq('job_type', 'deep_mode')
    .eq('status', 'pending')
    .lte('run_after', new Date().toISOString())
    .order('run_after')
    .limit(1)

  if (pickErr) {
    console.error('[cron/deep-mode] Query error:', pickErr)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  if (!jobs || jobs.length === 0) {
    return NextResponse.json({ ok: true, message: 'No pending jobs' })
  }

  const job = jobs[0]

  // Mark as running (optimistic — if two crons overlap, second will see 'running')
  const { error: updateErr } = await supabase
    .from('background_jobs')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', job.id)
    .eq('status', 'pending') // guard against race

  if (updateErr) {
    console.error('[cron/deep-mode] Mark running error:', updateErr)
    return NextResponse.json({ error: 'Failed to claim job' }, { status: 500 })
  }

  const startedAt = Date.now()

  try {
    const payload = job.payload as {
      lockedIdentity: LockedIdentity
    }
    const profileId: string = job.profile_id

    // Load existing profile fields (for merge precedence)
    const { data: existingFields } = await supabase
      .from('profile_fields')
      .select('label, section, provenance_status, confidence_score')
      .eq('profile_id', profileId)

    // Run deep mode agent
    const { synthesis, iterations, elapsedMs } = await runDeepMode(
      payload.lockedIdentity,
      existingFields || []
    )

    // Run Stage 4 verification on deep-mode claims
    const verified = await verifyClaims(synthesis)

    // Persist new claims to profile_fields
    if (verified.claims.length > 0) {
      const rows = verified.claims.map((claim, i) => ({
        profile_id: profileId,
        section: claim.section,
        label: claim.label,
        value: claim.value,
        source_name: 'deep-mode',
        source_url: claim.sourceUrl || null,
        confidence_score: claim.confidence,
        provenance_status: 'seeded',
        sort_order: 1000 + i,
        seeded_at: new Date().toISOString(),
        verified_at: claim.verifiedAt || null,
        verification_hash: claim.verificationHash || null,
        verification_failed: claim.verificationFailed || false,
        confidence_before_verification: claim.confidenceBeforeVerification || null,
      }))

      const { error: insertErr } = await supabase
        .from('profile_fields')
        .insert(rows)

      if (insertErr) {
        console.error('[cron/deep-mode] Insert fields error:', insertErr)
        throw new Error(`Failed to save fields: ${insertErr.message}`)
      }
    }

    const elapsedTotal = Date.now() - startedAt

    // Create feed item
    await supabase.from('feed_items').insert({
      profile_id: profileId,
      item_type: 'deep_mode_complete',
      title: 'Deep mode research complete',
      body: `Found ${verified.claims.length} additional claims in ${Math.round(elapsedMs / 1000)}s across ${iterations} search iterations.`,
      action_url: `/activate?deepReady=1&profileId=${profileId}`,
    })

    // Mark job completed
    await supabase
      .from('background_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        payload: {
          ...job.payload,
          result: {
            claimsFound: verified.claims.length,
            iterations,
            elapsedMs: elapsedTotal,
          },
        },
      })
      .eq('id', job.id)

    console.log(
      `[cron/deep-mode] Job ${job.id} completed: ${verified.claims.length} claims, ` +
      `${iterations} iters, ${elapsedTotal}ms`
    )

    return NextResponse.json({
      ok: true,
      jobId: job.id,
      claimsFound: verified.claims.length,
      iterations,
      elapsedMs: elapsedTotal,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    console.error('[cron/deep-mode] Job failed:', msg)

    await supabase
      .from('background_jobs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error: msg.slice(0, 1000),
      })
      .eq('id', job.id)

    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
