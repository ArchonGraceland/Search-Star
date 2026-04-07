// ═══════════════════════════════════════════════════
// src/lib/activate/identity-lock.ts
//
// Stage 1 of the v1.4 synthesis architecture.
// One broad SerpAPI web search + one Claude Haiku call
// to disambiguate a person into 3-5 candidate personas.
// The user picks themselves; the result becomes the
// locked identity constraints for all downstream stages.
// ═══════════════════════════════════════════════════

export interface LockedIdentityCandidate {
  candidateId: string        // stable id like "candidate-0"
  name: string               // canonical name as found in web results
  employer?: string
  location?: string
  photoUrl?: string          // best available headshot URL
  summary: string            // one-line description of this persona
  sourceUrls: string[]       // the top URLs that informed this persona
  confidence: number         // 0-1, Haiku's own confidence this is a distinct real person
}

export interface IdentityLockInput {
  fullName: string
  employer?: string
  city?: string
  linkedinUrl?: string
}

export interface IdentityLockResult {
  candidates: LockedIdentityCandidate[]
  searchQuery: string
  resultsConsidered: number
}

// ─── SerpAPI — broad Google web search ───────────────

async function broadWebSearch(query: string, numResults: number = 10): Promise<{
  organic: Array<{ title: string; url: string; snippet: string; thumbnail?: string }>
}> {
  const serpApiKey = process.env.SERPAPI_KEY
  if (!serpApiKey) throw new Error('SERPAPI_KEY not configured')

  const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&num=${numResults}&api_key=${serpApiKey}`
  const res = await fetch(url, { next: { revalidate: 0 } })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`SerpAPI error ${res.status}: ${text.slice(0, 200)}`)
  }
  const data = await res.json()
  return {
    organic: (data.organic_results || []).map((r: {
      title?: string; link?: string; snippet?: string
      thumbnail?: string; rich_snippet?: { top?: { detected_extensions?: { thumbnail?: string } } }
    }) => ({
      title: r.title || '',
      url: r.link || '',
      snippet: r.snippet || '',
      thumbnail: r.thumbnail || r.rich_snippet?.top?.detected_extensions?.thumbnail || undefined,
    }))
  }
}

// ─── Fetch page content for top N results ─────────────

async function fetchTopResults(
  organic: Array<{ title: string; url: string; snippet: string; thumbnail?: string }>,
  limit: number = 10
): Promise<Array<{ url: string; title: string; snippet: string; thumbnail?: string; bodySnippet: string }>> {
  const top = organic.slice(0, limit)

  const fetched = await Promise.allSettled(
    top.map(async (r) => {
      try {
        const res = await fetch(r.url, {
          signal: AbortSignal.timeout(6000),
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SearchStarBot/1.0)' },
          next: { revalidate: 0 },
        })
        if (!res.ok) return { ...r, bodySnippet: '' }
        const html = await res.text()
        // Extract visible text — strip tags, collapse whitespace, take first 800 chars
        const bodySnippet = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 800)
        return { url: r.url, title: r.title, snippet: r.snippet, thumbnail: r.thumbnail, bodySnippet }
      } catch {
        return { url: r.url, title: r.title, snippet: r.snippet, thumbnail: r.thumbnail, bodySnippet: '' }
      }
    })
  )

  return fetched.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { url: top[i].url, title: top[i].title, snippet: top[i].snippet, thumbnail: top[i].thumbnail, bodySnippet: '' }
  )
}

// ─── Claude Haiku — persona grouping ──────────────────

async function groupPersonasWithHaiku(
  input: IdentityLockInput,
  results: Array<{ url: string; title: string; snippet: string; thumbnail?: string; bodySnippet: string }>
): Promise<LockedIdentityCandidate[]> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not configured')

  const resultsText = results.map((r, i) =>
    `[${i + 1}] URL: ${r.url}\nTitle: ${r.title}\nSnippet: ${r.snippet}\nPage content: ${r.bodySnippet}`
  ).join('\n\n---\n\n')

  const searchContext = [
    input.fullName,
    input.employer && `works at ${input.employer}`,
    input.city && `based in ${input.city}`,
    input.linkedinUrl && `LinkedIn: ${input.linkedinUrl}`,
  ].filter(Boolean).join(', ')

  const prompt = `You are disambiguating web search results to identify distinct real people named "${input.fullName}".

Search context: ${searchContext}

Web search results:
${resultsText}

Task: Group these search results into 3-5 distinct real-person personas. Each persona represents a different individual named (or closely matching) "${input.fullName}".

Rules:
- Only include personas with at least 1 search result supporting them
- If one persona is overwhelmingly dominant (e.g. LinkedIn + multiple pages + unique employer), it can be listed first with high confidence
- Include a persona for "${input.fullName}" even if you have no results, as the person may have minimal web presence — mark confidence low (0.15)
- Assign a photoUrl only when a clear headshot thumbnail is available in the results (not a company logo or generic image)
- Keep summaries to one sentence, factual, no speculation

Respond ONLY with valid JSON — no markdown, no preamble, no explanation:
{
  "candidates": [
    {
      "candidateId": "candidate-0",
      "name": "string — canonical full name",
      "employer": "string or null",
      "location": "string or null",
      "photoUrl": "string (direct image URL) or null",
      "summary": "one sentence describing this person",
      "sourceUrls": ["up to 3 most relevant URLs from the results"],
      "confidence": 0.0
    }
  ]
}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    }),
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Haiku API error ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  const rawText = data.content?.[0]?.text || ''

  // Strip any accidental markdown fences
  const cleaned = rawText.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(cleaned)

  const candidates: LockedIdentityCandidate[] = (parsed.candidates || []).map(
    (c: Omit<LockedIdentityCandidate, 'candidateId'> & { candidateId?: string }, i: number) => ({
      candidateId: c.candidateId || `candidate-${i}`,
      name: c.name || input.fullName,
      employer: c.employer || undefined,
      location: c.location || undefined,
      photoUrl: c.photoUrl || undefined,
      summary: c.summary || '',
      sourceUrls: Array.isArray(c.sourceUrls) ? c.sourceUrls.slice(0, 3) : [],
      confidence: typeof c.confidence === 'number' ? Math.min(1, Math.max(0, c.confidence)) : 0.5,
    })
  )

  return candidates
}

// ─── Main export ──────────────────────────────────────

export async function runIdentityLock(input: IdentityLockInput): Promise<IdentityLockResult> {
  // Build a focused search query
  const queryParts = [
    `"${input.fullName}"`,
    input.employer || '',
    input.city || '',
  ].filter(Boolean)

  // If we have a LinkedIn URL, include it as an anchor signal
  if (input.linkedinUrl) {
    queryParts.push('site:linkedin.com OR ' + queryParts.slice(1).join(' '))
  }

  const searchQuery = queryParts.join(' ').trim()

  // Stage 1a: broad web search
  const { organic } = await broadWebSearch(searchQuery, 10)

  // Stage 1b: fetch top results for richer content
  const results = await fetchTopResults(organic, 10)

  // Stage 1c: Haiku groups results into 3-5 personas
  const candidates = await groupPersonasWithHaiku(input, results)

  return {
    candidates,
    searchQuery,
    resultsConsidered: results.length,
  }
}
