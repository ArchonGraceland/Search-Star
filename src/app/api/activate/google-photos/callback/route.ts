import { NextRequest, NextResponse } from 'next/server'

// ═══════════════════════════════════════════════════
// Google Photos OAuth Callback
// Exchanges authorization code for access token,
// stores token in an HttpOnly cookie, then redirects
// back to /activate with a success flag.
// ═══════════════════════════════════════════════════

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const state = searchParams.get('state')

  // Base URL for redirects
  const origin = request.nextUrl.origin

  if (error) {
    return NextResponse.redirect(
      `${origin}/activate?gphotos_error=${encodeURIComponent(error)}`
    )
  }

  if (!code) {
    return NextResponse.redirect(
      `${origin}/activate?gphotos_error=no_code`
    )
  }

  // Verify state parameter matches what we set
  const stateCookie = request.cookies.get('gphotos_oauth_state')?.value
  if (!state || state !== stateCookie) {
    return NextResponse.redirect(
      `${origin}/activate?gphotos_error=state_mismatch`
    )
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_PHOTOS_CLIENT_ID!,
        client_secret: process.env.GOOGLE_PHOTOS_CLIENT_SECRET!,
        redirect_uri: `${origin}/api/activate/google-photos/callback`,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text()
      console.error('Token exchange failed:', errBody)
      return NextResponse.redirect(
        `${origin}/activate?gphotos_error=token_exchange_failed`
      )
    }

    const tokenData = await tokenResponse.json()
    const { access_token, expires_in } = tokenData

    if (!access_token) {
      return NextResponse.redirect(
        `${origin}/activate?gphotos_error=no_access_token`
      )
    }

    // Store access token in an HttpOnly cookie
    // Expires when the token expires (typically 1 hour)
    const response = NextResponse.redirect(
      `${origin}/activate?gphotos_connected=true`
    )

    response.cookies.set('gphotos_access_token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: expires_in || 3600,
    })

    // Clear the state cookie
    response.cookies.delete('gphotos_oauth_state')

    return response
  } catch (err) {
    console.error('OAuth callback error:', err)
    return NextResponse.redirect(
      `${origin}/activate?gphotos_error=internal_error`
    )
  }
}
