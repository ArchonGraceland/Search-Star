import { NextRequest, NextResponse } from 'next/server'

// ═══════════════════════════════════════════════════
// Types — mirrors the client-side SeededField type
// ═══════════════════════════════════════════════════

interface SeededField {
  id: string
  section: string
  label: string
  value: string
  source: string
  sourceUrl: string
  provenance: 'seeded'
  discoveredAt?: string
}

interface NarrativePhoto {
  id: string
  chapter: string
  caption: string
  date: string
  location: string
  source: string
  sourceLabel: string
  previewUrl: string
  relatedFields: string[]
}

interface DisambiguationCandidate {
  id: string
  source: string
  name: string
  title?: string
  location?: string
  employer?: string
  url: string
  avatar?: string
  confidence: number
  snippet?: string
}

interface DiscoverRequest {
  fullName: string
  employer?: string
  city?: string
  linkedinUrl?: string
  disambiguationSelections?: Record<string, string>
}

interface DiscoverResponse {
  fields: SeededField[]
  photos: NarrativePhoto[]
  errors?: string[]
  disambiguation?: DisambiguationCandidate[]
  sources: { name: string; status: 'found' | 'not_found' | 'error'; count: number }[]
}

// ═══════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════

let fieldIdCounter = 0
const makeId = (prefix: string) => `${prefix}-${++fieldIdCounter}-${Date.now()}`
const timestamp = () => new Date().toISOString()

function nameMatchScore(found: string | null | undefined, target: string): number {
  if (!found) return 0
  const f = found.toLowerCase().trim()
  const t = target.toLowerCase().trim()
  if (f === t) return 1
  const targetParts = t.split(/\s+/)
  const foundParts = f.split(/\s+/)
  const matchedParts = targetParts.filter(tp => foundParts.some(fp => fp.includes(tp) || tp.includes(fp)))
  return matchedParts.length / targetParts.length
}

function safeHostname(url: string): string {
  try { return new URL(url).hostname } catch { return url.slice(0, 40) }
}

// ═══════════════════════════════════════════════════
// 1. GitHub Discovery (Skills, Identity)
// ═══════════════════════════════════════════════════

interface GitHubUser {
  login: string
  html_url: string
  name: string | null
  bio: string | null
  location: string | null
  company: string | null
  avatar_url: string | null
  public_repos: number
  followers: number
}

interface GitHubRepo {
  name: string
  html_url: string
  description: string | null
  language: string | null
  stargazers_count: number
  fork: boolean
  topics: string[]
}

async function findGitHubCandidates(fullName: string, employer?: string, city?: string): Promise<{ user: GitHubUser; score: number }[]> {
  const queries = [
    `${fullName} in:name`,
    employer ? `${fullName} in:name ${employer}` : null,
  ].filter(Boolean)

  const candidates: { user: GitHubUser; score: number }[] = []
  const seen = new Set<string>()

  for (const q of queries) {
    try {
      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'SearchStar-Activate/1.0',
      }
      if (process.env.GITHUB_PAT) {
        headers['Authorization'] = `Bearer ${process.env.GITHUB_PAT}`
      }

      const res = await fetch(
        `https://api.github.com/search/users?q=${encodeURIComponent(q!)}&per_page=5`,
        { headers, next: { revalidate: 0 } }
      )
      if (!res.ok) continue

      const data = await res.json()
      for (const item of (data.items || []).slice(0, 5)) {
        if (seen.has(item.login)) continue
        seen.add(item.login)

        const userRes = await fetch(
          `https://api.github.com/users/${item.login}`,
          { headers, next: { revalidate: 0 } }
        )
        if (!userRes.ok) continue
        const user: GitHubUser = await userRes.json()

        let score = nameMatchScore(user.name, fullName)
        if (city && user.location?.toLowerCase().includes(city.toLowerCase())) score += 0.2
        if (employer && user.company?.toLowerCase().includes(employer.toLowerCase())) score += 0.3
        score = Math.min(score, 1)
        candidates.push({ user, score })
      }
    } catch (err) {
      console.error('GitHub candidate search error:', err)
    }
  }

  return candidates.sort((a, b) => b.score - a.score)
}

