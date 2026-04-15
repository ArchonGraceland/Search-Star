import Link from 'next/link'

export default function PublicHeader() {
  return (
    <header style={{ background: '#1a3a6b', borderBottom: '3px solid #112a4f', padding: '20px 24px' }}>
      <div style={{ maxWidth: '1120px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link
          href="/"
          style={{
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '22px',
            fontWeight: 700,
            color: '#ffffff',
            textDecoration: 'none',
            letterSpacing: '0.01em',
          }}
        >
          Search Star
        </Link>
        <nav className="public-header-nav">
          <Link
            href="/onboarding"
            className="nav-how-it-works"
            style={{
              fontFamily: 'Roboto, sans-serif',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              padding: '7px 16px',
              color: 'rgba(255,255,255,0.7)',
              textDecoration: 'none',
            }}
          >
            How It Works
          </Link>
          <Link
            href="/login"
            style={{
              fontFamily: 'Roboto, sans-serif',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              padding: '7px 16px',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '3px',
              color: 'rgba(255,255,255,0.8)',
              textDecoration: 'none',
            }}
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            style={{
              fontFamily: 'Roboto, sans-serif',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              padding: '7px 16px',
              background: '#ffffff',
              borderRadius: '3px',
              color: '#1a3a6b',
              textDecoration: 'none',
            }}
          >
            Sign Up
          </Link>
        </nav>
      </div>
    </header>
  )
}
