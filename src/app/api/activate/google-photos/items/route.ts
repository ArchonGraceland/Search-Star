import { NextRequest, NextResponse } from 'next/server'

// ═══════════════════════════════════════════════════
// Google Photos Picker — Retrieve Media Items
// Fetches all picked items from the completed session,
// maps them into NarrativePhoto format with auto-
// suggested chapter assignments.
// ═══════════════════════════════════════════════════

const PICKER_API_BASE = 'https://photospicker.googleapis.com/v1'

type NarrativeChapter = 'intellectual' | 'social' | 'athletic' | 'professional' | 'aesthetic' | 'family'

interface NarrativePhoto {
  id: string
  chapter: NarrativeChapter
  caption: string
  date: string
  location: string
  source: 'google'
  sourceLabel: string
  previewUrl: string
  relatedFields: string[]
}

// Google Picker media item shape (subset of fields we use)
interface PickedMediaItem {
  id: string
  createTime?: string
  type?: string
  mediaFile?: {
    baseUrl?: string
    mimeType?: string
    filename?: string
    mediaFileMetadata?: {
      width?: string
      height?: string
      cameraMake?: string
      cameraModel?: string
      photo?: Record<string, unknown>
      video?: Record<string, unknown>
    }
  }
}

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get('gphotos_access_token')?.value
  const sessionId = request.nextUrl.searchParams.get('sessionId')

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Not authenticated with Google Photos.' },
      { status: 401 }
    )
  }

  if (!sessionId) {
    return NextResponse.json(
      { error: 'Missing sessionId parameter.' },
      { status: 400 }
    )
  }

  try {
    // Fetch all pages of media items
    const allItems: PickedMediaItem[] = []
    let pageToken: string | undefined

    do {
      const params = new URLSearchParams({
        sessionId,
        pageSize: '100',
      })
      if (pageToken) params.set('pageToken', pageToken)

      const itemsResponse = await fetch(
        `${PICKER_API_BASE}/mediaItems?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      )

      if (!itemsResponse.ok) {
        const errBody = await itemsResponse.text()
        console.error('Fetch media items failed:', itemsResponse.status, errBody)

        if (itemsResponse.status === 401) {
          return NextResponse.json(
            { error: 'Token expired', code: 'TOKEN_EXPIRED' },
            { status: 401 }
          )
        }

        // FAILED_PRECONDITION = user hasn't finished picking yet
        if (itemsResponse.status === 400 || itemsResponse.status === 409) {
          return NextResponse.json(
            { error: 'User has not finished selecting photos. Continue polling.', code: 'NOT_READY' },
            { status: 409 }
          )
        }

        return NextResponse.json(
          { error: `Failed to fetch items: ${errBody}` },
          { status: itemsResponse.status }
        )
      }

      const data = await itemsResponse.json()
      if (data.mediaItems) {
        allItems.push(...data.mediaItems)
      }
      pageToken = data.nextPageToken
    } while (pageToken)

    // Map to NarrativePhoto format
    const photos: NarrativePhoto[] = allItems
      .filter(item => item.type !== 'VIDEO') // Only photos for narrative
      .map((item, index) => mapToNarrativePhoto(item, index))

    // Clean up: delete the session (best effort)
    try {
      await fetch(
        `${PICKER_API_BASE}/sessions/${encodeURIComponent(sessionId)}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }
      )
    } catch {
      // Session cleanup is best-effort
    }

    return NextResponse.json({ photos })
  } catch (err) {
    console.error('Fetch items error:', err)
    return NextResponse.json(
      { error: 'Internal error fetching media items' },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════
// Map a Google Photos PickedMediaItem → NarrativePhoto
// ═══════════════════════════════════════════════════

function mapToNarrativePhoto(item: PickedMediaItem, index: number): NarrativePhoto {
  const filename = item.mediaFile?.filename || ''
  const createTime = item.createTime || ''
  const date = createTime ? createTime.split('T')[0] : ''

  // Build a preview URL from the baseUrl
  // Google requires width/height params on base URLs
  const baseUrl = item.mediaFile?.baseUrl || ''
  const previewUrl = baseUrl ? `${baseUrl}=w800-h600` : ''

  // Extract dimensions
  const width = item.mediaFile?.mediaFileMetadata?.width
  const height = item.mediaFile?.mediaFileMetadata?.height

  // Auto-suggest chapter from filename and date heuristics
  const chapter = suggestChapter(filename, date)

  // Build a caption from filename
  const caption = buildCaption(filename, date)

  return {
    id: `gphotos-${item.id || index}`,
    chapter,
    caption,
    date,
    location: '', // Picker API doesn't expose GPS; user can fill in manually
    source: 'google',
    sourceLabel: 'Google Photos',
    previewUrl,
    relatedFields: buildRelatedFields(chapter, width, height),
  }
}

// ═══════════════════════════════════════════════════
// Chapter auto-suggestion heuristics (v1)
// ═══════════════════════════════════════════════════

function suggestChapter(filename: string, date: string): NarrativeChapter {
  const lower = filename.toLowerCase()

  // Athletic keywords
  if (/\b(run|race|marathon|gym|swim|bike|hike|trail|fitness|workout|match|game|sport|climb)\b/.test(lower)) {
    return 'athletic'
  }

  // Professional keywords
  if (/\b(office|meeting|conference|presentation|work|team|headshot|corporate|summit|pitch)\b/.test(lower)) {
    return 'professional'
  }

  // Intellectual keywords
  if (/\b(book|library|lecture|university|campus|graduation|diploma|seminar|talk|panel|keynote|research|lab)\b/.test(lower)) {
    return 'intellectual'
  }

  // Family keywords
  if (/\b(family|wedding|birthday|holiday|christmas|thanksgiving|baby|kid|child|parent|home)\b/.test(lower)) {
    return 'family'
  }

  // Social keywords
  if (/\b(dinner|party|friends|gathering|reunion|celebration|bar|restaurant|concert|festival|trip|travel|vacation)\b/.test(lower)) {
    return 'social'
  }

  // Aesthetic keywords
  if (/\b(art|museum|gallery|design|photo|paint|sculpture|architecture|sunset|landscape|nature)\b/.test(lower)) {
    return 'aesthetic'
  }

  // Date-based heuristic: weekend photos → social, weekday → professional
  if (date) {
    const dayOfWeek = new Date(date).getDay()
    if (dayOfWeek === 0 || dayOfWeek === 6) return 'social'
    return 'professional'
  }

  return 'aesthetic' // default
}

function buildCaption(filename: string, date: string): string {
  // Strip extension and clean up common patterns
  const name = filename
    .replace(/\.[^/.]+$/, '')      // remove extension
    .replace(/IMG_\d+/i, '')       // remove IMG_XXXX
    .replace(/DSC_?\d+/i, '')      // remove DSC_XXXX
    .replace(/PXL_\d+/i, '')       // remove PXL_XXXX
    .replace(/[_-]+/g, ' ')        // underscores/dashes → spaces
    .trim()

  if (name.length > 3) {
    return name
  }

  if (date) {
    return `Photo from ${formatDate(date)}`
  }

  return 'Imported from Google Photos'
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function buildRelatedFields(chapter: NarrativeChapter, width?: string, height?: string): string[] {
  const fields: string[] = []

  // Map chapter → likely related profile fields
  const chapterFieldMap: Record<NarrativeChapter, string[]> = {
    intellectual: ['interests.intellectual'],
    social: ['interests.social'],
    athletic: ['interests.athletic'],
    professional: ['skills', 'professional_history'],
    aesthetic: ['interests.aesthetic'],
    family: ['identity.family'],
  }

  fields.push(...(chapterFieldMap[chapter] || []))

  // Add dimension metadata as related context
  if (width && height) {
    fields.push(`dimensions:${width}x${height}`)
  }

  return fields
}
