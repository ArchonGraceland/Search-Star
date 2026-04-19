import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { SignOutButton } from './sign-out-button'

// Shared chrome styles (also mirrored in public-header-static.tsx).
const HEADER_STYLE: React.CSSProperties = { background: '#1a3a6b', borderBottom: '3px solid #112a4f', padding: '20px 24px' }
const INNER_STYLE: React.CSSProperties = { maxWidth: '1120px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }
const LOGO_STYLE: React.CSSProperties = { fontFamily: '"Crimson Text", Georgia, serif', fontSize: '22px', fontWeight: 700, color: '#ffffff', textDecoration: 'none', letterSpacing: '0.01em' }
const NAV_LINK_BASE: React.CSSProperties = { fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '7px 16px', textDecoration: 'none' }
const HOW_IT_WORKS_STYLE: React.CSSProperties = { ...NAV_LINK_BASE, color: 'rgba(255,255,255,0.7)' }
const SIGN_IN_STYLE: React.CSSProperties = { ...NAV_LINK_BASE, border: '1px solid rgba(255,255,255,0.3)', borderRadius: '3px', color: 'rgba(255,255,255,0.8)' }
const PRIMARY_CTA_STYLE: React.CSSProperties = { ...NAV_LINK_BASE, background: '#ffffff', borderRadius: '3px', color: '#1a3a6b' }

// PublicHeader — async server component, auth-aware.
//
// Renders chrome for public-facing pages: homepage (/ and /home), /onboarding,
// /manifesto. A logged-out visitor sees "Sign In / Sign Up". A logged-in
// visitor (e.g., a practitioner who escaped /log via the logo, or one
// reading the manifesto) sees "Dashboard / Sign Out" — showing a "Sign In"
// button to someone already signed in is a UX wart that makes the marketing
// surfaces feel disconnected from the app.
//
// "How It Works" is visible in both states — returning users may still want
// to re-read the explainer or share it.
//
// For client components ('use client') that cannot render an async server
// component, use PublicHeaderStatic from '@/components/public-header-static'.
// It must live in a separate file because named imports do not tree-shake
// across the server/client boundary — importing anything from this file
// would pull 'next/headers' (via supabase/server) into the client bundle.
export default async function PublicHeader() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

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
          {user ? (
            <>
              <Link href="/dashboard" style={PRIMARY_CTA_STYLE}>
                Dashboard
              </Link>
              <span style={{ padding: '7px 16px', display: 'inline-flex', alignItems: 'center' }}>
                <SignOutButton />
              </span>
            </>
          ) : (
            <>
              <Link href="/login" style={SIGN_IN_STYLE}>
                Sign In
              </Link>
              <Link href="/signup" style={PRIMARY_CTA_STYLE}>
                Sign Up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
