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

interface DiscoverRequest {
  fullName: string
  employer?: string
  city?: string
  linkedinUrl?: string
}

// ═══════════════════════════════════════════════════
// GitHub Discovery
// ═══════════════════════════════════════════════════

interface GitHubUser {
  login: string
  html_url: string
  name: string | null
  bio: string | null
  location: string | null
  company: string | null
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

async function findGitHubUser(fullName: string, employer?: string, city?: string): Promise<GitHubUser | null> {
  // Try name-based search first, then narrow with location/company
  const queries = [
    `${fullName} in:name`,
    employer ? `${fullName} in:name ${employer}` : null,
  ].filter(Boolean)

  for (const q of queries) {
    try {
      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'SearchStar-Activate/1.0',
      }
      // Use PAT if available for higher rate limits (5000/hr vs 60/hr)
      if (process.env.GITHUB_PAT) {
        headers['Authorization'] = `Bearer ${process.env.GITHUB_PAT}`
      }

      const res = await fetch(
        `https://api.github.com/search/users?q=${encodeURIComponent(q!)}&per_page=5`,
        { headers, next: { revalidate: 0 } }
      )

      if (!res.ok) {
        console.error(`GitHub search failed: ${res.status} ${res.statusText}`)
        continue
      }

      const data = await res.json()
      if (data.items && data.items.length > 0) {
        // Fetch full user profile for the top match
        const userRes = await fetch(
          `https://api.github.com/users/${data.items[0].login}`,
          { headers, next: { revalidate: 0 } }
        )
        if (userRes.ok) {
          return await userRes.json()
        }
      }
    } catch (err) {
      console.error('GitHub user search error:', err)
    }
  }
  return null
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
  const now = new Date().toISOString()
  let idCounter = 1

  const makeId = () => `gh-${idCounter++}-${now}`

  // Aggregate languages across repos (non-fork only)
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

  // Sort languages by repo count
  const sortedLangs = [...langMap.entries()]
    .sort((a, b) => b[1].repoCount - a[1].repoCount)

  // Top languages as Skills
  for (const [lang, stats] of sortedLangs.slice(0, 8)) {
    const level = stats.repoCount >= 20 ? 'Expert' :
                  stats.repoCount >= 10 ? 'Advanced' :
                  stats.repoCount >= 5 ? 'Intermediate' : 'Familiar'
    const starNote = stats.totalStars > 0 ? `, ${stats.totalStars} stars` : ''
    fields.push({
      id: makeId(),
      section: 'Skills',
      label: lang,
      value: `${level} · ${stats.repoCount} repos${starNote}`,
      source: 'github.com',
      sourceUrl: user.html_url,
      provenance: 'seeded',
    })
  }

  // Total stars and repos as a general Skills field
  const totalStars = ownRepos.reduce((sum, r) => sum + r.stargazers_count, 0)
  if (ownRepos.length > 0) {
    fields.push({
      id: makeId(),
      section: 'Skills',
      label: 'Open Source',
      value: `${ownRepos.length} public repos${totalStars > 0 ? `, ${totalStars.toLocaleString()} total stars` : ''}`,
      source: 'github.com',
      sourceUrl: user.html_url,
      provenance: 'seeded',
    })
  }

  // Notable repos (starred projects) as Interests (intellectual)
  const notableRepos = ownRepos
    .filter(r => r.stargazers_count >= 10)
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 5)

  for (const repo of notableRepos) {
    fields.push({
      id: makeId(),
      section: 'Interests (intellectual)',
      label: `Open Source: ${repo.name}`,
      value: `${repo.description || repo.name} · ${repo.stargazers_count} stars`,
      source: 'github.com',
      sourceUrl: repo.html_url,
      provenance: 'seeded',
    })
  }

  // Topics/interests from repo topics
  const topicCounts = new Map<string, number>()
  for (const repo of ownRepos) {
    for (const topic of (repo.topics || [])) {
      topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1)
    }
  }
  const topTopics = [...topicCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  for (const [topic, count] of topTopics) {
    // Format topic nicely
    const label = topic.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    fields.push({
      id: makeId(),
      section: 'Skills',
      label,
      value: `Referenced in ${count} repos`,
      source: 'github.com',
      sourceUrl: user.html_url,
      provenance: 'seeded',
    })
  }

  // GitHub bio as potential identity field
  if (user.bio) {
    fields.push({
      id: makeId(),
      section: 'Identity',
      label: 'Bio',
      value: user.bio,
      source: 'github.com',
      sourceUrl: user.html_url,
      provenance: 'seeded',
    })
  }

  // Location from GitHub profile
  if (user.location) {
    fields.push({
      id: makeId(),
      section: 'Identity',
      label: 'Location',
      value: user.location,
      source: 'github.com',
      sourceUrl: user.html_url,
      provenance: 'seeded',
    })
  }

  // Company from GitHub profile
  if (user.company) {
    fields.push({
      id: makeId(),
      section: 'Identity',
      label: 'Employer',
      value: user.company.replace(/^@/, ''),
      source: 'github.com',
      sourceUrl: user.html_url,
      provenance: 'seeded',
    })
  }

  return fields
}

