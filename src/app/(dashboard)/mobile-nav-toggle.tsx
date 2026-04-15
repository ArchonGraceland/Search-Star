'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { SignOutButton } from '@/components/sign-out-button'

interface Props {
  navLinks: { href: string; label: string }[]
  displayName: string | null
  children: React.ReactNode
}

export default function MobileNavToggle({ navLinks, displayName, children }: Props) {
  const [open, setOpen] = useState(false)
  const sidebarRef = useRef<HTMLElement>(null)

  // Close on outside tap
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent | TouchEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [open])

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar" ref={sidebarRef}>

        {/* Header row — always visible */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          <div>
            <Link href="/" style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#ffffff', textDecoration: 'none' }}>
              Search Star
            </Link>
            {displayName && (
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', marginTop: '2px', fontFamily: 'Roboto, sans-serif', margin: '2px 0 0' }}>
                {displayName}
              </p>
            )}
          </div>
          {/* Mobile-only toggle */}
          <button
            className="mobile-nav-toggle"
            onClick={() => setOpen(o => !o)}
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {open ? (
                <><line x1="2" y1="2" x2="14" y2="14"/><line x1="14" y1="2" x2="2" y2="14"/></>
              ) : (
                <><line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="14" y2="8"/><line x1="2" y1="12" x2="14" y2="12"/></>
              )}
            </svg>
            {open ? 'Close' : 'Menu'}
          </button>
        </div>

        {/* Nav — CSS controls visibility */}
        <div className="dashboard-nav-drawer" data-open={open ? 'true' : 'false'}
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
