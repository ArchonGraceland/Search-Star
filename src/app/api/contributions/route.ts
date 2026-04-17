import { NextResponse } from 'next/server'

// Retired in v4 — the v3 four-way mentor-share split (mentor/coach/cb/pl) is
// gone along with the mentor role system. Phase 4 rebuilds this as a single
// voluntary donation to Search Star at 5% default. Until then this endpoint
// returns 501 so any caller gets a clear signal instead of a column-not-found
// crash from the dropped mentor_share / coach_share / cb_share / pl_share
// columns on the contributions table.

export async function POST() {
  return NextResponse.json(
    { error: 'Voluntary contributions are being rebuilt for v4. This endpoint is temporarily retired.' },
    { status: 501 },
  )
}