// ═══════════════════════════════════════════════════
// Google Scholar Discovery (via SerpAPI)
// ═══════════════════════════════════════════════════

/* eslint-disable @typescript-eslint/no-explicit-any */

async function discoverScholar(fullName: string, employer?: string): Promise<SeededField[]> {
  const fields: SeededField[] = []
  const now = new Date().toISOString()
  let idCounter = 1
  const makeId = () => `scholar-${idCounter++}-${now}`

  const serpApiKey = process.env.SERPAPI_KEY
  if (!serpApiKey) {
    console.log('SERPAPI_KEY not configured — skipping Scholar discovery')
    return fields
  }

  try {
    // Step 1: Search for author profiles via SerpAPI Google Scholar Profiles
    const query = employer ? `${fullName} ${employer}` : fullName
    const searchUrl = `https://serpapi.com/search.json?engine=google_scholar_profiles&mauthors=${encodeURIComponent(query)}&api_key=${serpApiKey}`

    const searchRes = await fetch(searchUrl, { next: { revalidate: 0 } })
    if (!searchRes.ok) {
      console.error(`SerpAPI profile search failed: ${searchRes.status}`)
      return fields
    }

    const searchData = await searchRes.json()
    const profiles = searchData.profiles || []

    if (profiles.length === 0) {
      console.log('No Scholar profile found for:', fullName)
      return fields
    }

    // Take the first (best) match
    const profile = profiles[0]
    const authorId = profile.author_id
    const profileUrl = profile.link || `https://scholar.google.com/citations?user=${authorId}&hl=en`

    // Affiliation from search result
    if (profile.affiliations) {
      fields.push({
        id: makeId(),
        section: 'Identity',
        label: 'Academic Affiliation',
        value: profile.affiliations,
        source: 'scholar.google.com',
        sourceUrl: profileUrl,
        provenance: 'seeded',
      })
    }

    // Research interests from search result
    const interests: string[] = (profile.interests || []).map((i: any) => i.title).filter(Boolean)
    if (interests.length > 0) {
      fields.push({
        id: makeId(),
        section: 'Interests (intellectual)',
        label: 'Research Areas',
        value: interests.join(', '),
        source: 'scholar.google.com',
        sourceUrl: profileUrl,
        provenance: 'seeded',
      })
    }

    // Email domain (if exposed)
    if (profile.email) {
      fields.push({
        id: makeId(),
        section: 'Identity',
        label: 'Verified Email Domain',
        value: profile.email,
        source: 'scholar.google.com',
        sourceUrl: profileUrl,
        provenance: 'seeded',
      })
    }

    // Step 2: Fetch full author page for citation metrics + articles
    const authorUrl = `https://serpapi.com/search.json?engine=google_scholar_author&author_id=${authorId}&api_key=${serpApiKey}`
    const authorRes = await fetch(authorUrl, { next: { revalidate: 0 } })

    if (authorRes.ok) {
      const authorData = await authorRes.json()

      // Citation metrics from cited_by.table
      const table = authorData.cited_by?.table
      if (table) {
        const allCitations = table.find((r: any) => r.citations)?.citations?.all
        const hIndex = table.find((r: any) => r.h_index)?.h_index?.all
        const i10Index = table.find((r: any) => r.i10_index)?.i10_index?.all

        if (hIndex) {
          let metricsValue = `h-index: ${hIndex}`
          if (allCitations) metricsValue += `, ${Number(allCitations).toLocaleString()} total citations`
          if (i10Index) metricsValue += `, i10-index: ${i10Index}`

          fields.push({
            id: makeId(),
            section: 'Interests (intellectual)',
            label: 'Citation Metrics',
            value: metricsValue,
            source: 'scholar.google.com',
            sourceUrl: profileUrl,
            provenance: 'seeded',
          })
        }
      }

      // Articles (top publications)
      const articles: any[] = authorData.articles || []
      if (articles.length > 0) {
        fields.push({
          id: makeId(),
          section: 'Interests (intellectual)',
          label: 'Published Research',
          value: `${articles.length}+ publications including: ${articles.slice(0, 3).map((a: any) => a.title).join('; ')}`,
          source: 'scholar.google.com',
          sourceUrl: profileUrl,
          provenance: 'seeded',
        })

        // Individual notable publications (top 3)
        for (const article of articles.slice(0, 3)) {
          const citedBy = article.cited_by?.value ? ` (cited ${article.cited_by.value}×)` : ''
          const year = article.year ? ` [${article.year}]` : ''
          fields.push({
            id: makeId(),
            section: 'Interests (intellectual)',
            label: 'Publication',
            value: `${article.title}${year}${citedBy}`,
            source: 'scholar.google.com',
            sourceUrl: article.link || profileUrl,
            provenance: 'seeded',
          })
        }
      }

      // Co-authors
      const coauthors: any[] = authorData.co_authors || []
      if (coauthors.length > 0) {
        fields.push({
          id: makeId(),
          section: 'Interests (intellectual)',
          label: 'Frequent Collaborators',
          value: coauthors.slice(0, 5).map((c: any) => c.name).join(', '),
          source: 'scholar.google.com',
          sourceUrl: profileUrl,
          provenance: 'seeded',
        })
      }
    }

  } catch (err) {
    console.error('Scholar discovery error:', err)
  }

  return fields
}

