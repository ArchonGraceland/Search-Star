// ═══════════════════════════════════════════════════
// src/lib/activate/synthesis/types.ts
//
// Shared types for the v1.4 synthesis pipeline.
// Used across evidence-gathering, synthesis, and
// verification stages.
// ═══════════════════════════════════════════════════

// ─── Identity constraints from Phase 11 ───────────

export interface LockedIdentity {
  candidateId: string
  name: string
  employer?: string
  location?: string
  photoUrl?: string
  summary: string
  sourceUrls: string[]
  confidence: number
  lockedAt?: string
}

// ─── Stage 2: Evidence Bundle ─────────────────────

export interface WebResult {
  url: string
  title: string
  snippet: string
  bodyText: string      // readability-extracted main content (~2000 chars)
  fetchedAt: string
  fetchOk: boolean
}

export interface EvidenceBundle {
  identity: LockedIdentity
  searchQuery: string
  webResults: WebResult[]         // top ~15 fetched pages
  grokResponse: string | null     // raw text from Grok single-shot, or null if unavailable
  gatheredAt: string
}

// ─── Stage 3: Synthesis ───────────────────────────

export interface SynthesisClaim {
  section: string           // 'Identity', 'Skills', 'Interests (athletic)', etc.
  label: string             // 'Employer', 'Python', 'Marathon', etc.
  value: string
  confidence: number        // 0-1
  sourceUrl: string | null  // URL where this claim was found (for Stage 4 verification)
  sourceLabel: string       // display name of the source
  reasoning?: string        // brief explanation (may be omitted to reduce tokens)
}

export interface SynthesisOutput {
  narrative: string         // 200-word bio paragraph
  claims: SynthesisClaim[]
  model: 'claude' | 'grok'
}

export interface MergedClaim extends SynthesisClaim {
  singleSource: boolean     // true if only one model produced this claim
  mergedFrom: ('claude' | 'grok')[]
  // Verification fields — populated in Stage 4
  verifiedAt?: string
  verificationHash?: string       // sha256 of page content at verification time
  verificationFailed?: boolean    // true if URL fetch succeeded but claim text not found
  confidenceBeforeVerification?: number  // stored so we know what was downgraded
}

export interface MergedSynthesis {
  narrative: string
  claims: MergedClaim[]
  claudeNarrative: string
  grokNarrative: string | null
  mergedAt: string
}

// ─── Stage 4: Verification ────────────────────────

export interface VerificationResult {
  url: string
  found: boolean
  contentHash?: string
  verifiedAt: string
  error?: string
}
