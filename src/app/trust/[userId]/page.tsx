import { createClient, createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { computeTrustForUser } from '@/lib/trust-compute'

// Public Trust Record view — v4 Phase 6.
//
// Visibility rules:
//   - Private profile           → 404 (calm, no surface)
//   - Network profile           → treated as Public for v1 (Network-gating
//                                 flagged in TODO below; comes later)
//   - Public profile            → visible
//   - share_enabled also required (practitioner must have explicitly
//                                  toggled sharing on via /api/trust/share)
//
// We intentionally omit the completed-streaks list in v1 — showing
// individual streak dates on a public page leaks more than the practitioner
// has opted into. A future revision can add a practitioner-controlled toggle
// for streak visibility (TODO below).
//
// We compute fresh from the source data rather than reading trust_records so
// the public view always reflects reality. Uses the service client because
// the viewer is unauthenticated; the service client bypasses RLS and reads
// exactly the columns needed.

const STAGE_LABELS: Record<string, string> = {
  seedling: 'Seedling',
  rooting: 'Rooting',
  growing: 'Growing',
  established: 'Established',
  mature: 'Mature',
}

const STAGE_DESCRIPTIONS: Record<string, string> = {
  seedling:
    'At the beginning. The practice has started; no sponsored streak has yet been completed under a full roster of witnesses.',
  rooting:
    'One sponsored streak completed. Real sponsors stayed present through ninety days of practice.',
  growing:
    'A pattern of completed sponsored streaks is forming. A documented record of genuine effort across practices.',
  established:
    'A substantial record: multiple completed streaks across more than one skill category, sustained across more than a year and a half.',
  mature:
    'A rare, deep record of completed sponsored practice across three or more years and three or more domains.',
}

const STAGE_COLORS: Record<string, string> = {
  seedling: '#5a8a5a',
  rooting: '#2d6a6a',
  growing: '#1a3a6b',
  established: '#7a4a1a',
  mature: '#4a1a6b',
}

function formatBreadthValue(n: number): string {
  if (n === 0) return 'No categories yet'
  if (n === 1) return '1 skill category'
  return `${n} distinct skill categories`
}

function formatDurabilityValue(days: number): string {
  const d = Math.round(days)
  if (d === 0) return 'Not yet established'
  if (d < 30) return `${d} day${d === 1 ? '' : 's'}`
  if (d < 365) {
    const months = Math.floor(d / 30)
    return `${months} month${months === 1 ? '' : 's'}`
  }
  const years = Math.floor(d / 365)
  const remMonths = Math.floor((d % 365) / 30)
  if (remMonths === 0) return `${years} year${years === 1 ? '' : 's'}`
  return `${years} year${years === 1 ? '' : 's'}, ${remMonths} month${remMonths === 1 ? '' : 's'}`
}

function LockedState() {
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
          The owner of this Trust Record has chosen to keep it private.
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

export default async function PublicTrustPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params

  // Read profile with the regular (anon/RLS) client so we honor row-level
  // security on profiles. If the profile isn't visible to unauthenticated
  // callers, we treat that the same as private.
  const publicClient = await createClient()
  const { data: profile } = await publicClient
    .from('profiles')
    .select('display_name, visibility')
    .eq('user_id', userId)
    .single()

  if (!profile) notFound()

  // Private profile -> calm locked state.
  // TODO(Phase 6.x): implement Network visibility gating. For now, Network is
  // treated as Public. The gating needs a concept of "the viewer's network",
  // which we don't have yet because most viewers won't be authenticated.
  if (profile.visibility === 'private') {
    return <LockedState />
  }

  // Additionally require that share_enabled is true — even Public profiles
  // must explicitly toggle sharing on via the dashboard to expose the URL.
  // Read trust_records with the service client since the viewer is
  // unauthenticated and RLS would otherwise block the read.
  const svc = createServiceClient()
  const { data: trustRow } = await svc
    .from('trust_records')
    .select('share_enabled')
    .eq('user_id', userId)
    .single()

  if (!trustRow?.share_enabled) {
    return <LockedState />
  }

  // Compute fresh from completed sponsored streaks. Use the service client
  // since we're serving an unauthenticated viewer; RLS would otherwise
  // return nothing.
  const result = await computeTrustForUser(svc, userId)

  const stage = result.stage
  const stageLabel = STAGE_LABELS[stage]
  const stageColor = STAGE_COLORS[stage]
  const stageDescription = STAGE_DESCRIPTIONS[stage]

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
            {
              label: 'Depth',
              value: `${result.completed_streaks} completed streak${result.completed_streaks === 1 ? '' : 's'}`,
            },
            {
              label: 'Breadth',
              value: formatBreadthValue(result.breadth_score),
            },
            {
              label: 'Durability',
              value: formatDurabilityValue(result.durability_score),
            },
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

        {/* Footer */}
        <p
          style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: '12px',
            color: '#bbb',
            textAlign: 'center',
            margin: '40px 0 0',
            lineHeight: '1.6',
          }}
        >
          This record is issued by{' '}
          <Link href="/" style={{ color: '#1a3a6b', textDecoration: 'none' }}>
            Search Star
          </Link>
          . It is built entirely from sponsored ninety-day streaks that reached completion with every
          sponsor still present.
        </p>
      </div>
    </div>
  )
}
