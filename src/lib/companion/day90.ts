import { createServiceClient } from '@/lib/supabase/server'
import type Anthropic from '@anthropic-ai/sdk'
import {
  getAnthropic,
  COMPANION_MODEL,
  DAY90_SUMMARY_SYSTEM_PROMPT,
} from '@/lib/anthropic'
import { buildImageBlocks, getOrFetchTranscript } from '@/lib/companion/media'
import { isVideoUrl } from '@/lib/media'

// Shared library used by both POST /api/companion/day90-summary and the
// server-component sponsor page. Keeping this in a plain TS module means the
// server component can call summarize() directly without doing an internal
// fetch with an absolute URL — which is both simpler and avoids an extra
// network hop during SSR.
//
// The summary's voice is governed by DAY90_SUMMARY_SYSTEM_PROMPT in
// src/lib/anthropic.ts. See that file for the design rationale.

// Conservative character budget for the session-record portion of the
// prompt. Sonnet 4.6's context window is 200k tokens; at ~4 chars/token this
// is ~800k chars of model input, and we want to stay well under that even
// accounting for system prompt + response tokens. 400k chars is comfortably
// under. In practice a 90-post commitment almost never approaches this.
const MAX_RECORD_CHARS = 400_000

// Output budget for the summary itself. A few paragraphs is the target
// (per the system prompt). 2000 tokens gives the model room to cover the
// arc of 90 days without padding.
const MAX_OUTPUT_TOKENS = 2000

// How many images from the session record to pass to the model as actual
// image blocks. A single image consumes ~1.5k tokens at Sonnet pricing;
// six is a comfortable budget that leaves room for the full session text.
// The sampling strategy (first, last, and four evenly distributed between)
// aims to let the model see the arc of the practice visually rather than
// front- or back-loaded.
const MAX_IMAGES_IN_SUMMARY = 6

type PostRow = {
  id: string
  body: string | null
  media_urls: string[] | null
  posted_at: string
  transcript: string | null
}

type SummarizeResult =
  | { ok: true; summary: string; truncated: boolean; postCount: number }
  | { ok: false; error: string }

/**
 * Generate a day-90 summary for a commitment. Pulls the full session record
 * from the database, formats it for the model, handles truncation if the
 * record is unexpectedly large, and returns the Companion's summary.
 *
 * Returns { ok: false } on any failure — caller decides how to surface.
 * This function never throws.
 */
