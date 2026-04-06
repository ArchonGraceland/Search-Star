import { NextRequest, NextResponse } from 'next/server'

// ═══════════════════════════════════════════════════
// Google Photos OAuth — Initiate
// Generates the Google OAuth consent URL and redirects
// the user there. Sets a CSRF state cookie.
// ═══════════════════════════════════════════════════

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const SCOPE = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly'

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin

  // Generate CSRF state token
  const state = crypto.randomUUID()

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_PHOTOS_CLIENT_ID!,
    redirect_uri: `${origin}/api/activate/google-photos/callback`,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'online',
    state,
    prompt: 'consent',
  })

  const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`

  // Set state cookie for CSRF verification in callback
  const response = NextResponse.redirect(authUrl)
  response.cookies.set('gphotos_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10 minutes — enough for OAuth flow
  })

  return response
}
