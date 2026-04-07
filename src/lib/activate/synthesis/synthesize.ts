// ═══════════════════════════════════════════════════
// src/lib/activate/synthesis/synthesize.ts
//
// Stage 3 of the v1.4 synthesis pipeline.
//   a. Two parallel Sonnet calls: one reads the web
//      evidence bundle, one reads Grok's output.
//   b. A third Sonnet merge call: per-claim, take the
//      value from whichever source has higher confidence.
//      If both agree → keep value, conf = max(c1, c2).
//      If only one produced it → keep at original conf,
//      flag as single_source.
//
// Output: MergedSynthesis consumed by Stage 4 verify.
// ═══════════════════════════════════════════════════

import {
  EvidenceBundle,
  SynthesisClaim,
  SynthesisOutput,
  MergedClaim,
  MergedSynthesis,
} from './types'

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const SONNET_MODEL = 'claude-sonnet-4-20250514'

// ─── Shared profile sections ──────────────────────

const SECTIONS = [
  'Identity',
  'Skills',
  'Interests (intellectual)',
  'Interests (athletic)',
  'Interests (social)',
  'Professional History',
]

// ─── Sonnet call helper ───────────────────────────

async function callSonnet(systemPrompt: string, userPrompt: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured')

  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: SONNET_MODEL,
      max_tokens: 2000,
      messages: [{ role: 'user', content: `${systemPrompt}\n\n${userPrompt}` }],
    }),
    next: { revalidate: 0 } as RequestInit,
  } as RequestInit)

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Sonnet API ${res.status}: ${txt.slice(0, 300)}`)
  }

  const data = await res.json()
  return data.content?.[0]?.text || ''
}

// ─── Parse synthesis JSON response ───────────────

function parseSynthesisResponse(raw: string, model: 'claude' | 'grok'): SynthesisOutput {
  const cleaned = raw.replace(/```json|```/g, '').trim()

  let parsed: { narrative?: string; claims?: unknown[] } = {}
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    // Try to extract JSON from within the text
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) {
      try { parsed = JSON.parse(match[0]) } catch {}
    }
  }

  const claims: SynthesisClaim[] = []
  if (Array.isArray(parsed.claims)) {
    for (const raw of parsed.claims) {
      const c = raw as Record<string, unknown>
      if (
        c &&
        typeof c === 'object' &&
        typeof c['section'] === 'string' &&
        typeof c['label'] === 'string' &&
        typeof c['value'] === 'string'
      ) {
        claims.push({
          section: c['section'],
          label: c['label'],
          value: String(c['value']).slice(0, 500),
          confidence: typeof c['confidence'] === 'number'
            ? Math.min(1, Math.max(0, c['confidence']))
            : 0.5,
          sourceUrl: typeof c['sourceUrl'] === 'string' ? c['sourceUrl'] : null,
          sourceLabel: typeof c['sourceLabel'] === 'string' ? c['sourceLabel'] : 'web-search',
        })
      }
    }
  }

  return {
    narrative: typeof parsed.narrative === 'string'
      ? parsed.narrative.slice(0, 600)
      : '',
    claims,
    model,
  }
}

// ─── Synthesis prompt ─────────────────────────────

const SYNTHESIS_SYSTEM = `You are a professional researcher assembling a structured profile about a real person.
Your job is to extract factual claims from the evidence provided and organize them into a structured profile.

Rules:
- Only include claims supported by the evidence
- Be conservative with confidence scores: 0.9 = multiple independent sources agree, 0.7 = one strong source, 0.5 = single mention, uncertain, or could be outdated
- Include the sourceUrl when you have a specific URL for the claim
- Use one of these sections exactly: ${SECTIONS.join(', ')}
- Keep each claim's value concise (under 100 characters)
- Do not invent or speculate — only state what the evidence shows
- If the evidence is thin or the person has low web presence, return fewer claims with lower confidence

Respond ONLY with valid JSON. No markdown, no preamble:
{
  "narrative": "200 words or less biographical summary",
  "claims": [
    {
      "section": "Skills",
      "label": "Python",
      "value": "Python programming",
      "confidence": 0.85,
      "sourceUrl": "https://github.com/username",
      "sourceLabel": "github.com"
    }
  ]
}`

// ─── Synthesize from web evidence ────────────────

async function synthesizeFromWebEvidence(bundle: EvidenceBundle): Promise<SynthesisOutput> {
  const evidenceText = bundle.webResults
    .filter(r => r.bodyText.length > 50 || r.snippet.length > 30)
    .slice(0, 12)
    .map((r, i) =>
      `[Source ${i + 1}] URL: ${r.url}\nTitle: ${r.title}\nSnippet: ${r.snippet}\n${r.bodyText ? `Content: ${r.bodyText.slice(0, 1500)}` : ''}`
    )
    .join('\n\n---\n\n')

  const identityContext = [
    `Name: ${bundle.identity.name}`,
    bundle.identity.employer && `Employer: ${bundle.identity.employer}`,
    bundle.identity.location && `Location: ${bundle.identity.location}`,
    bundle.identity.summary && `Known as: ${bundle.identity.summary}`,
  ].filter(Boolean).join('\n')

  const userPrompt = `Person to profile:
${identityContext}

