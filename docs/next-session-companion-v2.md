# Next session — Companion v2: conversation as the product

> **Deprecated 2026-04-20. Superseded by `docs/chat-room-plan.md`. Retain for tactical reference (file paths, Cloudinary preset, SSR client patterns, Whisper transcription details) only. The strategic framing below — practitioner-solo Companion surface with sponsors as eventual readers — is replaced by the room model in decision #8 where sponsors are active participants in a persistent multi-member chat.**

**Context bundle for the next session's Claude.** Read this first. Everything you need to start working is here; don't re-read the prior transcript unless something specific doesn't line up.

---

## Product thesis (updated end of session 2026-04-18)

The previous framing — "video is the core interaction" — was wrong. The core interaction is **a conversation between the practitioner and the Companion, where media is an optional enriching input.** Most days the practitioner just wants to talk (by voice or text) about what they did. Some days they'll want to show something — a woodworking joint, a recovery run's trail, a finished piece of writing — and on those days video or a photo earns its place in the thread. But the daily habit shape is conversational, not upload-first.

This matters because:

- **Back-and-forth is where formation happens.** The first Companion turn is rarely the useful one. The third, fourth, fifth turns — where the Companion asks a grounded follow-up and the practitioner surfaces something they hadn't articulated — that's the product doing its job. A video-only UX doesn't have turn 2.
- **Video has real friction.** Upload latency, file-size errors, Whisper transcription wait (5–15s), camera permission prompts. Text and voice are near-instant. A daily habit can't afford 20 seconds of dead air between "I want to log" and "the AI responded."
- **Text/voice is always available.** Not every practice has something to show on any given day. Someone reading philosophy, someone running, someone grieving their way toward the next act of their life — forcing them to film something in order to reflect rejects entire categories of practice that belong on Search Star.

But video and photo are *not* decorative. They're load-bearing in three specific ways:

- **Evidence for sponsors.** When a sponsor pledges $500 on a 90-day commitment, they want more than a text journal. A 30-second video taken on-site, a photo of the work made, is hard to fake and that's the entire premise of v4 ("sponsors as witnesses"). Text alone weakens the sponsor value proposition.
- **Credibility of the Trust record.** A portable credential backed by media of the work is harder to game than one backed by text. This matters at scale when Search Star's Trust record starts being used as a hiring/admissions signal.
- **Domain-specific practices that *are* the video.** Guitar, running form, woodworking technique, cooking plating. For these, text description is a pale shadow; the video is the practice. Dropping the ability to capture the work would neuter these use cases.

**Resolution:** conversation is the primary surface; media attachment is a first-class optional input; when media is present, the Companion transcribes and responds specifically to what's in it.

## The target interaction

> **Open the app → Companion opens with a greeting → practitioner answers (voice or text) → conversation continues → optionally attach a photo or short video when it helps → conversation keeps going, grounded in what was said or shown → sponsors see the whole thread later as the session record.**

Think of it as Claude.ai's chat composer, but purpose-built for daily practice reflection: the Companion knows the commitment, opens the conversation, and remembers across sessions.

## Where we are today

Three gaps currently prevent this (all confirmed during session 2026-04-18):

