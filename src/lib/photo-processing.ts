import sharp from 'sharp'
import { createHash } from 'crypto'

// ═══════════════════════════════════════════════════
// Photo Processing Utilities — Phase 5
// ═══════════════════════════════════════════════════
// Shared by: upload, import-url, enrich-google
// Spec reference: Section 3.9 "Photo metadata schema", "Photo hosting"

export type NarrativeChapter = 'intellectual' | 'social' | 'athletic' | 'professional' | 'aesthetic' | 'family'
export type AccessTier = 'public' | 'private' | 'marketing'

export interface PhotoMetadata {
  type: 'photo'
  url: string
  hash: string
  accessTier: AccessTier
  narrative: {
    chapter: NarrativeChapter
    caption: string
    date: string
    location: string
    relatedFields: string[]
  }
  provenance: {
    status: 'discovered' | 'confirmed' | 'self_reported'
    source: string
    discoveredAt: string
  }
  validation: {
    validatedBy: string[]
    stake: number
  }
}

export interface ExifData {
  date: string | null
  latitude: number | null
  longitude: number | null
  cameraMake: string | null
  cameraModel: string | null
}

// ═══ EXIF Extraction ═══

export async function extractExif(buffer: Buffer): Promise<ExifData> {
  // Dynamic import — exifr is ESM-only
  const exifr = await import('exifr')
  
  try {
    const parsed = await exifr.parse(buffer, {
      pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate', 'GPSLatitude', 'GPSLongitude', 'Make', 'Model'],
      gps: true,
    })

    if (!parsed) {
      return { date: null, latitude: null, longitude: null, cameraMake: null, cameraModel: null }
    }

    // Extract date — try multiple EXIF date fields
    let date: string | null = null
    const rawDate = parsed.DateTimeOriginal || parsed.CreateDate || parsed.ModifyDate
    if (rawDate) {
      if (rawDate instanceof Date) {
        date = rawDate.toISOString().split('T')[0]
      } else if (typeof rawDate === 'string') {
        // EXIF dates can be "YYYY:MM:DD HH:MM:SS"
        date = rawDate.replace(/^(\d{4}):(\d{2}):(\d{2}).*/, '$1-$2-$3')
      }
    }

    // GPS coordinates — exifr with gps:true returns decimal degrees
    const latitude = typeof parsed.latitude === 'number' ? parsed.latitude : null
    const longitude = typeof parsed.longitude === 'number' ? parsed.longitude : null

    return {
      date,
      latitude,
      longitude,
      cameraMake: parsed.Make || null,
      cameraModel: parsed.Model || null,
    }
  } catch (err) {
    console.error('EXIF extraction failed:', err)
    return { date: null, latitude: null, longitude: null, cameraMake: null, cameraModel: null }
  }
}

// ═══ Reverse Geocoding ═══

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    // BigDataCloud — free, no API key, returns structured location data
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
      { signal: AbortSignal.timeout(5000) }
    )

    if (!res.ok) {
      throw new Error(`Geocode HTTP ${res.status}`)
    }

    const data = await res.json()
    
    // Build a human-readable location string
    const parts: string[] = []
    if (data.locality) parts.push(data.locality)
    else if (data.city) parts.push(data.city)
    
    if (data.principalSubdivision) parts.push(data.principalSubdivision)
    
    if (parts.length === 0 && data.countryName) {
      parts.push(data.countryName)
    }

    return parts.join(', ') || ''
  } catch (err) {
    console.error('Reverse geocoding failed:', err)
    
    // Fallback: try OpenStreetMap Nominatim
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`,
        {
          headers: { 'User-Agent': 'SearchStar/1.0 (https://searchstar.com)' },
          signal: AbortSignal.timeout(5000),
        }
      )
      if (!res.ok) return ''
      const data = await res.json()
      const addr = data.address || {}
      const parts: string[] = []
      if (addr.city || addr.town || addr.village) parts.push(addr.city || addr.town || addr.village)
      if (addr.state) parts.push(addr.state)
      return parts.join(', ') || ''
    } catch {
      return ''
    }
  }
}

// ═══ WebP Conversion ═══

export async function convertToWebP(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize({
      width: 2048,
      height: 2048,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer()
}

// ═══ SHA-256 Hash ═══

export function computeHash(buffer: Buffer): string {
  return `sha256:${createHash('sha256').update(buffer).digest('hex')}`
}

// ═══ Chapter Suggestion Heuristics ═══

export function suggestChapter(
  filename: string,
  date: string | null,
  location: string | null
): NarrativeChapter {
  const lower = (filename + ' ' + (location || '')).toLowerCase()

  // Athletic keywords
  if (/\b(run|race|marathon|gym|swim|bike|hike|trail|fitness|workout|match|game|sport|climb|strava)\b/.test(lower)) {
    return 'athletic'
  }

  // Professional keywords
  if (/\b(office|meeting|conference|presentation|work|team|headshot|corporate|summit|pitch|cowork)\b/.test(lower)) {
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

  // Date-based heuristic: weekend → social, weekday → professional
  if (date) {
    const dayOfWeek = new Date(date).getDay()
    if (dayOfWeek === 0 || dayOfWeek === 6) return 'social'
    return 'professional'
  }

  return 'aesthetic'
}

// ═══ Build Caption from Filename ═══

export function buildCaption(filename: string): string {
  const name = filename
    .replace(/\.[^/.]+$/, '')
    .replace(/IMG_\d+/i, '')
    .replace(/DSC_?\d+/i, '')
    .replace(/PXL_\d+/i, '')
    .replace(/[_-]+/g, ' ')
    .trim()

  return name.length > 3 ? name : 'Photo'
}
