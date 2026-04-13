import Link from 'next/link'

export const metadata = {
  title: 'Invalid Link — Search Star',
}

export default function ValidateInvalidPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: '#1a3a6b', borderBottom: '3px solid #112a4f', padding: '20px 24px' }}>
        <div style={{ maxWidth: '1120px', margin: '0 auto' }}>
          <Link href="/" style={{
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '22px',
            fontWeight: 700,
            color: '#ffffff',
            textDecoration: 'none',
          }}>
            Search Star
          </Link>
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
            color: '#991b1b',
            marginBottom: '16px',
          }}>
            Invalid Link
          </p>
          <h1 style={{
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '28px',
            fontWeight: 700,
            color: '#1a1a1a',
            marginBottom: '16px',
            lineHeight: '1.3',
          }}>
            This validator link is not valid.
          </h1>
          <p style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: '14px',
            color: '#767676',
            lineHeight: '1.65',
            marginBottom: '32px',
          }}>
            The invitation link may be incorrect or has already been used in a way that cannot be verified. Contact the person who invited you and ask them to resend the invitation.
          </p>
          <Link href="/" style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: '13px',
            fontWeight: 700,
            color: '#1a3a6b',
            textDecoration: 'none',
          }}>
            ← Return to Search Star
          </Link>
        </div>
      </main>
    </div>
  )
}
