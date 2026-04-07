// ═══════════════════════════════════════════════════
// src/lib/activate/synthesis/verify.ts
//
// Stage 4 of the v1.4 synthesis pipeline.
// For each claim with a cited sourceUrl:
//   1. Fetch the page
//   2. Check whether the claim value text appears in
//      the page content
//   3. If found → mark verified_at + content hash
//   4. If not found → downgrade confidence by 0.3,
//      set verificationFailed = true
//
// This is a HARD COMMITMENT — verification status
// becomes part of the trust system (spec Section 5).
// ═══════════════════════════════════════════════════

import crypto from 'crypto'
import { MergedClaim, MergedSynthesis, VerificationResult } from './types'

// ─── Helpers ──────────────────────────────────────

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex')
}

/**
 * Check if the claim value appears in the page text.
 * We normalize both strings to catch minor formatting differences.
 */
function claimAppearsInText(claimValue: string, pageText: string): boolean {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()

  const normalizedClaim = normalize(claimValue)
  const normalizedPage = normalize(pageText)

  // Exact match
  if (normalizedPage.includes(normalizedClaim)) return true

  // Token overlap: all significant words from claim appear in page
  const claimTokens = normalizedClaim.split(' ').filter(t => t.length > 3)
  if (claimTokens.length === 0) return false

  const tokenMatches = claimTokens.filter(t => normalizedPage.includes(t))
  return tokenMatches.length / claimTokens.length >= 0.75
}

// ─── Fetch page for verification ──────────────────

async function fetchForVerification(url: string): Promise<{
  text: string
  ok: boolean
  error?: string
}> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SearchStarBot/1.0; +https://searchstar.com)',
        Accept: 'text/html,application/xhtml+xml,text/plain',
      },
      next: { revalidate: 0 } as RequestInit,
    } as RequestInit)

    if (!res.ok) {
      return { text: '', ok: false, error: `HTTP ${res.status}` }
    }

    const html = await res.text()

    // Extract visible text
    let text: string
    try {
      const { Readability } = await import('@mozilla/readability')
      const { JSDOM } = await import('jsdom')
      const dom = new JSDOM(html, { url })
      const reader = new Readability(dom.window.document)
      const article = reader.parse()
      text = article?.textContent || ''
    } catch {
      text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
    }

    return {
      text: text.replace(/\s+/g, ' ').trim(),
      ok: true,
    }
  } catch (err) {
    return {
      text: '',
      ok: false,
      error: err instanceof Error ? err.message : 'fetch error',
    }
  }
}

// ─── Verify a single claim ────────────────────────

async function verifyClaim(
  claim: MergedClaim,
  pageCache: Map<string, { text: string; ok: boolean }>
): Promise<MergedClaim> {
  if (!claim.sourceUrl) {
    // No URL to verify — leave unverified, no penalty
    return claim
  }

  const now = new Date().toISOString()

  // Check cache first (multiple claims may cite same page)
  if (!pageCache.has(claim.sourceUrl)) {
    const result = await fetchForVerification(claim.sourceUrl)
    pageCache.set(claim.sourceUrl, result)
  }

  const page = pageCache.get(claim.sourceUrl)!

  if (!page.ok || page.text.length < 50) {
    // Couldn't fetch — downgrade but don't fail hard
    return {
      ...claim,
      confidence: Math.max(0, claim.confidence - 0.15),
      confidenceBeforeVerification: claim.confidence,
      verificationFailed: true,
    }
  }

  const found = claimAppearsInText(claim.value, page.text)

  if (found) {
    return {
      ...claim,
      verifiedAt: now,
      verificationHash: sha256(page.text.slice(0, 10000)),
      confidenceBeforeVerification: claim.confidence,
    }
  } else {
    // URL fetched OK but claim text not found — spec says downgrade by 0.3
    return {
      ...claim,
      confidence: Math.max(0, claim.confidence - 0.3),
      confidenceBeforeVerification: claim.confidence,
      verificationFailed: true,
    }
  }
}

// ─── Verification result summary ──────────────────

export function verificationSummary(claims: MergedClaim[]): {
  total: number
  verified: number
  failed: number
  noUrl: number
  verificationRate: number
} {
  const withUrl = claims.filter(c => c.sourceUrl)
  const verified = claims.filter(c => c.verifiedAt).length
  const failed = claims.filter(c => c.verificationFailed).length
  const noUrl = claims.length - withUrl.length
  return {
    total: claims.length,
    verified,
    failed,
    noUrl,
    verificationRate: withUrl.length > 0 ? verified / withUrl.length : 0,
  }
}

// ─── Main: verify all claims ──────────────────────

export async function verifyClaims(synthesis: MergedSynthesis): Promise<MergedSynthesis> {
  const claimsWithUrls = synthesis.claims.filter(c => c.sourceUrl)
  const claimsWithoutUrls = synthesis.claims.filter(c => !c.sourceUrl)

  if (claimsWithUrls.length === 0) {
    return synthesis
  }

  // Shared page cache — multiple claims may reference the same URL
  const pageCache = new Map<string, { text: string; ok: boolean }>()

  // Verify all URL-backed claims in parallel
  // (page cache handles dedup so same URL isn't fetched twice)
  const verifiedClaims = await Promise.all(
    claimsWithUrls.map(claim => verifyClaim(claim, pageCache))
  )

  const summary = verificationSummary([...verifiedClaims, ...claimsWithoutUrls])
  console.log(
    `[Stage 4] Verification: ${summary.verified}/${summary.total} verified, ` +
    `${summary.failed} failed, ${summary.noUrl} no URL. Rate: ${(summary.verificationRate * 100).toFixed(0)}%`
  )

  return {
    ...synthesis,
    claims: [...verifiedClaims, ...claimsWithoutUrls],
  }
}

export type { VerificationResult }
