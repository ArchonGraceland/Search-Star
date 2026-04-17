import { createServiceClient } from '@/lib/supabase/server'
import {
  getAnthropic,
  COMPANION_MODEL,
  DAY90_SUMMARY_SYSTEM_PROMPT,
} from '@/lib/anthropic'

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

type PostRow = {
  session_number: number | null
  body: string | null
  media_urls: string[] | null
  posted_at: string
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
    .select('id, title, description, streak_starts_at, streak_ends_at')
    .eq('id', commitmentId)
    .single()

  if (commErr || !commitment) {
    return { ok: false, error: 'Commitment not found.' }
  }

  const { data: postsData, error: postsErr } = await db
    .from('commitment_posts')
    .select('session_number, body, media_urls, posted_at')
    .eq('commitment_id', commitmentId)
    .order('posted_at', { ascending: true })

  if (postsErr) {
    return { ok: false, error: 'Failed to load session record.' }
  }

  const posts: PostRow[] = postsData ?? []
  if (posts.length === 0) {
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

  const { record, truncated } = formatRecord(
    commitment.title,
    commitment.description,
    commitment.streak_starts_at,
    commitment.streak_ends_at,
    posts
  )

  try {
    const anthropic = getAnthropic()
    const response = await anthropic.messages.create({
      model: COMPANION_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: DAY90_SUMMARY_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content:
            'Below is the session record for a 90-day practice commitment that has reached completion. Write the summary for the sponsors.\n\n' +
            record,
        },
      ],
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
  title: string | null,
  description: string | null,
  streakStartsAt: string | null,
  streakEndsAt: string | null,
  posts: PostRow[]
): { record: string; truncated: boolean } {
  const headerLines: string[] = []
  if (title) headerLines.push(`Commitment: ${title}`)
  if (description) headerLines.push(`What the practitioner named it for: ${description}`)
  if (streakStartsAt && streakEndsAt) {
    headerLines.push(
      `Streak window: ${dateOnly(streakStartsAt)} → ${dateOnly(streakEndsAt)}`
    )
  }
  headerLines.push(`Total sessions logged: ${posts.length}`)

  const sessionLines: string[] = posts.map((post) => {
    const date = dateOnly(post.posted_at)
    const n = post.session_number ?? '?'
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
