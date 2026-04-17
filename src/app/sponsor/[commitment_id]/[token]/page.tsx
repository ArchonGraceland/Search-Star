import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import SponsorActions from './sponsor-actions'
import { summarizeCommitment, isDay90Reached } from '@/lib/companion/day90'

export const dynamic = 'force-dynamic'

interface Post {
  id: string
  body: string | null
  media_urls: string[] | null
  session_number: number | null
  posted_at: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function formatRange(startIso: string | null, endIso: string | null): string {
  if (!startIso || !endIso) return ''
  const start = new Date(startIso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const end = new Date(endIso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${start} → ${end}`
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|avi|webm|mkv)/i.test(url) || url.includes('/video/upload/')
}

export default async function SponsorFeed({
  params,
}: {
  params: Promise<{ commitment_id: string; token: string }>
}) {
  const { commitment_id, token } = await params

  // Token is the access control. There's no Supabase auth context here —
  // sponsors don't have accounts — so we use the service client to read past
  // RLS. The sponsorship row's access_token is the gate.
  const supabase = createServiceClient()

  // Look up the sponsorship by token + commitment. Both must match.
  const { data: sponsorship } = await supabase
    .from('sponsorships')
    .select('id, sponsor_name, pledge_amount, status, commitment_id, released_at, vetoed_at, veto_reason')
    .eq('access_token', token)
    .eq('commitment_id', commitment_id)
    .maybeSingle()

  if (!sponsorship) notFound()

  // Fetch the commitment with practitioner display_name and practice name.
  const { data: commitment } = await supabase
    .from('commitments')
    .select('id, status, streak_starts_at, streak_ends_at, user_id, practices(name)')
    .eq('id', commitment_id)
    .single()

  if (!commitment) notFound()

  // Get practitioner display name.
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('user_id', commitment.user_id)
    .single()

  const practitionerName = profile?.display_name ?? 'the practitioner'

  const practice = commitment.practices as { name: string } | { name: string }[] | null
  const practiceName = practice
    ? (Array.isArray(practice) ? practice[0]?.name : practice.name) ?? null
    : null

  // Fetch the session post stream — chronological, oldest first.
  const { data: posts } = await supabase
    .from('commitment_posts')
    .select('id, body, media_urls, session_number, posted_at')
    .eq('commitment_id', commitment_id)
    .order('posted_at', { ascending: true })

  const postList: Post[] = (posts as Post[] | null) ?? []

  // Companion day-90 summary. Only generate when the commitment has
  // reached day 90 or is explicitly completed — we don't want to pay
  // for an Anthropic call every time a sponsor visits during the
  // active streak. summarizeCommitment never throws; it returns
  // {ok:false,...} on failure so the page renders cleanly either way.
  const summaryEligible = isDay90Reached(commitment.status, commitment.streak_ends_at)
  const summaryResult = summaryEligible ? await summarizeCommitment(commitment_id) : null

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      {/* Header */}
      <header style={{ background: '#1a3a6b', padding: '20px 0' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 24px' }}>
          <span style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '22px', fontWeight: 700, color: '#ffffff' }}>
            Search Star
          </span>
        </div>
      </header>

      <main style={{ maxWidth: '720px', margin: '0 auto', padding: '40px 24px 80px' }}>
        {/* Eyebrow */}
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', letterSpacing: '0.2em', color: '#767676', textTransform: 'uppercase', fontWeight: 700, marginBottom: '12px' }}>
          Sponsor feed — {sponsorship.sponsor_name}
        </p>

        {/* Commitment title + practitioner */}
        <h1 style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '32px', fontWeight: 700, color: '#1a1a1a', margin: '0 0 8px', lineHeight: 1.15 }}>
          {practitionerName}&rsquo;s 90-day commitment
        </h1>
        {practiceName && (
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '15px', color: '#5a5a5a', margin: '0 0 4px' }}>
            {practiceName}
          </p>
        )}
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#767676', margin: '0 0 28px' }}>
          {formatRange(commitment.streak_starts_at, commitment.streak_ends_at)}
        </p>

        {/* Pledge summary */}
        <div style={{ background: '#ffffff', border: '1px solid #d4d4d4', borderLeft: '3px solid #1a3a6b', borderRadius: '3px', padding: '18px 22px', marginBottom: '32px' }}>
          <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#767676', margin: '0 0 4px' }}>
            Your pledge
          </p>
          <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '26px', fontWeight: 700, color: '#1a3a6b', margin: 0 }}>
            ${Number(sponsorship.pledge_amount).toFixed(2)}
          </p>
        </div>

        {/* Companion's 90-day summary — three states. Panel frame is always
            visible so sponsors see what's coming from day one. */}
        {summaryEligible && summaryResult?.ok === true ? (
          <div style={{ background: '#ffffff', border: '1px solid #d4d4d4', borderLeft: '3px solid #1a3a6b', borderRadius: '3px', padding: '18px 22px', marginBottom: '32px' }}>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#767676', margin: '0 0 10px' }}>
              Companion&rsquo;s summary
            </p>
            <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '17px', color: '#1a1a1a', lineHeight: 1.65, margin: 0, whiteSpace: 'pre-wrap' }}>
              {summaryResult.summary}
            </p>
            {summaryResult.truncated && (
              <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#767676', margin: '14px 0 0' }}>
                Earlier sessions omitted for length.
              </p>
            )}
          </div>
        ) : summaryEligible && summaryResult?.ok === false ? (
          <div style={{ background: '#ffffff', border: '1px solid #d4d4d4', borderLeft: '3px solid #1a3a6b', borderRadius: '3px', padding: '18px 22px', marginBottom: '32px' }}>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#767676', margin: '0 0 10px' }}>
              Companion&rsquo;s summary
            </p>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#767676', margin: 0, lineHeight: 1.6 }}>
              The summary is temporarily unavailable.
            </p>
          </div>
        ) : (
          <div style={{ background: '#fafafa', border: '1px solid #d4d4d4', borderLeft: '3px solid #1a3a6b', borderRadius: '3px', padding: '18px 22px', marginBottom: '32px' }}>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#767676', margin: '0 0 10px' }}>
              Companion&rsquo;s summary
            </p>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#767676', margin: 0, lineHeight: 1.6 }}>
              The Companion&rsquo;s 90-day summary will appear here once the commitment reaches day 90.
            </p>
          </div>
        )}

        {/* Prior-action state or active sponsor actions */}
        {sponsorship.status === 'released' ? (
          <div style={{ background: '#edf7ed', border: '1px solid #d4d4d4', borderLeft: '3px solid #2d6a2d', borderRadius: '3px', padding: '18px 22px', marginBottom: '32px' }}>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#2d6a2d', margin: '0 0 6px' }}>
              You released this pledge
            </p>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#3a3a3a', lineHeight: 1.6, margin: 0 }}>
              Thank you for witnessing {practitionerName}&rsquo;s 90 days.
              {sponsorship.released_at && (
                <> Released {new Date(sponsorship.released_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.</>
              )}
            </p>
          </div>
        ) : sponsorship.status === 'vetoed' ? (
          <div style={{ background: '#fef2f2', border: '1px solid #d4d4d4', borderLeft: '3px solid #991b1b', borderRadius: '3px', padding: '18px 22px', marginBottom: '32px' }}>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#991b1b', margin: '0 0 6px' }}>
              You vetoed this commitment
            </p>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#3a3a3a', lineHeight: 1.6, margin: 0 }}>
              The streak has ended. No payment was taken.
              {sponsorship.vetoed_at && (
                <> Vetoed {new Date(sponsorship.vetoed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.</>
              )}
            </p>
          </div>
        ) : sponsorship.status === 'pledged' && commitment.status === 'active' ? (
          <SponsorActions
            sponsorshipId={sponsorship.id}
            token={token}
            canRelease={!!commitment.streak_ends_at && new Date(commitment.streak_ends_at) <= new Date()}
            canVeto={true}
            practitionerName={practitionerName}
            pledgeAmount={Number(sponsorship.pledge_amount)}
          />
        ) : null}

        {/* Session stream */}
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#767676', marginBottom: '16px' }}>
          The practice
        </p>

        {postList.length === 0 ? (
          <div style={{ background: '#ffffff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '48px 28px', textAlign: 'center' }}>
            <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '14px', color: '#b8b8b8', margin: 0, lineHeight: 1.6 }}>
              {practitionerName} hasn&rsquo;t logged any sessions yet. Check back once the streak is underway.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {postList.map((post) => (
              <div key={post.id} style={{ background: '#ffffff', border: '1px solid #d4d4d4', borderRadius: '3px', padding: '18px 22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#1a3a6b' }}>
                    {post.session_number != null && post.session_number > 0 ? `Session ${post.session_number}` : 'Start ritual'}
                  </span>
                  <span style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#767676' }}>
                    {formatDate(post.posted_at)}
                  </span>
                </div>

                {post.body && (
                  <p style={{ fontFamily: '"Crimson Text", Georgia, serif', fontSize: '17px', color: '#1a1a1a', lineHeight: 1.65, margin: '0 0 12px', whiteSpace: 'pre-wrap' }}>
                    {post.body}
                  </p>
                )}

                {post.media_urls && post.media_urls.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {post.media_urls.map((url, i) =>
                      isVideoUrl(url) ? (
                        <video
                          key={i}
                          controls
                          preload="metadata"
                          src={url}
                          style={{ maxWidth: '100%', maxHeight: '360px', borderRadius: '3px', background: '#000' }}
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={i}
                          src={url}
                          alt=""
                          style={{ maxWidth: '100%', maxHeight: '360px', borderRadius: '3px', display: 'block' }}
                        />
                      )
                    )}
                  </div>
                )}

                {!post.body && (!post.media_urls || post.media_urls.length === 0) && (
                  <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '13px', color: '#b8b8b8', fontStyle: 'italic', margin: 0 }}>
                    Session logged.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer note */}
        <p style={{ fontFamily: 'Roboto, sans-serif', fontSize: '12px', color: '#b8b8b8', marginTop: '32px', lineHeight: 1.6, textAlign: 'center' }}>
          This is a private sponsor link. Anyone with this URL can view the practice — keep it to yourself.
        </p>
      </main>
    </div>
  )
}
