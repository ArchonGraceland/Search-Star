import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Email confirmation handler for the modern Supabase token-hash flow.
//
// When a user signs up, Supabase sends an email containing a link that points
// at this route with `?token_hash=...&type=signup&next=...`. We verify the
// token, which creates the session cookie, and then redirect to `next` (or
// to `/start` by default, which is the stage resolver for post-confirmation
// onboarding).
//
// This route also handles the other email-link types Supabase sends under
// the same flow: 'invite', 'magiclink', 'recovery', 'email_change', 'email'.
// They all use the same verification call and the same redirect destination,
// so one handler covers them.
//
// If verification fails or the link is malformed, we land the user on the
// login page with an `error=auth` query param rather than leaving them on a
// blank screen. The legacy `?code=...` PKCE flow is handled separately by
// /auth/callback, which this route does not replace.

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/start'

  // Safety: only allow relative paths in `next` so nobody can craft a
  // confirmation link that redirects off-site after verification.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/start'

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      return NextResponse.redirect(new URL(safeNext, request.url))
    }
    console.error('Auth confirm: verifyOtp failed', { type, error: error.message })
  }

  return NextResponse.redirect(new URL('/login?error=auth', request.url))
}
