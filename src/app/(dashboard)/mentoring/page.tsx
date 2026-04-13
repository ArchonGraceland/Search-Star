import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ConfirmButton } from './confirm-button'

const STATUS_COLORS: Record<string, string> = {
  active: '#2d6a6a',
  completed: '#1a3a6b',
  abandoned: '#c0392b',
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function MentoringPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, mentor_role')
    .eq('user_id', user.id)
    .single()

  // All active mentees
  const { data: menteeRels } = await supabase
    .from('mentor_relationships')
    .select('id, mentee_user_id, started_at')
    .eq('mentor_user_id', user.id)
    .eq('status', 'active')

  interface PostRow {
    id: string
    commitment_id: string
    body: string
    session_number: number
    posted_at: string
    confirmed: boolean
    validator_token: string | null
  }

  interface MenteeDetail {
    relationship_id: string
    mentee_user_id: string
    display_name: string | null
    started_at: string
    commitment: {
      id: string
      title: string
      status: string
      sessions_logged: number
    } | null
    last_session_at: string | null
    recent_posts: PostRow[]
  }

  const mentees: MenteeDetail[] = []

  for (const rel of menteeRels ?? []) {
    const { data: mp } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', rel.mentee_user_id)
      .single()

    const { data: commitment } = await supabase
      .from('commitments')
      .select('id, title, status, sessions_logged, created_at')
      .eq('user_id', rel.mentee_user_id)
      .in('status', ['active', 'completed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let recentPosts: PostRow[] = []
    let last_session_at: string | null = null

    if (commitment) {
      // Check if current user is a validator for this commitment
      const { data: validators } = await supabase
        .from('validators')
        .select('id, invite_token')
        .eq('commitment_id', commitment.id)
        .eq('user_id', user.id)
        .eq('status', 'active')

      const validator = validators?.[0] ?? null

      const { data: posts } = await supabase
        .from('commitment_posts')
        .select('id, commitment_id, body, session_number, posted_at')
        .eq('commitment_id', commitment.id)
        .order('posted_at', { ascending: false })
        .limit(3)

      for (const post of posts ?? []) {
        let confirmed = false
        if (validator) {
          const { data: conf } = await supabase
            .from('post_confirmations')
            .select('id')
            .eq('post_id', post.id)
            .eq('validator_id', validator.id)
            .maybeSingle()
          confirmed = !!conf
        }

        recentPosts.push({
          ...post,
          confirmed,
          validator_token: validator?.invite_token ?? null,
        })
      }

      last_session_at = recentPosts[0]?.posted_at ?? null
    }

    mentees.push({
      relationship_id: rel.id,
      mentee_user_id: rel.mentee_user_id,
      display_name: mp?.display_name ?? null,
      started_at: rel.started_at,
      commitment: commitment ?? null,
      last_session_at,
      recent_posts: recentPosts,
    })
  }

  return (
    <div style={{ maxWidth: '880px' }}>
      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#767676', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>
        Mentoring
      </p>
      <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '32px', fontWeight: 700, margin: '0 0 6px' }}>
        Your mentee cohort
      </h1>
      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#767676', margin: '0 0 8px', lineHeight: '1.5' }}>
        {profile?.mentor_role
          ? `You are a ${profile.mentor_role.replace('_', ' ')}. Review recent sessions and confirm posts for practitioners you mentor.`
          : 'Review recent sessions and confirm posts for practitioners you mentor.'}
      </p>
      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#b8b8b8', margin: '0 0 36px' }}>
        <Link href="/mentors" style={{ color: '#1a3a6b', textDecoration: 'none' }}>Back to mentor relationships</Link>
      </p>

      {mentees.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '48px 28px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#b8b8b8', margin: '0 0 12px' }}>
            You are not yet mentoring anyone.
          </p>
          <Link href="/mentors" style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#1a3a6b', fontWeight: 600 }}>
            Invite a practitioner
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {mentees.map((mentee) => (
            <div key={mentee.relationship_id} style={{ background: '#fff', border: '1px solid #d4d4d4', borderRadius: '3px', overflow: 'hidden' }}>
              {/* Mentee header */}
              <div style={{ padding: '18px 20px', borderBottom: '1px solid #f0f0f0', display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
                <div>
                  <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '15px', fontWeight: 700, color: '#1a1a1a', margin: '0 0 4px' }}>
                    {mentee.display_name ?? 'Unnamed member'}
                  </p>
                  {mentee.commitment ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#5a5a5a', margin: 0 }}>
                        {mentee.commitment.title}
                      </p>
                      <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#fff', background: STATUS_COLORS[mentee.commitment.status] ?? '#767676', padding: '1px 6px', borderRadius: '2px' }}>
                        {mentee.commitment.status}
                      </span>
                      <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', color: '#b8b8b8' }}>
                        {mentee.commitment.sessions_logged} sessions logged
                      </span>
                    </div>
                  ) : (
                    <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#b8b8b8', margin: 0 }}>
                      No active commitment
                    </p>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', color: '#b8b8b8', margin: '0 0 2px' }}>Last session</p>
                  <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', fontWeight: 600, color: '#5a5a5a', margin: 0 }}>
                    {formatDate(mentee.last_session_at)}
                  </p>
                </div>
              </div>

              {/* Recent posts */}
              {mentee.recent_posts.length === 0 ? (
                <div style={{ padding: '20px', background: '#fafafa' }}>
                  <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#b8b8b8', margin: 0 }}>
                    No session posts yet.
                  </p>
                </div>
              ) : (
                <div>
                  {mentee.recent_posts.map((post, i) => (
                    <div
                      key={post.id}
                      style={{
                        padding: '16px 20px',
                        borderBottom: i < mentee.recent_posts.length - 1 ? '1px solid #f5f5f5' : 'none',
                        background: '#fafafa',
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        gap: '16px',
                        alignItems: 'start',
                      }}
                    >
                      <div>
                        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', color: '#b8b8b8', margin: '0 0 6px' }}>
                          Session {post.session_number} — {formatDate(post.posted_at)}
                        </p>
                        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#1a1a1a', margin: 0, lineHeight: '1.6' }}>
                          {post.body.length > 240 ? post.body.slice(0, 240) + '…' : post.body}
                        </p>
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        {post.confirmed ? (
                          <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#2d6a6a', padding: '4px 10px', border: '1px solid #2d6a6a', borderRadius: '3px' }}>
                            Confirmed
                          </span>
                        ) : post.validator_token ? (
                          <ConfirmButton
                            commitmentId={post.commitment_id}
                            postId={post.id}
                            validatorToken={post.validator_token}
                          />
                        ) : (
                          <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', color: '#b8b8b8' }}>
                            Not a validator
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer link */}
              {mentee.commitment && (
                <div style={{ padding: '12px 20px', borderTop: '1px solid #f0f0f0' }}>
                  <Link
                    href={`/validate/${mentee.commitment.id}`}
                    style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#1a3a6b', textDecoration: 'none', fontWeight: 600 }}
                  >
                    Full validator view
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
