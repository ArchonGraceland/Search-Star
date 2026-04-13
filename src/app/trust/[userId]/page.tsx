import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const STAGE_LABELS: Record<string, string> = {
  seedling: 'Seedling',
  rooting: 'Rooting',
  growing: 'Growing',
  established: 'Established',
  mature: 'Mature',
}

const STAGE_DESCRIPTIONS: Record<string, string> = {
  seedling: 'Beginning a practice — validators are witnessing early effort.',
  rooting: 'Consistent effort confirmed by validators across multiple sessions.',
  growing: 'A documented record of genuine, sustained practice is building.',
  established: 'A substantial credential of confirmed practice over time.',
  mature: 'A rare, deep record of sustained and witnessed practice across years.',
}

const STAGE_COLORS: Record<string, string> = {
  seedling: '#5a8a5a',
  rooting: '#2d6a6a',
  growing: '#1a3a6b',
  established: '#7a4a1a',
  mature: '#4a1a6b',
}

function formatDepth(score: number): string {
  const sessions = Math.round(score)
  if (sessions === 0) return 'No confirmed sessions yet'
  if (sessions === 1) return '1 confirmed session'
  return `${sessions} confirmed sessions`
}

function formatBreadth(score: number): string {
  if (score === 0) return 'No skill categories recorded'
  if (score === 1) return 'Across 1 skill category'
  return `Across ${score} distinct skill categories`
}

function formatDurability(score: number): string {
  const days = Math.round(score)
  if (days === 0) return 'Practice underway'
  if (days < 30) return `${days} days of sustained practice`
  const months = Math.floor(days / 30)
  const remainder = days % 30
  if (remainder === 0) return `${months} month${months > 1 ? 's' : ''} of sustained practice`
  return `${months} month${months > 1 ? 's' : ''} and ${remainder} day${remainder > 1 ? 's' : ''} of sustained practice`
}

