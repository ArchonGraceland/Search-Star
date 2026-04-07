// ═══════════════════════════════════════════════════
// src/lib/activate/synthesis/deep-mode.ts
//
// Phase 13 — Deep Mode research agent.
// Runs a tool-use loop (web_search via SerpAPI +
// web_fetch) against the locked identity, focusing
// on gaps left by standard-mode synthesis.
//
// Returns MergedSynthesis, then caller passes it
// through verifyClaims() unchanged (Stage 4 reuse).
// ═══════════════════════════════════════════════════

import { LockedIdentity, MergedSynthesis, MergedClaim, SynthesisClaim } from './types'
import { getConfidencePrior } from './confidence-priors'

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const SONNET_MODEL = 'claude-sonnet-4-20250514'
const MAX_ITERATIONS = 10
const MAX_ELAPSED_MS = 90_000

// ─── Tool definitions ──────────────────────────────

const TOOLS = [
  {
    name: 'web_search',
    description: 'Search the web for information about a person. Returns search result snippets.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
  },
  {
    name: 'web_fetch',
    description: 'Fetch the content of a URL. Returns page text.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch' },
      },
      required: ['url'],
    },
  },
]

// ─── SerpAPI web search ────────────────────────────

async function executeWebSearch(query: string): Promise<string> {
  const apiKey = process.env.SERP_API_KEY
  if (!apiKey) return '(web_search unavailable — no SERP_API_KEY configured)'

  try {
    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=8&api_key=${apiKey}`
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return `(web_search error: HTTP ${res.status})`
    const data = await res.json()
    const results = (data.organic_results || []) as Array<{
      title?: string; link?: string; snippet?: string
    }>
    return results
      .slice(0, 8)
      .map((r, i) => `[${i + 1}] ${r.title || ''}\n${r.link || ''}\n${r.snippet || ''}`)
      .join('\n\n') || '(no results)'
  } catch (e) {
    return `(web_search error: ${e instanceof Error ? e.message : 'unknown'})`
  }
}

// ─── web_fetch ────────────────────────────────────

async function executeWebFetch(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12_000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SearchStarBot/1.0; +https://searchstar.com)',
        Accept: 'text/html,text/plain',
      },
    })
    if (!res.ok) return `(fetch error: HTTP ${res.status})`
    const html = await res.text()

    // Strip tags
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3000)

    return text || '(empty page)'
  } catch (e) {
    return `(fetch error: ${e instanceof Error ? e.message : 'unknown'})`
  }
}

// ─── Execute tool call ────────────────────────────

async function executeTool(name: string, input: Record<string, string>): Promise<string> {
  if (name === 'web_search') return executeWebSearch(input.query || '')
  if (name === 'web_fetch') return executeWebFetch(input.url || '')
  return `(unknown tool: ${name})`
}

// ─── Build system prompt ──────────────────────────

function buildSystemPrompt(
  identity: LockedIdentity,
  existingLabels: string[]
): string {
  const identityLines = [
    `Name: ${identity.name}`,
    identity.employer ? `Employer: ${identity.employer}` : null,
    identity.location ? `Location: ${identity.location}` : null,
    identity.summary ? `Summary: ${identity.summary}` : null,
    identity.sourceUrls?.length
      ? `Known source URLs: ${identity.sourceUrls.slice(0, 5).join(', ')}`
      : null,
  ].filter(Boolean).join('\n')

  const existingStr = existingLabels.length
    ? `Standard mode already found these fields (do NOT duplicate them — focus on gaps):\n${existingLabels.join(', ')}`
    : 'Standard mode found no fields — this is a fresh search.'

  return `You are a deep research agent building a structured profile for a real person.

Person to research:
${identityLines}

${existingStr}

Use web_search and web_fetch to find factual information about this person across:
- Professional history, publications, patents, awards
- Athletic records (race times, competition results)
- Community involvement, board memberships
- Academic credentials, research areas
- Specific skills, notable projects
- Social/civic activities

Rules:
- Only include claims you found in the web evidence — never speculate
- Target higher-confidence claims from verifiable sources (GitHub, Google Scholar, race databases, bar registries, LinkedIn, official org sites)
- Skip anything already in the existing fields list
- When done researching, output ONLY a JSON object (no markdown) matching this schema:
{
  "narrative": "150-200 word biographical summary",
  "claims": [
    {
      "section": "Skills|Identity|Interests (intellectual)|Interests (athletic)|Interests (social)|Professional History",
      "label": "claim label",
      "value": "claim value (under 100 chars)",
      "confidence": 0.0-1.0,
      "sourceUrl": "https://...",
      "sourceLabel": "domain.com"
    }
  ]
}

When you have enough information (or after exhausting productive searches), output the final JSON.`
}

// ─── Parse agent final output ─────────────────────

function parseAgentOutput(text: string): SynthesisClaim[] {
  const cleaned = text.replace(/```json|```/g, '').trim()
  let parsed: { claims?: unknown[] } = {}

  try {
    parsed = JSON.parse(cleaned)
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) {
      try { parsed = JSON.parse(match[0]) } catch {}
    }
  }

  if (!Array.isArray(parsed.claims)) return []

  return parsed.claims
    .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
    .filter(c =>
      typeof c['section'] === 'string' &&
      typeof c['label'] === 'string' &&
      typeof c['value'] === 'string'
    )
    .map(c => ({
      section: String(c['section']),
      label: String(c['label']),
      value: String(c['value']).slice(0, 500),
      confidence: typeof c['confidence'] === 'number'
        ? Math.min(1, Math.max(0, c['confidence']))
        : 0.5,
      sourceUrl: typeof c['sourceUrl'] === 'string' ? c['sourceUrl'] : null,
      sourceLabel: typeof c['sourceLabel'] === 'string' ? c['sourceLabel'] : 'web-search',
    }))
}

// ─── Anthropic tool-use loop ──────────────────────

type AnthropicMessage = {
  role: 'user' | 'assistant'
  content: unknown
}

async function runAgentLoop(
  identity: LockedIdentity,
  existingLabels: string[]
): Promise<{ claims: SynthesisClaim[]; narrative: string; iterations: number; elapsedMs: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  const systemPrompt = buildSystemPrompt(identity, existingLabels)
  const messages: AnthropicMessage[] = [
    {
      role: 'user',
      content: `Research ${identity.name} and produce a structured profile JSON. Start with web searches.`,
    },
  ]

  let iterations = 0
  const startMs = Date.now()
  let finalText = ''

  while (iterations < MAX_ITERATIONS && Date.now() - startMs < MAX_ELAPSED_MS) {
    iterations++

    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: SONNET_MODEL,
        max_tokens: 4000,
        system: systemPrompt,
        tools: TOOLS,
        messages,
      }),
    })

    if (!res.ok) {
      const txt = await res.text()
      throw new Error(`Anthropic API ${res.status}: ${txt.slice(0, 300)}`)
    }

    const data = await res.json()
    const stopReason: string = data.stop_reason || ''
    const contentBlocks: Array<{ type: string; id?: string; name?: string; input?: Record<string, string>; text?: string }> =
      data.content || []

    // Append assistant message
    messages.push({ role: 'assistant', content: contentBlocks })

    if (stopReason === 'end_turn') {
      // Extract final text
      const textBlock = contentBlocks.find(b => b.type === 'text')
      finalText = textBlock?.text || ''
      break
    }

    if (stopReason === 'tool_use') {
      // Execute all tool calls
      const toolUseBlocks = contentBlocks.filter(b => b.type === 'tool_use')
      const toolResults = await Promise.all(
        toolUseBlocks.map(async block => ({
          type: 'tool_result' as const,
          tool_use_id: block.id!,
          content: await executeTool(block.name!, block.input || {}),
        }))
      )
      messages.push({ role: 'user', content: toolResults })
      continue
    }

    // Unexpected stop — break
    const textBlock = contentBlocks.find(b => b.type === 'text')
    finalText = textBlock?.text || ''
    break
  }

  const elapsedMs = Date.now() - startMs
  const claims = parseAgentOutput(finalText)

  // Extract narrative from JSON if present
  let narrative = ''
  try {
    const cleaned = finalText.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned.match(/\{[\s\S]*\}/)?.[0] || '{}')
    narrative = typeof parsed.narrative === 'string' ? parsed.narrative.slice(0, 600) : ''
  } catch {}

  return { claims, narrative, iterations, elapsedMs }
}

// ─── Merge deep-mode claims with existing fields ──

interface ExistingField {
  label: string
  section: string
  provenance_status: string
  confidence_score?: number
}

export function mergeDeepModeClaims(
  deepClaims: SynthesisClaim[],
  existingFields: ExistingField[]
): MergedClaim[] {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

  // Index existing fields by normalized section::label
  const existingMap = new Map<string, ExistingField>()
  for (const f of existingFields) {
    const key = `${normalize(f.section)}::${normalize(f.label)}`
    existingMap.set(key, f)
  }

  const result: MergedClaim[] = []

  for (const claim of deepClaims) {
    const key = `${normalize(claim.section)}::${normalize(claim.label)}`
    const existing = existingMap.get(key)

    if (!existing) {
      // New claim — add as seeded
      result.push({ ...claim, singleSource: true, mergedFrom: ['claude'] })
      continue
    }

    const status = existing.provenance_status

    // corrected or removed — skip entirely
    if (status === 'corrected' || status === 'removed') continue

    // confirmed — add as new seeded row for comparison (don't overwrite)
    if (status === 'confirmed') {
      result.push({
        ...claim,
        label: `${claim.label} (deep mode)`,
        singleSource: true,
        mergedFrom: ['claude'],
      })
      continue
    }

    // seeded — overwrite only if higher confidence
    if (status === 'seeded') {
      const existingConf = existing.confidence_score ?? 0
      if (claim.confidence > existingConf) {
        result.push({ ...claim, singleSource: true, mergedFrom: ['claude'] })
      }
      // else skip (lower confidence)
      continue
    }

    // Any other status — add as new
    result.push({ ...claim, singleSource: true, mergedFrom: ['claude'] })
  }

  return result
}

// ─── Main export ──────────────────────────────────

export async function runDeepMode(
  identity: LockedIdentity,
  existingFields: ExistingField[]
): Promise<{
  synthesis: MergedSynthesis
  iterations: number
  elapsedMs: number
}> {
  const existingLabels = existingFields
    .filter(f => f.provenance_status !== 'removed')
    .map(f => `${f.section}: ${f.label}`)

  const { claims, narrative, iterations, elapsedMs } = await runAgentLoop(identity, existingLabels)
  const mergedClaims = mergeDeepModeClaims(claims, existingFields)

  // Phase 14: blend agent-assigned confidence with learned source prior
  // Formula: 0.7 * agentConfidence + 0.3 * sourcePrior
  const mergedWithPriors = await Promise.all(
    mergedClaims.map(async (claim) => {
      const sourcePrior = await getConfidencePrior(claim.sourceLabel || 'web-search')
      const blended = Math.round((0.7 * claim.confidence + 0.3 * sourcePrior) * 10000) / 10000
      return { ...claim, confidence: blended }
    })
  )

  const synthesis: MergedSynthesis = {
    narrative,
    claims: mergedWithPriors,
    claudeNarrative: narrative,
    grokNarrative: null,
    mergedAt: new Date().toISOString(),
  }

  console.log(
    `[DeepMode] Done in ${elapsedMs}ms, ${iterations} iterations, ${claims.length} raw claims → ${mergedClaims.length} merged`
  )

  return { synthesis, iterations, elapsedMs }
}
