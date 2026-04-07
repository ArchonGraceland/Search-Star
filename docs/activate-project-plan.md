# Activate — Project Plan

**Search Star Profile Activation System**
*From passive consumer to sovereign participant*

---

## Overview

The Activate system (`/activate`) lets anyone go from "the internet has scattered data about me" to "I own a structured, validated, monetized profile" in minutes. The UI flow is built and deployed. This plan breaks the remaining backend and integration work into phases that each fit in a single chat session.

**Current state:** Six-step UI at `/activate` with mock data. Steps: Identify → Scrape → Review & Correct → Private Sections → Visual Narrative → Publish.

**End state:** Fully functional pipeline that discovers real public data, generates real profile JSON-LD with provenance metadata, integrates with Google Photos Picker, produces downloadable files, and feeds into the existing registration desk.

**Spec alignment:** This plan implements Section 3.9 ("Activate: Profile Discovery & Visual Narrative") of the Search Star specification v1.3. All deliverables are cross-referenced to spec subsections below.

**UI-to-spec step mapping:** The Activate UI has six steps; the spec defines seven logical steps. The mapping is:
- UI Step 1 (Identify) = Spec step 1 (Identify)
- UI Step 2 (Scrape) = Spec steps 2 + 3 (Discover + Assemble draft)
- UI Step 3 (Review) = Spec steps 4 + 5 (Present for review + Confirm/correct/remove)
- UI Step 4 (Private) = Spec step 6 (Add private sections)
- UI Step 5 (Photos) = Spec visual narrative (not a discrete spec step — cross-cuts steps 4-7)
- UI Step 6 (Publish) = Spec step 7 (Publish)

**Repo:** `github.com/ArchonGraceland/Search-Star` — clone fresh each session.

---

## Phase 1: Discovery Engine — GitHub & Google Scholar

**Estimated scope:** 1 chat session
**Depends on:** Nothing (standalone backend)
**Spec reference:** Section 3.9, "Discovery sources" table — Skills & credentials row, Interests (intellectual) row

### Chat prompt

> Let's start Phase 1 of the Activate project plan. Build the `/api/activate/discover` route for the Search Star repo. This route accepts POST with `{ fullName, employer, city, linkedinUrl }` and returns an array of SeededField objects by querying GitHub API and Google Scholar. Map GitHub data (repos, languages, commits, stars) to Skills and Google Scholar data (publications, h-index) to Interests (intellectual). Each field needs provenance metadata: source URL, timestamp, status "seeded". Support multiple values when sources disagree. Then wire the Activate UI (`src/app/activate/page.tsx`) Step 1 button to call this API instead of using mock data. Push to GitHub when done.

### Files to create
- `src/app/api/activate/discover/route.ts` — the discovery API route

### Files to modify
- `src/app/activate/page.tsx` — replace mock data with real API call in `handleScrape`
- `package.json` — add any new dependencies (e.g., `octokit` for GitHub API)

### Files to reference (read-only context)
- `public/spec.html` — Section 3.9, "Discovery sources" table for field mappings
- `src/app/api/profile/route.ts` — pattern for Supabase server client creation

### Deliverables
- API route at `/api/activate/discover` (POST)
- GitHub API integration: repos, languages, commit counts, star counts → Skills
- Google Scholar scraping: publications, h-index, co-authors → Interests (intellectual)
- Response format: `{ fields: SeededField[], photos: NarrativePhoto[] }`
- Activate UI wired to real API
- Error handling for rate limits, not-found, disambiguation
- Multi-value support when same field found in multiple sources

### End-of-phase checklist
- [ ] `npm run build` passes
- [ ] Push to GitHub, Vercel deploys successfully
- [ ] `/activate` Step 1 calls real API (even if Scholar returns empty for most people, GitHub should return data for anyone with a public profile)
- [ ] Verify: `curl -X POST https://www.searchstar.com/api/activate/discover -H 'Content-Type: application/json' -d '{"fullName":"...","employer":"...","city":"..."}' | jq .`

### Handoff to Phase 3
No files to carry over — Phase 3 works from the response format established here.

---

## Phase 2: Discovery Engine — LinkedIn, Professional & Social Sources

**Estimated scope:** 1 chat session
**Depends on:** Phase 1 (extends the same API route)
**Spec reference:** Section 3.9, "Discovery sources" table — all six rows

### Chat prompt

> Let's do Phase 2 of the Activate project plan. Extend the `/api/activate/discover` route to add LinkedIn public profile scraping (Identity fields), professional directory lookups (bar associations, medical boards, CPA registries), conference archive scraping (PyCon, KubeCon speaker pages), Athlinks/RunSignUp race results (Interests athletic), social interest discovery (meetup profiles, nonprofit boards), and professional history (company websites, SEC EDGAR). Add merge logic that preserves all values when multiple sources disagree. Add a disambiguation step in the UI for when the scraper finds multiple possible matches. The spec requires all six source categories from the Discovery sources table in Section 3.9. Push to GitHub when done.

### Files to modify
- `src/app/api/activate/discover/route.ts` — extend with new source integrations
- `src/app/activate/page.tsx` — add disambiguation UI if multiple matches found

### Files to reference
- `public/spec.html` — Section 3.9, "Discovery sources" table (all six rows)