1. **The session-logger form on `/commit/[id]` has no camera/gallery buttons** — only `/log` does. The Cloudinary upload flow in `src/app/log/client.tsx` (`handleMediaChange` + `uploadToCloudinary`) is not replicated on `src/app/(dashboard)/commit/[id]/page.tsx` (form block around line 473 — it's a plain textarea with a Log Session button, nothing else).

2. **The Companion panel is gated to `status === 'active'`** on both client and server. Client gate in `src/app/(dashboard)/commit/[id]/page.tsx` (`{commitment.status === 'active' && <CompanionPanel commitmentId={commitment.id} />}`). Server gate in `src/app/api/companion/reflect/route.ts` (403 response). This means the 14-day launch window — when practitioners are most excited, most uncertain, and most at risk of dropping off — has no AI engagement at all. That's wrong.

3. **The Companion reflects on the whole record, not on the latest turn.** First-user-turn framing in `src/app/api/companion/reflect/route.ts` says "below is the session record so far; respond as the Companion." When the practitioner just said something — spoke it, typed it, or uploaded a video of it — the model should be told specifically "the practitioner just said this; respond to what they just said," not "here's everything, reflect." The transcription pipeline (Groq Whisper-large-v3 via `src/lib/companion/media.ts`, cached in `commitment_posts.transcript`) works fine — the gap is in how its output is presented to the model.

## Plan — three stages

Do Stage A first. Validate it feels right. Then move to Stage B. Stage C is the north star but requires Stage B's plumbing.

### Stage A — unblock the current surface (first chunk of the session)

Get the existing post-based UI to match the conversation-first thesis as closely as it can without a full chat rewrite.

1. **Replicate media upload on `/commit/[id]`.** Copy `handleMediaChange`, `uploadToCloudinary`, the preview state, and the Camera/Gallery buttons from `src/app/log/client.tsx` into the session form on `src/app/(dashboard)/commit/[id]/page.tsx`. Same 50MB cap, same video/image handling. Post sends `media_urls: [url]` to `/api/commitments/[id]/posts`, which already accepts that field.

2. **Allow Companion during launch.** Drop the `status === 'active'` gate on the client render and the server 403. Add a status-aware branch in `src/app/api/companion/reflect/route.ts`: when `commitment.status === 'launch'`, use a new `COMPANION_LAUNCH_SYSTEM_PROMPT` (add to `src/lib/anthropic.ts` alongside the existing one) tuned for pre-streak conversations — help the practitioner articulate what they're committing to, think through what success looks like, rehearse explaining their practice to a potential sponsor. Not "reflect on your sessions" (there are none yet).

3. **Make the Companion respond to what was just said.** Restructure the first-user-turn builder in `/api/companion/reflect` so when the latest post is recent (say, within the last few minutes), the user turn sent to Claude is explicitly framed as: "The practitioner just posted. Here's what they said: [body + transcript if video present]. Respond to what they just said — quote or paraphrase something specific, and engage with it as the Companion." Keep the existing all-sessions-record as context but demote it from "this is what to respond to" to "this is background you've been keeping track of." Tune the system prompt so the Companion is explicitly trained to anchor each response in something concrete the practitioner said or showed.

**Stage A done = David can log a session with optional video on either `/log` or `/commit/[id]`, during launch or active, and get back a Companion response that specifically engages with what he just said.** That's the minimum viable version of the product thesis.

### Stage B — conversation as the surface (next chunk or next session)

Move from "post once, get one reflection" to "chat continuously within a session."

- **Add a chat UI to the Companion panel.** The panel already supports follow-up turns (the `history` param in `/api/companion/reflect`), so the backend is mostly there. What's missing is the UI: a scrolling message list, a composer at the bottom, voice-input button (browser Web Speech API for now — streaming ASR can come later), media attachment button. The existing session-post form stays as an alternate "submit a big written journal entry" surface, but the default new-user experience should be the chat.

- **Stream Companion responses.** Swap `anthropic.messages.create` for `anthropic.messages.stream` in `/api/companion/reflect`, and stream tokens back to the client via a Server-Sent Events response or a readable stream. Mobile users seeing tokens arrive is dramatically better UX than staring at a spinner for 8 seconds. Show Whisper as a separate progress step when media is attached — "Listening to your video…" → "Reading what you said…" → response streams.

- **Persist the full conversation as a session.** Today a session is one `commitment_posts` row. With conversations, a session is a thread. Options:
  - **(a) Keep `commitment_posts` as-is, but a session == a thread of posts with a `thread_id` column and `role` ('practitioner' / 'companion').** Simple schema change, preserves existing data, sponsors see the thread as the session when they view it.
  - **(b) Make the Companion turns transient (not persisted), only persist the practitioner's content.** Simpler but loses the reflection history, which is actually valuable (the Companion's quoted observations are evidence of the formation process over time).
  - **Recommend (a).** It's a one-migration change and preserves the richer artifact. See "Schema migration notes" below.

- **Voice-in during the conversation.** Start with push-to-talk via Web Speech API (free, works on Android Chrome, latency-light). Short-form audio is still captured as `media_urls` when it's part of the practitioner's answer but doesn't require Whisper for the speech-to-text loop — Web Speech gives instant transcription for the typing replacement case. Groq Whisper stays as the transcription path for video uploads where the audio is the content (skill demonstration, talking-head reflection).

### Stage C — the one-tap daily habit (north star, don't try in the same session as A+B)

Once Stage B is stable:

- Logged-in landing is a persistent conversation view. Open app → Companion greets you about today's practice → you tap the mic, speak, release → Companion responds streaming. Zero typing, zero navigation. That's the shape that makes this a daily habit.
- Native-feel recording UX for video: `MediaRecorder` API with a large tap-to-record button, codec fallbacks (opus/webm default, mp4/aac when needed), client-side preview before upload.
- Session summarization: at end of day, the conversation gets auto-summarized into the session-level artifact that sponsors see on their feed. The sponsor doesn't necessarily want the full back-and-forth — they want the 2-sentence "here's what happened today" derived from it.

## Schema migration notes (Stage B, option (a))

Adding `thread_id` and `role` columns to `commitment_posts`:

```sql
-- Stage B migration (DRAFT — do not apply until Stage B is actually being built)
alter table commitment_posts
  add column if not exists thread_id uuid,
  add column if not exists role text check (role in ('practitioner', 'companion'));

-- Backfill: existing rows become single-turn practitioner threads
update commitment_posts
set thread_id = id, role = 'practitioner'
where thread_id is null;

-- Make required going forward
alter table commitment_posts
  alter column thread_id set not null,
  alter column role set not null;

create index if not exists commitment_posts_thread_idx
  on commitment_posts (commitment_id, thread_id, posted_at);
```