async function getGitHubRepos(username: string): Promise<GitHubRepo[]> {
  try {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'SearchStar-Activate/1.0',
    }
    if (process.env.GITHUB_PAT) {
      headers['Authorization'] = `Bearer ${process.env.GITHUB_PAT}`
    }
    const res = await fetch(
      `https://api.github.com/users/${username}/repos?sort=stars&per_page=100&type=owner`,
      { headers, next: { revalidate: 0 } }
    )
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

function buildGitHubFields(user: GitHubUser, repos: GitHubRepo[]): SeededField[] {
  const fields: SeededField[] = []
  const ts = timestamp()

  const langMap = new Map<string, { repoCount: number; totalStars: number }>()
  const ownRepos = repos.filter(r => !r.fork)

  for (const repo of ownRepos) {
    if (repo.language) {
      const existing = langMap.get(repo.language) || { repoCount: 0, totalStars: 0 }
      existing.repoCount++
      existing.totalStars += repo.stargazers_count
      langMap.set(repo.language, existing)
    }
  }

  const sortedLangs = [...langMap.entries()].sort((a, b) => b[1].repoCount - a[1].repoCount)

  for (const [lang, stats] of sortedLangs.slice(0, 8)) {
    const level = stats.repoCount >= 20 ? 'Expert' :
                  stats.repoCount >= 10 ? 'Advanced' :
                  stats.repoCount >= 5 ? 'Intermediate' : 'Familiar'
    const starNote = stats.totalStars > 0 ? `, ${stats.totalStars} stars` : ''
    fields.push({
      id: makeId('gh'), section: 'Skills', label: lang,
      value: `${level} · ${stats.repoCount} repos${starNote}`,
      source: 'github.com', sourceUrl: user.html_url, provenance: 'seeded', discoveredAt: ts,
    })
  }

  const totalStars = ownRepos.reduce((sum, r) => sum + r.stargazers_count, 0)
  if (ownRepos.length > 0) {
    fields.push({
      id: makeId('gh'), section: 'Skills', label: 'Open Source',
      value: `${ownRepos.length} public repos${totalStars > 0 ? `, ${totalStars.toLocaleString()} total stars` : ''}`,
      source: 'github.com', sourceUrl: user.html_url, provenance: 'seeded', discoveredAt: ts,
    })
  }

  const notableRepos = ownRepos.filter(r => r.stargazers_count >= 10)
    .sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 5)

  for (const repo of notableRepos) {
    fields.push({
      id: makeId('gh'), section: 'Interests (intellectual)',
      label: `Open Source: ${repo.name}`,
      value: `${repo.description || repo.name} · ${repo.stargazers_count} stars`,
      source: 'github.com', sourceUrl: repo.html_url, provenance: 'seeded', discoveredAt: ts,
    })
  }

  const topicCounts = new Map<string, number>()
  for (const repo of ownRepos) {
    for (const topic of (repo.topics || [])) {
      topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1)
    }
  }
  for (const [topic, count] of [...topicCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
    const label = topic.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    fields.push({
      id: makeId('gh'), section: 'Skills', label,
      value: `Referenced in ${count} repos`,
      source: 'github.com', sourceUrl: user.html_url, provenance: 'seeded', discoveredAt: ts,
    })
  }

  if (user.bio) {
    fields.push({ id: makeId('gh'), section: 'Identity', label: 'Bio', value: user.bio,
      source: 'github.com', sourceUrl: user.html_url, provenance: 'seeded', discoveredAt: ts })
  }
  if (user.location) {
    fields.push({ id: makeId('gh'), section: 'Identity', label: 'Location', value: user.location,
      source: 'github.com', sourceUrl: user.html_url, provenance: 'seeded', discoveredAt: ts })
  }
  if (user.company) {
    fields.push({ id: makeId('gh'), section: 'Identity', label: 'Employer',
      value: user.company.replace(/^@/, ''),
      source: 'github.com', sourceUrl: user.html_url, provenance: 'seeded', discoveredAt: ts })
  }

  return fields
}

// ═══════════════════════════════════════════════════
// 2. Google Scholar Discovery (Interests intellectual)
// ═══════════════════════════════════════════════════