### Deliverables
- All six spec source categories implemented: Identity, Skills, Interests (athletic), Interests (social), Interests (intellectual), Professional history
- Merge logic preserving multiple values with source attribution
- Disambiguation UI for multiple-match scenarios

### End-of-phase checklist
- [ ] Build passes, deploy succeeds
- [ ] Test with a person who has LinkedIn + GitHub + Scholar presence
- [ ] Verify all six source categories return data for appropriate test cases

### Handoff to Phase 5
No files to carry over.

---

## Phase 3: Provenance System & Database Schema

**Estimated scope:** 1 chat session
**Depends on:** Phase 1 (needs the discovery output format)
**Spec reference:** Section 3.9, "Claim provenance" subsection; "Unclaimed profiles" subsection

### Chat prompt

> Let's do Phase 3 of the Activate project plan. Build the provenance system and database schema. Create a Supabase migration for a new `profile_fields` table: `id, profile_id, section, label, value, provenance_status (seeded/confirmed/self_reported/corrected/validated/removed), source_url, seeded_at, confirmed_at, corrected_at, original_value, confidence_score`. Support multi-value fields (multiple rows for same field+section when sources disagree). Add `seeding_status` column (claimed/unclaimed) to the directory table. Add RLS policies: owners read/write their own, platforms read status only, unclaimed profiles frozen (no writes). Add a `confidence_score` per field (0-1) based on source reliability (GitHub API=0.9, web scrape=0.6, self-reported=0.5). Update the Activate UI to persist field states via Supabase and show confidence indicators alongside provenance badges. The spec defines five provenance states — `validated` is set by the trust system later but the column must exist now. Push to GitHub when done.

### Files to create
- `supabase/migrations/YYYYMMDD_profile_fields.sql` — new table, RLS policies, indexes
- `src/app/api/activate/fields/route.ts` — CRUD API for profile fields with provenance

### Files to modify
- `src/app/activate/page.tsx` — persist to Supabase, show confidence indicators, load saved state
- `src/app/api/activate/discover/route.ts` — save discovered fields to database after scraping

### Files to reference
- `public/spec.html` — Section 3.9, "Claim provenance" subsection (five states table, JSON-LD examples)
- `src/lib/supabase/server.ts` — server client pattern
- `src/lib/supabase/client.ts` — client-side Supabase pattern

### Deliverables
- `profile_fields` table with multi-value support and all five provenance states
- `seeding_status` column on directory table
- RLS policies including unclaimed freeze
- Confidence scores computed and displayed
- Activate UI persists state across page refreshes
- Correction logging stores original values

### End-of-phase checklist
- [ ] Migration runs without errors on Supabase
- [ ] Build passes, deploy succeeds
- [ ] Activate flow persists: start activation, refresh page, data is still there
- [ ] Confirm/correct/remove actions update the database
- [ ] Confidence indicators visible in review step

### Handoff to Phase 5
The `profile_fields` table schema is the foundation for photo metadata storage in Phase 5.

---

## Phase 4: Google Photos Picker Integration

**Estimated scope:** 1 chat session
**Depends on:** Nothing (standalone OAuth flow)
**Spec reference:** Section 3.9, "Photo sourcing" subsection — "Private library integration" channel

### Chat prompt

> Let's do Phase 4 of the Activate project plan. Integrate the Google Photos Picker API. This requires: setting up OAuth 2.0 (I'll need to create a Google Cloud project and provide the client ID/secret), creating a Picker session via the API, redirecting the user to the pickerUri in a new window with /autoclose, polling the session until mediaItemsSet is true, retrieving selected media items with their metadata (date, location, dimensions), and mapping them into the NarrativePhoto format with auto-suggested chapter assignments. Wire this into the Activate UI Step 5 "Connect Google Photos" button. The Picker API cannot be iframed — it must open in a new window. Push to GitHub when done.

### Pre-requisites (manual, before starting chat)
- Create Google Cloud project at console.cloud.google.com
- Enable Photos Picker API
- Configure OAuth consent screen
- Create OAuth 2.0 client ID (web application)
- Add authorized redirect URI: `https://www.searchstar.com/api/activate/google-photos/callback`
- Add credentials to Vercel environment variables: `GOOGLE_PHOTOS_CLIENT_ID`, `GOOGLE_PHOTOS_CLIENT_SECRET`

### Files to create
- `src/app/api/activate/google-photos/session/route.ts` — create Picker session
- `src/app/api/activate/google-photos/poll/route.ts` — poll session status
- `src/app/api/activate/google-photos/items/route.ts` — retrieve selected media items
- `src/app/api/activate/google-photos/callback/route.ts` — OAuth callback

### Files to modify
- `src/app/activate/page.tsx` — replace `handleGooglePhotosConnect` alert with real OAuth + Picker flow

### Deliverables
- Full OAuth 2.0 → Picker session → poll → retrieve flow
- Photos mapped to NarrativePhoto with auto-suggested chapters
- Working "Connect Google Photos" button in Activate UI

### End-of-phase checklist
- [ ] Build passes, deploy succeeds
- [ ] Click "Connect Google Photos" → OAuth → Google Photos picker opens → select photos → they appear in the narrative builder
- [ ] Selected photos have date and location metadata populated

