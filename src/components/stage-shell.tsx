import Link from 'next/link'
import StageBar from './stage-bar'

interface StageShellProps {
  stage: number
  children: React.ReactNode
}

export default function StageShell({ stage, children }: StageShellProps) {
  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ background: '#1a3a6b', borderBottom: '3px solid #112a4f', padding: '16px 24px' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" style={{ width: 20, height: 20 }}>
              <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8"/>
              <polygon points="32,6 36,24 32,20 28,24" fill="#fff"/>
              <polygon points="32,6 36,24 32,28 28,24" fill="rgba(255,255,255,0.6)"/>
              <polygon points="58,32 40,28 44,32 40,36" fill="#fff" opacity="0.6"/>
              <polygon points="32,58 28,40 32,44 36,40" fill="#fff" opacity="0.6"/>
              <polygon points="6,32 24,36 20,32 24,28" fill="#fff" opacity="0.6"/>
              <circle cx="32" cy="32" r="3" fill="#fff"/>
            </svg>
            <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>
              Search Star
            </span>
          </Link>
          <Link href="/dashboard" style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', color: 'rgba(255,255,255,0.45)', textDecoration: 'none' }}>
            Skip to dashboard →
          </Link>
        </div>
      </header>

      {/* Stage bar */}
      <StageBar current={stage} />

      {/* Content */}
      <main className="stage-shell-content" style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '48px 24px 64px' }}>
        <div style={{ width: '100%', maxWidth: '560px' }}>
          {children}
        </div>
      </main>
    </div>
  )
}
