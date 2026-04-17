// Trust Record computation — v4 Phase 6.
//
// Per docs/v4-decisions.md §6 and spec §6, a practitioner's Trust Record is
// built from COMPLETED sponsored streaks. "Completed" means every sponsor who
// pledged at any point in the commitment released payment at day 90. A
// streak that ended via veto, sponsor withdrawal, or silence contributes
// NOTHING. There are no validator or mentor inputs in v4.
//
// A completed-for-Trust streak is defined strictly at the sponsorship level:
// every sponsorship on the commitment must be in status 'released' or 'paid'.
// If ANY sponsorship ended in 'vetoed' or 'refunded', the streak did not
// complete — even if commitments.status somehow says 'completed'. The
// sponsorship-level check is the source of truth because the no-escape-hatch
// principle (v4-decisions) means a single lost sponsor ends the streak.
//
// Three dimensions:
//   Depth       — sum of streak weights across all completed sponsored streaks,
//                 where each streak weight reflects sponsor count, diversity,
//                 and reliability
//   Breadth     — count of distinct skill categories across completed streaks
//   Durability  — calendar days between the oldest completed streak's
//                 streak_starts_at and the most recent's completed_at
//
// All numbers here are v1 CALIBRATIONS — notional until real completion data
// accumulates. The algorithm is intentionally transparent so that admins can
// audit it by reading the source.

import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing and for sanity in the release hook)
// ---------------------------------------------------------------------------

/**
 * Sponsor count factor. More sponsors on a streak => more credibility that
 * real people across real relationships stayed convinced through 90 days.
 * Range 0.5 (one sponsor) to 1.5 (five or more sponsors).
 *
 * v1 calibration: linear ramp from 1 -> 5, then flat. First-sponsor streaks
 * still count (0.5), just less than multi-sponsor ones.
 */
export function sponsorCountFactor(n: number): number {
  if (n <= 0) return 0
  if (n === 1) return 0.5
  if (n >= 5) return 1.5
  // n in {2, 3, 4}: 0.75, 1.0, 1.25
  return 0.5 + ((n - 1) / 4) * 1.0
}

/**
 * Sponsor diversity factor. Distinct sponsor-email domains is a rough proxy
 * for "sponsors across multiple social circles" since we don't have explicit
 * relationship metadata. A streak where every sponsor uses @gmail.com gets
 * 0.8; a streak with sponsors across 3+ domains gets 1.2.
 *
 * v1 calibration: the domain-as-circle heuristic is imperfect (family sharing
 * one domain, colleagues sharing one domain, etc.) but it's directionally
 * correct and doesn't require any extra data. Expect to improve when
 * sponsor-relationship signals become available.
 */
export function sponsorDiversityFactor(distinctDomains: number): number {
  if (distinctDomains <= 0) return 0.8
  if (distinctDomains >= 3) return 1.2
  // 1 domain -> 0.8, 2 domains -> 1.0
  return 0.8 + (distinctDomains - 1) * 0.2
}

/**
 * Sponsor reliability factor for a streak. Input is the AVERAGE reliability
 * score across all the streak's sponsors, each score in [0, 1]. Maps that
 * average to a factor in [0.7, 1.3].
 *
 * v1 calibration: neutral at 0.5 (neutral avg) maps to 1.0; linear either
 * direction. A streak witnessed by sponsors who collectively have a strong
 * track record of releasing payment when warranted carries more signal.
 */
export function sponsorReliabilityFactor(avgReliability: number): number {
  const clamped = Math.max(0, Math.min(1, avgReliability))
  // 0 -> 0.7, 0.5 -> 1.0, 1 -> 1.3
  return 0.7 + clamped * 0.6
}

/**
 * Individual sponsor reliability. Ratio of good releases to total
 * consequential participations (released + vetoed + refunded). Bounded [0, 1].
 *
 * First-time-ish sponsors (total < 2 consequential participations) return 0.5
 * neutral, NOT 0 — so a brand-new sponsor isn't treated as unreliable just
 * for being new. As their history accumulates the score converges to the
 * true ratio.
 */
export function sponsorReliabilityScore(
  released: number,
  vetoed: number,
  refunded: number,
): number {
  const total = released + vetoed + refunded
  if (total < 2) return 0.5
  return released / total
}

