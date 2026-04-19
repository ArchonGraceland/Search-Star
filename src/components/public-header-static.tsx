import Link from 'next/link'

// Shared chrome styles (mirrored in public-header.tsx so both variants
// render identically).
const HEADER_STYLE: React.CSSProperties = { background: '#1a3a6b', borderBottom: '3px solid #112a4f', padding: '20px 24px' }
const INNER_STYLE: React.CSSProperties = { maxWidth: '1120px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }
const LOGO_STYLE: React.CSSProperties = { fontFamily: '"Crimson Text", Georgia, serif', fontSize: '22px', fontWeight: 700, color: '#ffffff', textDecoration: 'none', letterSpacing: '0.01em' }
const NAV_LINK_BASE: React.CSSProperties = { fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '7px 16px', textDecoration: 'none' }
const HOW_IT_WORKS_STYLE: React.CSSProperties = { ...NAV_LINK_BASE, color: 'rgba(255,255,255,0.7)' }
const SIGN_IN_STYLE: React.CSSProperties = { ...NAV_LINK_BASE, border: '1px solid rgba(255,255,255,0.3)', borderRadius: '3px', color: 'rgba(255,255,255,0.8)' }
const PRIMARY_CTA_STYLE: React.CSSProperties = { ...NAV_LINK_BASE, background: '#ffffff', borderRadius: '3px', color: '#1a3a6b' }

// PublicHeaderStatic — synchronous variant for client components.
//
// This is in its own file (not a named export from public-header.tsx) because
// named imports do not tree-shake across the server/client boundary: importing
// anything from a module pulls the module's entire dependency graph into the
// client bundle. The default export of public-header.tsx imports supabase's
// server client, which in turn imports 'next/headers' (server-only) — so
// importing even the static variant from there would drag next/headers into
// the client build and fail.
//
// This file has no server dependencies. Client components (/sponsor/[id],
// /sponsor/invited/[token]) import it safely.
//
// Always shows the logged-out nav. Those pages are for external pledgers who
// typically aren't signed in to Search Star anyway.
export default function PublicHeaderStatic() {
  return (
    <header style={HEADER_STYLE}>
      <div style={INNER_STYLE}>
        <Link href="/" style={LOGO_STYLE}>
          Search Star
        </Link>
        <nav className="public-header-nav">
          <Link href="/onboarding" className="nav-how-it-works" style={HOW_IT_WORKS_STYLE}>
            How It Works
          </Link>
          <Link href="/login" style={SIGN_IN_STYLE}>
            Sign In
          </Link>
          <Link href="/signup" style={PRIMARY_CTA_STYLE}>
            Sign Up
          </Link>
        </nav>
      </div>
    </header>
  )
}
