'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function AcceptContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  useEffect(() => {
    if (token) {
      window.location.href = `/api/validate/accept?token=${token}`
    } else {
      window.location.href = '/validate/invalid'
    }
  }, [token])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f5f5',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <header style={{ background: '#1a3a6b', borderBottom: '3px solid #112a4f', padding: '20px 24px' }}>
        <div style={{ maxWidth: '1120px', margin: '0 auto' }}>
          <span style={{
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '22px',
            fontWeight: 700,
            color: '#ffffff',
          }}>
            Search Star
          </span>
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{
          background: '#fff',
          border: '1px solid #d4d4d4',
          borderRadius: '3px',
          padding: '48px 40px',
          maxWidth: '440px',
          width: '100%',
          textAlign: 'center',
        }}>
          <p style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#767676',
            marginBottom: '16px',
          }}>
            Validator Invitation
          </p>
          <p style={{
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '24px',
            fontWeight: 700,
            color: '#1a1a1a',
            marginBottom: '12px',
          }}>
            Accepting invitation…
          </p>
          <p style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: '14px',
            color: '#767676',
            lineHeight: '1.6',
          }}>
            Please wait while we verify your link.
          </p>
        </div>
      </main>
    </div>
  )
}

export default function ValidateAcceptPage() {
  return (
    <Suspense>
      <AcceptContent />
    </Suspense>
  )
}