/**
 * Assign a Trust growth stage from the three dimensions + completed streak
 * count. Precedence: Mature -> Established -> Growing -> Rooting -> Seedling.
 * Returns the first match.
 *
 * v1 calibration thresholds (document as such, expect to retune):
 *   Seedling     default / 0 completed streaks
 *   Rooting      1 completed streak
 *   Growing      2-3 streaks across >=2 categories, OR 3+ streaks in one category
 *   Established  4+ streaks across >=2 categories, >=18 months durability (547 days)
 *   Mature       8+ streaks across >=3 categories, >=36 months durability (1095 days)
 *
 * Breadth gates the top two stages deliberately: a practitioner with 10
 * streaks in one category is Growing, not Mature. The Trust Record values
 * wholeness of development, not specialization volume.
 */
export function assignTrustStage(args: {
  completedStreaks: number
  breadth: number // distinct categories
  durabilityDays: number
}): 'seedling' | 'rooting' | 'growing' | 'established' | 'mature' {
  const { completedStreaks, breadth, durabilityDays } = args

  if (completedStreaks >= 8 && breadth >= 3 && durabilityDays >= 1095) {
    return 'mature'
  }
  if (completedStreaks >= 4 && breadth >= 2 && durabilityDays >= 547) {
    return 'established'
  }
  if ((completedStreaks >= 2 && breadth >= 2) || completedStreaks >= 3) {
    return 'growing'
  }
  if (completedStreaks >= 1) {
    return 'rooting'
  }
  return 'seedling'
}

/**
 * Email domain extractor. Lowercase + trim. Returns '' for anything that
 * doesn't look like an email; the caller can treat those as a single
 * "unknown" bucket rather than counting each as distinct.
 */
export function emailDomain(email: string | null | undefined): string {
  if (!email) return ''
  const trimmed = email.trim().toLowerCase()
  const at = trimmed.lastIndexOf('@')
  if (at < 0 || at === trimmed.length - 1) return ''
  return trimmed.slice(at + 1)
}

// ---------------------------------------------------------------------------
// Main compute
// ---------------------------------------------------------------------------

export interface CompletedStreakSummary {
  commitment_id: string
  practice_name: string | null
  category_id: string | null
  streak_starts_at: string | null
  completed_at: string | null
  sponsor_count: number
  distinct_domains: number
  avg_reliability: number
  weight: number
}

export interface TrustComputeResult {
  stage: 'seedling' | 'rooting' | 'growing' | 'established' | 'mature'
  depth_score: number
  breadth_score: number
  durability_score: number
  completed_streaks: number
  // Transparent inputs — surfaced to the dashboard and useful for debugging.
  streak_details: CompletedStreakSummary[]
}

/**
 * Compute a user's Trust Record inputs and result. Does NOT write to the DB
 * — callers decide when to upsert trust_records and profiles.trust_stage.
 *
 * This function uses whatever SupabaseClient it's given. In the /api/trust/compute
 * route we use the user-scoped RLS client (which returns only the caller's
 * data). In the release-action hook we use the service client (RLS bypass,
 * because we're computing on behalf of the practitioner).
 */
