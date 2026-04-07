import { NextRequest, NextResponse } from 'next/server'
import { runIdentityLock, IdentityLockInput } from '@/lib/activate/identity-lock'

// ═══════════════════════════════════════════════════
// POST /api/activate/identity-lock
//
// Stage 1 of the v1.4 synthesis architecture.
// Takes identifying details, runs one broad SerpAPI
// web search, fetches top 10 results, asks Claude
// Haiku to group them into 3-5 distinct personas.
// Returns candidates for the user to pick from.
// ═══════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const body: IdentityLockInput = await request.json()
    const { fullName, employer, city, linkedinUrl } = body

    if (!fullName?.trim()) {
      return NextResponse.json({ error: 'fullName is required' }, { status: 400 })
    }

    const result = await runIdentityLock({ fullName, employer, city, linkedinUrl })

    return NextResponse.json({
      candidates: result.candidates,
      searchQuery: result.searchQuery,
      resultsConsidered: result.resultsConsidered,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Identity lock error:', message)
    return NextResponse.json({ error: 'Identity lock failed', details: message }, { status: 500 })
  }
}
