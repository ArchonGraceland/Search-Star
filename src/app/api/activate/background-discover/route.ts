import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ═══════════════════════════════════════════════════
// POST /api/activate/background-discover
// Background discovery: creates unclaimed draft stubs
// from public data without a user initiating.
//
// Spec reference: Section 3.9 "Unclaimed profiles"
// Five enforced properties:
//   1. Trust score = 0
//   2. Not queryable (no paid queries)
//   3. Not editable (frozen via RLS)
//   4. Visible in directory with "Unclaimed" badge
//   5. No marketing messages
// ═══════════════════════════════════════════════════

interface BackgroundDiscoverRequest {
  subjects: {
    fullName: string
    employer?: string
    city?: string
    linkedinUrl?: string
  }[]
}

// Admin client — uses service role for background operations
function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ═══ Lightweight discovery helpers (reused from discover route logic) ═══

interface SeededField {
  section: string
  label: string
  value: string
  source: string
  sourceUrl: string
}

let fieldCounter = 0
const ts = () => new Date().toISOString()

function getSourceConfidence(sourceName: string): number {
  const s = sourceName.toLowerCase()
  if (s.includes('github')) return 0.9
  if (s.includes('scholar')) return 0.85
  return 0.6
}

async function discoverGitHub(fullName: string, employer?: string): Promise<SeededField[]> {
  const fields: SeededField[] = []
  try {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'SearchStar-BackgroundDiscover/1.0',
    }
    if (process.env.GITHUB_PAT) {
      headers['Authorization'] = `Bearer ${process.env.GITHUB_PAT}`
    }

    const query = employer
      ? `${fullName} in:name ${employer}`
      : `${fullName} in:name`

    const res = await fetch(
      `https://api.github.com/search/users?q=${encodeURIComponent(query)}&per_page=3`,
      { headers, next: { revalidate: 0 } }
    )
    if (!res.ok) return fields

    const data = await res.json()
    const items = data.items || []
    if (items.length === 0) return fields

    // Only use high-confidence match
    const best = items[0]
    const userRes = await fetch(`https://api.github.com/users/${best.login}`, { headers, next: { revalidate: 0 } })
    if (!userRes.ok) return fields
    const user = await userRes.json()

    // Name match check
    const nameParts = fullName.toLowerCase().split(/\s+/)
    const foundName = (user.name || '').toLowerCase()
    const matchCount = nameParts.filter((p: string) => foundName.includes(p)).length
    if (matchCount < nameParts.length * 0.5) return fields // Low confidence, skip

    if (user.bio) {
      fields.push({ section: 'Identity', label: 'Bio', value: user.bio,
        source: 'github.com', sourceUrl: user.html_url })
    }
    if (user.location) {
      fields.push({ section: 'Identity', label: 'Location', value: user.location,
        source: 'github.com', sourceUrl: user.html_url })
    }
    if (user.company) {
      fields.push({ section: 'Identity', label: 'Employer', value: user.company.replace(/^@/, ''),
        source: 'github.com', sourceUrl: user.html_url })
    }

    // Get repos for skills
    const reposRes = await fetch(
      `https://api.github.com/users/${best.login}/repos?sort=stars&per_page=30&type=owner`,
      { headers, next: { revalidate: 0 } }
    )
    if (reposRes.ok) {
      const repos = await reposRes.json()
      const ownRepos = (repos || []).filter((r: any) => !r.fork)
      const langMap = new Map<string, number>()
      for (const repo of ownRepos) {
        if (repo.language) {
          langMap.set(repo.language, (langMap.get(repo.language) || 0) + 1)
        }
      }
      for (const [lang, count] of [...langMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
        const level = count >= 20 ? 'Expert' : count >= 10 ? 'Advanced' : count >= 5 ? 'Intermediate' : 'Familiar'
        fields.push({ section: 'Skills', label: lang, value: `${level} · ${count} repos`,
          source: 'github.com', sourceUrl: user.html_url })
      }
      if (ownRepos.length > 0) {
        fields.push({ section: 'Skills', label: 'Open Source',
          value: `${ownRepos.length} public repos`,
          source: 'github.com', sourceUrl: user.html_url })
      }
    }
  } catch (err) {
    console.error('Background GitHub discovery error:', err)
  }
  return fields
}

async function discoverScholarBasic(fullName: string): Promise<SeededField[]> {
  const fields: SeededField[] = []
  const serpApiKey = process.env.SERPAPI_KEY
  if (!serpApiKey) return fields

  try {
    const query = `author:"${fullName}"`
    const url = `https://serpapi.com/search.json?engine=google_scholar&q=${encodeURIComponent(query)}&hl=en&api_key=${serpApiKey}`
    const res = await fetch(url, { next: { revalidate: 0 } })
    if (!res.ok) return fields

    const data = await res.json()
    const results = data.organic_results || []
    if (results.length > 0) {
      fields.push({
        section: 'Interests (intellectual)', label: 'Published Research',
        value: `${results.length}+ results found`,
        source: 'scholar.google.com',
        sourceUrl: data.search_metadata?.google_scholar_url || '',
      })
    }
  } catch (err) {
    console.error('Background Scholar discovery error:', err)
  }
  return fields
}

// ═══ Main handler ═══