async function discoverScholar(fullName: string, employer?: string): Promise<SeededField[]> {
  const fields: SeededField[] = []
  const ts = timestamp()
  const serpApiKey = process.env.SERPAPI_KEY
  if (!serpApiKey) { console.log('SERPAPI_KEY not configured — skipping Scholar'); return fields }

  try {
    const authorQuery = `author:"${fullName}"`
    const searchQuery = employer ? `${authorQuery} ${employer}` : authorQuery
    const searchUrl = `https://serpapi.com/search.json?engine=google_scholar&q=${encodeURIComponent(searchQuery)}&hl=en&api_key=${serpApiKey}`
    const searchRes = await fetch(searchUrl, { next: { revalidate: 0 } })
    if (!searchRes.ok) { console.error(`SerpAPI Scholar search failed: ${searchRes.status}`); return fields }

    const searchData = await searchRes.json()
    let authorId: string | null = null
    let profileUrl = ''

    const profiles: any[] = searchData.profiles?.results || []
    for (const profile of profiles) {
      if (profile.author_id && nameMatchScore(profile.name, fullName) >= 0.5) {
        authorId = profile.author_id
        profileUrl = `https://scholar.google.com/citations?user=${authorId}&hl=en`
        break
      }
    }

    if (!authorId) {
      for (const result of (searchData.organic_results || [])) {
        for (const author of (result.publication_info?.authors || [])) {
          if (author.author_id && author.name && fullName.toLowerCase().includes(author.name.replace(/^[A-Z]+\s/, '').toLowerCase())) {
            authorId = author.author_id
            profileUrl = `https://scholar.google.com/citations?user=${authorId}&hl=en`
            break
          }
        }
        if (authorId) break
      }
    }

    if (!authorId) {
      const organicResults = searchData.organic_results || []
      if (organicResults.length > 0) {
        fields.push({
          id: makeId('scholar'), section: 'Interests (intellectual)', label: 'Published Research',
          value: `${searchData.search_information?.total_results || organicResults.length}+ results including: ${organicResults.slice(0, 3).map((r: any) => r.title).join('; ')}`,
          source: 'scholar.google.com', sourceUrl: searchData.search_metadata?.google_scholar_url || '',
          provenance: 'seeded', discoveredAt: ts,
        })
      }
      return fields
    }

    const authorUrl = `https://serpapi.com/search.json?engine=google_scholar_author&author_id=${authorId}&hl=en&api_key=${serpApiKey}`
    const authorRes = await fetch(authorUrl, { next: { revalidate: 0 } })
    if (!authorRes.ok) { console.error(`SerpAPI author fetch failed: ${authorRes.status}`); return fields }

    const authorData = await authorRes.json()

    if (authorData.author?.affiliations) {
      fields.push({ id: makeId('scholar'), section: 'Identity', label: 'Academic Affiliation',
        value: authorData.author.affiliations, source: 'scholar.google.com', sourceUrl: profileUrl,
        provenance: 'seeded', discoveredAt: ts })
    }

    const interests: string[] = (authorData.author?.interests || []).map((i: any) => i.title).filter(Boolean)
    if (interests.length > 0) {
      fields.push({ id: makeId('scholar'), section: 'Interests (intellectual)', label: 'Research Areas',
        value: interests.join(', '), source: 'scholar.google.com', sourceUrl: profileUrl,
        provenance: 'seeded', discoveredAt: ts })
    }

    const table: any[] = authorData.cited_by?.table || []
    const citationsRow = table.find((r: any) => r.citations)
    const hIndexRow = table.find((r: any) => r.h_index)
    const i10Row = table.find((r: any) => r.i10_index)

    if (hIndexRow) {
      let metricsValue = `h-index: ${hIndexRow.h_index?.all}`
      if (citationsRow?.citations?.all) metricsValue += `, ${Number(citationsRow.citations.all).toLocaleString()} total citations`
      if (i10Row?.i10_index?.all) metricsValue += `, i10-index: ${i10Row.i10_index.all}`
      fields.push({ id: makeId('scholar'), section: 'Interests (intellectual)', label: 'Citation Metrics',
        value: metricsValue, source: 'scholar.google.com', sourceUrl: profileUrl,
        provenance: 'seeded', discoveredAt: ts })
    }

    const articles: any[] = authorData.articles || []
    if (articles.length > 0) {
      fields.push({ id: makeId('scholar'), section: 'Interests (intellectual)', label: 'Published Research',
        value: `${articles.length}+ publications including: ${articles.slice(0, 3).map((a: any) => a.title).join('; ')}`,
        source: 'scholar.google.com', sourceUrl: profileUrl, provenance: 'seeded', discoveredAt: ts })

      for (const article of articles.slice(0, 3)) {
        const citedBy = article.cited_by?.value ? ` (cited ${Number(article.cited_by.value).toLocaleString()}×)` : ''
        const year = article.year ? ` [${article.year}]` : ''
        fields.push({ id: makeId('scholar'), section: 'Interests (intellectual)', label: 'Publication',
          value: `${article.title}${year}${citedBy}`, source: 'scholar.google.com',
          sourceUrl: article.link || profileUrl, provenance: 'seeded', discoveredAt: ts })
      }
    }

    const coauthors: any[] = authorData.co_authors || []
    if (coauthors.length > 0) {
      fields.push({ id: makeId('scholar'), section: 'Interests (intellectual)', label: 'Frequent Collaborators',
        value: coauthors.slice(0, 5).map((c: any) => c.name).join(', '),
        source: 'scholar.google.com', sourceUrl: profileUrl, provenance: 'seeded', discoveredAt: ts })
    }
  } catch (err) {
    console.error('Scholar discovery error:', err)
  }

  return fields
}