### Handoff to Phase 5
Google Photos integration provides one of three photo channels. Phase 5 builds the other two (upload + URL import) and the processing pipeline.

---

## Phase 5: Photo Upload, URL Import & Processing

**Estimated scope:** 1 chat session
**Depends on:** Phase 3 (needs database to persist photo metadata), Phase 4 (Google Photos imports need location backfill)
**Spec reference:** Section 3.9, "Photo sourcing", "Photo metadata schema", "Photo hosting" subsections

### Chat prompt

> Let's do Phase 5 of the Activate project plan. Build the photo processing pipeline. Enhance device upload to extract EXIF metadata (date, GPS→location via geocoding) and auto-suggest chapter assignments. Build the URL import to fetch images and extract metadata. Also backfill Google Photos-sourced NarrativePhotos from Phase 4: download images server-side using the baseUrl (with OAuth bearer token and `=d` param), run EXIF extraction to get GPS coordinates, reverse geocode to location strings, and populate the location field — the Picker API doesn't expose GPS so we need the actual image bytes. Store photo metadata in Supabase matching the spec's full photo metadata schema: type, url, hash (SHA-256), accessTier, narrative (chapter, caption, date, location, relatedFields), provenance (status, source, discoveredAt), validation (validatedBy:[], stake:0). Each photo needs a per-photo accessTier setting (default "public"). Include empty validation block scaffolding. Convert uploaded images to WebP at max 2048px on the long edge. Generate SHA-256 hashes. Push to GitHub when done.

### Files to create
- `src/app/api/activate/photos/upload/route.ts` — handle file upload, EXIF extraction, WebP conversion, hash generation
- `src/app/api/activate/photos/import-url/route.ts` — fetch image from URL, process same as upload
- `src/app/api/activate/photos/enrich-google/route.ts` — download Google Photos images via baseUrl + OAuth token, extract EXIF GPS, reverse geocode, return enriched metadata
- `src/lib/photo-processing.ts` — shared utilities: EXIF parsing, WebP conversion, hash generation, chapter suggestion, reverse geocoding

### Files to modify
- `src/app/activate/page.tsx` — enhance upload handler to call API, show EXIF-derived metadata, add accessTier toggle per photo
- `package.json` — add dependencies: `sharp` (WebP conversion), `exifr` (EXIF parsing)

### Files to reference
- `public/spec.html` — Section 3.9, "Photo metadata schema" (JSON example), "Photo hosting" (WebP, 2048px, cache headers)

### Deliverables
- EXIF extraction (date, GPS coordinates) with reverse geocoding
- Auto-chapter suggestion from metadata context
- Google Photos location backfill: download image bytes via baseUrl + OAuth bearer token, extract EXIF GPS, reverse geocode to location string, update NarrativePhoto.location
- WebP conversion at max 2048px
- SHA-256 hash generation
- Per-photo accessTier setting
- Empty validation block in schema
- Photo metadata persisted to Supabase

### End-of-phase checklist
- [ ] Build passes, deploy succeeds
- [ ] Upload a photo → see EXIF date and location auto-populated
- [ ] URL import works → image fetched and processed
- [ ] Google Photos imports from Phase 4 → location field backfilled from EXIF GPS
- [ ] Photos stored as WebP, hash generated
- [ ] accessTier toggle visible per photo

### Handoff to Phase 6
Photos and profile fields are now both persisted. Phase 6 exports them as JSON-LD + HTML.

---

## Phase 6: Profile JSON-LD Export & HTML Generation

**Estimated scope:** 1 chat session
**Depends on:** Phases 3 and 5 (needs provenance data and photo metadata)
**Spec reference:** Section 3.9 (provenance JSON-LD examples), Section 8.4 (output format table), Section 8.2 (visibility modes), Section 8.3 (Contact via Search Star)

### Chat prompt

