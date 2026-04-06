import { NextRequest, NextResponse } from 'next/server'

// ═══════════════════════════════════════════════════
// Google Photos Picker — Poll Session
// Checks session status. Returns { mediaItemsSet }
// Client calls this on an interval until true.
// ═══════════════════════════════════════════════════

const PICKER_API_BASE = 'https://photospicker.googleapis.com/v1'

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get('gphotos_access_token')?.value
  const sessionId = request.nextUrl.searchParams.get('sessionId')

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Not authenticated with Google Photos.' },
      { status: 401 }
    )
  }

  if (!sessionId) {
    return NextResponse.json(
      { error: 'Missing sessionId parameter.' },
      { status: 400 }
    )
  }

  try {
    const pollResponse = await fetch(
      `${PICKER_API_BASE}/sessions/${encodeURIComponent(sessionId)}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    if (!pollResponse.ok) {
      const errBody = await pollResponse.text()
      console.error('Poll session failed:', pollResponse.status, errBody)

      if (pollResponse.status === 401) {
        return NextResponse.json(
          { error: 'Token expired', code: 'TOKEN_EXPIRED', mediaItemsSet: false },
          { status: 401 }
        )
      }

      return NextResponse.json(
        { error: `Poll failed: ${errBody}`, mediaItemsSet: false },
        { status: pollResponse.status }
      )
    }

    const session = await pollResponse.json()

    return NextResponse.json({
      mediaItemsSet: session.mediaItemsSet === true,
      pollInterval: session.pollingConfig?.pollInterval
        ? parseDuration(session.pollingConfig.pollInterval)
        : 5000,
    })
  } catch (err) {
    console.error('Poll error:', err)
    return NextResponse.json(
      { error: 'Internal error polling session', mediaItemsSet: false },
      { status: 500 }
    )
  }
}

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+(?:\.\d+)?)s$/)
  if (match) {
    return Math.round(parseFloat(match[1]) * 1000)
  }
  return 5000
}
