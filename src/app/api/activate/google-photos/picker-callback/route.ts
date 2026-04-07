import { NextResponse } from 'next/server'

// ═══════════════════════════════════════════════════
// Google Photos Picker — Picker Callback
//
// Google redirects here after the user finishes
// selecting photos in the picker popup. We just
// need to close the popup window — the parent page
// is already polling for mediaItemsSet via the
// /poll route and will fetch items automatically.
// ═══════════════════════════════════════════════════

export async function GET() {
  // Return a minimal HTML page that closes itself.
  // The parent window's polling loop will detect
  // that mediaItemsSet=true and call /items.
  const html = `<!DOCTYPE html>
<html>
<head><title>Returning to Search Star…</title></head>
<body style="font-family:sans-serif;text-align:center;padding:40px;color:#555">
  <p>Photos selected. Returning to Search Star…</p>
  <script>
    // Close this popup — parent is polling and will fetch the photos
    try { window.close() } catch(e) {}
    // Fallback: if window.close() is blocked, redirect parent
    setTimeout(function() {
      if (!window.closed) {
        try { window.opener.focus() } catch(e) {}
        window.close()
      }
    }, 500)
  </script>
</body>
</html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' },
  })
}
