import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type Anthropic from '@anthropic-ai/sdk'
import { getAnthropic, COMPANION_MODEL, COMPANION_SYSTEM_PROMPT, COMPANION_LAUNCH_SYSTEM_PROMPT } from '@/lib/anthropic'
import { buildImageBlocks, getOrFetchTranscript } from '@/lib/companion/media'
import { isVideoUrl } from '@/lib/media'

// POST /api/companion/reflect
//
// Practitioner-authenticated endpoint. The Companion reads the commitment's
// session record and produces a reflection — either an opening reflection
// (no user_message) or a response to a follow-up (user_message present,
// optionally with the in-session history so the Companion has conversational
// context).
//
// Allowed for launch and active commitments. During launch there are no
// sessions yet, so the Companion opens with questions about what the
// practitioner is about to begin (see COMPANION_LAUNCH_SYSTEM_PROMPT).
// During active it reads the session record and responds to what the
// practitioner has actually done. For 'completed' or 'abandoned', the
// day-90 summary endpoint is the appropriate surface.
//
// Rate limit: 20 calls per user per hour, enforced via companion_rate_limit.
// This is the guardrail against a render-loop bug burning the Anthropic
// account — do not remove.

type HistoryTurn = { role: 'user' | 'assistant'; content: string }

// How many most-recent session posts to include in the record passed to the
// model. Thirty is enough to surface patterns; the full 90 comes later via
// the day-90 summary. Chronological ascending so the model reads the arc
// from earliest to latest.
const MAX_SESSIONS_IN_CONTEXT = 30