export async function summarizeCommitment(
  commitmentId: string
): Promise<SummarizeResult> {
  const db = createServiceClient()

  const { data: commitment, error: commErr } = await db
    .from('commitments')
    .select(`
      id, started_at, completed_at,
      practices (name, label)
    `)
    .eq('id', commitmentId)
    .single()

  if (commErr || !commitment) {
    return { ok: false, error: 'Commitment not found.' }
  }

  // Normalize Supabase's possibly-array join shape
  const rawPractice = (commitment as unknown as { practices?: { name?: string | null; label?: string | null } | { name?: string | null; label?: string | null }[] }).practices
  const practice = Array.isArray(rawPractice) ? rawPractice[0] : rawPractice
  const practiceName = practice?.name ?? null

  const { data: postsData, error: postsErr } = await db
    .from('room_messages')
    .select('id, body, media_urls, posted_at, transcript')
    .eq('commitment_id', commitmentId)
    .eq('message_type', 'practitioner_post')
    .eq('is_session', true)
    .order('posted_at', { ascending: true })

  if (postsErr) {
    return { ok: false, error: 'Failed to load session record.' }
  }

  const rawPosts: PostRow[] = postsData ?? []
  if (rawPosts.length === 0) {
    // No sessions were logged. Rather than ask the model to describe an
    // absent record, return a plain descriptive note. This is an honest
    // signal to sponsors, not a failure.
    return {
      ok: true,
      summary:
        'The practitioner did not log any sessions during this 90-day commitment. The session record is empty.',
      truncated: false,
      postCount: 0,
    }
  }

  // For any post with a video, resolve a transcript (cached or fresh from
  // Whisper) and inline it into the body that the formatter sees. The
  // day-90 summary reads the full 90-day arc, so video content surfaces
  // through its transcript rather than being invisible to the model.
  const posts: PostRow[] = await Promise.all(
    rawPosts.map(async (p) => {
      const hasVideo = (p.media_urls ?? []).some(
        (u) => typeof u === 'string' && isVideoUrl(u)
      )
      if (!hasVideo) return p
      const transcript = await getOrFetchTranscript(
        p.id,
        p.media_urls,
        p.transcript
      )
      if (!transcript) return p
      const existing = (p.body ?? '').trim()
      const prefixed = `[video transcript: ${transcript}]`
      const mergedBody = existing.length === 0 ? prefixed : `${prefixed}\n\n${existing}`
      return { ...p, body: mergedBody }
    })
  )

  // Compute a notional streak-end for the header block. In v4 the
  // streak_ends_at column is retired; day-90 is started_at + 90 days.
  const streakEndsAt = commitment.started_at
    ? new Date(new Date(commitment.started_at).getTime() + 90 * 24 * 60 * 60 * 1000).toISOString()
    : null

  const { record, truncated } = formatRecord(
    practiceName,
    null, // description is retired in v4; practice name is the commitment statement
    commitment.started_at,
    streakEndsAt,
    posts
  )

  // Sample up to six images across the arc. The strategy: first image post,
  // last image post, and up to four evenly distributed between. Only
  // image-bearing posts are considered — video-only sessions are represented
  // by their transcripts, already folded into the record text above.
  const imageBlocks = sampleImageBlocks(posts, MAX_IMAGES_IN_SUMMARY)

  // Build a single-turn content array: intro text → sampled images → record
  // text. Images sit between the framing and the record so the model reads
  // them as "here are representative frames from the practice, and here is
  // the full written history."
  type ContentBlock = Anthropic.Messages.TextBlockParam | Anthropic.Messages.ImageBlockParam
  const content: ContentBlock[] = [
    {
      type: 'text',
      text: 'Below is the session record for a 90-day practice commitment that has reached completion. Write the summary for the sponsors.',
    },
    ...imageBlocks,
    { type: 'text', text: record },
  ]

  try {
    const anthropic = getAnthropic()
    const response = await anthropic.messages.create({
      model: COMPANION_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: DAY90_SUMMARY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      console.error('Companion day90: unexpected response shape', {
        commitmentId,
        content_types: response.content.map((b) => b.type),
      })
      return { ok: false, error: 'Summary generation failed.' }
    }

    return {
      ok: true,
      summary: textBlock.text,
      truncated,
      postCount: posts.length,
    }
  } catch (err) {
    console.error('Companion day90: Anthropic call failed', {
      commitmentId,
      error: err instanceof Error ? err.message : String(err),
    })
    return { ok: false, error: 'Summary generation failed.' }
  }
}

/**
 * A commitment is eligible for a day-90 summary when either:
 *   - The streak end date has passed (practice window is complete), OR
 *   - The commitment has been explicitly marked 'completed'
 *
 * Either condition counts — a practitioner who marks the commitment
 * complete on day 88 and a practitioner who simply lets the streak run out
 * both qualify.
 */
export function isDay90Reached(
  status: string | null,
  streakEndsAt: string | null
): boolean {
  if (status === 'completed') return true
  if (!streakEndsAt) return false
  try {
    return new Date(streakEndsAt) <= new Date()
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------

function formatRecord(
  practiceName: string | null,
  description: string | null,
  startedAt: string | null,
  streakEndsAt: string | null,
  posts: PostRow[]
): { record: string; truncated: boolean } {
  const headerLines: string[] = []
  if (practiceName) headerLines.push(`Commitment: ${practiceName}`)
  if (description) headerLines.push(`What the practitioner named it for: ${description}`)
  if (startedAt && streakEndsAt) {
    headerLines.push(
      `Streak window: ${dateOnly(startedAt)} → ${dateOnly(streakEndsAt)}`
    )
  }
  headerLines.push(`Total sessions logged: ${posts.length}`)

  const sessionLines: string[] = posts.map((post, idx) => {
    const date = dateOnly(post.posted_at)
    const n = idx + 1 // session number is computed from chronological order now
    const hasMedia = (post.media_urls?.length ?? 0) > 0
    const mediaNote = hasMedia ? ' (with media)' : ''
    const bodyText = (post.body ?? '').trim()
    if (bodyText.length === 0) {
      return `Session ${n} — ${date}${mediaNote}: (no written entry)`
    }
    return `Session ${n} — ${date}${mediaNote}:\n${bodyText}`
  })

  const fullRecord = assemble(headerLines, sessionLines, false)
  if (fullRecord.length <= MAX_RECORD_CHARS) {
    return { record: fullRecord, truncated: false }
  }

  // Overflow: drop oldest sessions first. Per the Phase 7 handoff,
  // losing mid-stream sponsors who joined late is worse than losing the
  // opening — so trim from the front.
  const trimmedSessions = sessionLines.slice()
  while (trimmedSessions.length > 0) {
    const candidate = assemble(headerLines, trimmedSessions, true)
    if (candidate.length <= MAX_RECORD_CHARS) {
      return { record: candidate, truncated: true }
    }
    trimmedSessions.shift()
  }

  // Edge case: a single session entry is itself larger than the budget.
  const first = sessionLines[0] ?? ''
  const clipped =
    first.length > MAX_RECORD_CHARS
      ? first.slice(0, MAX_RECORD_CHARS - 200) + '\n[...entry truncated for length.]'
      : first
  return { record: assemble(headerLines, [clipped], true), truncated: true }
}

function assemble(
  headerLines: string[],
  sessionLines: string[],
  truncated: boolean
): string {
  const truncationNote = truncated
    ? '\n(Earlier sessions omitted for length.)\n'
    : ''
  return [
    ...headerLines,
    '',
    'Session record:',
    truncationNote.trim(),
    '',
    sessionLines.join('\n\n'),
  ]
    .filter((line, i, arr) => !(line === '' && arr[i - 1] === ''))
    .join('\n')
}

function dateOnly(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 10)
  } catch {
    return iso
  }
}

// ---------------------------------------------------------------------------
// Image sampling across the 90-day arc
// ---------------------------------------------------------------------------
//
// Strategy: pick up to MAX posts from the subset that actually carries images,
// evenly distributed by index. Always include the first and last image-post
// so the summary frames the arc (where it started, where it ended); fill the
// middle with evenly-spaced picks. For each chosen post, include ALL its
// image blocks — practitioners typically log one image per session, and if
// they logged two, both are relevant.
//
// "Evenly distributed by index in the image-post subset" rather than by date:
// a practitioner who posts images densely in week 1 and sparsely afterward
// should have their dense-week images represented proportionally, not
// oversampled just because that week occupies more calendar days.

function sampleImageBlocks(
  posts: PostRow[],
  maxImages: number
): Anthropic.Messages.ImageBlockParam[] {
  if (maxImages <= 0) return []

  // Filter to posts that actually contain at least one image URL.
  const imagePosts = posts.filter((p) => buildImageBlocks(p.media_urls).length > 0)
  if (imagePosts.length === 0) return []

  // Pick indices from imagePosts. If we have fewer image-posts than the
  // budget allows, take them all. Otherwise sample evenly including the
  // endpoints.
  let pickedIndices: number[]
  if (imagePosts.length <= maxImages) {
    pickedIndices = imagePosts.map((_, i) => i)
  } else {
    pickedIndices = []
    for (let k = 0; k < maxImages; k++) {
      const idx = Math.round((k * (imagePosts.length - 1)) / (maxImages - 1))
      pickedIndices.push(idx)
    }
    // Dedup in case rounding collides on small sets.
    pickedIndices = Array.from(new Set(pickedIndices))
  }

  // Flatten the chosen posts' image blocks; enforce the hard cap in case
  // a single post contains multiple images and we overshoot.
  const blocks: Anthropic.Messages.ImageBlockParam[] = []
  for (const idx of pickedIndices) {
    const post = imagePosts[idx]
    if (!post) continue
    for (const block of buildImageBlocks(post.media_urls)) {
      if (blocks.length >= maxImages) return blocks
      blocks.push(block)
    }
  }
  return blocks
}
