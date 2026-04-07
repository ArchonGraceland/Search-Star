// ═══════════════════════════════════════════════════
// src/lib/activate/synthesis/evidence-gathering.ts
//
// Stage 2 of the v1.4 synthesis pipeline.
// Three parallel evidence streams:
//   a. Broad SerpAPI web search → fetch top 15 pages →
//      extract main content with @mozilla/readability
//   b. Grok API single-shot profile generation
//   c. (Deep mode only — Phase 13) Claude research agent
//
// Output: EvidenceBundle consumed by Stage 3 synthesis.
// ═══════════════════════════════════════════════════

import { LockedIdentity, EvidenceBundle, WebResult } from './types'

// ─── SerpAPI search ───────────────────────────────

async function serpSearch(query: string, numResults: number = 20): Promise<
  Array<{ title: string; url: string; snippet: string }>
> {
  const key = process.env.SERPAPI_KEY
  if (!key) throw new Error('SERPAPI_KEY not configured')

  const url =
    `https://serpapi.com/search.json?engine=google` +
    `&q=${encodeURIComponent(query)}` +
    `&num=${numResults}` +
    `&api_key=${key}`

  const res = await fetch(url, { next: { revalidate: 0 } })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`SerpAPI ${res.status}: ${txt.slice(0, 200)}`)
  }

  const data = await res.json()
  return (data.organic_results || []).map((r: {
    title?: string; link?: string; snippet?: string
  }) => ({
    title: r.title || '',
    url: r.link || '',
    snippet: r.snippet || '',
  }))
}

// ─── Page fetch + readability extraction ──────────

async function fetchPageText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SearchStarBot/1.0; +https://searchstar.com)',
        Accept: 'text/html,application/xhtml+xml',
      },
      next: { revalidate: 0 },
    })
    if (!res.ok) return ''

    const html = await res.text()

    // Use readability-style extraction: strip scripts/styles, collapse whitespace
    // We import dynamically to avoid issues in edge runtimes
    let extracted = ''
    try {
      // Dynamic import works in Node.js API routes (not edge)
      const { Readability } = await import('@mozilla/readability')
      const { JSDOM } = await import('jsdom')
      const dom = new JSDOM(html, { url })
      const reader = new Readability(dom.window.document)
      const article = reader.parse()
      extracted = article?.textContent || ''
    } catch {
      // Fallback: naive tag-strip
      extracted = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
    }

    return extracted.replace(/\s+/g, ' ').trim().slice(0, 3000)
  } catch {
    return ''
  }
}

async function fetchTopPages(
  results: Array<{ title: string; url: string; snippet: string }>,
  limit: number = 15
): Promise<WebResult[]> {
  // Skip PDFs, social media that blocks scrapers, binary files
  const skip = /\.(pdf|docx|xlsx|pptx|zip)$/i
  const filtered = results
    .filter(r => r.url && !skip.test(r.url))
    .slice(0, limit)

  const now = new Date().toISOString()

  const settled = await Promise.allSettled(
    filtered.map(async (r) => {
      const bodyText = await fetchPageText(r.url)
      return {
        url: r.url,
        title: r.title,
        snippet: r.snippet,
        bodyText,
        fetchedAt: now,
        fetchOk: bodyText.length > 0,
      } satisfies WebResult
    })
  )

  return settled.map((s, i) =>
    s.status === 'fulfilled'
      ? s.value
      : {
          url: filtered[i].url,
          title: filtered[i].title,
          snippet: filtered[i].snippet,
          bodyText: '',
          fetchedAt: now,
          fetchOk: false,
        }
  )
}

// ─── Grok single-shot ────────────────────────────

async function callGrok(identity: LockedIdentity): Promise<string | null> {
  const key = process.env.XAI_API_KEY
  if (!key) {
    console.warn('XAI_API_KEY not configured — skipping Grok evidence stream')
    return null
  }

  const context = [
    identity.name,
    identity.employer && `who works at ${identity.employer}`,
    identity.location && `based in ${identity.location}`,
    identity.summary && `(${identity.summary})`,
  ]
    .filter(Boolean)
    .join(' ')

  const prompt = `Tell me everything you know about ${context}. 

Please provide:
1. A brief biographical summary (2-3 sentences)
2. Their professional background and career history
3. Their skills and areas of expertise
4. Their educational background
5. Any notable achievements, publications, or projects
6. Their interests and activities outside work (if known)
7. Any public social profiles or website URLs you're aware of

Be factual and specific. If you're uncertain about something, say so. Include URLs where possible so claims can be verified.`

  try {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'grok-3-latest',
        messages: [
          {
            role: 'system',
            content:
              'You are a research assistant. Provide factual information about people based on your training data. Always cite specific URLs or sources when you have them. If you are uncertain, say so explicitly.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1500,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(30000),
      next: { revalidate: 0 } as RequestInit,
    } as RequestInit)

    if (!res.ok) {
      const txt = await res.text()
      console.warn(`Grok API ${res.status}: ${txt.slice(0, 200)}`)
      return null
    }

    const data = await res.json()
    return data.choices?.[0]?.message?.content || null
  } catch (err) {
    console.warn('Grok call failed:', err instanceof Error ? err.message : err)
    return null
  }
}

// ─── Build search query from locked identity ───────

export function buildSearchQuery(identity: LockedIdentity): string {
  const parts: string[] = [`"${identity.name}"`]
  if (identity.employer) parts.push(identity.employer)
  if (identity.location) parts.push(identity.location)
  // Add source URL domains as context signals
  identity.sourceUrls.slice(0, 2).forEach(u => {
    try {
      const host = new URL(u).hostname.replace('www.', '')
      if (host && !parts.some(p => p.includes(host))) {
        parts.push(`site:${host}`)
      }
    } catch {}
  })
  return parts.join(' ')
}

// ─── Main: gather all evidence ────────────────────

export async function gatherEvidence(identity: LockedIdentity): Promise<EvidenceBundle> {
  const searchQuery = buildSearchQuery(identity)

  // Run web search and Grok in parallel
  const [searchResults, grokResponse] = await Promise.allSettled([
    serpSearch(searchQuery, 20),
    callGrok(identity),
  ])

  const organic =
    searchResults.status === 'fulfilled' ? searchResults.value : []

  // Fetch page content in parallel (up to 15 pages)
  const webResults = await fetchTopPages(organic, 15)

  return {
    identity,
    searchQuery,
    webResults,
    grokResponse:
      grokResponse.status === 'fulfilled' ? grokResponse.value : null,
    gatheredAt: new Date().toISOString(),
  }
}