// ═══════════════════════════════════════════════════
// 3. LinkedIn Discovery via SerpAPI Google engine
//    (Identity, Professional history)
// ═══════════════════════════════════════════════════

interface LinkedInCandidate {
  name: string
  title?: string
  location?: string
  employer?: string
  url: string
  snippet?: string
  confidence: number
}

async function discoverLinkedIn(
  fullName: string, employer?: string, city?: string, linkedinUrl?: string
): Promise<{ fields: SeededField[]; candidates: LinkedInCandidate[] }> {
  const fields: SeededField[] = []
  const candidates: LinkedInCandidate[] = []
  const ts = timestamp()
  const serpApiKey = process.env.SERPAPI_KEY
  if (!serpApiKey) { console.log('SERPAPI_KEY not configured — skipping LinkedIn'); return { fields, candidates } }

  try {
    let query: string
    if (linkedinUrl) {
      const vanity = linkedinUrl.replace(/https?:\/\/(www\.)?linkedin\.com\/in\//i, '').replace(/\/$/, '')
      query = `site:linkedin.com/in "${vanity}" OR "${fullName}"`
    } else {
      const parts = [fullName, employer, city].filter(Boolean).join(' ')
      query = `site:linkedin.com/in ${parts}`
    }

    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&num=5&api_key=${serpApiKey}`
    const res = await fetch(url, { next: { revalidate: 0 } })
    if (!res.ok) { console.error(`SerpAPI LinkedIn search failed: ${res.status}`); return { fields, candidates } }

    const data = await res.json()
    const results: any[] = data.organic_results || []

    for (const result of results.slice(0, 5)) {
      const resultUrl: string = result.link || ''
      if (!resultUrl.includes('linkedin.com/in/')) continue

      const title = (result.title || '') as string
      const snippet = (result.snippet || '') as string

      // Parse: "Jane Smith - Staff Engineer - Datadog | LinkedIn"
      const titleParts = title.replace(/\s*\|\s*LinkedIn.*$/i, '').split(/\s*[-–—]\s*/)
      const foundName = titleParts[0]?.trim() || ''
      const foundTitle = titleParts.slice(1).join(' — ').trim() || undefined

      let foundLocation: string | undefined
      let foundEmployer: string | undefined

      const locationMatch = snippet.match(/^([^·]+)·/)?.[1]?.trim()
      if (locationMatch && locationMatch.length < 60 && !locationMatch.includes('View')) {
        foundLocation = locationMatch
      }

      if (foundTitle) {
        const atMatch = foundTitle.match(/(?:at|@)\s+(.+)/i)
        if (atMatch) foundEmployer = atMatch[1].trim()
        const lastDash = foundTitle.split(/\s*[-–—]\s*/)
        if (lastDash.length > 1 && !foundEmployer) foundEmployer = lastDash[lastDash.length - 1].trim()
      }

      let confidence = nameMatchScore(foundName, fullName)
      if (linkedinUrl && resultUrl.includes(linkedinUrl.replace(/https?:\/\/(www\.)?linkedin\.com/i, ''))) {
        confidence = Math.max(confidence, 0.95)
      }
      if (employer && foundEmployer?.toLowerCase().includes(employer.toLowerCase())) confidence += 0.2
      if (city && foundLocation?.toLowerCase().includes(city.toLowerCase())) confidence += 0.15
      confidence = Math.min(confidence, 1)

      if (confidence >= 0.3) {
        candidates.push({ name: foundName, title: foundTitle, location: foundLocation,
          employer: foundEmployer, url: resultUrl, snippet, confidence })
      }
    }

    candidates.sort((a, b) => b.confidence - a.confidence)

    // Extract fields from best match if confident enough
    const best = candidates[0]
    if (best && best.confidence >= 0.6) {
      if (best.name) fields.push({ id: makeId('li'), section: 'Identity', label: 'Name',
        value: best.name, source: 'linkedin.com', sourceUrl: best.url, provenance: 'seeded', discoveredAt: ts })
      if (best.title) fields.push({ id: makeId('li'), section: 'Identity', label: 'Title',
        value: best.title, source: 'linkedin.com', sourceUrl: best.url, provenance: 'seeded', discoveredAt: ts })
      if (best.location) fields.push({ id: makeId('li'), section: 'Identity', label: 'Location',
        value: best.location, source: 'linkedin.com', sourceUrl: best.url, provenance: 'seeded', discoveredAt: ts })
      if (best.employer) fields.push({ id: makeId('li'), section: 'Identity', label: 'Employer',
        value: best.employer, source: 'linkedin.com', sourceUrl: best.url, provenance: 'seeded', discoveredAt: ts })
      if (best.snippet && best.snippet.length > 30) {
        fields.push({ id: makeId('li'), section: 'Professional history', label: 'LinkedIn Summary',
          value: best.snippet.slice(0, 300), source: 'linkedin.com', sourceUrl: best.url,
          provenance: 'seeded', discoveredAt: ts })
      }
    }
  } catch (err) {
    console.error('LinkedIn discovery error:', err)
  }

  return { fields, candidates }
}

// ═══════════════════════════════════════════════════
// 4. Professional Directory Discovery
//    (Skills, Professional history)
// ═══════════════════════════════════════════════════

async function discoverProfessionalDirectories(
  fullName: string, employer?: string, _city?: string
): Promise<SeededField[]> {
  const fields: SeededField[] = []
  const ts = timestamp()
  const serpApiKey = process.env.SERPAPI_KEY
  if (!serpApiKey) return fields

  try {
    const queries = [
      `"${fullName}" (site:calbar.ca.gov OR site:nysed.gov OR site:aicpa.org OR site:npiprofile.cms.hhs.gov OR "bar association" OR "medical license" OR "CPA registry")`,
      `"${fullName}" (site:pycon.org OR site:kubecon.io OR site:events.linuxfoundation.org OR "conference speaker" OR "keynote speaker" OR "panelist")`,
    ]

    for (const query of queries) {
      const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&num=5&api_key=${serpApiKey}`
      const res = await fetch(url, { next: { revalidate: 0 } })
      if (!res.ok) continue

      const data = await res.json()
      for (const result of (data.organic_results || []).slice(0, 3)) {
        const resultUrl: string = result.link || ''
        const title: string = result.title || ''
        const snippet: string = result.snippet || ''
        const combinedText = `${title} ${snippet}`.toLowerCase()

        const nameParts = fullName.toLowerCase().split(/\s+/)
        if (!nameParts.every(part => combinedText.includes(part))) continue

        const hostname = safeHostname(resultUrl)
        const isLicense = /bar\s*association|medical\s*board|medical\s*license|cpa\s*registry|npi|attorney|licensed|licensure/i.test(combinedText)
        const isConference = /speaker|keynote|panelist|talk|presentation|conference|pycon|kubecon|gophercon|reinvent|summit/i.test(combinedText)

        if (isLicense) {
          let licenseType = 'Professional License'
          if (/attorney|bar\s*association|juris/i.test(combinedText)) licenseType = 'Attorney'
          else if (/physician|medical|doctor|md|npi/i.test(combinedText)) licenseType = 'Medical Professional'
          else if (/cpa|accountant/i.test(combinedText)) licenseType = 'Certified Public Accountant'

          fields.push({ id: makeId('dir'), section: 'Skills', label: licenseType,
            value: snippet.slice(0, 200), source: hostname, sourceUrl: resultUrl,
            provenance: 'seeded', discoveredAt: ts })
        } else if (isConference) {
          fields.push({ id: makeId('dir'), section: 'Interests (intellectual)', label: 'Conference Speaking',
            value: `${title.slice(0, 100)} — ${snippet.slice(0, 150)}`,
            source: hostname, sourceUrl: resultUrl, provenance: 'seeded', discoveredAt: ts })
        } else {
          fields.push({ id: makeId('dir'), section: 'Professional history', label: 'Professional Listing',
            value: `${title.slice(0, 120)} — ${snippet.slice(0, 150)}`,
            source: hostname, sourceUrl: resultUrl, provenance: 'seeded', discoveredAt: ts })
        }
      }
    }
  } catch (err) {
    console.error('Professional directory discovery error:', err)
  }
  return fields
}

