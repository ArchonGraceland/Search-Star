// ═══════════════════════════════════════════════════
// Photo Discovery Module
// Spec reference: Section 3.9 "Photo sourcing — Public discovery"
//
// Searches for publicly available images associated with
// an individual from: conference speaker pages, university
// faculty pages, company about pages, published articles
// with author headshots, public Flickr, event photography
// archives, and race photo services.
//
// Returns candidate photos with source URL, context,
// suggested chapter, and preview URL. All photos require
// explicit user approval — none are auto-included.
// ═══════════════════════════════════════════════════

export interface DiscoveredPhoto {
  id: string
  chapter: 'intellectual' | 'social' | 'athletic' | 'professional' | 'aesthetic' | 'family'
  caption: string
  date: string
  location: string
  source: 'public'
  sourceLabel: string
  previewUrl: string
  sourceUrl: string
  sourceContext: string
  relatedFields: string[]
  accessTier: 'public' | 'private' | 'marketing'
  hash: string
}

// ═══ Chapter assignment rules per spec ═══
// conference/university → intellectual
// race/athletic → athletic
// company/professional → professional
// article/social → intellectual
// flickr/event → aesthetic

interface PhotoSourceConfig {
  label: string
  queries: (fullName: string, employer?: string, city?: string) => string[]
  chapter: DiscoveredPhoto['chapter']
  contextPrefix: string
}

const PHOTO_SOURCES: PhotoSourceConfig[] = [
  {
    label: 'Conference speaker pages',
    queries: (name, employer) => [
      `"${name}" speaker photo`,
      `"${name}" conference keynote headshot`,
      employer ? `"${name}" "${employer}" speaker` : '',
    ].filter(Boolean),
    chapter: 'intellectual',
    contextPrefix: 'Conference speaker',
  },
  {
    label: 'University faculty pages',
    queries: (name) => [
      `"${name}" faculty photo professor`,
      `"${name}" university department headshot`,
    ],
    chapter: 'intellectual',
    contextPrefix: 'Faculty page',
  },
  {
    label: 'Company about pages',
    queries: (name, employer) => [
      employer ? `"${name}" "${employer}" about team photo` : `"${name}" about team company headshot`,
      employer ? `"${name}" "${employer}" leadership team` : '',
    ].filter(Boolean),
    chapter: 'professional',
    contextPrefix: 'Company page',
  },
  {
    label: 'Published articles',
    queries: (name) => [
      `"${name}" author headshot photo article`,
      `"${name}" published by portrait`,
    ],
    chapter: 'intellectual',
    contextPrefix: 'Article author',
  },
  {
    label: 'Race & athletic photos',
    queries: (name) => [
      `"${name}" marathon race photo finish`,
      `"${name}" triathlon running cycling photo`,
    ],
    chapter: 'athletic',
    contextPrefix: 'Race photo',
  },
  {
    label: 'Event photography',
    queries: (name) => [
      `"${name}" event photo gala award`,
    ],
    chapter: 'aesthetic',
    contextPrefix: 'Event photo',
  },
]

// ═══ Filtering: skip low-quality / irrelevant results ═══

const BLOCKED_DOMAINS = new Set([
  'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
  'pinterest.com', 'tiktok.com', 'youtube.com',
  'stock.adobe.com', 'shutterstock.com', 'gettyimages.com',
  'istockphoto.com', 'dreamstime.com', 'depositphotos.com',
  'alamy.com', '123rf.com', 'bigstockphoto.com',
  'gravatar.com', 'ui-avatars.com',
])

function isBlockedDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '')
    return BLOCKED_DOMAINS.has(hostname) ||
      hostname.endsWith('.fbcdn.net') ||
      hostname.endsWith('.twimg.com')
  } catch {
    return true
  }
}

function isLikelyPhoto(url: string): boolean {
  const lower = url.toLowerCase()
  // Must be an image URL or from a page likely to contain photos
  return /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(lower) ||
    lower.includes('/photo') ||
    lower.includes('/image') ||
    lower.includes('/headshot') ||
    lower.includes('/speaker') ||
    lower.includes('/faculty') ||
    lower.includes('/team')
}

function safeHostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url.slice(0, 40) }
}

// ═══ SerpAPI Google Images search ═══

interface SerpImageResult {
  title: string
  link: string
  original: string
  thumbnail: string
  source: string
  source_name?: string
  position: number
}

