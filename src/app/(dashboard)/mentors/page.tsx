import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { InviteForm } from './invite-form'

const ROLE_LABELS: Record<string, string> = {
  mentor: 'Mentor',
  coach: 'Coach',
  community_builder: 'Community Builder',
  practice_leader: 'Practice Leader',
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  mentor: 'You provide direct accountability and guidance to practitioners. You receive 23.75% of contributions from your active mentees.',
  coach: 'You provide structured coaching support. You receive 23.75% of contributions from practitioners you coach.',
  community_builder: 'You grow and sustain the practice community. You receive 23.75% of contributions from practitioners in your community.',
  practice_leader: 'You lead a defined practice domain. You receive 23.75% of contributions from practitioners in your practice group.',
}

const STATUS_COLORS: Record<string, string> = {
  active: '#2d6a6a',
  completed: '#1a3a6b',
  abandoned: '#c0392b',
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function MentorsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, mentor_role')
    .eq('user_id', user.id)
    .single()

  // My mentor (I am mentee)
  const { data: mentorRel } = await supabase
    .from('mentor_relationships')
    .select('id, mentor_user_id, started_at')
    .eq('mentee_user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  let mentorProfile: { display_name: string | null } | null = null
  if (mentorRel) {
    const { data } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', mentorRel.mentor_user_id)
      .single()
    mentorProfile = data
  }

  // My mentees (I am mentor)
  const { data: menteeRels } = await supabase
    .from('mentor_relationships')
    .select('id, mentee_user_id, started_at')
    .eq('mentor_user_id', user.id)
    .eq('status', 'active')

  interface MenteeRow {
    id: string
    mentee_user_id: string
    display_name: string | null
    started_at: string
    active_commitment: { title: string; status: string; sessions_logged: number } | null
    last_session_at: string | null
  }

  const menteeRows: MenteeRow[] = []
  for (const rel of menteeRels ?? []) {
    const { data: mp } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', rel.mentee_user_id)
      .single()

    const { data: commitment } = await supabase
      .from('commitments')
      .select('title, status, sessions_logged, created_at')
      .eq('user_id', rel.mentee_user_id)
      .in('status', ['active', 'completed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let last_session_at: string | null = null
    if (commitment) {
      const { data: lastPost } = await supabase
        .from('commitment_posts')
        .select('posted_at')
        .eq('user_id', rel.mentee_user_id)
        .order('posted_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      last_session_at = lastPost?.posted_at ?? null
    }

    menteeRows.push({
      id: rel.id,
      mentee_user_id: rel.mentee_user_id,
      display_name: mp?.display_name ?? null,
      started_at: rel.started_at,
      active_commitment: commitment ?? null,
      last_session_at,
    })
  }

  return (
    <div style={{ maxWidth: '800px' }}>
      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#767676', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>
        Mentors
      </p>
      <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '32px', fontWeight: 700, margin: '0 0 6px' }}>
        Mentor relationships
      </h1>
      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#767676', margin: '0 0 36px', lineHeight: '1.5' }}>
        Your mentor supports your practice. Practitioners you mentor receive your guidance and accountability.
      </p>

      {/* Role badge */}
      {profile?.mentor_role && (
        <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '16px 20px', marginBottom: '32px', borderLeft: '3px solid #1a3a6b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#fff', background: '#1a3a6b', padding: '2px 8px', borderRadius: '3px' }}>
              {ROLE_LABELS[profile.mentor_role] ?? profile.mentor_role}
            </span>
          </div>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#5a5a5a', margin: 0, lineHeight: '1.5' }}>
            {ROLE_DESCRIPTIONS[profile.mentor_role] ?? ''}
          </p>
        </div>
      )}

      {/* Section A: Your mentor */}
      <div style={{ marginBottom: '40px' }}>
        <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '22px', fontWeight: 700, margin: '0 0 16px', color: '#1a1a1a' }}>
          Your mentor
        </h2>

        {mentorRel && mentorProfile ? (
          <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '20px' }}>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '16px', fontWeight: 600, color: '#1a1a1a', margin: '0 0 4px' }}>
              {mentorProfile.display_name ?? 'Unnamed member'}
            </p>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#b8b8b8', margin: 0 }}>
              Mentoring you since {formatDate(mentorRel.started_at)}
            </p>
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '28px 24px' }}>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#5a5a5a', margin: '0 0 16px', lineHeight: '1.5' }}>
              You do not have a mentor yet. Invite someone whose practice and judgment you trust.
            </p>
            <InviteForm direction="request_mentor" placeholder="mentor@example.com" buttonLabel="Request mentor" />
          </div>
        )}
      </div>

      {/* Section B: Practitioners you mentor — only if user has a mentor_role */}
      {profile?.mentor_role && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
            <h2 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '22px', fontWeight: 700, margin: 0, color: '#1a1a1a' }}>
              Practitioners you mentor
            </h2>
            <Link href="/mentoring" style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#1a3a6b', textDecoration: 'none', fontWeight: 600 }}>
              Full mentor view
            </Link>
          </div>

          {menteeRows.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '28px 24px' }}>
              <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#5a5a5a', margin: '0 0 16px', lineHeight: '1.5' }}>
                You are not yet mentoring anyone. Invite a practitioner to your cohort.
              </p>
              <InviteForm direction="invite_mentee" placeholder="practitioner@example.com" buttonLabel="Invite practitioner" />
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: '#d4d4d4', border: '1px solid #d4d4d4', borderRadius: '3px', overflow: 'hidden' }}>
                {menteeRows.map((row) => (
                  <div key={row.id} style={{ background: '#fff', padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '16px' }}>
                    <div>
                      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', fontWeight: 600, color: '#1a1a1a', margin: '0 0 4px' }}>
                        {row.display_name ?? 'Unnamed member'}
                      </p>
                      {row.active_commitment ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#5a5a5a', margin: 0 }}>
                            {row.active_commitment.title}
                          </p>
                          <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#fff', background: STATUS_COLORS[row.active_commitment.status] ?? '#767676', padding: '1px 6px', borderRadius: '2px' }}>
                            {row.active_commitment.status}
                          </span>
                        </div>
                      ) : (
                        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#b8b8b8', margin: 0 }}>
                          No active commitment
                        </p>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', color: '#b8b8b8', margin: '0 0 2px' }}>Last session</p>
                      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 600, color: '#5a5a5a', margin: 0 }}>
                        {formatDate(row.last_session_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '16px' }}>
                <InviteForm direction="invite_mentee" placeholder="practitioner@example.com" buttonLabel="Invite another practitioner" />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