Web evidence (${bundle.webResults.length} pages fetched):
${evidenceText || '(No substantial web content found for this person)'}`

  const raw = await callSonnet(SYNTHESIS_SYSTEM, userPrompt)
  return parseSynthesisResponse(raw, 'claude')
}

// ─── Synthesize from Grok output ─────────────────

async function synthesizeFromGrokOutput(
  bundle: EvidenceBundle,
  grokText: string
): Promise<SynthesisOutput> {
  const identityContext = [
    `Name: ${bundle.identity.name}`,
    bundle.identity.employer && `Employer: ${bundle.identity.employer}`,
    bundle.identity.location && `Location: ${bundle.identity.location}`,
  ].filter(Boolean).join('\n')

  const userPrompt = `Person to profile:
${identityContext}

Grok's knowledge about this person:
${grokText.slice(0, 3000)}`

  const raw = await callSonnet(SYNTHESIS_SYSTEM, userPrompt)
  return parseSynthesisResponse(raw, 'grok')
}

// ─── Merge logic ──────────────────────────────────

function claimKey(claim: SynthesisClaim): string {
  // Normalize key so "Python" and "python" match
  return `${claim.section.toLowerCase()}::${claim.label.toLowerCase()}`
}

function valuesSimilar(a: string, b: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').trim()
  const na = normalize(a)
  const nb = normalize(b)
  if (na === nb) return true
  // One contains the other (handles "New York" vs "New York, NY")
  if (na.includes(nb) || nb.includes(na)) return true
  return false
}

export async function mergeWithSonnet(
  claudeOutput: SynthesisOutput,
  grokOutput: SynthesisOutput | null,
  identity: { name: string }
): Promise<{ narrative: string; claims: MergedClaim[] }> {
  if (!grokOutput || grokOutput.claims.length === 0) {
    // Only Claude — no merge needed
    return {
      narrative: claudeOutput.narrative,
      claims: claudeOutput.claims.map(c => ({
        ...c,
        singleSource: true,
        mergedFrom: ['claude'],
      })),
    }
  }

  // Build per-claim maps
  const claudeMap = new Map<string, SynthesisClaim>()
  const grokMap = new Map<string, SynthesisClaim>()

  for (const c of claudeOutput.claims) claudeMap.set(claimKey(c), c)
  for (const c of grokOutput.claims) grokMap.set(claimKey(c), c)

  const allKeys = new Set([...claudeMap.keys(), ...grokMap.keys()])
  const merged: MergedClaim[] = []

  for (const key of allKeys) {
    const cc = claudeMap.get(key)
    const gc = grokMap.get(key)

    if (cc && gc) {
      // Both sources produced this claim
      const agree = valuesSimilar(cc.value, gc.value)
      const winner = cc.confidence >= gc.confidence ? cc : gc
      merged.push({
        ...winner,
        confidence: agree
          ? Math.max(cc.confidence, gc.confidence)
          : Math.max(cc.confidence, gc.confidence) * 0.9, // slight penalty for disagreement
        singleSource: false,
        mergedFrom: ['claude', 'grok'],
      })
    } else if (cc) {
      merged.push({ ...cc, singleSource: true, mergedFrom: ['claude'] })
    } else if (gc) {
      // Grok-only claims get slightly lower base confidence since we can't verify against web
      merged.push({
        ...gc!,
        confidence: gc!.confidence * 0.85,
        singleSource: true,
        mergedFrom: ['grok'],
      })
    }
  }

  // Merge narratives with a quick Sonnet call
  const key = process.env.ANTHROPIC_API_KEY
  let narrative = claudeOutput.narrative

  if (key && claudeOutput.narrative && grokOutput.narrative) {
    try {
      const raw = await callSonnet(
        `You are combining two biographical summaries into one authoritative 150-200 word paragraph about ${identity.name}. 
Be factual, professional, and third-person. Respond with ONLY the paragraph — no JSON, no preamble.`,
        `Summary A:\n${claudeOutput.narrative}\n\nSummary B:\n${grokOutput.narrative}`
      )
      narrative = raw.trim().slice(0, 600)
    } catch {
      // Fall back to Claude's narrative
    }
  }

  return { narrative, claims: merged }
}

// ─── Main: run synthesis ──────────────────────────

export async function runSynthesis(bundle: EvidenceBundle): Promise<MergedSynthesis> {
  // Run both synthesis calls in parallel
  const [claudeResult, grokResult] = await Promise.allSettled([
    synthesizeFromWebEvidence(bundle),
    bundle.grokResponse
      ? synthesizeFromGrokOutput(bundle, bundle.grokResponse)
      : Promise.resolve(null),
  ])

  const claudeOutput: SynthesisOutput =
    claudeResult.status === 'fulfilled'
      ? claudeResult.value
      : { narrative: '', claims: [], model: 'claude' }

  const grokOutput: SynthesisOutput | null =
    grokResult.status === 'fulfilled' ? grokResult.value : null

  const { narrative, claims } = await mergeWithSonnet(
    claudeOutput,
    grokOutput,
    bundle.identity
  )

  return {
    narrative,
    claims,
    claudeNarrative: claudeOutput.narrative,
    grokNarrative: grokOutput?.narrative || null,
    mergedAt: new Date().toISOString(),
  }
}
