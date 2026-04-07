import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { HARDCODED_PRIORS, seedPriorsCache } from '@/lib/activate/synthesis/confidence-priors'

// ═══════════════════════════════════════════════════
// GET /api/activate/confidence-priors
//
// Returns a JSON map of source → learned confidence
// for all sources that have >= 10 observations in
// the source_confidence_priors materialized view.
// Sources with < 10 observations are excluded so
// callers know to use their hardcoded fallback.
//
// Response: { priors: Record<string, number>, sources: SourceDetail[] }
// ═══════════════════════════════════════════════════

interface SourceRow {
  source: string
  total_observations: number
  confirmed_count: number
  corrected_count: number
  removed_count: number
  confirmed_rate: number | null
  removed_rate: number | null
  learned_confidence: number | null
  last_updated: string | null
}

export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('source_confidence_priors')
      .select('*')
      .order('total_observations', { ascending: false })

    if (error) {
      console.error('[confidence-priors] Query error:', error.message)
      // Return hardcoded priors as fallback — never a hard failure
      return NextResponse.json({
        priors: buildPriorsMap([]),
        sources: [],
        fallback: true,
      })
    }

    const rows = (data || []) as SourceRow[]
    const priors = buildPriorsMap(rows)

    // Seed the in-process cache so confidence-priors.ts
    // doesn't need to re-fetch us on the same warm instance
    seedPriorsCache(priors)

    return NextResponse.json({
      priors,
      sources: rows.map(r => ({
        source: r.source,
        totalObservations: Number(r.total_observations),
        confirmedCount: Number(r.confirmed_count),
        correctedCount: Number(r.corrected_count),
        removedCount: Number(r.removed_count),
        confirmedRate: r.confirmed_rate !== null ? Number(r.confirmed_rate) : null,
        removedRate: r.removed_rate !== null ? Number(r.removed_rate) : null,
        learnedConfidence: r.learned_confidence !== null ? Number(r.learned_confidence) : null,
        hardcodedPrior: getHardcodedPrior(r.source),
        effectiveConfidence: r.learned_confidence !== null
          ? Number(r.learned_confidence)
          : getHardcodedPrior(r.source),
        lastUpdated: r.last_updated,
        sufficient: r.learned_confidence !== null,
      })),
    })
  } catch (err) {
    console.error('[confidence-priors] Unexpected error:', err)
    return NextResponse.json({
      priors: buildPriorsMap([]),
      sources: [],
      fallback: true,
    })
  }
}

// ─── Helpers ──────────────────────────────────────

function normalizeSource(s: string): string {
  return s.toLowerCase().split(/[\s\-_.(]/)[0]
}

function getHardcodedPrior(source: string): number {
  const n = normalizeSource(source)
  if (HARDCODED_PRIORS[n] !== undefined) return HARDCODED_PRIORS[n]
  const lower = source.toLowerCase()
  for (const [key, val] of Object.entries(HARDCODED_PRIORS)) {
    if (key !== 'default' && lower.includes(key)) return val
  }
  return HARDCODED_PRIORS.default
}

function buildPriorsMap(rows: SourceRow[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const row of rows) {
    // Only include rows with learned_confidence (>= 10 observations)
    if (row.learned_confidence !== null) {
      const key = normalizeSource(row.source)
      map[key] = Number(row.learned_confidence)
    }
  }
  return map
}
