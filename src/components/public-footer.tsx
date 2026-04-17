import Link from 'next/link'

export default function PublicFooter() {
  return (
    <footer style={{ background: '#1a1a1a', padding: '28px 24px' }}>
      <div
        style={{
          maxWidth: '1120px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: 'Roboto, sans-serif',
          fontSize: '12px',
          color: 'rgba(255,255,255,0.5)',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <span>
          <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Search Star</strong> — v4.0
        </span>
        <div style={{ display: 'flex', gap: '24px' }}>
          <Link
            href="/onboarding"
            style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            How It Works
          </Link>
          <Link
            href="/manifesto"
            style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            Manifesto
          </Link>
          <Link
            href="/spec"
            style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            Spec
          </Link>
          <Link
            href="/roadmap"
            style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            Roadmap
          </Link>
        </div>
      </div>
    </footer>
  )
}
