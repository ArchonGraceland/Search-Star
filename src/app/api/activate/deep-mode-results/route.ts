import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ═══════════════════════════════════════════════════
// GET /api/activate/deep-mode-results
// Returns merged+verified deep mode claims for a
// profile that have source = 'deep-mode'.
// ═══════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const profileId = searchParams.get('profileId')

    if (!profileId) {
      return NextResponse.json({ error: 'profileId required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Fetch deep-mode fields (tagged with source_name = 'deep-mode')
    const { data: fields, error } = await supabase
      .from('profile_fields')
      .select('*')
      .eq('profile_id', profileId)
      .eq('source_name', 'deep-mode')
      .neq('provenance_status', 'removed')
      .order('section')
      .order('sort_order')

    if (error) {
      return NextResponse.json({ error: 'Failed to load deep-mode results' }, { status: 500 })
    }

    // Check if there's a completed deep-mode job + its timing
    const { data: jobs } = await supabase
      .from('background_jobs')
      .select('id, completed_at, started_at, created_at')
      .eq('profile_id', profileId)
      .eq('job_type', 'deep_mode')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)

    const job = jobs?.[0] || null
    const durationMs = job?.started_at && job?.completed_at
      ? new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()
      : null

    return NextResponse.json({
      fields: fields || [],
      count: fields?.length || 0,
      job: job ? {
        completedAt: job.completed_at,
        durationMs,
      } : null,
    })
  } catch (err) {
    console.error('GET /api/activate/deep-mode-results error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
