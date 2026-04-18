import { type EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Primary email-link landing for Search Star.
//
// Supabase can send two different kinds of confirmation links depending on
// how the project is configured:
//
//   1. Legacy PKCE flow:   ?code=<uuid>
//   2. Modern token flow:  ?token_hash=<hash>&type=<signup|recovery|...>
//
// We accept both here so a template change or a project setting change
// doesn't break confirmation for users in flight. `emailRedirectTo` on
// signUp() is pinned to this URL so every confirmation link lands here
// regardless of the Supabase project's default Site URL.
//
// On success we route through /start (the stage resolver), which handles
// new-user onboarding and returning-user dispatch in one place. On failure
// we redirect to /login?error=auth — the login page renders a visible
// notice for that query param rather than leaving users guessing.

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/start'
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/start'

  const supabase = await createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`)
    }
    console.error('Auth callback: exchangeCodeForSession failed', { error: error.message })
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`)
    }
    console.error('Auth callback: verifyOtp failed', { type, error: error.message })
  } else {
    console.error('Auth callback: neither code nor token_hash present')
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
