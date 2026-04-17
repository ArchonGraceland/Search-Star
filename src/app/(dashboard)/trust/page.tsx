import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TrustControls } from './trust-controls'
import { computeTrustForUser, type CompletedStreakSummary } from '@/lib/trust-compute'

// v4 Phase 6 — Trust Record dashboard.
//
// Shows:
//   1. The growth stage (Seedling → Mature) as a visual badge
//   2. Depth / Breadth / Durability as three labeled values with plain prose
//      (no numerical composite score anywhere — spec is explicit)
//   3. The list of completed sponsored streaks that FEED the record, as
//      transparent inputs. The practitioner can see exactly what's counted.
//   4. A "What this doesn't include" note. Honest about what's excluded
//      (in-progress streaks, vetoed streaks) because that honesty is part of
//      the anti-gaming design.
//
// We compute on page load rather than reading a stale trust_records row.
// The compute is cheap at small scale and a fresh number is always nicer
// than a stale one. The controls row can also trigger the persisted POST
// endpoint, which is what keeps profiles.trust_stage in sync for the
// cases that care (public profile visibility, dashboard badges elsewhere).

const STAGE_LABELS: Record<string, string> = {
  seedling: 'Seedling',
  rooting: 'Rooting',
  growing: 'Growing',
  established: 'Established',
  mature: 'Mature',
}

const STAGE_DESCRIPTIONS: Record<string, string> = {
  seedling:
    'You are at the beginning. The practice has started; no sponsored streak has yet been completed under a full roster of witnesses.',
  rooting:
    'One sponsored streak completed. Real sponsors stayed present through ninety days of your practice.',
  growing:
    'A pattern of completed sponsored streaks is forming. You are building a documented record of genuine effort across practices.',
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

function formatStreakRange(s: CompletedStreakSummary): string {
  if (!s.streak_starts_at || !s.completed_at) return ''
  const start = new Date(s.streak_starts_at)
  const end = new Date(s.completed_at)
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
}

export default async function TrustPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, visibility')
    .eq('user_id', user.id)
    .single()

  const { data: trustRow } = await supabase
    .from('trust_records')
    .select('share_enabled')
    .eq('user_id', user.id)
    .single()

  // Compute fresh on page load — transparent, no staleness, cheap at our scale.
  const result = await computeTrustForUser(supabase, user.id)

  const stage = result.stage
  const stageLabel = STAGE_LABELS[stage]
  const stageColor = STAGE_COLORS[stage]
  const stageDescription = STAGE_DESCRIPTIONS[stage]
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
        Your Trust Record is built from completed sponsored streaks — ninety-day commitments where every
        sponsor who pledged stayed present and released payment at the end. It cannot be performed into
        existence. It grows only through the work, witnessed by people willing to put their name behind it.
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
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        {[
          {
            label: 'Depth',
            value: `${result.completed_streaks} completed streak${result.completed_streaks === 1 ? '' : 's'}`,
            description:
              'Completed sponsored streaks, weighted by how many sponsors backed each one and their track record of witnessing well.',
          },
          {
            label: 'Breadth',
            value: formatBreadthValue(result.breadth_score),
            description:
              'Distinct skill categories across your completed streaks. The Record values wholeness of development, not specialization alone.',
          },
          {
            label: 'Durability',
            value: formatDurabilityValue(result.durability_score),
            description:
              'Calendar time between your first completed streak and your most recent. Cannot be accelerated.',
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

      {/* Completed-streak list — the transparent inputs */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e0e0e0',
          borderRadius: '3px',
          padding: '24px',
          marginBottom: '24px',
        }}
      >
        <h2
          style={{
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '18px',
            fontWeight: 600,
            color: '#1a3a6b',
            margin: '0 0 16px',
          }}
        >
          What feeds your Record
        </h2>

        {result.streak_details.length === 0 ? (
          <p
            style={{
              fontFamily: 'Roboto, sans-serif',
              fontSize: '14px',
              color: '#666',
              margin: '0',
              lineHeight: '1.6',
            }}
          >
            No completed sponsored streaks yet. When a ninety-day commitment reaches day ninety with every
            sponsor still present and releasing payment, it appears here and contributes to your Record.
          </p>
        ) : (
          <ul style={{ margin: '0', padding: '0', listStyle: 'none' }}>
            {result.streak_details.map((s) => (
              <li
                key={s.commitment_id}
                style={{
                  padding: '14px 0',
                  borderBottom: '1px solid #f0f0f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: '16px',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <p
                    style={{
                      fontFamily: 'Roboto, sans-serif',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: '#222',
                      margin: '0 0 4px',
                    }}
                  >
                    {s.practice_name ?? 'Untitled practice'}
                  </p>
                  <p
                    style={{
                      fontFamily: 'Roboto, sans-serif',
                      fontSize: '12px',
                      color: '#888',
                      margin: '0',
                    }}
                  >
                    {formatStreakRange(s)}
                  </p>
                </div>
                <p
                  style={{
                    fontFamily: 'Roboto, sans-serif',
                    fontSize: '12px',
                    color: '#666',
                    margin: '0',
                  }}
                >
                  {s.sponsor_count} sponsor{s.sponsor_count === 1 ? '' : 's'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Honest exclusions note */}
      <div
        style={{
          background: '#f8f8f8',
          border: '1px solid #e0e0e0',
          borderRadius: '3px',
          padding: '16px 20px',
          marginBottom: '32px',
        }}
      >
        <p
          style={{
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '13px',
            fontWeight: 600,
            color: '#555',
            margin: '0 0 6px',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          What this doesn&apos;t include
        </p>
        <p
          style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: '13px',
            color: '#555',
            margin: '0',
            lineHeight: '1.6',
          }}
        >
          Commitments that are still in progress, still in their launch period, abandoned mid-streak, or
          ended by a sponsor veto are not counted here. Near-misses do not accumulate. The Record reflects
          what was finished under a full roster of witnesses — nothing more, nothing less.
        </p>
      </div>

      {/* Recompute + Share controls */}
      <TrustControls
        shareEnabled={trustRow?.share_enabled ?? false}
        userId={user.id}
        isPrivate={isPrivate}
      />
    </div>
  )
}