Apply via `Supabase:apply_migration`, never psql (the Supabase DNS isn't reachable from the container). Verify via `execute_sql` on `information_schema.columns`.

Two RLS implications:
- The existing "owner can read" and "sponsor can read" policies on `commitment_posts` continue to cover both roles (they're user_id-based, which still works because the practitioner's user_id goes on both their own turns and on the Companion-as-response turns that belong to that practitioner's commitment).
- But: sponsors seeing Companion turns might be jarring or might be a feature. **This is a design question for David** — see open questions below.

## Pre-existing ground rules (don't violate)

- Git author email must be `dverchere@gmail.com`. Any other email breaks Vercel deployments.
- Clone fresh at session start: `git clone --depth 1 --branch main https://[PAT]@github.com/ArchonGraceland/Search-Star.git`. Production is the `main` branch. The old `v4` branch is retired; don't touch it.
- `git restore package.json package-lock.json` before committing, unless dependencies genuinely changed (and if they did, call that out in the commit message so it's deliberate).
- Supabase DDL only via `Supabase:apply_migration`. Verification via `Supabase:execute_sql` on `information_schema.columns` / `pg_policies` / `pg_indexes`. Never try direct psql — container can't reach Supabase DNS.
- Deployment verification: push, wait 90 seconds, then `Vercel:list_deployments limit=1` to confirm READY and matching commit SHA. Production domain is www.searchstar.com.
- **For Supabase reads of RLS-gated tables on the server** (commitments, sponsorships, commitment_posts, donations, sponsor_invitations, companion_rate_limit, confirmation_acknowledgments): use `createServiceClient()` after `getUser()` via the SSR client. The `@supabase/ssr` client drops the JWT intermittently — see commits 0710ce4, 1dccc46, 501d976, 0f28db9. The E2E path is clean on this; don't regress it. Writes from the service client must include `.eq('user_id', user.id)` to prevent cross-user writes.
- `next/headers` is not edge-runtime-compatible. In middleware, inline the service client with `@supabase/supabase-js`'s `createClient` rather than importing from `@/lib/supabase/server`.
- `companion_rate_limit` caps at 20 calls/hr per user. Don't remove it even if it gets in the way of testing. If it does, either wait the hour or bump temporarily via `execute_sql` and restore before shipping.

## Environment state to verify on session start

- Pull latest `main`. As of end of 2026-04-18, head was `fd8af28` (this doc) with prior commits `c9b8e1c` (/log copy), `ef48048` (PWA + homepage bounce), `0f28db9` (SSR→service sweep), `1dccc46`, `0710ce4`.
- Cloudinary env vars in Vercel: `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`. The upload preset must be set to **unsigned** in the Cloudinary dashboard (browser-direct upload without signing).
- `GROQ_API_KEY` in Vercel production env (not just preview). For Whisper-large-v3 transcription of uploaded videos.
- `ANTHROPIC_API_KEY` in Vercel production env. The Companion needs it.
- DB state: David's user `231c3b34-0504-422d-ad5e-dcd536b97c0f` has commitment `651919b0-defc-446a-836d-b6b77ca88f09` "Sentensese", status `launch`, streak_starts_at 2026-05-02. Three posts exist, all with empty `media_urls`. Ask David whether to clear these for cleaner testing or preserve them.

## Pitfalls to avoid

- **Don't ship Stage A's video upload without also un-gating the Companion for launch.** If David uploads a video during launch and the Companion still refuses to respond, he'll assume something's broken and we'll waste time re-diagnosing working code. Both changes need to land together.
- **Don't skip the video-specific prompt framing in favor of just removing the gate.** The Companion reading the record and saying something generic is worse than not running — it makes the product feel like a chatbot. The prompt framing change is what makes it feel like it listened.
- **Don't build a desktop-first recording UI and ship to mobile second.** Mobile is the primary surface. Test on David's Android phone. Verify Cloudinary accepts whatever `MediaRecorder` produces in-browser (codec selection matters — opus/webm usually works, mp4/aac sometimes needed).
- **Don't persist Companion turns as if they were practitioner sessions.** In the Stage B schema, `role = 'companion'` turns are part of the thread but should not count toward `sessions_logged` (which is what drives day X of 90 in the UI). Keep the counter incrementing only on `role = 'practitioner'` rows.
- **Don't let the Companion see stale context after a new post.** Today's code pulls the 30 most recent posts chronologically. That's fine as reference, but it means the system prompt needs to explicitly disambiguate "the latest post is the one to respond to" vs. "here's the history." Otherwise the model has to guess which turn it's answering.

## Open design questions for David (surface before implementing)

1. **Launch-window Companion: auto-open or tap-to-start?** Active-commitment Companion auto-opens with a reflection. Launch-window has no sessions yet, so auto-opening is weird. Recommend a prompt-first UI: "Ready to talk about what you're building?" → Companion opens. Confirm.
2. **What's the Companion's job during launch?** Best guesses: help the practitioner articulate the commitment, prepare them for day 1, or rehearse explaining the practice to a potential sponsor. David's prior instinct leans toward "help them think through what they're committing to." Confirm the specific pre-streak goal before writing the launch system prompt.
3. **Do sponsors see Companion turns in the session thread?** Pro: richer evidence, shows the formation process, quotes of the practitioner's voice are preserved. Con: practitioner might feel less free to be honest knowing a sponsor will read the Companion's follow-up probes. Recommend **yes by default**, with a "private reflection" mode toggleable per-session. Confirm.
4. **Stage B scope: full chat UI or incremental?** Full chat UI is a meaningful frontend build (2–4 hours). Incremental option: keep the existing single-post form but append a Companion chat drawer that unfolds after the first post, so the practitioner logs something and can then continue the conversation. Simpler, ships faster, might be the right stepping-stone.
5. **Keep or delete the three existing media-less posts on "Sentensese"?** They're David's test data, not assumed deletable.

## First moves when the next session opens

1. Pull latest `main` (should be at `fd8af28` or later). Quick visual check that production is serving the right build: visit https://www.searchstar.com/log while signed in — should show the "Your commitment starts on Saturday, May 2" splash, not the old "No active commitment" splash.
2. Ask David the five design questions above, especially #1–#3 which gate implementation.
3. Read the three source files side-by-side: `src/app/(dashboard)/commit/[id]/page.tsx`, `src/app/log/client.tsx`, `src/app/api/companion/reflect/route.ts`, plus `src/lib/anthropic.ts` for the system prompt.
4. Implement Stage A as a single commit if the three changes hang together tidily, or two commits (media UI / Companion changes) if they don't. Ship. Have David test from his phone with a fresh video — that's the validation.
5. If Stage A feels right, move to Stage B scope discussion with David before writing code. The frontend chat UI is a meaningful commitment; don't start until the product direction is re-confirmed after seeing Stage A in the wild.

## What "done" looks like

**End of Stage A:** David opens Search Star on his phone, navigates into his launch-window commitment, uploads a short video saying something about what he's committing to, and within ~15 seconds gets back a response from the Companion that quotes or paraphrases something specific he said on video. The conversation turns after that continue through text. That is the product's minimum viable loop.

**End of Stage B:** That same flow feels like a chat, not a form — he sees the Companion's response stream in token-by-token, he can reply without leaving the surface, and the conversation persists as the session artifact that sponsors eventually see.

**End of Stage C:** It's a daily habit. He opens the app, hears the Companion greet him about today, taps-and-speaks, gets a response, and is done in under a minute.
