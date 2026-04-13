import PublicHeader from '@/components/public-header'
import Link from 'next/link'

export default function ValidateInvalidPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <PublicHeader />
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 70px)', padding: '32px 16px' }}>
        <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '48px 56px', maxWidth: '480px', width: '100%', textAlign: 'center' }}>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '32px', marginBottom: '16px', margin: '0 0 16px' }}>⚠️</p>
          <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '28px', fontWeight: 700, margin: '0 0 12px', color: '#1a1a1a' }}>
            Invalid invitation link
          </h1>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#5a5a5a', lineHeight: '1.7', margin: '0 0 28px' }}>
            This validator invitation link is invalid or could not be found. It may have been used already, or the link may be incorrect.
          </p>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#5a5a5a', lineHeight: '1.7', margin: '0 0 28px' }}>
            Ask the practitioner to send you a new invitation link.
          </p>
          <Link href="/" style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: '#1a3a6b',
            textDecoration: 'none',
          }}>
            ← Back to Search Star
          </Link>
        </div>
      </div>
    </div>
  )
}