export async function computeTrustForUser(
  db: SupabaseClient,
  userId: string,
): Promise<TrustComputeResult> {
  // Fetch all the user's commitments with their practice + category join.
  // We filter to status='completed' but verify at the sponsorship level below
  // for belt-and-suspenders correctness per the no-escape-hatch principle.
  const { data: commitments } = await db
    .from('commitments')
    .select(
      'id, status, streak_starts_at, completed_at, practice_id, practices(id, name, category_id)',
    )
    .eq('user_id', userId)
    .eq('status', 'completed')

  if (!commitments || commitments.length === 0) {
    return {
      stage: 'seedling',
      depth_score: 0,
      breadth_score: 0,
      durability_score: 0,
      completed_streaks: 0,
      streak_details: [],
    }
  }

  // Fetch all sponsorships for these commitments so we can
  //   (a) filter out commitments where any sponsorship was vetoed/refunded
  //   (b) compute sponsor_count and distinct_domains per streak
  //   (c) collect sponsor identities for reliability computation
  const commitmentIds = commitments.map((c) => c.id)
  const { data: sponsorships } = await db
    .from('sponsorships')
    .select('id, commitment_id, status, sponsor_email, sponsor_user_id')
    .in('commitment_id', commitmentIds)

  const sponsorshipsByCommitment = new Map<string, typeof sponsorships>()
  for (const s of sponsorships ?? []) {
    const arr = sponsorshipsByCommitment.get(s.commitment_id) ?? []
    arr.push(s)
    sponsorshipsByCommitment.set(s.commitment_id, arr)
  }

  // Collect every sponsor identity we'll need a reliability score for.
  // Key preference: sponsor_user_id when present, otherwise lowercased email.
  // Falls back to email because many sponsors don't have accounts.
  const sponsorKeys = new Set<string>()
  const sponsorKeyOf = (s: {
    sponsor_user_id: string | null
    sponsor_email: string | null
  }): string | null => {
    if (s.sponsor_user_id) return `uid:${s.sponsor_user_id}`
    if (s.sponsor_email) return `em:${s.sponsor_email.trim().toLowerCase()}`
    return null
  }

  for (const arr of sponsorshipsByCommitment.values()) {
    for (const s of arr ?? []) {
      const key = sponsorKeyOf(s)
      if (key) sponsorKeys.add(key)
    }
  }

  // Build the reliability cache by querying the full history of each sponsor
  // in one shot. We grab ALL consequential sponsorships (released/paid/vetoed/
  // refunded) across the whole platform for these sponsors.
  //
  // We do two parallel queries: one by sponsor_user_id (accounted sponsors)
  // and one by sponsor_email (unaccounted sponsors). Union the results into
  // the cache.
  const reliabilityCache = new Map<string, number>()

  if (sponsorKeys.size > 0) {
    const userIds: string[] = []
    const emails: string[] = []
    for (const key of sponsorKeys) {
      if (key.startsWith('uid:')) userIds.push(key.slice(4))
      else if (key.startsWith('em:')) emails.push(key.slice(3))
    }

    // Pull every consequential sponsorship for these sponsors.
    // 'pledged' doesn't count — it hasn't reached a decision point.
    const CONSEQUENTIAL = ['released', 'paid', 'vetoed', 'refunded']

    // Accumulate per-sponsor-key: { released, vetoed, refunded }
    const counts = new Map<string, { released: number; vetoed: number; refunded: number }>()

    async function tally(
      column: 'sponsor_user_id' | 'sponsor_email',
      values: string[],
    ) {
      if (values.length === 0) return
      const { data } = await db
        .from('sponsorships')
        .select('sponsor_user_id, sponsor_email, status')
        .in(column, values)
        .in('status', CONSEQUENTIAL)
      for (const row of data ?? []) {
        const key = sponsorKeyOf(row)
        if (!key) continue
        const bucket = counts.get(key) ?? { released: 0, vetoed: 0, refunded: 0 }
        if (row.status === 'released' || row.status === 'paid') bucket.released++
        else if (row.status === 'vetoed') bucket.vetoed++
        else if (row.status === 'refunded') bucket.refunded++
        counts.set(key, bucket)
      }
    }

    await Promise.all([
      tally('sponsor_user_id', userIds),
      tally('sponsor_email', emails),
    ])

    for (const key of sponsorKeys) {
      const c = counts.get(key) ?? { released: 0, vetoed: 0, refunded: 0 }
      reliabilityCache.set(
        key,
        sponsorReliabilityScore(c.released, c.vetoed, c.refunded),
      )
    }
  }

  // Per-commitment summary.
  type PracticeJoin = { id: string; name: string | null; category_id: string | null }
  const streakDetails: CompletedStreakSummary[] = []
  const categorySet = new Set<string>()
  let depthTotal = 0

  for (const c of commitments) {
    const streakSponsorships = sponsorshipsByCommitment.get(c.id) ?? []

    // Guard: if any sponsorship on this commitment is vetoed or refunded,
    // the streak did NOT complete for Trust purposes. Skip it. This is
    // belt-and-suspenders — commitment status should already reflect this,
    // but the sponsorship-level check is the spec-correct source of truth.
    const hasFailure = (streakSponsorships ?? []).some(
      (s) => s.status === 'vetoed' || s.status === 'refunded',
    )
    if (hasFailure) continue

    // Only count sponsorships that actually landed (released/paid) as the
    // roster of witnesses. A streak with zero released sponsorships somehow
    // marked complete would contribute zero weight.
    const releasedSponsorships = (streakSponsorships ?? []).filter(
      (s) => s.status === 'released' || s.status === 'paid',
    )

    const sponsorCount = releasedSponsorships.length

    const domainSet = new Set<string>()
    let reliabilitySum = 0
    let reliabilityN = 0
    for (const s of releasedSponsorships) {
      const domain = emailDomain(s.sponsor_email)
      if (domain) domainSet.add(domain)
      const key = sponsorKeyOf(s)
      if (key) {
        reliabilitySum += reliabilityCache.get(key) ?? 0.5
        reliabilityN++
      }
    }
    const distinctDomains = domainSet.size
    const avgReliability = reliabilityN > 0 ? reliabilitySum / reliabilityN : 0.5

    const weight =
      1 *
      sponsorCountFactor(sponsorCount) *
      sponsorDiversityFactor(distinctDomains) *
      sponsorReliabilityFactor(avgReliability)

    depthTotal += weight

    // Supabase typings treat the joined practices record as possibly-array;
    // normalize it to a single object for our local use.
    const raw = (c as unknown as { practices?: PracticeJoin | PracticeJoin[] }).practices
    const practice: PracticeJoin | null = Array.isArray(raw) ? raw[0] ?? null : raw ?? null
    if (practice?.category_id) categorySet.add(practice.category_id)

    streakDetails.push({
      commitment_id: c.id,
      practice_name: practice?.name ?? null,
      category_id: practice?.category_id ?? null,
      streak_starts_at: c.streak_starts_at,
      completed_at: c.completed_at,
      sponsor_count: sponsorCount,
      distinct_domains: distinctDomains,
      avg_reliability: avgReliability,
      weight,
    })
  }

  // Durability: calendar days between the oldest completed streak start and
  // the most recent completed streak's completed_at. A single streak ends up
  // at ~90 days.
  let durabilityDays = 0
  if (streakDetails.length > 0) {
    const starts = streakDetails
      .map((s) => s.streak_starts_at)
      .filter((x): x is string => !!x)
      .map((s) => new Date(s).getTime())
    const ends = streakDetails
      .map((s) => s.completed_at)
      .filter((x): x is string => !!x)
      .map((s) => new Date(s).getTime())
    if (starts.length > 0 && ends.length > 0) {
      const oldestStart = Math.min(...starts)
      const latestEnd = Math.max(...ends)
      durabilityDays = Math.max(0, (latestEnd - oldestStart) / (1000 * 60 * 60 * 24))
    }
  }

  const completedStreaks = streakDetails.length
  const breadth = categorySet.size

  const stage = assignTrustStage({
    completedStreaks,
    breadth,
    durabilityDays,
  })

  // Round for stable storage. We intentionally DO NOT round depth_score to an
  // integer — the fractional weight is the whole point of the algorithm.
  return {
    stage,
    depth_score: Math.round(depthTotal * 100) / 100,
    breadth_score: breadth,
    durability_score: Math.round(durabilityDays * 10) / 10,
    completed_streaks: completedStreaks,
    streak_details: streakDetails,
  }
}

/**
 * Compute + persist. The single write path: trust_records upsert +
 * profiles.trust_stage sync. Returns the result for callers that want to use
 * it immediately (e.g. to render a response).
 */
export async function computeAndPersistTrust(
  db: SupabaseClient,
  userId: string,
): Promise<TrustComputeResult> {
  const result = await computeTrustForUser(db, userId)

  const { error: upsertError } = await db
    .from('trust_records')
    .upsert(
      {
        user_id: userId,
        stage: result.stage,
        depth_score: result.depth_score,
        breadth_score: result.breadth_score,
        durability_score: result.durability_score,
        completed_streaks: result.completed_streaks,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

  if (upsertError) {
    // Surface to caller. The release hook catches and logs; the /api/trust
    // route returns 500.
    throw upsertError
  }

  await db.from('profiles').update({ trust_stage: result.stage }).eq('user_id', userId)

  return result
}
