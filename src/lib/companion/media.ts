import type Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'
import { isImageUrl, isVideoUrl } from '@/lib/media'

// Helpers the Companion uses to turn a session post's media into model input.
//
// Two responsibilities:
//   1. Build Anthropic image blocks from image URLs. Cloudinary delivers the
//      images we host, and those URLs are publicly reachable, so we pass the
//      URL directly to the model via URLImageSource rather than fetching and
//      base64-encoding. One fewer roundtrip, and the SDK >= 0.90 supports it.
//   2. Transcribe videos once via Groq Whisper and cache the result on
//      room_messages.transcript. The day-90 summary reads many posts, so
//      a per-post cache matters for both latency and cost; /reflect benefits
//      too on the handful of calls that replay an earlier session.
//
// Both helpers are tolerant of failure: the image builder skips unknown URLs,
// and getOrFetchTranscript returns a short human-readable placeholder string
// if transcription fails rather than throwing. The Companion remains callable
// even when media handling degrades.

type ImageBlockParam = Anthropic.Messages.ImageBlockParam

/**
 * Build Anthropic image blocks from a media_urls array. URLs that don't
 * look like images (videos, unknown) are silently skipped. Callers compose
 * these into a content array alongside text blocks.
 */
export function buildImageBlocks(mediaUrls: string[] | null | undefined): ImageBlockParam[] {
  if (!mediaUrls || mediaUrls.length === 0) return []
  const blocks: ImageBlockParam[] = []
  for (const url of mediaUrls) {
    if (!url || typeof url !== 'string') continue
    if (!isImageUrl(url)) continue
    blocks.push({
      type: 'image',
      source: { type: 'url', url },
    })
  }
  return blocks
}

// ---------------------------------------------------------------------------
// Video transcription via Groq Whisper
// ---------------------------------------------------------------------------
//
// Groq hosts whisper-large-v3 on an OpenAI-compatible endpoint. A POST to
// /openai/v1/audio/transcriptions with the audio file (multipart) returns
// { text: "..." } in ~seconds. We point Whisper directly at the Cloudinary
// video URL via a streamed fetch — Groq's API accepts the file, not the URL,
// so we bounce the bytes through the serverless function.
//
// Placeholder-on-failure: the string returned below is prepended to the
// session body when the real transcript is unavailable, so the Companion
// knows media was present without being misled about its content.

const GROQ_TRANSCRIBE_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const GROQ_MODEL = 'whisper-large-v3'
const UNAVAILABLE_PLACEHOLDER = '[video attached — transcription unavailable]'

/**
 * Resolve a transcript for a post's video media, reading from the cache
 * first and calling Whisper only when the cache is cold. Persists the
 * transcript on success.
 *
 * Returns:
 *   - the cached or freshly-fetched transcript text on success,
 *   - a short placeholder string when a video is present but transcription
 *     failed (never cached, so a retry on the next call is possible),
 *   - null when no video is present in media_urls at all.
 *
 * Never throws. Errors are logged, not surfaced.
 */
