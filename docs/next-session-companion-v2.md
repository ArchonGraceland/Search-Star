# Next session — Companion v2: video as the core interaction

**Context bundle for the next session's Claude.** Read this first. Everything you need to start working is here; don't re-read the prior transcript unless something specific doesn't line up.

---

## Product goal

The thing that makes Search Star useful to real users is this interaction: **open the app, record a video talking about today's practice, hear a response from an AI that listened to what you said.** Everything else (sponsors, trust stages, launch windows) is scaffolding. The Companion is the product.

The current implementation has three gaps keeping this from working:

1. **The session-logger form on `/commit/[id]` has no camera/gallery buttons** — only `/log` does. A practitioner in launch window who navigates to their commitment page to log a session gets a text-only textarea with no way to upload video. The Cloudinary upload flow that powers `/log` (`src/app/log/client.tsx`, function `handleMediaChange` + `uploadToCloudinary`) needs to be replicated on `/commit/[id]` (the file is `src/app/(dashboard)/commit/[id]/page.tsx` — note the `'use client'` — the form block is around line 473).

2. **The Companion panel is gated to `status === 'active'`.** Line in `src/app/(dashboard)/commit/[id]/page.tsx`:
   ```
   {commitment.status === 'active' && <CompanionPanel commitmentId={commitment.id} />}
   ```
   Plus the server-side gate in `src/app/api/companion/reflect/route.ts`:
   ```
   if (commitment.status !== 'active') { return 403 'Companion reflection is available only during an active commitment.' }
   ```
   Both need to allow `status === 'launch'` too. The 14-day launch window is when the practitioner is most excited and most uncertain; silence from the AI during that period is wrong. A launch-mode variant of the system prompt (see `COMPANION_SYSTEM_PROMPT` in `src/lib/anthropic.ts`) should acknowledge "you haven't started yet, you're getting ready, I'm going to help you get there" rather than "reflect on your record of sessions" which doesn't make sense when there are no sessions yet. David's instinct: use the launch window to help the practitioner think through *what* they're committing to, what success looks like to them, who they'll invite as sponsors.

3. **The Companion reflects on the whole record, not on the video specifically.** Current system prompt and first-user-turn framing (`src/app/api/companion/reflect/route.ts` around `recordHeader`) say "below is the session record so far; respond as the Companion." When the practitioner just uploaded a video, the model should be told: "the practitioner just uploaded a video; here's the transcript of what they said; respond directly to what they said." The Companion should lead with a specific reference to what the practitioner said on camera, not a general reflection on the record. Two knobs: (a) structure the first user turn to flag "this is a fresh upload, respond to it" when a new video was posted recently, (b) tune the system prompt so the Companion is explicitly trained to quote or paraphrase what it heard. The transcription pipeline (Groq Whisper-large-v3 via `src/lib/companion/media.ts`, cached in `commitment_posts.transcript`) already works — the gap is in how its output is presented to the model.

## The north-star fix David actually wants

*"Open app → record video → get AI response."* One tap to record. Auto-transcribe. Companion responds specifically to what was said. Conversation continues. No typing required at any step.

Today's flow is eight steps: open, navigate to /log, tap Gallery, file picker, find video, upload, write note, submit. Even if everything worked, this is too many steps for a daily habit. The goal is a single primary surface — the logged-in landing, which middleware already routes to `/log` for users with a commitment — that shows a large record button and nothing else, and the AI response streams back in-place.

Don't build the full native-recording UI on day one. Build it in two stages:

### Stage A — fix the three gaps, as-is (target for first chunk of the session)
- Replicate the Cloudinary upload UI from `src/app/log/client.tsx` onto the session-logging form in `src/app/(dashboard)/commit/[id]/page.tsx`. Same `handleMediaChange`, same `uploadToCloudinary`, same 50MB cap. Post sends `media_urls: [url]` to `/api/commitments/[id]/posts` which already accepts it (the server route writes it to `commitment_posts.media_urls`).
- Remove the active-only gates on CompanionPanel (both client render and server 403). Allow `launch` and `active`. Add a status-aware branch in `src/app/api/companion/reflect/route.ts` that uses a separate `COMPANION_LAUNCH_SYSTEM_PROMPT` when commitment.status === 'launch'.
- Adjust the user-turn construction in `/api/companion/reflect` so when the latest post has a video (transcript present, posted within the last few minutes), the first user turn to Claude is something like: "The practitioner just posted a new session and uploaded a video. Here's what they said on the video: [transcript]. Respond to what they said — quote or paraphrase something specific they said, and engage with it as the Companion." Leave the all-sessions-record behavior as a fallback for turns that aren't immediately following a fresh upload.

