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
// Photo Upload — Device Upload Processing
// ═══════════════════════════════════════════════════
// Receives a multipart file upload, extracts EXIF metadata
// (date, GPS→location), converts to WebP, generates SHA-256
// hash, and returns enriched photo metadata.

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const chapterParam = formData.get('chapter') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    // Validate file size (max 20MB raw)
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 20MB)' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // 1. Extract EXIF
    const exif = await extractExif(buffer)

    // 2. Reverse geocode if GPS coordinates found
    let location = ''
    if (exif.latitude !== null && exif.longitude !== null) {
      location = await reverseGeocode(exif.latitude, exif.longitude)
    }

    // 3. Convert to WebP (max 2048px long edge)
    const webpBuffer = await convertToWebP(buffer)

    // 4. SHA-256 hash of the WebP output
    const hash = computeHash(webpBuffer)

    // 5. Auto-suggest chapter
    const chapter: NarrativeChapter = (chapterParam as NarrativeChapter) || suggestChapter(file.name, exif.date, location)

    // 6. Build caption from filename
    const caption = buildCaption(file.name)

    // 7. Encode WebP as base64 data URL for client preview
    const webpBase64 = `data:image/webp;base64,${webpBuffer.toString('base64')}`

    return NextResponse.json({
      id: `upload-${Date.now()}`,
      chapter,
      caption,
      date: exif.date || new Date().toISOString().split('T')[0],
      location,
      source: 'upload',
      sourceLabel: 'Uploaded',
      previewUrl: webpBase64,
      relatedFields: [],
      hash,
      accessTier: 'public',
      webpSize: webpBuffer.length,
      exif: {
        cameraMake: exif.cameraMake,
        cameraModel: exif.cameraModel,
        latitude: exif.latitude,
        longitude: exif.longitude,
      },
    })
  } catch (err) {
    console.error('Photo upload error:', err)
    return NextResponse.json(
      { error: 'Failed to process photo' },
      { status: 500 }
    )
  }
}