// ═══════════════════════════════════════════════════
// 5. Athletic Discovery — Athlinks, RunSignUp
//    (Interests athletic)
// ═══════════════════════════════════════════════════

async function discoverAthletic(fullName: string, _city?: string): Promise<SeededField[]> {
  const fields: SeededField[] = []
  const ts = timestamp()
  const serpApiKey = process.env.SERPAPI_KEY
  if (!serpApiKey) return fields

  try {
    const query = `"${fullName}" (site:athlinks.com OR site:runsignup.com OR site:results.active.com OR site:ultrasignup.com OR site:usacycling.org OR "race result" OR "finish time" OR "marathon" OR "triathlon")`
    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&num=8&api_key=${serpApiKey}`
    const res = await fetch(url, { next: { revalidate: 0 } })
    if (!res.ok) return fields

    const data = await res.json()
    const results: any[] = data.organic_results || []
    const raceResults: { event: string; detail: string; url: string; source: string }[] = []

    for (const result of results.slice(0, 5)) {
      const resultUrl: string = result.link || ''
      const title: string = result.title || ''
      const snippet: string = result.snippet || ''
      const combinedText = `${title} ${snippet}`.toLowerCase()
      const nameParts = fullName.toLowerCase().split(/\s+/)
      if (!nameParts.every(part => combinedText.includes(part))) continue

      const hostname = safeHostname(resultUrl)
      const timeMatch = snippet.match(/\b(\d{1,2}:\d{2}(?::\d{2})?)\b/)
      const placeMatch = snippet.match(/(?:place|overall|position|finished)\s*:?\s*#?(\d+)/i) ||
                         snippet.match(/(\d+)(?:st|nd|rd|th)\s+(?:place|overall|out of)/i)

      let detail = snippet.slice(0, 200)
      if (timeMatch) detail = `Time: ${timeMatch[1]} — ${detail.slice(0, 150)}`
      if (placeMatch) detail = `Place: ${placeMatch[1]} — ${detail}`

      raceResults.push({ event: title.slice(0, 120), detail: detail.slice(0, 250), url: resultUrl, source: hostname })
    }

    if (raceResults.length > 0) {
      fields.push({ id: makeId('ath'), section: 'Interests (athletic)', label: 'Race Results',
        value: `${raceResults.length} result${raceResults.length > 1 ? 's' : ''} found: ${raceResults.map(r => r.event).join('; ').slice(0, 200)}`,
        source: 'multiple', sourceUrl: raceResults[0].url, provenance: 'seeded', discoveredAt: ts })

      for (const race of raceResults.slice(0, 5)) {
        fields.push({ id: makeId('ath'), section: 'Interests (athletic)', label: 'Race',
          value: `${race.event} — ${race.detail}`, source: race.source, sourceUrl: race.url,
          provenance: 'seeded', discoveredAt: ts })
      }
    }
  } catch (err) {
    console.error('Athletic discovery error:', err)
  }
  return fields
}

// ═══════════════════════════════════════════════════
// 6. Social Interest Discovery
//    (Interests social — meetup, nonprofit, articles)
// ═══════════════════════════════════════════════════

async function discoverSocial(fullName: string, employer?: string, _city?: string): Promise<SeededField[]> {
  const fields: SeededField[] = []
  const ts = timestamp()
  const serpApiKey = process.env.SERPAPI_KEY
  if (!serpApiKey) return fields

  try {
    const queries = [
      `"${fullName}" (site:meetup.com OR "board member" OR "board of directors" OR "nonprofit" OR "volunteer" OR "advisory board")`,
      `"${fullName}" ("published" OR "article by" OR "written by" OR "podcast guest" OR "interview with"${employer ? ` OR "${employer}"` : ''})`,
    ]

    for (const query of queries) {
      const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&num=5&api_key=${serpApiKey}`
      const res = await fetch(url, { next: { revalidate: 0 } })
      if (!res.ok) continue

      const data = await res.json()
      for (const result of (data.organic_results || []).slice(0, 3)) {
        const resultUrl: string = result.link || ''
        const title: string = result.title || ''
        const snippet: string = result.snippet || ''
        const combinedText = `${title} ${snippet}`.toLowerCase()
        const nameParts = fullName.toLowerCase().split(/\s+/)
        if (!nameParts.every(part => combinedText.includes(part))) continue

        const hostname = safeHostname(resultUrl)
        const isMeetup = /meetup\.com/i.test(resultUrl)
        const isNonprofit = /board\s*(member|director)|nonprofit|non-profit|advisory\s*board|volunteer|charity/i.test(combinedText)
        const isArticle = /article|written\s*by|author|published|blog\s*post|medium\.com/i.test(combinedText)
        const isPodcast = /podcast|episode|interview|guest\s*on/i.test(combinedText)

        const valueText = `${title.slice(0, 120)} — ${snippet.slice(0, 150)}`

        if (isMeetup) {
          fields.push({ id: makeId('soc'), section: 'Interests (social)', label: 'Meetup',
            value: valueText, source: hostname, sourceUrl: resultUrl, provenance: 'seeded', discoveredAt: ts })
        } else if (isNonprofit) {
          fields.push({ id: makeId('soc'), section: 'Interests (social)', label: 'Community Involvement',
            value: valueText, source: hostname, sourceUrl: resultUrl, provenance: 'seeded', discoveredAt: ts })
        } else if (isArticle) {
          fields.push({ id: makeId('soc'), section: 'Interests (intellectual)', label: 'Published Article',
            value: valueText, source: hostname, sourceUrl: resultUrl, provenance: 'seeded', discoveredAt: ts })
        } else if (isPodcast) {
          fields.push({ id: makeId('soc'), section: 'Interests (social)', label: 'Podcast Appearance',
            value: valueText, source: hostname, sourceUrl: resultUrl, provenance: 'seeded', discoveredAt: ts })
        } else {
          fields.push({ id: makeId('soc'), section: 'Interests (social)', label: 'Social Activity',
            value: valueText, source: hostname, sourceUrl: resultUrl, provenance: 'seeded', discoveredAt: ts })
        }
      }
    }
  } catch (err) {
    console.error('Social discovery error:', err)
  }
  return fields
}

