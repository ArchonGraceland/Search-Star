import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ═══════════════════════════════════════════════════
// POST /api/activate/deep-mode  — enqueue a deep-mode job
// GET  /api/activate/deep-mode  — poll job status
// ═══════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      profileId: string
      lockedIdentity: Record<string, unknown>
    }
    const { profileId, lockedIdentity } = body

    if (!profileId || !lockedIdentity) {
      return NextResponse.json({ error: 'profileId and lockedIdentity required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Insert background job — runs after 30s
    const { data, error } = await supabase
      .from('background_jobs')
      .insert({
        job_type: 'deep_mode',
        profile_id: profileId,
        payload: { lockedIdentity },
        status: 'pending',
        run_after: new Date(Date.now() + 30_000).toISOString(),
      })
      .select('id')
      .single()

    if (error) {
      console.error('Enqueue deep-mode job error:', error)
      return NextResponse.json({ error: 'Failed to enqueue job' }, { status: 500 })
    }

    return NextResponse.json({ success: true, jobId: data.id })
  } catch (err) {
    console.error('POST /api/activate/deep-mode error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const profileId = searchParams.get('profileId')
    const jobId = searchParams.get('jobId')

    if (!profileId && !jobId) {
      return NextResponse.json({ error: 'profileId or jobId required' }, { status: 400 })
    }

    const supabase = await createClient()

    let query = supabase
      .from('background_jobs')
      .select('id, status, started_at, completed_at, error, created_at')
      .eq('job_type', 'deep_mode')
      .order('created_at', { ascending: false })
      .limit(1)

    if (jobId) {
      query = query.eq('id', jobId)
    } else {
      query = query.eq('profile_id', profileId!)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: 'Failed to query job status' }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ status: 'not_found' })
    }

    return NextResponse.json({ job: data[0] })
  } catch (err) {
    console.error('GET /api/activate/deep-mode error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
