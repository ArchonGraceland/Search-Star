# Search Star — Claude Code context

## Project
Search Star (searchstar.com) — sovereign personal data platform.
Owner: David (dverchere@gmail.com, GitHub: ArchonGraceland).
Private repo, deploys from `main` to Vercel on push.

## Source-of-truth docs (read in order at session start)
1. docs/v4-decisions.md — structural decisions, including Decision #8 (rooms-are-primary, 2026-04-20)
2. docs/chat-room-plan.md — five-phase room plan
3. docs/v4-build-plan.md — broader v4 plan (Decision #8 supersedes parts of this)
4. docs/bcd-arc.md — execution log for B/C/D arc Sessions 1–6
5. docs/review/pass-*.md — recent audit + decision records

When older notes disagree with the docs, **the docs win.**
docs/next-session-companion-v2.md is DEPRECATED — read only for tactical reference.

## Anti-drift rule
Before starting any "next-session target," verify status against:
- docs/review/pass-*.md
- docs/bcd-arc.md
- the file system

Trust the docs over any other source.

## Stack
Next.js 16 (App Router), TypeScript, Tailwind v4, Supabase (Postgres + RLS + Realtime), Vercel.

## Design system — Project Graceland
- Navy #1a3a6b
- Crimson Text headings, Roboto body, JetBrains Mono for monetary values
- 3px border-radius
- Teal #0d9488 for platform-facing UI
- Institutional restraint

## Build/deploy rules
- Always run `npm run build` before pushing — TypeScript must pass.
- Git author MUST be dverchere@gmail.com / David — other emails break Vercel.
- `main` is the only deploy target. `v4` branch is retired.
- Vercel auto-deploys on push, ~75s.
- Verify deploys with curl `-s -o /dev/null -w "%{http_code}"`. 405 on GET = POST-only route deployed. Redirect-to-login on protected routes = correct.

## Supabase rules
- Use the `apply_migration` MCP tool (not `execute_sql`) for DDL.
- `supabase db push` via CLI fails — Supabase DNS unreachable from sandboxes. Use the MCP tool.
- Project ID: qgjyfcqgnuamgymonblj
- Always `DROP CONSTRAINT IF EXISTS` before re-adding a CHECK constraint.
- Verify schema with `SELECT table_name FROM information_schema.tables WHERE table_schema='public'` before migrations.
- Never declare the Supabase Admin client at module scope — env vars aren't available at build time. Use a lazy singleton.

## Realtime debugging
- When Realtime is broken and client looks clean (SUBSCRIBED, no errors): query server logs FIRST. `Supabase:get_logs service='realtime'` is one tool call. Bug is usually a recursive RLS policy.
- Do NOT layer custom retry on top of SDK reconnect — causes "cannot add callbacks after subscribe()" race. Fix via component-key remount instead.

## Vercel log queries
Require teamId `team_3QGOH2gaQBtEyFzCX7wtsP7X` and projectId `prj_4naGexGhfiklNAPntvurIkFWH5Nh` on every call. API truncates messages — use Vercel dashboard UI for full error text.

## SSR Supabase client (ongoing)
Outbound Postgres queries sometimes run unauthenticated; RLS-gated tables silently return empty. E2E path fully migrated as of 2026-04-25. Long-term: diagnose @supabase/ssr JWT-propagation. Not launch-blocking.

## Companion v2 / Phase 10 — current target
The plan of record is `docs/companion-v2-plan.md` (drafted 2026-04-26, restructured around multi-agent architecture). Read that, not the older five-item roadmap that this section used to carry. Sub-phases in serial order:

- 10A — Foundations: doc cleanup + cross-commitment memory (schema, Memory Curator agent, read path).
- 10B — Conversation-aware participation: architectural rewrite of the Response Companion's trigger model. Replaces the `triggerKind` enum and the followup heuristic with one "should I speak now?" decision per practitioner_post.
- 10C — Voice input via Whisper (Groq `whisper-large-v3`, reusing `src/lib/companion/media.ts`).
- 10D — Streaming Companion responses (deferred until self-pilot signals 3–5s latency is the felt pain).

Cited supporting docs: `docs/companion-v2-scope.md` (scope-survival reasoning), `docs/bcd-arc.md` Known-follow-ups dated 2026-04-22 and 2026-04-26 (the two production traces driving 10B), `docs/chat-room-plan.md` §§3, 6, 7 (voice and event-by-event behavior — unchanged in Phase 10).

GROQ_API_KEY is set in Vercel (Production / Preview / Development) — no further env work needed for Companion media transcription or future Whisper composer input.
