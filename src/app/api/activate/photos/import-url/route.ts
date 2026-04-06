import { NextRequest, NextResponse } from 'next/server'
import {
  extractExif,
  reverseGeocode,
  convertToWebP,
  computeHash,
  suggestChapter,
  buildCaption,
  type NarrativeChapter,
} from '@/lib/photo-processing'

// ═══════════════════════════════════════════════════
// Photo Import from URL
// ═══════════════════════════════════════════════════
// Fetches an image from a given URL, processes it
// (EXIF extraction, WebP conversion, SHA-256 hash),
// and returns enriched photo metadata.

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url, chapter: chapterParam, caption: captionParam } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Validate URL
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol')
      }
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    // Fetch the image
    const fetchRes = await fetch(url, {
      headers: {
        'User-Agent': 'SearchStar/1.0 (https://searchstar.com)',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!fetchRes.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: HTTP ${fetchRes.status}` },
        { status: 400 }
      )
    }

    const contentType = fetchRes.headers.get('content-type') || ''
    if (!contentType.startsWith('image/')) {
      return NextResponse.json(
        { error: `URL does not point to an image (got ${contentType})` },
        { status: 400 }
      )
    }

    const arrayBuf = await fetchRes.arrayBuffer()
    const buffer = Buffer.from(arrayBuf)

    // Validate size (max 20MB)
    if (buffer.length > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image too large (max 20MB)' }, { status: 400 })
    }

    // 1. Extract EXIF
    const exif = await extractExif(buffer)

    // 2. Reverse geocode if GPS
    let location = ''
    if (exif.latitude !== null && exif.longitude !== null) {
      location = await reverseGeocode(exif.latitude, exif.longitude)
    }

    // 3. Convert to WebP
    const webpBuffer = await convertToWebP(buffer)

    // 4. SHA-256 hash
    const hash = computeHash(webpBuffer)

    // 5. Extract filename from URL for heuristics
    const filename = parsedUrl.pathname.split('/').pop() || ''

    // 6. Chapter suggestion
    const chapter: NarrativeChapter = (chapterParam as NarrativeChapter) || suggestChapter(filename, exif.date, location)

    // 7. Caption
    const caption = captionParam || buildCaption(filename)

    // 8. WebP as base64 for preview
    const webpBase64 = `data:image/webp;base64,${webpBuffer.toString('base64')}`

    return NextResponse.json({
      id: `url-${Date.now()}`,
      chapter,
      caption,
      date: exif.date || new Date().toISOString().split('T')[0],
      location,
      source: 'url',
      sourceLabel: parsedUrl.hostname,
      previewUrl: webpBase64,
      relatedFields: [],
      hash,
      accessTier: 'public',
      webpSize: webpBuffer.length,
      originalUrl: url,
      exif: {
        cameraMake: exif.cameraMake,
        cameraModel: exif.cameraModel,
        latitude: exif.latitude,
        longitude: exif.longitude,
      },
    })
  } catch (err) {
    console.error('URL import error:', err)
    return NextResponse.json(
      { error: 'Failed to process image from URL' },
      { status: 500 }
    )
  }
}