> Let's do Phase 6 of the Activate project plan. Build the export pipeline. Generate `profile.json` as JSON-LD with schema version `schema.searchstar.org/v1.3`, per-field provenance tags, photo array with full narrative metadata (chapter, caption, date, location, relatedFields, accessTier, hash, validation placeholder), and access policy with user-set pricing. Multi-value fields: export only the user's chosen value, not rejected alternatives. Generate `index.html` using the Graceland design system (Crimson Text, Roboto, JetBrains Mono, navy #1a3a6b, 3px radius) with visual narrative gallery organized by chapter, score visualizations, "Contact via Search Star" button, and visibility mode support (full/summary). Include a cache header guidance comment. Package profile.json + index.html + WebP photos + README.txt into a downloadable zip. Ensure the registration desk at /profile-builder can accept both v0.8 and v1.3 schemas. Push to GitHub when done.

### Files to create
- `src/lib/profile-export.ts` — JSON-LD generator (shared utility)
- `src/lib/html-export.ts` — Graceland HTML page generator
- `src/app/api/activate/export/route.ts` — endpoint that generates zip file

### Files to modify
- `src/app/activate/page.tsx` — wire "Download files & register" button to call export API
- `src/app/(dashboard)/profile-builder/page.tsx` — accept v1.3 schema alongside v0.8

### Files to reference
- `public/spec.html` — Section 3.9 JSON-LD examples, Section 8.2 visibility modes, Section 8.3 Contact CTA, Section 8.4 output format table
- `public/profile.html` — existing sample profile for HTML structure reference

### Deliverables
- `profile.json` with full provenance and narrative metadata
- `index.html` with Graceland design, visual narrative gallery, Contact button, visibility modes
- Downloadable zip with all files + README.txt
- Registration desk accepts v1.3 schema

### End-of-phase checklist
- [ ] Build passes, deploy succeeds
- [ ] Complete activation flow → click "Download" → zip downloads with profile.json, index.html, photos, README.txt
- [ ] Open index.html in browser → looks correct, visual narrative gallery works
- [ ] profile.json validates against schema
- [ ] Upload profile.json to profile-builder → accepted without errors

### Handoff to Phase 7
Export pipeline is complete. Phase 7 connects the dots between Activate and the registration desk.

---

## Phase 7: Registration Desk Integration

**Estimated scope:** 1 chat session (small)
**Depends on:** Phase 6 (needs the exported files)
**Spec reference:** Section 8.4 step 7 (Register with Search Star)

### Chat prompt

> Let's do Phase 7 of the Activate project plan. This is glue code connecting Activate to the existing registration desk. After the user downloads their files in Step 6, redirect them to `/profile-builder?source=activate` with pre-populated data. Update the profile-builder to accept a `source=activate` query param that skips the URL fetch step and uses passed data (name, handle, location, presence score, skills count, interests) directly. Add a "Just activated?" link on the profile-builder page. Store activation state in Supabase so users can resume if they leave mid-flow. Push to GitHub when done.

### Files to modify
- `src/app/activate/page.tsx` — add redirect to profile-builder after download
- `src/app/(dashboard)/profile-builder/page.tsx` — accept `source=activate` param, skip URL fetch, pre-populate fields
- `src/app/api/activate/state/route.ts` — save/load activation progress

### Files to create
- `src/app/api/activate/state/route.ts` — activation state persistence API

### Deliverables
- Seamless flow from Activate → download → register
- Profile-builder pre-populated from activation data
- Resumable activation state

### End-of-phase checklist
- [ ] Build passes, deploy succeeds
- [ ] Complete full flow: identify → scrape → review → photos → publish → download → register
- [ ] Leave mid-flow, come back, resume where you left off

### Handoff to Phase 9
Core flow is complete end-to-end. Remaining phases are enhancements.

---

## Phase 8: Unclaimed Profiles

**Estimated scope:** 1 chat session
**Depends on:** Phases 1-2 (discovery engine) and Phase 3 (database schema)
**Spec reference:** Section 3.9, "Unclaimed profiles" subsection

### Chat prompt

> Let's do Phase 8 of the Activate project plan. Build the unclaimed profiles system. Add background discovery capability that creates draft stubs from public data without a user initiating. Store as directory entries with `seeding_status: 'unclaimed'`, trust score 0. Enforce frozen state via the RLS policy from Phase 3 — no edits allowed. Add "Unclaimed" badge in the platform directory browser. Build a claim flow: user finds their stub, verifies identity via KYC (Stripe Identity per spec section 2), takes ownership. Implement immediate deletion on request with no appeals. Disable all monetization on unclaimed stubs — no paid queries, no marketing messages. Add a GDPR-style deletion endpoint. The spec comparison table defines five properties that differ between claimed/unclaimed — enforce all five. Push to GitHub when done.

### Files to create
- `src/app/api/activate/background-discover/route.ts` — background discovery endpoint
- `src/app/api/activate/claim/route.ts` — claim flow with KYC verification
- `src/app/api/activate/delete-stub/route.ts` — immediate deletion endpoint

### Files to modify
- `src/app/platform/directory/page.tsx` — add "Unclaimed" badge, filter/sort by status
- `src/app/api/platform/directory/route.ts` — return seeding_status, filter options
- `src/app/api/platform/query/route.ts` — block paid queries on unclaimed profiles
- `src/app/api/platform/send-marketing/route.ts` — block marketing to unclaimed profiles

### Deliverables
- Background discovery creating frozen unclaimed stubs
- Claim flow with KYC identity verification
- Immediate deletion on request
- All five spec properties enforced (trust=0, not queryable, not editable, visible with badge, no marketing)
- Platform directory shows claimed/unclaimed status

### End-of-phase checklist
- [ ] Build passes, deploy succeeds
- [ ] Create an unclaimed stub → verify it appears in directory with badge
- [ ] Attempt to query unclaimed stub → blocked
- [ ] Attempt to send marketing to unclaimed stub → blocked
- [ ] Claim the stub → verify status transitions to claimed, profile becomes editable
- [ ] Request deletion → verify immediate removal

---

## Phase 9: Public Photo Discovery

**Estimated scope:** 1 chat session
**Depends on:** Phase 2 (discovery engine) and Phase 5 (photo metadata system)
**Spec reference:** Section 3.9, "Photo sourcing" — "Public discovery" channel

### Chat prompt

> Let's do Phase 9 of the Activate project plan. During activation, search for publicly available images associated with the individual. Sources per spec: conference speaker pages, university faculty pages, company about pages, published articles with author headshots, public Flickr, event photography archives, race photo services. Record source URL and context. Auto-suggest chapter assignment (conference → intellectual, race → athletic, company → professional). Present discovered photos in the Activate UI Step 5 alongside uploaded photos. All photos require explicit user approval — none auto-included. Discovered photos get provenance status "seeded" with source URL. Push to GitHub when done.

### Files to create
- `src/lib/photo-discovery.ts` — image discovery from public sources

### Files to modify
- `src/app/api/activate/discover/route.ts` — add photo discovery alongside data discovery
- `src/app/activate/page.tsx` — show discovered photos with approval/reject controls in Step 5

### Deliverables
- Photo discovery from conference, university, company, article, and race sources
- Auto-chapter suggestion from source context
- Discovered photos presented for explicit approval
- Provenance tracking on discovered photos

### End-of-phase checklist
- [ ] Build passes, deploy succeeds
- [ ] Activate with a person who has conference speaker photos → photos appear as candidates
- [ ] Approve/reject controls work
- [ ] Approved photos appear in visual narrative with correct chapter

---

## Phase 10: Spec Update & Documentation

**Estimated scope:** 1 chat session (small)
**Depends on:** All previous phases

### Chat prompt

> Let's do Phase 10 of the Activate project plan. Final documentation pass. Update spec section 3.9 with implementation details learned during build. Update section 8.4 to reference `/activate` as the primary onboarding path with AI prompt as fallback. Update `create.html` to link to `/activate`. Update the onboarding page and homepage to feature Activate prominently. Update roadmap to reflect completed phases. Write developer docs for the discovery API. Verify schema v0.8/v1.3 compatibility across registration desk and platform query system. Push everything to GitHub.

### Files to modify
- `public/spec.html` — section 3.9 implementation details, section 8.4 updated
- `public/roadmap.html` — mark v1.3 phases complete
- `public/create.html` — add link to /activate
- `src/app/onboarding/page.tsx` — feature Activate prominently
- `src/app/page.tsx` — add Activate to homepage hero

### Deliverables
- Spec reflects what was actually built
- All entry points link to /activate
- Roadmap updated
- Developer documentation for discovery API

### End-of-phase checklist
- [ ] All pages link to /activate correctly
- [ ] Spec section 3.9 matches implementation
- [ ] Roadmap shows v1.3 as complete
- [ ] Schema compatibility verified

---

# Activate v1.4 — Synthesis Architecture

**Status:** v1.4.0-draft (architecture decided, implementation in progress)
**Spec reference:** Section 3.9, "v1.4 architecture" subsection

## Why v1.4

The v1.3.0 pipeline (six independent scrapers stapled together with `Promise.allSettled`) shipped and works, but the output quality is thin compared to what users get from Grok or Grokipedia. The diagnosis: scrapers parse, but they don't synthesize. A search-grounded LLM reading the open web produces a fundamentally richer profile than six bespoke parsers each looking at one source in isolation.

v1.4 replaces the parsing architecture with a synthesis architecture. The existing six scrapers from v1.3.0 are deprecated — they remain in the codebase but are no longer called by the discovery flow. If a specific scraper proves uniquely valuable for some field type that synthesis handles poorly, it can be promoted back to a Stage 2 evidence collector at that time.

## The five stages

```
Stage 1 — Identity lock
  One broad search + one Haiku call to disambiguate.
  User picks themselves from 3-5 candidate personas.
  Output: locked identity constraints (canonical name, employer, location, social handles, key URLs).

Stage 2 — Parallel evidence gathering
  Three parallel evidence streams, no merging yet:
    a. Broad web search (Tavily/SerpAPI), top 30-50 results, fetch top ~15 pages
    b. Grok API single-shot ("tell me about this person")
    c. Claude research agent with web_search + web_fetch tools (deep mode only)
  Output: raw evidence bundle (text snippets, URLs, structured rows).

Stage 3 — Synthesis
  Two parallel synthesis calls:
    a. Claude reads evidence bundle, writes 200-word narrative + extracts structured fields
    b. Grok reads evidence bundle, writes 200-word narrative + extracts structured fields
  Then a merge call:
    Per claim, take the value from whichever source has higher confidence.
    If both agree: keep value, confidence = max(claude_conf, grok_conf).
    If only one produced the claim: keep at original confidence, flag as single-source.
  Output: merged narrative + structured fields with provenance.

Stage 4 — Machine verification
  For each cited URL, fetch the page and verify the claim text appears.
  Verified claims: provenance_status = 'seeded', verified_at = now, verification_hash = sha256(content).
  Unverified claims: confidence downgraded by 0.3, flagged for human review.
  This is a HARD COMMITMENT — the verification status becomes part of the trust system.

Stage 5 — Human review (existing flow + corrections logging)
  The existing review UI from v1.3.0 still applies — user confirms, corrects, removes.
  NEW: every correction logged to discovery_corrections table:
    {source, field_type, discovered_value, corrected_value, timestamp}
  These corrections become training data for per-source-per-field-type confidence priors,
  replacing the hardcoded getSourceConfidence() table over time.
```

## Mode split

**Standard mode** runs Stages 1-5 synchronously on activation. ~$0.10-0.15, ~15 seconds. This is the default.

**Deep mode** adds the Claude research agent in Stage 2 (30-second agentic loop with web_search/web_fetch tools). Runs as a background job after publish, notifies the user via the feed when richer results are ready. ~$0.30-0.50, ~60-90 seconds. The user gets fast value immediately and richer value asynchronously.

## Trust system implications

Machine verification is the substantive new capability. v1.3.0 provenance was a *claim* about where data came from — nothing checked whether the cited URL actually contained the data. v1.4 provenance is *machine-verified*: every claim's URL is fetched and grep'd at activation time, and the verification status is part of the row. This is a stronger guarantee than Grokipedia or LinkedIn provide and should be called out in Section 5 of the spec as a trust signal.

Human review remains required after machine verification. Machines do the labor (find claims, verify URLs); humans do the judgment (is this the right person, is this current, is this how I want to be represented). Combining both gives best-of-both-worlds: scale from machines, accuracy from humans.

---

## Phase 11: Identity Lock & Corrections Logging

**Estimated scope:** 1 chat session
**Depends on:** Phase 10 (foundation)
**Spec reference:** Section 3.9, "v1.4 architecture" — Stage 1 + Stage 5

### Chat prompt

> Let's do Phase 11 of the Activate project plan. Build the v1.4 foundation: identity lock and corrections logging. Add a new endpoint `POST /api/activate/identity-lock` that takes `{fullName, employer?, city?, linkedinUrl?}`, runs one broad web search via SerpAPI, fetches the top 10 results, and asks Claude Haiku to group them into 3-5 distinct personas with photo, employer, location, and one-line summary each. Returns the candidates as a `LockedIdentityCandidate[]` array. Add a new Step 0 to the Activate UI that runs identity lock first, presents candidates, lets the user pick themselves, and stores the locked constraints in activation state for downstream use. Also create the `discovery_corrections` table (Supabase migration) with columns: `id, profile_id, source, field_type, label, discovered_value, corrected_value, action ('confirmed'/'corrected'/'removed'), created_at`. Modify the existing `/api/activate/fields` route to log every confirm/correct/remove action to this table. Don't change the v1.3.0 discovery pipeline yet — Phase 12 does that. Push to GitHub when done.

### Files to create
- `src/app/api/activate/identity-lock/route.ts` — identity lock endpoint
- `supabase/migrations/YYYYMMDD_discovery_corrections.sql` — corrections logging table with RLS
- `src/lib/activate/identity-lock.ts` — search + fetch + Haiku call helper

### Files to modify
- `src/app/activate/page.tsx` — insert Step 0 (Identify Yourself) before existing Step 1 (Identify), present candidates, store locked identity in activation state
- `src/app/api/activate/fields/route.ts` — log confirm/correct/remove actions to discovery_corrections
- `src/app/api/activate/state/route.ts` — extend state schema with `lockedIdentity` field

### Files to reference
- `public/spec.html` — Section 3.9 v1.4 architecture (after this phase ships, the spec will describe what's being built)
- `src/app/api/activate/discover/route.ts` — pattern for SerpAPI usage and Supabase persistence

### Deliverables
- Identity lock endpoint that returns 3-5 disambiguated candidates with photos
- Step 0 in the Activate UI: "Which one is you?"
- Locked identity constraints persisted to activation state and available to downstream stages
- `discovery_corrections` table with RLS (owner can read own corrections, no one writes except via API)
- Every user action in the review step logged to corrections table
- Existing v1.3.0 discovery flow unchanged (the deprecation happens in Phase 12)

### End-of-phase checklist
- [ ] `npm run build` passes
- [ ] Migration applies without errors
- [ ] Push to GitHub, Vercel deploys successfully
- [ ] Click into /activate, enter name → see persona candidates → pick one → continue to existing Step 1
- [ ] Confirm a discovered field → row appears in `discovery_corrections` with action='confirmed'
- [ ] Correct a discovered field → row appears with both discovered_value and corrected_value
- [ ] Remove a discovered field → row appears with action='removed'

### Handoff to Phase 12
The locked identity from this phase becomes the input to Stage 2 evidence gathering in Phase 12. The corrections table starts collecting data immediately so by the time Phase 12 ships, there's already a baseline of real correction data to inform the per-source-per-field-type priors (even if those priors aren't computed until Phase 14).

---

## Phase 12: Synthesis Pipeline (Standard Mode)

**Estimated scope:** 2 chat sessions
**Depends on:** Phase 11 (locked identity is the input)
**Spec reference:** Section 3.9, "v1.4 architecture" — Stages 2, 3, 4

### Chat prompt

> Let's do Phase 12 of the Activate project plan. Build the v1.4 synthesis pipeline in standard mode. Replace the existing `/api/activate/discover` with a new pipeline: (Stage 2) gather evidence by running one broad SerpAPI search using the locked identity from Phase 11, fetching the top 15 results in parallel, and extracting main content with @mozilla/readability. In parallel, call Grok's API once with the locked identity asking for a structured profile. (Stage 3) Run two parallel Sonnet calls — one with the search evidence bundle, one with Grok's output — each producing a 200-word narrative and a structured field array with per-claim confidence scores. Then run a third Sonnet call to merge: per claim, take the value from whichever source has higher confidence; if they agree, keep value and use max(c1, c2); if only one produced it, keep at original confidence with single_source flag. (Stage 4) For every claim with a cited URL, fetch the URL and verify the claim text appears in the page content. Mark verified claims with verified_at + content hash; downgrade unverified claims by 0.3 confidence and flag them. Persist everything to profile_fields with the new fields. Mark the v1.3.0 six-scraper code (`discoverScholar`, `discoverLinkedIn`, `discoverProfessionalDirectories`, `discoverAthletic`, `discoverSocial`, GitHub flow) as deprecated in comments but leave them in the file. Push to GitHub when done.

### Pre-requisites (manual, before starting chat)
- Add `XAI_API_KEY` to Vercel environment variables (Grok API key from x.ai)
- Verify SerpAPI key still works (already in env)
- Confirm Anthropic API key has Sonnet access (already in env)

### Files to create
- `src/lib/activate/synthesis/evidence-gathering.ts` — Stage 2: broad search + page fetch + Grok call
- `src/lib/activate/synthesis/synthesize.ts` — Stage 3: two parallel synthesis calls + merge
- `src/lib/activate/synthesis/verify.ts` — Stage 4: URL fetch + claim verification + hash
- `src/lib/activate/synthesis/types.ts` — shared types (EvidenceBundle, SynthesisResult, VerifiedClaim)
- `supabase/migrations/YYYYMMDD_verification_fields.sql` — add `verified_at`, `verification_hash`, `single_source` columns to profile_fields

### Files to modify
- `src/app/api/activate/discover/route.ts` — replace v1.3.0 logic with v1.4 pipeline call; mark v1.3.0 helpers as deprecated in comments
- `src/app/activate/page.tsx` — surface verification status indicators in the review step (verified ✓ / unverified ⚠)
- `src/lib/activate/generate-profile-json.ts` — include verification metadata in JSON-LD output

### Files to reference
- `src/app/api/activate/discover/route.ts` — existing v1.3.0 implementation (being deprecated)
- `src/lib/activate/identity-lock.ts` — Phase 11 output is the input here
- `public/spec.html` — Section 3.9 v1.4 architecture

### Deliverables
- Standard-mode v1.4 pipeline running end-to-end on every activation
- Stage 2 evidence gathering from broad search + Grok in parallel
- Stage 3 dual synthesis (Claude + Grok) with per-claim confidence merge
- Stage 4 machine verification with URL fetching and content hashing
- Verification status visible in the review UI
- v1.3.0 scrapers marked deprecated, code retained for fallback
- All claims persisted to profile_fields with new verification columns

### End-of-phase checklist
- [ ] `npm run build` passes
- [ ] Migration applies without errors
- [ ] Push to GitHub, Vercel deploys successfully
- [ ] Run an activation end-to-end: identity lock → standard synthesis → review → publish
- [ ] Compare output quality to a v1.3.0 activation of the same person — qualitative improvement should be obvious
- [ ] Verify at least 80% of claims have `verified_at` populated (the rest should be flagged for review)
- [ ] Average activation time < 30 seconds, average cost < $0.20

### Handoff to Phase 13
Phase 12 ships standard mode. Phase 13 layers deep mode on top by adding the Claude research agent as a background job.

---

## Phase 13: Deep Mode (Background Research Agent)

**Estimated scope:** 2 chat sessions
**Depends on:** Phase 12 (standard mode is the foundation)
**Spec reference:** Section 3.9, "v1.4 architecture" — deep mode

### Chat prompt (stub — to be expanded after Phase 12 ships)

> Let's do Phase 13 of the Activate project plan. Add deep mode as a background job. After a user publishes a standard-mode activation, queue a background job that runs the Claude research agent (web_search + web_fetch tools, 30-90 second agentic loop) using the locked identity. When the deep mode results land, merge them with the existing profile_fields rows (taking higher-confidence claims, preserving any user corrections that have already happened), re-run Stage 4 verification on the new claims, and notify the user via their feed that richer results are ready. The user can review the new claims and confirm/correct/remove the same way they did with standard mode. Build the background job runner using Vercel cron or a simple in-Postgres job queue. Push to GitHub when done.

### Open questions to resolve before this phase starts
- Background job runner: Vercel cron, a Postgres-backed queue (pg-boss), or a hosted queue (Inngest)?
- How to handle user corrections that happen between standard mode publish and deep mode landing — preserve user values always, or let high-confidence deep-mode values override?
- Notification mechanism: feed item, email, or both?
- Should deep mode be opt-in per profile, or run by default for everyone?

### Estimated deliverables (to be detailed during planning)
- Background job runner
- Deep mode pipeline using Claude research agent with tool use
- Merge logic that respects user corrections
- Feed notification when deep mode results are ready
- Deep mode opt-in/opt-out toggle in the activation flow

---

## Phase 14: Learned Confidence Priors

**Estimated scope:** 1-2 chat sessions
**Depends on:** Phase 11 (corrections data) + Phase 12 (synthesis pipeline)
**Spec reference:** Section 3.9, "v1.4 architecture" — Stage 5 learning loop

### Chat prompt (stub — to be expanded after Phase 12 ships)

> Let's do Phase 14 of the Activate project plan. Replace the hardcoded `getSourceConfidence()` table with learned per-source-per-field-type priors derived from the `discovery_corrections` table. Compute the priors as a nightly batch job: for each (source, field_type) pair, calculate the empirical accuracy as (confirmed_count) / (confirmed_count + corrected_count + removed_count). Store the priors in a new `confidence_priors` table. Update the synthesis pipeline (Phase 12) to use the learned priors instead of hardcoded values. When a (source, field_type) pair has fewer than 50 corrections, fall back to the hardcoded prior. Add an admin dashboard view showing the learned priors and how they've drifted from the hardcoded baseline. Push to GitHub when done.

### Open questions to resolve before this phase starts
- Minimum sample size before a learned prior overrides the hardcoded one (50? 100?)
- How to handle cold-start sources that have never been seen
- Per-field-type granularity (every label individually, or grouped by section)
- Should priors decay over time so stale corrections don't dominate

### Estimated deliverables (to be detailed during planning)
- Nightly batch job computing priors from corrections table
- `confidence_priors` table
- Synthesis pipeline reads from learned priors with hardcoded fallback
- Admin dashboard showing learned vs. hardcoded values

---

## Dependency Graph (updated for v1.4)

```
Phase 1 (GitHub + Scholar discovery)                    [v1.3.0 - DEPRECATED]
  ├── Phase 2 (LinkedIn + professional + social)        [v1.3.0 - DEPRECATED]
  │     └── Phase 8 (Unclaimed profiles)
  │           └── Phase 9 (Public photo discovery)
  └── Phase 3 (Provenance + database + multi-value + freeze)
        ├── Phase 5 (Photo upload + URL import + processing)
        │     └── Phase 6 (JSON-LD export + HTML generation)
        │           └── Phase 7 (Registration desk)
        └── Phase 8 (Unclaimed profiles)

Phase 4 (Google Photos Picker) — independent

Phase 10 (Documentation) — after v1.3.0 phases

──── v1.4 Synthesis Architecture ────

Phase 11 (Identity lock + corrections logging)
  └── Phase 12 (Synthesis pipeline standard mode)       [REPLACES v1.3.0 scrapers]
        ├── Phase 13 (Deep mode background research)
        └── Phase 14 (Learned confidence priors)
```

## Recommended Order (v1.4)

1. **Phase 11** — Identity lock + corrections logging (foundation for both 12 and 14)
2. **Phase 12** — Synthesis pipeline standard mode (the main quality jump)
3. **Phase 13** — Deep mode (richer results for users who want them)
4. **Phase 14** — Learned confidence priors (long-term sharpening loop)

After Phase 12 ships, the existing v1.3.0 scrapers are dead code that can either be deleted or kept as fallback. The decision point should be after a few weeks of running v1.4 in production — if users are getting consistently better results, delete the scrapers; if some scraper is producing data the synthesis pipeline misses, promote it back to a Stage 2 evidence collector.

---

## Dependency Graph (v1.3, historical)

This was the dependency structure when v1.3.0 was being built. Phases 1, 2, and 9 are now deprecated by v1.4 but the rest of the v1.3 graph (Phases 3, 4, 5, 6, 7, 8, 10) remains in force — they're foundation pieces that v1.4 depends on.

```
Phase 1 (GitHub + Scholar discovery)                    [DEPRECATED in v1.4]
  ├── Phase 2 (LinkedIn + professional + social sources) [DEPRECATED in v1.4]
  │     └── Phase 8 (Unclaimed profiles)
  │           └── Phase 9 (Public photo discovery)        [DEPRECATED in v1.4]
  └── Phase 3 (Provenance + database + multi-value + freeze)
        ├── Phase 5 (Photo upload + URL import + processing)
        │     └── Phase 6 (JSON-LD export + HTML generation)
        │           └── Phase 7 (Registration desk)
        └── Phase 8 (Unclaimed profiles)

Phase 4 (Google Photos Picker) — independent, can run in parallel

Phase 10 (Documentation) — after everything else
```

## Recommended Order (v1.3, historical — for reference)

1. **Phase 1** — GitHub + Scholar discovery (gets real data flowing)
2. **Phase 3** — Provenance + database (foundation for persistence, multi-value support, freeze enforcement)
3. **Phase 2** — LinkedIn + professional + social sources (completes all six spec source categories)
4. **Phase 5** — Photo upload + URL import + processing (full photo metadata schema)
5. **Phase 4** — Google Photos Picker (parallel track, needs OAuth setup — do manual pre-requisites first)
6. **Phase 6** — JSON-LD export + HTML generation (produces actual output files)
7. **Phase 7** — Registration desk integration (connects to existing system)
8. **Phase 9** — Public photo discovery (enhancement)
9. **Phase 8** — Unclaimed profiles (ethically complex, do after core flow works)
10. **Phase 10** — Documentation (clean up and document)

v1.3 total: ~10 chat sessions, completed.
v1.4 total: ~6 additional chat sessions across Phases 11-14.

---

## Session Protocol

At the start of each session:
1. Clone the repo fresh: `git clone https://ArchonGraceland:TOKEN@github.com/ArchonGraceland/Search-Star.git`
2. Copy the chat prompt from the relevant phase above
3. Paste it as your first message

At the end of each session:
1. Build passes (`npm run build`)
2. Push to GitHub with descriptive commit message
3. Verify Vercel deployment succeeds
4. Confirm the end-of-phase checklist items
