// ═══════════════════════════════════════════════════
// src/lib/activate/synthesis/confidence-priors.ts
//
// Phase 14 — Learned confidence priors.
// Loads per-source accuracy rates from the
// source_confidence_priors materialized view,
// falling back to hardcoded values when there
// are fewer than 10 observations for a source.
//
// Caches the full priors map in-process for 5 min
// to avoid hitting the DB on every field save.
// ═══════════════════════════════════════════════════

// ─── Hardcoded fallback priors ────────────────────
// Used when a source has < 10 corrections observations
// or when the DB is unavailable.

export const HARDCODED_PRIORS: Record<string, number> = {
  github: 0.9,
  scholar: 0.85,
  calbar: 0.8,
  nysed: 0.8,
  aicpa: 0.8,
  npi: 0.8,
  athlinks: 0.75,
  runsignup: 0.75,
  linkedin: 0.7,
  meetup: 0.65,
  'user-input': 0.5,
  default: 0.6,
}

// ─── In-process cache ─────────────────────────────

interface PriorsCache {
  priors: Record<string, number>
  loadedAt: number
}

let priorsCache: PriorsCache | null = null
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

// ─── Normalize source name ────────────────────────
// "GitHub (API)" → "github", "Google Scholar" → "google"
// We match on lowercase first token to be consistent
// with how the hardcoded priors are keyed.

function normalizeSource(sourceName: string): string {
  return sourceName.toLowerCase().split(/[\s\-_.(]/)[0]
}

// ─── Load priors from DB via internal API ─────────

async function loadPriorsFromDB(): Promise<Record<string, number>> {
  try {
    // Call our own internal API route (avoids importing supabase client
    // which requires cookies/headers context we may not have here)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.searchstar.com'
    const res = await fetch(`${baseUrl}/api/activate/confidence-priors`, {
      signal: AbortSignal.timeout(5_000),
      headers: { 'x-internal': '1' },
    })
    if (!res.ok) return {}
    const data = await res.json() as { priors?: Record<string, number> }
    return data.priors || {}
  } catch {
    return {}
  }
}

// ─── Refresh cache if stale ───────────────────────

async function ensureFresh(): Promise<Record<string, number>> {
  const now = Date.now()
  if (priorsCache && now - priorsCache.loadedAt < CACHE_TTL_MS) {
    return priorsCache.priors
  }

  const learned = await loadPriorsFromDB()
  priorsCache = { priors: learned, loadedAt: now }
  return learned
}

// ─── Public API ───────────────────────────────────

/**
 * Returns the confidence prior for a given source name.
 * Uses the learned rate from discovery_corrections if ≥ 10
 * observations exist; otherwise falls back to the hardcoded prior.
 */
export async function getConfidencePrior(sourceName: string): Promise<number> {
  const normalized = normalizeSource(sourceName || '')
  const learned = await ensureFresh()

  // Prefer learned value if present (DB already filtered for >= 10 obs)
  if (learned[normalized] !== undefined) {
    return learned[normalized]
  }

  // Fall back to hardcoded prior — exact match first, then substring scan
  if (HARDCODED_PRIORS[normalized] !== undefined) {
    return HARDCODED_PRIORS[normalized]
  }

  // Substring scan for compound source names (e.g. "github-api" → github)
  const lower = (sourceName || '').toLowerCase()
  for (const [key, val] of Object.entries(HARDCODED_PRIORS)) {
    if (key !== 'default' && lower.includes(key)) return val
  }

  return HARDCODED_PRIORS.default
}

/**
 * Invalidate the in-process cache (called after cron refreshes the view).
 */
export function invalidatePriorsCache(): void {
  priorsCache = null
}

/**
 * Returns the raw in-process cache (used by the API route to avoid
 * circular fetch when the API route itself calls loadPriorsFromDB).
 */
export function getCachedPriors(): Record<string, number> | null {
  if (!priorsCache) return null
  const now = Date.now()
  if (now - priorsCache.loadedAt >= CACHE_TTL_MS) return null
  return priorsCache.priors
}

/**
 * Directly seed the in-process cache from a DB result set.
 * Called by the API route so it doesn't need to re-fetch itself.
 */
export function seedPriorsCache(priors: Record<string, number>): void {
  priorsCache = { priors, loadedAt: Date.now() }
}