export async function getOrFetchTranscript(
  postId: string,
  mediaUrls: string[] | null | undefined,
  cachedTranscript: string | null
): Promise<string | null> {
  // No videos → no transcript work. Callers skip media handling entirely.
  const videoUrl = (mediaUrls ?? []).find((u) => typeof u === 'string' && isVideoUrl(u))
  if (!videoUrl) return null

  // Cache hit.
  if (cachedTranscript && cachedTranscript.trim().length > 0) {
    return cachedTranscript
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    console.error('Companion transcription: GROQ_API_KEY is not set')
    return UNAVAILABLE_PLACEHOLDER
  }

  try {
    // Groq's Whisper endpoint caps request bodies at 25 MB. A typical
    // practitioner video uploaded from a phone is 20–40 MB because mp4
    // bundles audio + video tracks + high-bitrate encoding. Sending the
    // whole video fails with HTTP 413 on anything longer than about 15
    // seconds, which is a regression against our product guidance ("keep
    // videos under 15 seconds" is a suggestion, not a hard upload cap).
    //
    // Cloudinary's URL transforms include a video-to-audio extractor:
    // rewriting a ".../video/upload/.../file.mp4" URL to ".mp3" on the
    // tail makes Cloudinary ffmpeg-extract the audio track on the fly
    // and cache it at the new URL. In practice the audio is 10–100x
    // smaller than the source video — the 30 MB test video reduced to
    // 266 KB of mp3. Whisper cares about audio anyway.
    //
    // Fallback: if the URL doesn't look like a Cloudinary delivery URL
    // (unlikely in practice — all our uploads go through Cloudinary),
    // fetch the original bytes and let Groq size-check it. Better to
    // try and fail with a real error than to silently do nothing.
    const transcodeUrl = buildAudioTranscodeUrl(videoUrl)
    const audioRes = await fetch(transcodeUrl)
    if (!audioRes.ok) {
      console.error('Companion transcription: audio extract fetch failed', {
        postId,
        transcodeUrl,
        status: audioRes.status,
      })
      return UNAVAILABLE_PLACEHOLDER
    }
    const audioBlob = await audioRes.blob()

    const form = new FormData()
    // Filename drives Groq's content-type detection. Match the transcode
    // extension so Groq parses the payload as mp3 rather than guessing
    // from magic bytes.
    const baseName = videoUrl.split('/').pop()?.split('?')[0]?.replace(/\.[^.]+$/, '') || 'audio'
    form.append('file', audioBlob, `${baseName}.mp3`)
    form.append('model', GROQ_MODEL)
    form.append('response_format', 'json')

    const groqRes = await fetch(GROQ_TRANSCRIBE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })

    if (!groqRes.ok) {
      const errText = await groqRes.text().catch(() => '')
      console.error('Companion transcription: Groq call failed', {
        postId,
        status: groqRes.status,
        body: errText.slice(0, 500),
      })
      return UNAVAILABLE_PLACEHOLDER
    }

    const data = (await groqRes.json()) as { text?: string }
    const transcript = (data.text ?? '').trim()

    if (transcript.length === 0) {
      return UNAVAILABLE_PLACEHOLDER
    }

    // Persist for next call. Errors here are non-fatal — we still return
    // the transcript to the caller; worst case we re-transcribe next time.
    try {
      const db = createServiceClient()
      await db
        .from('room_messages')
        .update({ transcript })
        .eq('id', postId)
    } catch (persistErr) {
      console.error('Companion transcription: persist failed', {
        postId,
        error: persistErr instanceof Error ? persistErr.message : String(persistErr),
      })
    }

    return transcript
  } catch (err) {
    console.error('Companion transcription: unexpected error', {
      postId,
      error: err instanceof Error ? err.message : String(err),
    })
    return UNAVAILABLE_PLACEHOLDER
  }
}

// ---------------------------------------------------------------------------
// Cloudinary video → audio URL transform
// ---------------------------------------------------------------------------
//
// Cloudinary delivers uploaded videos at URLs like:
//   https://res.cloudinary.com/<cloud>/video/upload/v<ver>/<folder>/<id>.mp4
//
// Changing the trailing extension to ".mp3" (and keeping the rest intact)
// makes Cloudinary extract and serve just the audio track, transcoded to
// mp3. First request triggers the transcode (a couple of seconds for a
// short video); subsequent requests hit the CDN cache. No auth required
// since our upload preset is unsigned and videos are publicly readable.
//
// Other Cloudinary extensions are accepted (webm, mov, etc.); we rewrite
// any of them. Non-Cloudinary URLs — unlikely in practice, all our
// uploads go through Cloudinary — are returned unchanged so the caller
// falls through to the old behavior (fetch bytes, send to Groq, probably
// 413, log, return placeholder). We don't try to detect "is this a
// Cloudinary URL" structurally because the /video/upload/ path marker
// is already enforced by isVideoUrl in src/lib/media.ts for any URL that
// reached this point.

function buildAudioTranscodeUrl(videoUrl: string): string {
  // Rewrite the extension only if it looks like a real file extension on
  // the path's last segment. Guard against query strings and fragments.
  const hashIdx = videoUrl.indexOf('#')
  const queryIdx = videoUrl.indexOf('?')
  const cutIdx = Math.min(
    hashIdx === -1 ? videoUrl.length : hashIdx,
    queryIdx === -1 ? videoUrl.length : queryIdx
  )
  const pathPart = videoUrl.slice(0, cutIdx)
  const tailPart = videoUrl.slice(cutIdx)
  // Match the last dot-extension on the path. The `i` flag is cosmetic —
  // Cloudinary lowercases extensions, but user-uploaded .MOV exists in
  // the wild.
  const extMatch = pathPart.match(/\.[a-zA-Z0-9]{2,5}$/)
  if (!extMatch) return videoUrl
  return `${pathPart.slice(0, -extMatch[0].length)}.mp3${tailPart}`
}