### Stage B — one-tap record, streaming response (target for later in the session if A lands fast)
- `/log` (and `/commit/[id]` if we're consolidating) gets a primary record button using `MediaRecorder` API directly in the browser. Short-form — 60s or 2min cap. Uploads to Cloudinary as today, but initiated by the recorder's `onstop` rather than a file picker.
- The Companion response streams via Anthropic's streaming messages API so the user sees tokens arriving rather than waiting 10-20 seconds staring at a spinner during Whisper + Claude. (Two latency sources today: Whisper transcription of the just-uploaded video, then Claude generation. We can't shorten Whisper, but we can show it as its own progress step — "listening to your video..." — and then stream Claude's response after.)

Stage A is the minimum to unblock "the product does what David expected it to do when he uploaded a video." Stage B is what makes it feel like a native app. Do Stage A first and validate it feels right before committing to Stage B.

## Pre-existing ground rules from earlier sessions (don't violate)

- Git author email must be `dverchere@gmail.com`.
- Clone fresh at start: `git clone --depth 1 --branch main https://[PAT]@github.com/ArchonGraceland/Search-Star.git`.
- Production is `main` branch. `v4` branch is dead; don't touch it.
- `git restore package.json package-lock.json` before committing unless deps genuinely changed.
- Supabase DDL via `apply_migration`, verification via `execute_sql` on project `qgjyfcqgnuamgymonblj`.
- Deployment verification: 90s wait then `Vercel:list_deployments` limit=1.
- For Supabase reads of RLS-gated tables on the server (commitments, sponsorships, commitment_posts, donations, sponsor_invitations, companion_rate_limit, confirmation_acknowledgments): **use the service client via `createServiceClient()` after `getUser()` via SSR client.** The `@supabase/ssr` client drops the JWT intermittently. See commits 0710ce4, 1dccc46, 501d976, 0f28db9. E2E path is clean on this; don't regress it. Admin/institution pages not yet migrated but out of scope.
- `next/headers` is not edge-runtime-compatible. In middleware, inline the service client with `@supabase/supabase-js`'s `createClient` rather than importing from `@/lib/supabase/server`.

## Environment state to verify on session start

- Cloudinary env vars in Vercel (`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`) — the `/log` upload worked in spirit (David saw the camera buttons and the upload preset is wired), but verify. Upload preset must be set to **unsigned** in Cloudinary dashboard so the browser-direct upload works without signing.
- `GROQ_API_KEY` in Vercel env — added by David earlier for Whisper-large-v3. Verify it's in production env, not just preview.
- `ANTHROPIC_API_KEY` in Vercel env — Companion needs it.
- DB state: David's user `231c3b34-0504-422d-ad5e-dcd536b97c0f` has one commitment `651919b0-defc-446a-836d-b6b77ca88f09` "Sentensese" in status `launch`, streak_starts_at 2026-05-02. Three posts already logged, all with empty `media_urls`. Feel free to delete these during testing or ask David first — they're test data but they're his, not mine to assume.

## Pitfalls to avoid

- **Don't ask David to test Stage A from his phone before Stage A handles launch status.** The whole point is that the video→AI loop works during launch. If CompanionPanel is still gated to active at test time, David will see no AI response, conclude we broke something, and we'll burn 30 minutes re-diagnosing what's actually working as designed.
- **Don't skip the video-specific prompt framing in favor of just removing the active gate.** Removing the gate gets you a Companion that reads the session record during launch, which in launch-window has very little in it. Without the "respond to what you just heard" framing, the Companion will say something generic that feels like a chatbot rather than a teacher. Both changes together unlock the product; either one alone feels flat.
- **Don't break the rate limit.** `companion_rate_limit` table caps at 20 calls/hr per user. This is a safety rail against a render-loop bug burning the Anthropic bill. Don't remove it even if it gets in the way of testing — just wait out the hour or bump the limit temporarily via `execute_sql` and restore it before shipping.
- **Don't build a native-recording UI on desktop first and ship to mobile second.** Mobile is the primary surface. Test on David's phone (Android Chrome). `MediaRecorder` support is good on Android but codec selection matters (opus/webm usually works; mp4/aac sometimes needed). Verify what Cloudinary accepts.

## Open design questions to surface to David before implementing

1. During launch window, should the Companion's first turn be unprompted (opens the panel with a greeting) or prompted (practitioner has to tap "start")? The active-commitment behavior is currently unprompted — panel auto-opens a reflection. Launch window has no sessions yet so an auto-reflection reads weird. Probably prompt-first in launch: "Ready to talk about what you're building?" button → Companion opens.
2. When a practitioner uploads a video during launch window (no prior sessions), what's the Companion's job? To help them articulate the commitment? To prepare them for day 1? To let them rehearse explaining their practice to a potential sponsor? David's instinct seems to lean toward "help them think through what they're committing to" — confirm.
3. Should Stage B record-button replace the current upload UI entirely, or live alongside it (record OR upload existing file)? Record-only is simpler and matches the "mobile-first daily habit" shape; upload-also keeps desktop users in play.

## First moves for the next session

1. Pull latest main (current head is `c9b8e1c` as of the last session). Verify production is live and the /log launch-window splash copy looks right.
2. Read this file's "Stage A — fix the three gaps" section.
3. Open `src/app/(dashboard)/commit/[id]/page.tsx`, `src/app/log/client.tsx`, `src/app/api/companion/reflect/route.ts`, `src/lib/anthropic.ts` side by side.
4. Ask David the three design questions above, and also whether to keep the three pre-existing media-less posts on his commitment or delete them for cleaner testing.
5. Implement Stage A as a single commit (or at most two: one for the media UI on /commit, one for the Companion changes). Ship. Have David test from his phone.
6. If Stage A feels right, proceed to Stage B planning. If not, iterate on the prompt and framing before building more.

## What "done" looks like at the end of the next session

David opens his phone, navigates to his launch-window commitment, uploads or records a short video saying something about his practice, and gets back a response from the Companion that specifically engages with what he said on the video — quoting or paraphrasing a phrase, asking a grounded question, or offering an observation that could only have come from actually listening to him. That interaction is the product. Everything else in Search Star is in service of it.