export async function POST(request: NextRequest) {
  try {
    // Verify admin/service authorization
    const authHeader = request.headers.get('authorization')
    const apiKey = request.headers.get('x-api-key')
    const validKey = process.env.BACKGROUND_DISCOVER_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!authHeader?.includes('Bearer') && apiKey !== validKey) {
      return NextResponse.json({ error: 'Unauthorized — requires service key' }, { status: 401 })
    }

    const body: BackgroundDiscoverRequest = await request.json()
    if (!body.subjects || !Array.isArray(body.subjects) || body.subjects.length === 0) {
      return NextResponse.json({ error: 'subjects array is required' }, { status: 400 })
    }

    // Cap batch size
    const subjects = body.subjects.slice(0, 10)
    const admin = getAdmin()
    const results: { fullName: string; status: string; profileNumber?: string; fieldCount?: number; error?: string }[] = []

    for (const subject of subjects) {
      const { fullName, employer, city } = subject
      if (!fullName || fullName.trim().length < 2) {
        results.push({ fullName: fullName || '', status: 'skipped', error: 'Name too short' })
        continue
      }

      try {
        const handle = `@${fullName.toLowerCase().replace(/\s+/g, '.')}`

        // Check if already exists in directory
        const { data: existing } = await admin
          .from('directory')
          .select('id, seeding_status')
          .eq('handle', handle)
          .maybeSingle()

        if (existing) {
          results.push({ fullName, status: 'exists', error: `Already in directory (${existing.seeding_status})` })
          continue
        }

        // Also check profiles table
        const { data: existingProfile } = await admin
          .from('profiles')
          .select('id')
          .ilike('handle', handle)
          .maybeSingle()

        if (existingProfile) {
          results.push({ fullName, status: 'exists', error: 'Already in profiles table' })
          continue
        }

        // Run discovery (GitHub + basic Scholar)
        const [ghFields, scholarFields] = await Promise.allSettled([
          discoverGitHub(fullName, employer),
          discoverScholarBasic(fullName),
        ])

        const allFields: SeededField[] = []
        if (ghFields.status === 'fulfilled') allFields.push(...ghFields.value)
        if (scholarFields.status === 'fulfilled') allFields.push(...scholarFields.value)

        // Always add the identity baseline
        allFields.unshift({ section: 'Identity', label: 'Name', value: fullName.trim(),
          source: 'background-discovery', sourceUrl: '' })
        if (employer) {
          allFields.push({ section: 'Identity', label: 'Employer', value: employer.trim(),
            source: 'background-discovery', sourceUrl: '' })
        }
        if (city) {
          allFields.push({ section: 'Identity', label: 'City', value: city.trim(),
            source: 'background-discovery', sourceUrl: '' })
        }

        // Get next profile number
        const { data: lastEntry } = await admin
          .from('directory')
          .select('profile_number')
          .order('profile_number', { ascending: false })
          .limit(1)

        let nextNum = 'SS-000001'
        if (lastEntry && lastEntry.length > 0) {
          const num = parseInt(lastEntry[0].profile_number.replace('SS-', ''), 10)
          nextNum = `SS-${String(num + 1).padStart(6, '0')}`
        }

        // Create FROZEN unclaimed directory stub
        // Per spec: trust_score = 0, seeding_status = 'unclaimed'
        const { data: dirEntry, error: dirErr } = await admin
          .from('directory')
          .insert({
            profile_number: nextNum,
            handle,
            display_name: fullName.trim(),
            endpoint_url: '',
            domain: '',
            domain_verified: false,
            status: 'active',
            seeding_status: 'unclaimed',
            trust_score: 0,
            location: city || null,
          })
          .select('id')
          .single()

        if (dirErr) {
          results.push({ fullName, status: 'error', error: `Directory insert failed: ${dirErr.message}` })
          continue
        }

        // Also create a profiles table entry so it appears in platform directory
        // Per spec five properties: trust=0, not queryable, not editable, visible w/ badge, no marketing
        const skillTags = allFields.filter(f => f.section === 'Skills').map(f => f.label).slice(0, 10)
        const interestTags = allFields.filter(f => f.section.startsWith('Interests')).map(f => f.label).slice(0, 10)

        await admin
          .from('profiles')
          .insert({
            handle,
            display_name: fullName.trim(),
            profile_number: nextNum,
            location: city || null,
            trust_score: 0,
            presence_score: 0,
            status: 'active',
            seeding_status: 'unclaimed',
            role: 'owner',
            skills_count: skillTags.length,
            interests_tags: interestTags,
            price_public: 0,
            price_private: 0,
            price_marketing: 0,
          })

        // Save fields to profile_fields table
        if (dirEntry && allFields.length > 0) {
          const now = ts()
          const fieldRows = allFields.map((f, i) => ({
            profile_id: dirEntry.id,
            section: f.section,
            label: f.label,
            value: f.value,
            provenance_status: 'seeded',
            source_url: f.sourceUrl || null,
            source_name: f.source || 'background-discovery',
            seeded_at: now,
            confidence_score: getSourceConfidence(f.source),
            sort_order: i,
          }))

          await admin.from('profile_fields').insert(fieldRows)
        }

        results.push({
          fullName,
          status: 'created',
          profileNumber: nextNum,
          fieldCount: allFields.length,
        })
      } catch (subjectErr) {
        console.error(`Background discover error for ${fullName}:`, subjectErr)
        results.push({ fullName, status: 'error', error: String(subjectErr) })
      }
    }

    const created = results.filter(r => r.status === 'created').length
    const skipped = results.filter(r => r.status !== 'created').length

    return NextResponse.json({
      success: true,
      summary: { total: subjects.length, created, skipped },
      results,
    })
  } catch (err) {
    console.error('Background discovery error:', err)
    return NextResponse.json({ error: 'Background discovery failed' }, { status: 500 })
  }
}