export default async function PublicTrustPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, visibility')
    .eq('user_id', userId)
    .single()

  // Private or missing profile — calm locked state
  if (!profile || profile.visibility === 'private') {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#f5f5f5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '400px', padding: '40px 24px' }}>
          <p
            style={{
              fontFamily: '"Crimson Text", Georgia, serif',
              fontSize: '22px',
              color: '#1a3a6b',
              margin: '0 0 12px',
            }}
          >
            This record is private.
          </p>
          <p
            style={{
              fontFamily: 'Roboto, sans-serif',
              fontSize: '14px',
              color: '#888',
              margin: '0 0 24px',
              lineHeight: '1.6',
            }}
          >
            The owner of this Trust record has chosen to keep it private.
          </p>
          <Link
            href="/"
            style={{
              fontFamily: 'Roboto, sans-serif',
              fontSize: '13px',
              color: '#1a3a6b',
              textDecoration: 'underline',
            }}
          >
            Return to Search Star
          </Link>
        </div>
      </div>
    )
  }

  const { data: trust } = await supabase
    .from('trust_records')
    .select('stage, depth_score, breadth_score, durability_score, completed_streaks, updated_at, share_enabled')
    .eq('user_id', userId)
    .single()

  // No trust record yet
  if (!trust) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#f5f5f5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '400px', padding: '40px 24px' }}>
          <p
            style={{
              fontFamily: '"Crimson Text", Georgia, serif',
              fontSize: '22px',
              color: '#1a3a6b',
              margin: '0 0 12px',
            }}
          >
            No Trust record found.
          </p>
          <Link href="/" style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#1a3a6b', textDecoration: 'underline' }}>
            Return to Search Star
          </Link>
        </div>
      </div>
    )
  }

  const stage = trust.stage ?? 'seedling'
  const stageLabel = STAGE_LABELS[stage] ?? 'Seedling'
  const stageColor = STAGE_COLORS[stage] ?? '#5a8a5a'
  const stageDescription = STAGE_DESCRIPTIONS[stage] ?? ''

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f5f5f5',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '60px 24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '600px' }}>
        {/* Header */}
        <div style={{ marginBottom: '40px', textAlign: 'center' }}>
          <Link
            href="/"
            style={{
              fontFamily: '"Crimson Text", Georgia, serif',
              fontSize: '16px',
              fontWeight: 700,
              color: '#1a3a6b',
              textDecoration: 'none',
              letterSpacing: '0.04em',
            }}
          >
            Search Star
          </Link>
          <p
            style={{
              fontFamily: 'Roboto, sans-serif',
              fontSize: '12px',
              color: '#aaa',
              margin: '4px 0 0',
              letterSpacing: '0.04em',
            }}
          >
            Trust Record
          </p>
        </div>

        {/* Name */}
        <h1
          style={{
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '30px',
            fontWeight: 700,
            color: '#1a3a6b',
            margin: '0 0 32px',
            textAlign: 'center',
          }}
        >
          {profile.display_name}
        </h1>

        {/* Stage badge */}
        <div
          style={{
            background: '#ffffff',
            border: `2px solid ${stageColor}`,
            borderRadius: '3px',
            padding: '24px 28px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '20px',
          }}
        >
          <div
            style={{
              background: stageColor,
              borderRadius: '3px',
              padding: '10px 18px',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontFamily: '"Crimson Text", Georgia, serif',
                fontSize: '20px',
                fontWeight: 700,
                color: '#ffffff',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {stageLabel}
            </span>
          </div>
          <p
            style={{
              fontFamily: 'Roboto, sans-serif',
              fontSize: '14px',
              color: '#333',
              margin: '0',
              lineHeight: '1.7',
            }}
          >
            {stageDescription}
          </p>
        </div>

        {/* Three dimensions */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            marginBottom: '24px',
          }}
        >
          {[
            { label: 'Depth', value: formatDepth(trust.depth_score ?? 0) },
            { label: 'Breadth', value: formatBreadth(trust.breadth_score ?? 0) },
            { label: 'Durability', value: formatDurability(trust.durability_score ?? 0) },
          ].map(({ label, value }) => (
            <div
              key={label}
              style={{
                background: '#ffffff',
                border: '1px solid #e0e0e0',
                borderRadius: '3px',
                padding: '16px',
              }}
            >
              <p
                style={{
                  fontFamily: '"Crimson Text", Georgia, serif',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#1a3a6b',
                  margin: '0 0 6px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                {label}
              </p>
              <p
                style={{
                  fontFamily: 'Roboto, sans-serif',
                  fontSize: '13px',
                  color: '#333',
                  margin: '0',
                  lineHeight: '1.5',
                }}
              >
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* Completed commitments */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e0e0e0',
            borderRadius: '3px',
            padding: '16px 20px',
            marginBottom: '40px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span
            style={{
              fontFamily: '"Crimson Text", Georgia, serif',
              fontSize: '24px',
              fontWeight: 700,
              color: '#1a3a6b',
            }}
          >
            {trust.completed_streaks ?? 0}
          </span>
          <span
            style={{
              fontFamily: 'Roboto, sans-serif',
              fontSize: '13px',
              color: '#666',
            }}
          >
            completed commitment{(trust.completed_streaks ?? 0) !== 1 ? 's' : ''}
          </span>
          {trust.updated_at && (
            <span
              style={{
                fontFamily: 'Roboto, sans-serif',
                fontSize: '11px',
                color: '#bbb',
                marginLeft: 'auto',
              }}
            >
              Updated{' '}
              {new Date(trust.updated_at).toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric',
              })}
            </span>
          )}
        </div>

        {/* Footer */}
        <p
          style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: '12px',
            color: '#bbb',
            textAlign: 'center',
            margin: '0',
            lineHeight: '1.6',
          }}
        >
          This record is issued by{' '}
          <Link href="/" style={{ color: '#1a3a6b', textDecoration: 'none' }}>
            Search Star
          </Link>
          . It cannot be self-reported — it is built entirely from confirmed practice witnessed by real people.
        </p>
      </div>
    </div>
  )
}
