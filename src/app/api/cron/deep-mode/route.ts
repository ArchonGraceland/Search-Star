import { NextResponse } from 'next/server'

// Retired endpoint.
//
// The /api/cron/deep-mode schedule was registered against the main-branch
// vercel.json when v3 shipped. v4 dropped the deep-mode feature entirely —
// the route handler is gone from the v4 source tree — but Vercel's cron
// registry is populated from the target:production deployment, which is
// still the last main-branch push. Until that registration is cleared (by
// promoting a v4 deploy to target:production, or by re-merging to main
// with the crons array removed), Vercel will keep invoking this path
// every minute.
//
// This stub exists to turn that noise into a 200 no-op instead of a 500
// loop filling runtime logs. It is safe to delete once the production
// cron registration is cleared.

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ ok: true, retired: true })
}
