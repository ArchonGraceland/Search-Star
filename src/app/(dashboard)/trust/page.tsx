import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TrustControls } from './trust-controls'

const STAGE_LABELS: Record<string, string> = {
  seedling: 'Seedling',
  rooting: 'Rooting',
  growing: 'Growing',
  established: 'Established',
  mature: 'Mature',
}

const STAGE_DESCRIPTIONS: Record<string, string> = {
  seedling: 'You are at the beginning. The practice has started but sponsored streaks have not yet accumulated.',
  rooting: 'You have demonstrated real effort. Sponsors are backing your commitments and your practice is taking hold.',
  growing: 'Your practice is consistent and witnessed. You are building a documented record of genuine effort over time.',
  established: 'You have a substantial record of sponsored practice. This is a meaningful credential recognized across institutions.',
  mature: 'Your Trust record reflects deep, sustained, sponsored practice across years. This is rare and significant.',
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
  if (score === 0) return 'No skill categories yet'
  if (score === 1) return 'Across 1 skill category'
  return `Across ${score} distinct skill categories`
}

function formatDurability(score: number): string {
  const days = Math.round(score)
  if (days === 0) return 'No completed or active streaks yet'
  if (days < 30) return `${days} days of sustained practice`
  const months = Math.floor(days / 30)
  const remainder = days % 30
  if (remainder === 0) return `${months} month${months > 1 ? 's' : ''} of sustained practice`
  return `${months} month${months > 1 ? 's' : ''} and ${remainder} day${remainder > 1 ? 's' : ''} of sustained practice`
}

export default async function TrustPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, visibility')
    .eq('user_id', user.id)
    .single()

  const { data: trust } = await supabase
    .from('trust_records')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const stage = trust?.stage ?? 'seedling'
  const stageLabel = STAGE_LABELS[stage] ?? 'Seedling'
  const stageColor = STAGE_COLORS[stage] ?? '#5a8a5a'
  const stageDescription = STAGE_DESCRIPTIONS[stage] ?? ''
  const isPrivate = profile?.visibility === 'private'

  return (
    <div style={{ maxWidth: '720px' }}>
      <h1
        style={{
          fontFamily: '"Crimson Text", Georgia, serif',
          fontSize: '32px',
          fontWeight: 700,
          color: '#1a3a6b',
          margin: '0 0 8px',
        }}
      >
        Trust Record
      </h1>
      <p
        style={{
          fontFamily: 'Roboto, sans-serif',
          fontSize: '14px',
          color: '#666',
          margin: '0 0 40px',
          lineHeight: '1.6',
        }}
      >
        Your Trust record is a private credential built from sponsored practice over time. It cannot be performed into
        existence — only grown through sustained, witnessed effort.
      </p>

      {/* Stage badge */}
      <div
        style={{
          background: '#ffffff',
          border: `2px solid ${stageColor}`,
          borderRadius: '3px',
          padding: '28px 32px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '24px',
        }}
      >
        <div
          style={{
            background: stageColor,
            borderRadius: '3px',
            padding: '12px 20px',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: '"Crimson Text", Georgia, serif',
              fontSize: '22px',
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {stageLabel}
          </span>
        </div>
        <div>
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
          {trust?.updated_at && (
            <p
              style={{
                fontFamily: 'Roboto, sans-serif',
                fontSize: '12px',
                color: '#999',
                margin: '8px 0 0',
              }}
            >
              Last computed{' '}
              {new Date(trust.updated_at).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          )}
        </div>
      </div>

      {/* Three dimensions */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        {[
          {
            label: 'Depth',
            value: formatDepth(trust?.depth_score ?? 0),
            description: 'How far your practice has developed across completed sponsored streaks.',
          },
          {
            label: 'Breadth',
            value: formatBreadth(trust?.breadth_score ?? 0),
            description: 'How many distinct skill areas your practice spans.',
          },
          {
            label: 'Durability',
            value: formatDurability(trust?.durability_score ?? 0),
            description: 'How long your practice has been sustained over time.',
          },
        ].map(({ label, value, description }) => (
          <div
            key={label}
            style={{
              background: '#ffffff',
              border: '1px solid #e0e0e0',
              borderRadius: '3px',
              padding: '20px',
            }}
          >
            <p
              style={{
                fontFamily: '"Crimson Text", Georgia, serif',
                fontSize: '13px',
                fontWeight: 600,
                color: '#1a3a6b',
                margin: '0 0 8px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {label}
            </p>
            <p
              style={{
                fontFamily: 'Roboto, sans-serif',
                fontSize: '15px',
                fontWeight: 500,
                color: '#222',
                margin: '0 0 8px',
                lineHeight: '1.4',
              }}
            >
              {value}
            </p>
            <p
              style={{
                fontFamily: 'Roboto, sans-serif',
                fontSize: '12px',
                color: '#888',
                margin: '0',
                lineHeight: '1.5',
              }}
            >
              {description}
            </p>
          </div>
        ))}
      </div>

      {/* Supporting counts */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e0e0e0',
          borderRadius: '3px',
          padding: '20px 24px',
          marginBottom: '32px',
          display: 'flex',
          gap: '40px',
          flexWrap: 'wrap',
        }}
      >
        {[
          {
            label: 'Completed commitments',
            value: trust?.completed_streaks ?? 0,
          },
        ].map(({ label, value }) => (
          <div key={label}>
            <p
              style={{
                fontFamily: '"Crimson Text", Georgia, serif',
                fontSize: '26px',
                fontWeight: 700,
                color: '#1a3a6b',
                margin: '0',
              }}
            >
              {value}
            </p>
            <p
              style={{
                fontFamily: 'Roboto, sans-serif',
                fontSize: '12px',
                color: '#888',
                margin: '2px 0 0',
                letterSpacing: '0.02em',
              }}
            >
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Recompute + Share controls */}
      <TrustControls
        shareEnabled={trust?.share_enabled ?? false}
        userId={user.id}
        isPrivate={isPrivate}
      />
    </div>
  )
}
