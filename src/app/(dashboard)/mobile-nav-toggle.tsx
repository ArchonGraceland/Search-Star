'use client'

import { useState } from 'react'
import Link from 'next/link'
import { SignOutButton } from '@/components/sign-out-button'

interface Props {
  navLinks: { href: string; label: string }[]
  displayName: string | null
  children: React.ReactNode
}

export default function MobileNavToggle({ navLinks, displayName, children }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        {/* Header row — always visible */}
        <div className="dashboard-sidebar-header" style={{ padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div>
            <Link href="/" style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#ffffff', textDecoration: 'none' }}>
              Search Star
            </Link>
            {displayName && (
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', marginTop: '4px', fontFamily: 'Roboto, sans-serif' }}>
                {displayName}
              </p>
            )}
          </div>
          {/* Mobile toggle button */}
          <button className="mobile-nav-toggle" onClick={() => setOpen(o => !o)}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {open ? (
                <><line x1="2" y1="2" x2="14" y2="14"/><line x1="14" y1="2" x2="2" y2="14"/></>
              ) : (
                <><line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="14" y2="8"/><line x1="2" y1="12" x2="14" y2="12"/></>
              )}
            </svg>
            {open ? 'Close' : 'Menu'}
          </button>
        </div>

        {/* Nav — toggleable on mobile, always visible on desktop */}
        <div className={`dashboard-sidebar-inner${open ? ' open' : ''}`}
          style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <nav style={{ flex: 1, padding: '16px 0' }}>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                style={{
                  display: 'block', padding: '10px 20px',
                  fontFamily: 'Roboto, sans-serif', fontSize: '13px', fontWeight: 500,
                  color: 'rgba(255,255,255,0.75)', textDecoration: 'none', letterSpacing: '0.02em',
                }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <SignOutButton />
          </div>
        </div>
      </aside>

      <main className="dashboard-main">
        {children}
      </main>
    </div>
  )
}