// ═══════════════════════════════════════════════════
// POST handler
// ═══════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const body: DiscoverRequest = await request.json()

    if (!body.fullName || body.fullName.trim().length < 2) {
      return NextResponse.json(
        { error: 'fullName is required (at least 2 characters)' },
        { status: 400 }
      )
    }

    const { fullName, employer, city, linkedinUrl } = body
    const allFields: SeededField[] = []
    const errors: string[] = []

    // Run GitHub and Scholar discovery in parallel
    const [githubResult, scholarResult] = await Promise.allSettled([
      (async () => {
        const user = await findGitHubUser(fullName, employer, city)
        if (!user) return []
        const repos = await getGitHubRepos(user.login)
        return buildGitHubFields(user, repos)
      })(),
      discoverScholar(fullName, employer),
    ])

    if (githubResult.status === 'fulfilled') {
      allFields.push(...githubResult.value)
    } else {
      errors.push(`GitHub discovery failed: ${githubResult.reason}`)
      console.error('GitHub discovery failed:', githubResult.reason)
    }

    if (scholarResult.status === 'fulfilled') {
      allFields.push(...scholarResult.value)
    } else {
      errors.push(`Scholar discovery failed: ${scholarResult.reason}`)
      console.error('Scholar discovery failed:', scholarResult.reason)
    }

    // Add input identity fields as self-seeded baseline
    const now = new Date().toISOString()
    if (fullName) {
      allFields.unshift({
        id: `input-name-${now}`,
        section: 'Identity',
        label: 'Name',
        value: fullName.trim(),
        source: 'user-input',
        sourceUrl: '',
        provenance: 'seeded',
      })
    }
    if (employer) {
      allFields.push({
        id: `input-employer-${now}`,
        section: 'Identity',
        label: 'Employer',
        value: employer.trim(),
        source: 'user-input',
        sourceUrl: '',
        provenance: 'seeded',
      })
    }
    if (city) {
      allFields.push({
        id: `input-city-${now}`,
        section: 'Identity',
        label: 'City',
        value: city.trim(),
        source: 'user-input',
        sourceUrl: '',
        provenance: 'seeded',
      })
    }
    if (linkedinUrl) {
      allFields.push({
        id: `input-linkedin-${now}`,
        section: 'Identity',
        label: 'LinkedIn',
        value: linkedinUrl.trim(),
        source: 'user-input',
        sourceUrl: linkedinUrl.trim(),
        provenance: 'seeded',
      })
    }

    // Deduplicate: when multiple sources report the same field, keep all with
    // separate provenance (per spec: "both are preserved with timestamps").
    // We only dedupe exact value matches from the same source.
    const seen = new Set<string>()
    const dedupedFields = allFields.filter(f => {
      const key = `${f.section}|${f.label}|${f.value}|${f.source}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Assign stable sequential IDs for the UI
    const fields = dedupedFields.map((f, i) => ({
      ...f,
      id: String(i + 1),
    }))

    const response: { fields: SeededField[]; photos: NarrativePhoto[]; errors?: string[] } = {
      fields,
      photos: [], // Phase 9 handles photo discovery
    }

    if (errors.length > 0) {
      response.errors = errors
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('Discovery error:', err)
    return NextResponse.json(
      { error: 'Discovery failed. Please try again.' },
      { status: 500 }
    )
  }
}