// ═══════════════════════════════════════════════════
// Merge logic — preserves all values per spec:
// "two sources list different job titles — both are
// preserved with timestamps"
// ═══════════════════════════════════════════════════

function mergeFields(allFields: SeededField[]): SeededField[] {
  const seen = new Set<string>()
  const deduped = allFields.filter(f => {
    const key = `${f.section}|${f.label}|${f.value.toLowerCase().trim()}|${f.source}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return deduped.map((f, i) => ({ ...f, id: String(i + 1) }))
}

// ═══════════════════════════════════════════════════
// Disambiguation — build candidate list when multiple
// plausible matches are found
// ═══════════════════════════════════════════════════

function buildDisambiguationCandidates(
  githubCandidates: { user: GitHubUser; score: number }[],
  linkedinCandidates: LinkedInCandidate[],
): DisambiguationCandidate[] {
  const candidates: DisambiguationCandidate[] = []

  const plausibleGH = githubCandidates.filter(c => c.score >= 0.4)
  if (plausibleGH.length > 1) {
    for (const c of plausibleGH.slice(0, 4)) {
      candidates.push({
        id: `gh-${c.user.login}`, source: 'github.com',
        name: c.user.name || c.user.login, title: c.user.bio || undefined,
        location: c.user.location || undefined,
        employer: c.user.company?.replace(/^@/, '') || undefined,
        url: c.user.html_url, avatar: c.user.avatar_url || undefined,
        confidence: c.score,
      })
    }
  }

  const plausibleLI = linkedinCandidates.filter(c => c.confidence >= 0.4)
  if (plausibleLI.length > 1) {
    for (const c of plausibleLI.slice(0, 4)) {
      candidates.push({
        id: `li-${c.url.split('/in/')[1]?.replace(/\/$/, '') || c.name}`,
        source: 'linkedin.com', name: c.name, title: c.title,
        location: c.location, employer: c.employer, url: c.url,
        confidence: c.confidence, snippet: c.snippet,
      })
    }
  }

  return candidates
}

// ═══════════════════════════════════════════════════
// POST handler
// ═══════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    fieldIdCounter = 0

    const body: DiscoverRequest = await request.json()
    if (!body.fullName || body.fullName.trim().length < 2) {
      return NextResponse.json({ error: 'fullName is required (at least 2 characters)' }, { status: 400 })
    }

    const { fullName, employer, city, linkedinUrl } = body
    const allFields: SeededField[] = []
    const errors: string[] = []
    const sources: DiscoverResponse['sources'] = []
    const ts = timestamp()

    // ═══ Run all 6 discovery sources in parallel ═══
    const [githubResult, scholarResult, linkedinResult, directoryResult, athleticResult, socialResult] =
      await Promise.allSettled([
        (async () => {
          const candidates = await findGitHubCandidates(fullName, employer, city)
          if (candidates.length === 0) return { fields: [] as SeededField[], candidates }
          const best = candidates[0]
          const repos = await getGitHubRepos(best.user.login)
          return { fields: buildGitHubFields(best.user, repos), candidates }
        })(),
        discoverScholar(fullName, employer),
        discoverLinkedIn(fullName, employer, city, linkedinUrl),
        discoverProfessionalDirectories(fullName, employer, city),
        discoverAthletic(fullName, city),
        discoverSocial(fullName, employer, city),
      ])

    // ═══ Collect results ═══
    let githubCandidates: { user: GitHubUser; score: number }[] = []
    let linkedinCandidates: LinkedInCandidate[] = []

    if (githubResult.status === 'fulfilled') {
      allFields.push(...githubResult.value.fields)
      githubCandidates = githubResult.value.candidates
      sources.push({ name: 'GitHub', status: githubResult.value.fields.length > 0 ? 'found' : 'not_found', count: githubResult.value.fields.length })
    } else {
      errors.push(`GitHub discovery failed: ${githubResult.reason}`)
      sources.push({ name: 'GitHub', status: 'error', count: 0 })
    }

    if (scholarResult.status === 'fulfilled') {
      allFields.push(...scholarResult.value)
      sources.push({ name: 'Google Scholar', status: scholarResult.value.length > 0 ? 'found' : 'not_found', count: scholarResult.value.length })
    } else {
      errors.push(`Scholar discovery failed: ${scholarResult.reason}`)
      sources.push({ name: 'Google Scholar', status: 'error', count: 0 })
    }

    if (linkedinResult.status === 'fulfilled') {
      allFields.push(...linkedinResult.value.fields)
      linkedinCandidates = linkedinResult.value.candidates
      sources.push({ name: 'LinkedIn', status: linkedinResult.value.fields.length > 0 ? 'found' : 'not_found', count: linkedinResult.value.fields.length })
    } else {
      errors.push(`LinkedIn discovery failed: ${linkedinResult.reason}`)
      sources.push({ name: 'LinkedIn', status: 'error', count: 0 })
    }

    if (directoryResult.status === 'fulfilled') {
      allFields.push(...directoryResult.value)
      sources.push({ name: 'Professional Directories', status: directoryResult.value.length > 0 ? 'found' : 'not_found', count: directoryResult.value.length })
    } else {
      errors.push(`Directory discovery failed: ${directoryResult.reason}`)
      sources.push({ name: 'Professional Directories', status: 'error', count: 0 })
    }

    if (athleticResult.status === 'fulfilled') {
      allFields.push(...athleticResult.value)
      sources.push({ name: 'Athletic Records', status: athleticResult.value.length > 0 ? 'found' : 'not_found', count: athleticResult.value.length })
    } else {
      errors.push(`Athletic discovery failed: ${athleticResult.reason}`)
      sources.push({ name: 'Athletic Records', status: 'error', count: 0 })
    }

    if (socialResult.status === 'fulfilled') {
      allFields.push(...socialResult.value)
      sources.push({ name: 'Social & Community', status: socialResult.value.length > 0 ? 'found' : 'not_found', count: socialResult.value.length })
    } else {
      errors.push(`Social discovery failed: ${socialResult.reason}`)
      sources.push({ name: 'Social & Community', status: 'error', count: 0 })
    }

    // ═══ Add user-input identity baseline ═══
    if (fullName) {
      allFields.unshift({ id: `input-name-${ts}`, section: 'Identity', label: 'Name',
        value: fullName.trim(), source: 'user-input', sourceUrl: '', provenance: 'seeded', discoveredAt: ts })
    }
    if (employer) {
      allFields.push({ id: `input-employer-${ts}`, section: 'Identity', label: 'Employer',
        value: employer.trim(), source: 'user-input', sourceUrl: '', provenance: 'seeded', discoveredAt: ts })
    }
    if (city) {
      allFields.push({ id: `input-city-${ts}`, section: 'Identity', label: 'City',
        value: city.trim(), source: 'user-input', sourceUrl: '', provenance: 'seeded', discoveredAt: ts })
    }
    if (linkedinUrl) {
      allFields.push({ id: `input-linkedin-${ts}`, section: 'Identity', label: 'LinkedIn',
        value: linkedinUrl.trim(), source: 'user-input', sourceUrl: linkedinUrl.trim(), provenance: 'seeded', discoveredAt: ts })
    }

    // ═══ Merge — preserves multi-source values ═══
    const fields = mergeFields(allFields)

    // ═══ Build disambiguation candidates ═══
    const disambiguation = buildDisambiguationCandidates(githubCandidates, linkedinCandidates)

    // ═══ Response ═══
    const response: DiscoverResponse = { fields, photos: [], sources }
    if (errors.length > 0) response.errors = errors
    if (disambiguation.length > 0) response.disambiguation = disambiguation

    return NextResponse.json(response)
  } catch (err) {
    console.error('Discovery error:', err)
    return NextResponse.json({ error: 'Discovery failed. Please try again.' }, { status: 500 })
  }
}
