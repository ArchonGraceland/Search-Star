import { NextRequest, NextResponse } from 'next/server'
import {
  extractExif,
  reverseGeocode,
  convertToWebP,
  computeHash,
  suggestChapter,
  type NarrativeChapter,
} from '@/lib/photo-processing'

// ═══════════════════════════════════════════════════
// Enrich Google Photos — Backfill EXIF GPS & Metadata
// ═══════════════════════════════════════════════════
// The Picker API doesn't expose GPS data. This endpoint
// downloads the actual image bytes via the baseUrl (with
// OAuth bearer token + =d param), extracts EXIF GPS,
// reverse geocodes to a location string, converts to WebP,
// and generates a SHA-256 hash.
//
// IMPORTANT: baseUrls expire after 60 minutes. This
// endpoint must be called promptly after import.

export const runtime = 'nodejs'

interface EnrichRequest {
  photos: {
    id: string
    previewUrl: string  // format: {baseUrl}=w800-h600
    chapter: NarrativeChapter
    caption: string
    date: string
  }[]
}

interface EnrichedPhoto {
  id: string
  date: string
  location: string
  hash: string
  accessTier: 'public'
  chapter: NarrativeChapter
  webpBase64: string
  webpSize: number
  exif: {
    cameraMake: string | null
    cameraModel: string | null
    latitude: number | null
    longitude: number | null
  }
}

export async function POST(request: NextRequest) {
  // Get the OAuth token from HttpOnly cookie
  const accessToken = request.cookies.get('gphotos_access_token')?.value

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Not authenticated with Google Photos.', code: 'TOKEN_EXPIRED' },
      { status: 401 }
    )
  }

  try {
    const body: EnrichRequest = await request.json()

    if (!body.photos || !Array.isArray(body.photos) || body.photos.length === 0) {
      return NextResponse.json({ error: 'No photos to enrich' }, { status: 400 })
    }

    // Process each photo — extract baseUrl from previewUrl, download, enrich
    const results: EnrichedPhoto[] = []
    const errors: { id: string; error: string }[] = []

    for (const photo of body.photos) {
      try {
        // Extract the raw baseUrl from the previewUrl format "{baseUrl}=w800-h600"
        // The baseUrl is everything before the last "=" parameter
        const baseUrl = extractBaseUrl(photo.previewUrl)
        if (!baseUrl) {
          errors.push({ id: photo.id, error: 'Could not extract baseUrl from previewUrl' })
          continue
        }

        // Download actual image bytes with OAuth token + =d download param
        const downloadUrl = `${baseUrl}=d`
        const fetchRes = await fetch(downloadUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
          signal: AbortSignal.timeout(30000),
        })

        if (!fetchRes.ok) {
          if (fetchRes.status === 401) {
            return NextResponse.json(
              { error: 'Google Photos token expired.', code: 'TOKEN_EXPIRED' },
              { status: 401 }
            )
          }
          errors.push({ id: photo.id, error: `Download failed: HTTP ${fetchRes.status}` })
          continue
        }

        const buffer = Buffer.from(await fetchRes.arrayBuffer())

        // 1. Extract EXIF
        const exif = await extractExif(buffer)

        // 2. Reverse geocode if GPS coordinates found
        let location = ''
        if (exif.latitude !== null && exif.longitude !== null) {
          location = await reverseGeocode(exif.latitude, exif.longitude)
        }

        // 3. Convert to WebP (max 2048px)
        const webpBuffer = await convertToWebP(buffer)

        // 4. SHA-256 hash
        const hash = computeHash(webpBuffer)

        // 5. Re-evaluate chapter if we now have location data
        const chapter = location
          ? suggestChapter(photo.caption, exif.date || photo.date, location)
          : photo.chapter

        // 6. WebP as base64 for preview
        const webpBase64 = `data:image/webp;base64,${webpBuffer.toString('base64')}`

        results.push({
          id: photo.id,
          date: exif.date || photo.date,
          location,
          hash,
          accessTier: 'public',
          chapter,
          webpBase64,
          webpSize: webpBuffer.length,
          exif: {
            cameraMake: exif.cameraMake,
            cameraModel: exif.cameraModel,
            latitude: exif.latitude,
            longitude: exif.longitude,
          },
        })

        // Small delay between downloads to be nice to Google's API
        if (body.photos.indexOf(photo) < body.photos.length - 1) {
          await new Promise(r => setTimeout(r, 200))
        }
      } catch (err) {
        console.error(`Error enriching photo ${photo.id}:`, err)
        errors.push({
          id: photo.id,
          error: err instanceof Error ? err.message : 'Processing failed',
        })
      }
    }

    return NextResponse.json({
      enriched: results,
      errors,
      summary: {
        total: body.photos.length,
        enriched: results.length,
        failed: errors.length,
      },
    })
  } catch (err) {
    console.error('Enrich Google Photos error:', err)
    return NextResponse.json(
      { error: 'Internal error enriching photos' },
      { status: 500 }
    )
  }
}

// ═══ Extract baseUrl from previewUrl ═══
// previewUrl format: "{baseUrl}=w800-h600"
// We need just the baseUrl part (everything before the "=" size params)

function extractBaseUrl(previewUrl: string): string | null {
  if (!previewUrl) return null

  // The Google Photos baseUrl ends just before the "=w" or "=s" or "=d" parameters
  // Format: https://lh3.googleusercontent.com/...=w800-h600
  // We want: https://lh3.googleusercontent.com/...
  const match = previewUrl.match(/^(.+?)=\w/)
  if (match) return match[1]

  // If no = params, the whole thing might be the baseUrl
  if (previewUrl.startsWith('http')) return previewUrl

  return null
}