// Rate limit ceiling. 20 calls/hour gives a user generous room for a
// conversational session while catching runaway client bugs.
const RATE_LIMIT_PER_HOUR = 20

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    commitment_id?: string
    user_message?: string
    history?: HistoryTurn[]
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { commitment_id, user_message, history } = body

  if (!commitment_id || typeof commitment_id !== 'string') {
    return NextResponse.json({ error: 'commitment_id is required.' }, { status: 400 })
  }

  const db = createServiceClient()

  // Load the commitment and confirm the caller owns it.
  const { data: commitment, error: commErr } = await db
    .from('commitments')
    .select('id, user_id, status, title, description')
    .eq('id', commitment_id)
    .eq('user_id', user.id)
    .single()

  if (commErr || !commitment) {
    return NextResponse.json({ error: 'Commitment not found.' }, { status: 404 })
  }

  // Gate to launch or active status. During launch the Companion helps the
  // practitioner get clearer about what they're about to begin; during
  // active it reads the session record and responds. Completed and
  // abandoned commitments belong to the day-90 summary endpoint, not here.
  if (commitment.status !== 'active' && commitment.status !== 'launch') {
    return NextResponse.json(
      { error: 'Companion reflection is available during launch and active commitments.' },
      { status: 403 }
    )
  }

  // Rate limit check + increment. Keyed on (user_id, hour_bucket) where the
  // bucket is the current hour truncated. An upsert with an increment is
  // the cleanest atomic-enough pattern Supabase offers here — two near-
  // simultaneous calls could theoretically race, but the cap is generous
  // enough that a one-off double-count is harmless.
  const hourBucket = new Date()
  hourBucket.setUTCMinutes(0, 0, 0)
  const hourBucketIso = hourBucket.toISOString()

  const { data: existing } = await db
    .from('companion_rate_limit')
    .select('call_count')
    .eq('user_id', user.id)
    .eq('hour_bucket', hourBucketIso)
    .maybeSingle()

  const currentCount = existing?.call_count ?? 0
  if (currentCount >= RATE_LIMIT_PER_HOUR) {
    return NextResponse.json(
      { error: 'Companion rate limit reached. Try again next hour.' },
      { status: 429 }
    )
  }

  await db
    .from('companion_rate_limit')
    .upsert(
      { user_id: user.id, hour_bucket: hourBucketIso, call_count: currentCount + 1 },
      { onConflict: 'user_id,hour_bucket' }
    )

  // Load the most recent sessions, sort chronologically for the model.
  // `id` and `transcript` pulled so we can cache Whisper output per post.
  const { data: recentPosts } = await db
    .from('commitment_posts')
    .select('id, session_number, body, media_urls, posted_at, transcript')
    .eq('commitment_id', commitment_id)
    .order('posted_at', { ascending: false })
    .limit(MAX_SESSIONS_IN_CONTEXT)

  const rawPosts = (recentPosts ?? []).slice().reverse() // oldest → newest

  // For any post with a video, resolve a transcript (cached or fresh from
  // Whisper) and inline it into the body that the formatter sees. The
  // Companion reads transcripts as part of the session text so its
  // observations stay grounded in what was actually said on camera.
  const posts: PostRow[] = await Promise.all(
    rawPosts.map(async (p) => {
      const hasVideo = (p.media_urls ?? []).some(
        (u: string) => typeof u === 'string' && isVideoUrl(u)
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

  const recordText = formatSessionRecord(
    commitment.title,
    commitment.description,
    posts
  )

  // Collect image blocks from the most recent post only. Per-reflect image
  // volume is 1–3 typically — the practitioner just posted, and that's the
  // session they want reflected on. Older images don't need to be re-shown
  // every turn; their transcripts and bodies carry the context forward.
  const latestPost = posts[posts.length - 1]
  const latestImages = latestPost ? buildImageBlocks(latestPost.media_urls) : []

  // Is the latest post fresh enough that the Companion should anchor on it?
  // Ten minutes is the window — covers posting, Cloudinary upload, transcript
  // lag, and the practitioner tapping over to the Companion panel. Older
  // than that and the practitioner has wandered back in for a second look,
  // which reads better as "reflect on the record" than "respond to what
  // I just said."
  const LATEST_POST_FRESH_MS = 10 * 60 * 1000
  const latestPostIsFresh =
    !!latestPost &&
    Date.now() - new Date(latestPost.posted_at).getTime() < LATEST_POST_FRESH_MS

  // Status-aware system prompt. Launch has its own voice (§COMPANION_LAUNCH_SYSTEM_PROMPT)
  // because there are no sessions yet — the Companion is helping the practitioner
  // get clearer about what they're about to begin, not reflecting on what's done.
  const systemPrompt =
    commitment.status === 'launch'
      ? COMPANION_LAUNCH_SYSTEM_PROMPT
      : COMPANION_SYSTEM_PROMPT

  // Build the messages array. Three modes:
  //   - Opening reflection, latest post is fresh: the practitioner just posted.
  //     Frame the turn as "respond to what was just said/shown"; demote the
  //     rest of the record to background context.
  //   - Opening reflection, no fresh post (cold open or no posts at all): the
  //     practitioner opened the panel without a new session. Frame the turn
  //     as "here is the record (or the commitment, during launch); respond
  //     as the Companion."
  //   - Follow-up: user_message is present. Same framing as the appropriate
  //     opening mode above, then a terse assistant ack, then the prior
  //     history, then the new user message.
  //
  // The first user turn is a content array (text + image blocks). Subsequent
  // turns are plain strings — they're conversational follow-ups that don't
  // carry fresh media.
  type ContentBlock = Anthropic.Messages.TextBlockParam | Anthropic.Messages.ImageBlockParam
  type Msg =
    | { role: 'user' | 'assistant'; content: string }
    | { role: 'user'; content: ContentBlock[] }
  const messages: Msg[] = []

  const isOpening = !user_message || user_message.trim().length === 0

  // Framing sentence for the first user turn. The wording differs by whether
  // the practitioner just posted (respond to it), has an empty record but is
  // in launch (respond to the commitment), or is replaying the record (respond
  // to the record). The follow-up case re-uses whichever framing opened.
  let framingText: string
  if (latestPostIsFresh && latestPost) {
    // Anchor the Companion on the latest post. Include body and transcript
    // verbatim in the framing so the model doesn't have to guess which entry
    // is "the one." The full record still goes in as background below.
    const latestBody = (latestPost.body ?? '').trim()
    const latestSessionLabel =
      latestPost.session_number && latestPost.session_number > 0
        ? `session ${latestPost.session_number}`
        : 'a session'
    const mediaNote =
      (latestPost.media_urls?.length ?? 0) > 0
        ? latestBody.includes('[video transcript:')
          ? ' (with a video — the transcript is included in the body below)'
          : ' (with an image — shown below)'
        : ''
    const bodyBlock =
      latestBody.length > 0
        ? `What the practitioner just posted${mediaNote}:\n\n${latestBody}`
        : `The practitioner just posted ${latestSessionLabel}${mediaNote}, with no written body.`
    const instruction = isOpening
      ? 'Respond to what they just said or showed. Quote or paraphrase something specific from it, and engage with that as the Companion.'
      : 'I may follow up with questions after this — stay grounded in what I just posted and the record below.'
    framingText = `${bodyBlock}\n\n${instruction}\n\nFor context, here is the full session record (most recent last):`
  } else if (commitment.status === 'launch') {
    // Launch, cold open. No sessions to respond to; the subject is the
    // commitment itself. formatSessionRecord already emits the title and
    // description at the top and a "(No sessions logged yet.)" note.
    framingText = isOpening
      ? 'The practitioner has declared this commitment and is in the 14-day launch window before the streak begins. Respond as the Companion.'
      : "The practitioner has declared this commitment and is in the launch window. I may follow up — stay grounded in what's here."
  } else {
    // Active, cold open. The record is the subject.
    framingText = isOpening
      ? 'Below is the session record so far for this commitment. Respond as the Companion.'
      : "Below is the session record for this commitment. I may follow up with questions; stay grounded in what's here."
  }

  // Content array: framing → images from latest post (if any) → full record.
  // Images sit between the framing and the record so they read as "here is
  // what the practitioner most recently shared, alongside the written history."
  const firstTurnContent: ContentBlock[] = [
    { type: 'text', text: framingText },
    ...latestImages,
    { type: 'text', text: recordText },
  ]

  if (isOpening) {
    messages.push({ role: 'user', content: firstTurnContent })
  } else {
    messages.push({ role: 'user', content: firstTurnContent })
    // Acknowledge the record with an assistant-role placeholder so the
    // history below reads as a coherent multi-turn conversation from the
    // model's perspective. Keep the acknowledgement terse so it doesn't
    // shape the Companion's voice.
    messages.push({
      role: 'assistant',
      content: "Got it — I've read what you just posted and the record.",
    })

    // Include sanitized prior turns from the in-session history.
    if (Array.isArray(history)) {
      for (const turn of history) {
        if (!turn || typeof turn.content !== 'string') continue
        if (turn.role !== 'user' && turn.role !== 'assistant') continue
        const trimmed = turn.content.trim()
        if (trimmed.length === 0) continue
        messages.push({ role: turn.role, content: trimmed })
      }
    }

    messages.push({
      role: 'user',
      content: user_message.trim(),
    })
  }

  // Call the model.
  try {
    const anthropic = getAnthropic()
    const response = await anthropic.messages.create({
      model: COMPANION_MODEL,
      max_tokens: 400,
      system: systemPrompt,
      messages,
    })

    // Find the first text block; defend against unexpected shapes.
    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      console.error('Companion: unexpected response shape', {
        commitment_id,
        content_types: response.content.map((b) => b.type),
      })
      return NextResponse.json({ error: 'Companion unavailable' }, { status: 500 })
    }

    return NextResponse.json({ text: textBlock.text })
  } catch (err) {
    console.error('Companion: Anthropic call failed', {
      commitment_id,
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'Companion unavailable' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------

type PostRow = {
  id: string
  session_number: number | null
  body: string | null
  media_urls: string[] | null
  posted_at: string
  transcript: string | null
}

function formatSessionRecord(
  title: string | null,
  description: string | null,
  posts: PostRow[]
): string {
  const header: string[] = []
  if (title) header.push(`Commitment: ${title}`)
  if (description) header.push(`What the practitioner named it for: ${description}`)

  if (posts.length === 0) {
    header.push('')
    header.push('(No sessions logged yet. The practitioner just opened the panel.)')
    return header.join('\n')
  }

  const lines: string[] = []
  for (const post of posts) {
    const date = formatDate(post.posted_at)
    const n = post.session_number ?? '?'
    const hasMedia = (post.media_urls?.length ?? 0) > 0
    const bodyText = (post.body ?? '').trim()
    const mediaNote = hasMedia ? ' (with media)' : ''

    if (bodyText.length === 0) {
      lines.push(`Session ${n} — ${date}${mediaNote}: (no written entry)`)
    } else {
      lines.push(`Session ${n} — ${date}${mediaNote}:\n${bodyText}`)
    }
  }

  return [...header, '', 'Session record:', '', lines.join('\n\n')].join('\n')
}

function formatDate(iso: string): string {
  // Human-readable date, no time. The model doesn't need to know it's 3 PM.
  try {
    const d = new Date(iso)
    return d.toISOString().slice(0, 10)
  } catch {
    return iso
  }
}
