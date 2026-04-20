import { NextResponse } from 'next/server'

// v4 Decision #8 retires the start ritual. A commitment's streak begins
// immediately at declaration; there is no 14-day launch window between
// creation and start, and no ritual statement post. This endpoint returns
// 410 Gone so any stale clients call it once, see a clear response, and
// stop. New clients route commitment creation straight through
// POST /api/commitments which creates the commitment in 'active' status.
export async function POST() {
  return NextResponse.json({
    error: 'Start ritual retired in v4. Declaration starts the streak.',
  }, { status: 410 })
}
