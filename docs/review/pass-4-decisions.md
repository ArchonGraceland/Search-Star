# Pass 4 — Principal Decisions

This file records decisions the principal (David) has made during Pass 4.
Pass 4 opens with the password-reset flow as its anchor per Pass 3 §6(h),
which nominated it as the load-bearing blocker to real-user launch.

The shape of this file diverges from `pass-3-decisions.md` in one respect:
where Pass 3 alternated plan-blocks and completion-notes (§1 plan, §2
completion), Pass 4 records each work item as a single section that
covers the discovery, the decision, and the outcome together. This is
appropriate when the work is small enough that a separate plan-and-
signoff phase would add ceremony without protection — Pass 4's first
two items both had that shape.

---

## §1 — Phase 9a verification: password-reset flow already shipped

**Discovery (entering Pass 4).** The Pass 4 session prompt and Pass 3
§6(h) both nominated the password-reset flow as the next anchor, on the
assumption that no self-serve recovery path existed. That assumption
was stale. Commit `126f153` from 2026-04-20 ("Phase 9a: self-serve
password reset flow") had already shipped:

- A "Forgot password?" link on `src/app/(auth)/login/page.tsx` (line 117)
  pointing at `/auth/forgot-password`.
- `src/app/auth/forgot-password/page.tsx` — a full email-entry form
  calling `supabase.auth.resetPasswordForEmail(email, { redirectTo:
  '<origin>/auth/reset' })` and always showing the "check your email"
  confirmation regardless of account existence (no enumeration leak).
- `src/app/auth/reset/page.tsx` — a new-password form gated on
  `supabase.auth.getUser()` returning a session, with a clean
  "Link expired" fallback when no session is present, calling
  `updateUser({ password })` on submit and redirecting to `/log` on
  success.
- `src/app/auth/callback/route.ts` already handles **both** the legacy
  PKCE (`?code=`) and the modern token-hash (`?token_hash=&type=`)
  email-link flows, so either Supabase email-template format
  successfully establishes a session on the searchstar.com domain.

The Phase 9a commit body flagged two pieces of dashboard config as the
remaining work:

> Still requires Supabase dashboard config:
>   1. URL Configuration → add /auth/reset to Redirect URLs
>   2. Email Templates → Reset Password → confirm token-hash flow link

Whether either was done was unverified. The userMemories block and
Pass 3 §6(h) recommendation both still listed the password-reset flow
as not-yet-built, so Phase 9a's status going into Pass 4 was: code
landed five days ago, no end-to-end test ever performed in production,
config items unconfirmed.

**Sanity-check findings.**

1. **Vercel deploy state.** Three production deploys READY (the F2,
   F23, and §8-completion docs commits from Pass 3f). No regressions.

2. **URL allowlist.** Current `uri_allow_list`:
   ```
   https://www.searchstar.com/auth/callback,
   https://www.searchstar.com/auth/confirm,
   https://www.searchstar.com/**,
   http://localhost:3000/**
   ```
   The `/**` wildcard already covers `/auth/reset`. Phase 9a's commit
   body warning was conservative; no allowlist change needed.

3. **Recovery email template.** Subject was set to `"Reset Your Password"`
   (Title Case Of A Random Vendor — not matching the existing
   `"Confirm your Search Star account"` style). Body was the Supabase
   factory-default 144-character boilerplate:
   ```html
   <h2>Reset Password</h2>
   <p>Follow this link to reset the password for your user:</p>
   <p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
   ```
   Functional, but unbranded. The signup confirmation template, by
   contrast, is a fully Project-Graceland-branded 1.7KB HTML email
   (navy header, Crimson Text headline, navy CTA button, dark footer
   with the "Practice before profile." tagline). The reset email was
   the only Search Star transactional email not on-brand.

4. **Production data state.** 28 auth.users, 28 profiles, 0 orphans,
   0 with empty email. 25 of 28 are unconfirmed
   (`email_confirmed_at IS NULL`); range 2026-04-22 → 2026-04-25
   05:23 UTC. Surprising number, possibly real (slow signup funnel),
   possibly bots, but **out of scope** for password reset. Recorded
   here for archaeology and potential future investigation.

5. **Password floor.** `password_min_length=6` at the DB layer, both
   forms (signup, `/auth/reset`) enforce `minLength={8}` at the form
   layer. Below the principal's draft Q3 recommendation of 12 but
   consistent with existing signup behavior. Not a Pass 4 blocker.

6. **Active-commitment runway.** 2 active commitments started
   2026-04-22; day 90 lands 2026-07-21, ~85 days runway. Untouched
   by Pass 4 work.

**Smoke test (load-bearing question).** Whether the recovery email
actually establishes a session on searchstar.com when the user clicks
the link. The factory-default `{{ .ConfirmationURL }}` template uses
Supabase's hosted `/auth/v1/verify` endpoint as an intermediate hop;
how the session cookie transfers from supabase.co to searchstar.com
through that hop is non-obvious from code-reading alone. The cheapest
way to settle the question was to send a real recovery email and walk
the link.

Email triggered against `dverchere@gmail.com` at 2026-04-25T15:22:36Z
via the public `/auth/v1/recover` endpoint with
`redirect_to=https://www.searchstar.com/auth/reset`. Auth log
confirmed `user_recovery_requested` event, status 200. Email
delivered.

Click-through outcome (verified by principal screenshot):

- Email arrived from `Search Star <hello@searchstar.com>` with subject
  `"Reset Your Password"`.
- Body was the factory-default unbranded boilerplate as expected.
- Click landed on `/auth/reset`, which rendered the new-password form
  with a valid session — the "Set a new password" headline, "Choose
  something you'll remember. At least 8 characters." sub-copy, both
  inputs, the navy "Save new password" button, and the right-side
  branding chrome (logo, table image, convergence-principle pull
  quote) all rendered correctly.
- No "Link expired" fallback triggered. The session cookie transferred
  cleanly to the searchstar.com domain.

**Email-link URL format (deviation from Phase 9a commit body).** The
recovery link in the email points at the Supabase factory-default
endpoint:

```
https://qgjyfcqgnuamgymonblj.supabase.co/auth/v1/verify
  ?token=<recovery_token>
  &type=recovery
  &redirect_to=https://www.searchstar.com/auth/reset
```

Phase 9a's commit body described a different shape — the token-hash
flow `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=
recovery&next={{ .RedirectTo }}` routed through `/auth/confirm`. The
email template was never updated to that shape, so what's actually
running is the factory `{{ .ConfirmationURL }}` flow that bounces
through Supabase's hosted `/auth/v1/verify` endpoint and 302s to
`/auth/reset` with the session in the URL fragment
(`#access_token=...&refresh_token=...&type=recovery`). The Supabase
JS client picks up the fragment on page load and propagates the
session into the React tree before `/auth/reset`'s `useEffect` calls
`getUser()`, which is why the form rendered with a valid session
rather than showing "Link expired".

The factory flow is functionally fine. The token-hash flow Phase 9a's
commit body recommended would have a slightly cleaner URL surface
(no recovery token visible in the URL fragment, no browser-history
entry for `/auth/v1/verify`), but the difference is cosmetic. Not
worth changing in this pass — it's a Phase 9a design aspiration that
landed in code (`/auth/confirm` exists and handles the token-hash
type) but never landed in the email-template config that would
exercise it. Recorded for archaeology in case a future session wants
to close that loop.

Form-submit path was **not** exercised in the smoke test, because
exercising it would actually rotate the principal's production
password and the load-bearing question was already answered by the
form-render outcome. The submit handler is a single `updateUser({
password })` call followed by `router.push('/log')` and the
verification weight of testing it doesn't justify the cost of
rotating a real production credential and rotating it back.

**Decision (Phase 9a verified).** No code changes to the password-reset
flow. The Phase 9a implementation works as designed. The single
real gap is presentational — the email body — and is addressed in §2.

**Deferred for future work.**

- The 25-of-28 unconfirmed-user signal. Worth investigating whether
  the signup→confirm→onboarding funnel is leaking users or whether
  these are bot signups. Out of Pass 4 scope.
- The form-layer password floor at 8 chars vs. the principal's draft
  Q3 recommendation of 12. Cosmetic; not a Pass 4 blocker. If
  tightened, both signup and `/auth/reset` should change together to
  keep the surfaces consistent.

---

## §2 — Recovery email template: brand alignment

**Discovery.** §1 sanity-check (3) confirmed the recovery email used
Supabase's factory-default 144-char boilerplate while every other
Search Star transactional email is branded with the Project Graceland
design system. The recovery email was the only un-branded surface
remaining in the auth flow.

**Decision.** Apply a branded recovery template that mirrors the
existing signup-confirmation template's structure, and update the
subject line to match the confirmation email's "(verb) your Search
Star (noun)" voice.

**Why this matters even though the flow works.** A user clicking a
link in an unbranded email is making a small leap of trust — the
visual transition from a plain `<h2>Reset Password</h2>` email to the
fully branded `/auth/reset` page is a momentary mismatch that asks
"is this really from Search Star?" The branded template removes
that friction and matches the integrity of the rest of the auth
surface. It's a presentational consistency fix, not a launch blocker
on its own, but it's cheap to do alongside the §1 verification.

**Why mirror the confirmation template.** The signup confirmation
template was already designed and shipped (commit `11c1284`, "Branded
signup confirmation flow"). Reusing its structural decisions — navy
header band, Crimson Text headline, Roboto button styling, dark
footer with the "Practice before profile." tagline — keeps both
auth emails visually identical apart from copy. A user who has
seen the signup email immediately recognizes the reset email as
from the same product. Inventing a second visual style for a near-
identical use case would be design drift for no benefit.

**One copy addition.** The recovery template adds a "Didn't request
this? You can safely ignore this email — your password won't change
unless you click the link above." line that the confirmation
template doesn't have. The confirmation email doesn't need it
because signup confirmation is initiated by the user with their own
chosen email. Password reset can be triggered by anyone who knows
your email address, so the reassurance line is standard practice
for reset emails specifically. Recorded here for archaeology — if
someone later wonders why the two templates diverge by exactly
this one line, this is why.

**Subject.** Old: `"Reset Your Password"`. New:
`"Reset your Search Star password"`. Matches the confirmation
template's subject style (`"Confirm your Search Star account"`) and
brings the email subject under the same brand prefix that the rest
of Search Star's transactional mail uses. Sentence case, not Title
Case.

**Execution.**

| Object | Before | After |
|---|---|---|
| `mailer_subjects_recovery` | `"Reset Your Password"` | `"Reset your Search Star password"` |
| `mailer_templates_recovery_content` | 144-char Supabase factory default | 2,182-char Project Graceland-branded HTML mirroring the confirmation template |

Applied via `PATCH /v1/projects/qgjyfcqgnuamgymonblj/config/auth`
with the Supabase Management API at 2026-04-25T15:25 UTC. Response
HTTP 200. Verified via subsequent GET of the same endpoint:

- Subject: `"Reset your Search Star password"` ✓
- Body: 2,182 chars ✓
- Body starts with `<!DOCTYPE html>` ✓
- Body contains Project Graceland navy `#1a3a6b` ✓
- Body contains the new headline `"Reset your password."` ✓
- Body contains the footer tagline `"Practice before profile."` ✓
- Body contains the safety line `"Didn't request this?"` ✓
- Body contains `{{ .ConfirmationURL }}` exactly twice (once in
  button `href`, once in plain-text fallback) ✓

**Pre-change snapshot.** Captured to
`/home/claude/work/rollback_snapshot.json` during Pass 4 session for
rollback safety. Contents: factory-default subject and body. Not
committed to the repo — the original template is a Supabase default
and is recoverable from any new Supabase project's auth config if a
rollback is ever needed.

**Migrations applied.** None. The change is dashboard-only via the
Auth API; no DB schema, no application code. The repo remains at
tip `6e60cbc`.

**Verification.** A second recovery email triggered to
`dverchere@gmail.com` immediately after the PATCH (HTTP 200 on first
attempt) for the principal to visually confirm the rebranded template
renders as designed. Result: confirmed by principal screenshot at
2026-04-25T15:25 UTC. Inbox subject line reads `"Reset your Search
Star password"`. Email body renders the navy header band with the
`SEARCH STAR` wordmark, the Crimson Text `"Reset your password."`
headline, the new body copy (`"A password reset was requested for
your Search Star account. Click the button below to choose a new
password. The link will expire in one hour."`), and the navy
`"RESET PASSWORD"` button. Visual parity with the signup-confirmation
template achieved. No deviations.

**Production state at section close.**

- Repo tip: unchanged (`6e60cbc`). No code commit in §2.
- Vercel deploys: unchanged.
- 28 profiles unchanged.
- 2 active commitments unchanged.
- 1 pledged sponsorship + 1 active room_membership unchanged.
- `companion_rate_limit` table still dropped (Pass 3f).
- Auth config: `mailer_subjects_recovery` and
  `mailer_templates_recovery_content` updated as above. All other
  auth config fields unchanged (URL allowlist, password rules, OTP
  expiry, signup template — all left as-was).

---

## §3 — F24: service-client UPDATE on profile-write routes

**Discovery.** Pass 4 §3 opened with an audit of the remaining
profile-write surface. Two routes — `PATCH /api/profiles`
(display_name / location / bio) and `PATCH /api/profiles/visibility`
— were issuing their UPDATE through the SSR cookie-bound Supabase
client. This is the same `@supabase/ssr` JWT-propagation pattern
that the Pass 3d sweep migrated at `/api/admin/users` and
`/api/admin/tickets` (commit `b3fe91c`), and that the broader
end-to-end sweep migrated at commits `0710ce4`, `1dccc46`,
`501d976`, `0f28db9`. Symptom of the pattern when it fails: the
auth check passes (the cookie reads cleanly), but the subsequent
UPDATE silently no-ops because the Postgres connection runs
unauthenticated and RLS rejects the row. No error surface. The
caller sees a 200 and a "saved" toast; the database is unchanged.

Both routes were inside the E2E path the principal exercises
during real usage — the account page writes display_name/location/
bio through the first, and the visibility toggle on the same page
writes through the second. They had been overlooked in the earlier
sweeps because they live under `/api/profiles/` rather than under
`/api/admin/`, `/api/commitments/`, or the other directories the
sweep prompts had focused on.

**Decision.** Migrate the UPDATE step to the service client on
both routes. Keep the auth check on the SSR client — it needs the
cookie to identify the caller. Authorization for the UPDATE comes
from the explicit `user.id` WHERE-clause filter that both routes
already had: a service-client UPDATE filtered by `eq('user_id',
user.id)` can only ever modify the authenticated user's own row,
because `user.id` is the value the SSR auth check returned a
moment earlier. RLS becomes defense-in-depth rather than the
primary gate, mirroring the model the Pass 3d sweep settled on.

No change to authorization semantics. No change to caller-visible
behavior on the success path. The only difference is that under
JWT-propagation failure the UPDATE now lands instead of silently
no-opping.

**Execution.** Commit `2af29fb` on `main`:

> `fix(profiles): F24 — service-client UPDATE on profile-write routes`

Two files touched:

| File | Change |
|---|---|
| `src/app/api/profiles/route.ts` | UPDATE moved from SSR client to service client; auth check unchanged |
| `src/app/api/profiles/visibility/route.ts` | UPDATE moved from SSR client to service client; auth check unchanged |

Vercel deploy `dpl_2TZNXSz69yYZf9nFtpE42ktUY3Yv`: READY.

**Verification.** Four unauth smoke probes against the canonical
host `www.searchstar.com`. The bare apex `searchstar.com` returns
a 307 redirect to `www.`, which masked the visibility-PATCH probe
on the first attempt — a curl without `-L` reads the redirect's
own 307 instead of reaching the auth gate. Probing `www.` directly
removes that confound.

| Probe | Result |
|---|---|
| `PATCH /api/profiles` (no body) | HTTP 401 `{"error":"Unauthorized"}` |
| `PATCH /api/profiles` (valid body `{"display_name":"x"}`) | HTTP 401 `{"error":"Unauthorized"}` |
| `PATCH /api/profiles/visibility` (no body) | HTTP 401 `{"error":"Unauthorized"}` |
| `PATCH /api/profiles/visibility` (valid body `{"visibility":"public"}`) | HTTP 401 `{"error":"Unauthorized"}` |

The auth gate fires first on every probe, as designed. No UPDATE
is ever reached on an unauthenticated request, so no row should
have moved on the smoke run, and none did. Distribution re-query
post-deploy:

| Column | Distribution | Baseline | Drift |
|---|---|---|---|
| `profiles.visibility` | 28 private | 28 private | none |
| `profiles.role` | 1 admin, 27 NULL | 1 admin, 27 NULL | none |

**Probe-host note for future sessions.** Hit `www.searchstar.com`
directly when probing protected routes. The bare apex's 307 to
`www.` looks like a generic curl/proxy hiccup — the symptom
described as "DNS cache overflow" in the §3 starting prompt is
this redirect. With `-L` the probe completes; without `-L` the
probe reads the redirect verb-loss as a non-401 response. The
fastest path is to skip the apex entirely.

**Migrations applied.** None. F24 is application-code only.
Repo tip moves from `6e60cbc` (end of §2) to `2af29fb`.

**Deferred work — institutional-portal sweep.** Inventory while
auditing F24 surfaced two more routes that write through the SSR
cookie-bound client in the same pattern:

- `src/app/api/institution/[id]/enroll/route.ts`
- `src/app/api/institution/signup/route.ts`

Out of F24 scope. Both are part of the Phase 9 institutional-
portal surface, which is not in the E2E path the principal
currently exercises during real usage and is not gating real-user
launch. They are carried forward to a future institutional-portal
audit pass that should sweep the entire `/api/institution/*` tree
together — there are likely other patterns worth fixing in that
surface (RLS coverage, service-vs-SSR client choice, payload
validation) and dribbling them in one route at a time would
fragment the review. Recorded here so the inventory finding
isn't lost.

**Production state at section close.**

- Repo tip: `2af29fb` (F24 code commit) + this §3 docs commit on top.
- Vercel deploys: `dpl_2TZNXSz69yYZf9nFtpE42ktUY3Yv` READY.
- 28 profiles unchanged (28 private, 1 admin / 27 NULL).
- 2 active commitments unchanged.
- 1 pledged sponsorship + 1 active room_membership unchanged.
- `companion_rate_limit` table still dropped (Pass 3f).
- Auth config unchanged from §2 (recovery template still
  branded as in §2).
- `/api/profiles` and `/api/profiles/visibility` now write
  through the service client; auth gate on the SSR client
  unchanged.