async function searchImages(query: string, serpApiKey: string): Promise<SerpImageResult[]> {
  try {
    const url = `https://serpapi.com/search.json?engine=google_images&q=${encodeURIComponent(query)}&num=5&safe=active&api_key=${serpApiKey}`
    const res = await fetch(url, { next: { revalidate: 0 } })
    if (!res.ok) {
      console.error(`SerpAPI images search failed: ${res.status}`)
      return []
    }
    const data = await res.json()
    return (data.images_results || []).slice(0, 5)
  } catch (err) {
    console.error('SerpAPI images error:', err)
    return []
  }
}

// ═══ Google Custom Search API (fallback if configured) ═══

async function searchImagesCSE(query: string): Promise<SerpImageResult[]> {
  const cseKey = process.env.GOOGLE_CSE_KEY
  const cseId = process.env.GOOGLE_CSE_ID
  if (!cseKey || !cseId) return []

  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${cseKey}&cx=${cseId}&q=${encodeURIComponent(query)}&searchType=image&num=5&safe=active`
    const res = await fetch(url, { next: { revalidate: 0 } })
    if (!res.ok) return []
    const data = await res.json()
    return (data.items || []).map((item: any, i: number) => ({
      title: item.title || '',
      link: item.image?.contextLink || item.link || '',
      original: item.link || '',
      thumbnail: item.image?.thumbnailLink || item.link || '',
      source: item.displayLink || '',
      position: i,
    }))
  } catch {
    return []
  }
}

// ═══ Main discovery function ═══

let photoIdCounter = 0

export async function discoverPhotos(
  fullName: string,
  employer?: string,
  city?: string
): Promise<{
  photos: DiscoveredPhoto[]
  sourcesSearched: { name: string; status: 'found' | 'not_found' | 'error' }[]
}> {
  const serpApiKey = process.env.SERPAPI_KEY
  if (!serpApiKey) {
    console.log('SERPAPI_KEY not configured — skipping photo discovery')
    return { photos: [], sourcesSearched: [] }
  }

  const allPhotos: DiscoveredPhoto[] = []
  const sourcesSearched: { name: string; status: 'found' | 'not_found' | 'error' }[] = []
  const seenUrls = new Set<string>()
  const ts = new Date().toISOString()

  // Run source categories sequentially to avoid rate limiting
  // (SerpAPI has per-second limits)
  for (const sourceConfig of PHOTO_SOURCES) {
    const queries = sourceConfig.queries(fullName, employer, city)
    let foundCount = 0

    for (const query of queries) {
      if (!query) continue

      // Try SerpAPI first, fall back to CSE
      let results = await searchImages(query, serpApiKey)
      if (results.length === 0) {
        results = await searchImagesCSE(query)
      }

      for (const result of results) {
        const imageUrl = result.original || result.link
        const thumbnailUrl = result.thumbnail || imageUrl
        const pageUrl = result.link || imageUrl
        const sourceDomain = result.source || safeHostname(pageUrl)

        // Dedup by URL
        if (seenUrls.has(imageUrl)) continue

        // Filter out blocked domains
        if (isBlockedDomain(imageUrl) || isBlockedDomain(pageUrl)) continue

        // Verify the result title contains at least part of the person's name
        const nameParts = fullName.toLowerCase().split(/\s+/)
        const titleLower = (result.title || '').toLowerCase()
        const sourceNameLower = (result.source_name || sourceDomain).toLowerCase()
        const combinedText = `${titleLower} ${sourceNameLower}`
        const nameMatch = nameParts.some(part => combinedText.includes(part))
        if (!nameMatch) continue

        seenUrls.add(imageUrl)
        foundCount++

        const caption = result.title
          ? result.title.replace(/\s*[-–—|]\s*.*$/, '').slice(0, 120)
          : `${sourceConfig.contextPrefix}: ${sourceDomain}`

        allPhotos.push({
          id: `discovered-${++photoIdCounter}-${Date.now()}`,
          chapter: sourceConfig.chapter,
          caption,
          date: '',
          location: '',
          source: 'public',
          sourceLabel: `${sourceConfig.contextPrefix} · ${sourceDomain}`,
          previewUrl: thumbnailUrl,
          sourceUrl: pageUrl,
          sourceContext: sourceConfig.label,
          relatedFields: [],
          accessTier: 'public',
          hash: '',
        })
      }

      // Small delay between queries to avoid rate limiting
      if (queries.indexOf(query) < queries.length - 1) {
        await new Promise(r => setTimeout(r, 300))
      }
    }

    sourcesSearched.push({
      name: sourceConfig.label,
      status: foundCount > 0 ? 'found' : 'not_found',
    })
  }

  return { photos: allPhotos, sourcesSearched }
}
