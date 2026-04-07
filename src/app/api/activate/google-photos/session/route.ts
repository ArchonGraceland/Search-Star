import { NextRequest, NextResponse } from 'next/server'

// ═══════════════════════════════════════════════════
// Google Photos Picker — Create Session
// Creates a new picking session via the Picker API.
// Returns { sessionId, pickerUri, pollInterval }
// so the client can open the picker and start polling.
// ═══════════════════════════════════════════════════

const PICKER_API_BASE = 'https://photospicker.googleapis.com/v1'

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get('gphotos_access_token')?.value

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Not authenticated with Google Photos. Please connect first.' },
      { status: 401 }
    )
  }

  try {
    // Create a new Picker session
    const sessionResponse = await fetch(`${PICKER_API_BASE}/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Required: tells Google where to signal completion
        // Without this, mediaItemsSet never becomes true via polling
        redirectUri: process.env.NEXT_PUBLIC_BASE_URL
          ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/activate/google-photos/picker-callback`
          : 'https://www.searchstar.com/api/activate/google-photos/picker-callback',
      }),
    })

    if (!sessionResponse.ok) {
      const errBody = await sessionResponse.text()
      console.error('Picker session creation failed:', sessionResponse.status, errBody)

      if (sessionResponse.status === 401) {
        return NextResponse.json(
          { error: 'Google Photos token expired. Please reconnect.', code: 'TOKEN_EXPIRED' },
          { status: 401 }
        )
      }

      return NextResponse.json(
        { error: `Failed to create picker session: ${errBody}` },
        { status: sessionResponse.status }
      )
    }

    const session = await sessionResponse.json()

    // session contains: { id, pickerUri, pollingConfig: { pollInterval, timeoutIn }, mediaItemsSet }
    return NextResponse.json({
      sessionId: session.id,
      pickerUri: session.pickerUri,
      pollInterval: session.pollingConfig?.pollInterval
        ? parseDuration(session.pollingConfig.pollInterval)
        : 5000,
      timeoutIn: session.pollingConfig?.timeoutIn
        ? parseDuration(session.pollingConfig.timeoutIn)
        : 1800000, // 30 min default
    })
  } catch (err) {
    console.error('Create session error:', err)
    return NextResponse.json(
      { error: 'Internal error creating picker session' },
      { status: 500 }
    )
  }
}

/**
 * Parse a Google duration string like "5s" or "1800s" into milliseconds.
 */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+(?:\.\d+)?)s$/)
  if (match) {
    return Math.round(parseFloat(match[1]) * 1000)
  }
  return 5000 // fallback
}
