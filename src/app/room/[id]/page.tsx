import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SignOutButton } from '@/components/sign-out-button'
import RoomComposer from './room-composer'
import RealtimeMessages from './realtime-messages'
import type { MessageType, RoomMessageData } from './types'

// The room surface. v4 Decision #8: the primary post-login home when
// the user is in exactly one room. This page lives outside the
// (dashboard) group because it has its own chrome — a compact header
// with room name / members sidebar (or sheet on mobile) / message
// stream / composer — distinct from the dashboard's multi-page nav.
//
// Data reads go through the service client (per 0710ce4 pattern),
// gated at the app layer by a room_memberships check. Auth stays on
// the SSR client because session cookies.
export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RosterLine {
  userId: string
  name: string
  role: 'practitioner' | 'sponsor' | 'member'
  // Human-readable tail: "committing to X, day 12 of 90" or "$100 backing Dave's X"
  tail: string
}

interface ActiveCommitment {
  id: string
  userId: string
  practitionerName: string
  practiceName: string
  dayNumber: number
}

// ---------------------------------------------------------------------------

function dayNumberFromStart(isoStart: string, now: Date = new Date()): number {
  const start = new Date(isoStart).getTime()
  if (!Number.isFinite(start) || now.getTime() <= start) return 1
  const diffMs = now.getTime() - start
  return Math.max(1, Math.min(90, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1))
}

// Today in UTC (YYYY-MM-DD). The DB unique index on is_session uses
// posted_at::date, which is the server's local date (UTC in Vercel).
// We compute composer state the same way so the UI reflects what the
// DB will accept.
function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------

export default async function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: roomId } = await params

  const ssr = await createClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) redirect('/login')

  const db = createServiceClient()

  // Gate 1: caller must be an active member of this room.
  const { data: myMembership } = await db
    .from('room_memberships')
    .select('id, state')
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!myMembership || myMembership.state !== 'active') {
    // No membership => not theirs to see. Kick to dashboard rather
    // than login so they still have somewhere to land.
    redirect('/dashboard')
  }

  // ---------------------------------------------------------------------
  // Load room, members, commitments, sponsorships, messages, affirmations,
  // and profile names in parallel where possible.
  // ---------------------------------------------------------------------

  const [
    { data: room },
    { data: memberships },
    { data: commitments },
    { data: messages },
  ] = await Promise.all([
    db.from('rooms').select('id, name, created_at').eq('id', roomId).maybeSingle(),
    db
      .from('room_memberships')
      .select('user_id, joined_at, state')
      .eq('room_id', roomId)
      .eq('state', 'active'),
    db
      .from('commitments')
      .select('id, user_id, status, started_at, practice_id')
      .eq('room_id', roomId)
      .eq('status', 'active'),
    db
      .from('room_messages')
      .select(
        'id, user_id, commitment_id, message_type, body, media_urls, transcript, is_session, posted_at'
      )
      .eq('room_id', roomId)
      .order('posted_at', { ascending: true }),
  ])

  if (!room) {
    redirect('/dashboard')
  }

  // Collect user IDs to resolve display names in one query.
  const memberUserIds = (memberships ?? []).map((m) => m.user_id)
  const messageUserIds = (messages ?? []).map((m) => m.user_id)
  const allUserIds = Array.from(new Set([...memberUserIds, ...messageUserIds]))

  const { data: profiles } = allUserIds.length
    ? await db.from('profiles').select('user_id, display_name').in('user_id', allUserIds)
    : { data: [] as Array<{ user_id: string; display_name: string | null }> }

  const nameFor = (uid: string): string =>
    profiles?.find((p) => p.user_id === uid)?.display_name ?? 'A member'

  // Plain object keyed by user_id → display_name, passed to the client
  // component so Realtime-delivered messages from known members render
  // with the right author name. Members who join after this page
  // rendered fall back to "A member" in client shaping — router.refresh()
  // rebuilds the map.
  const nameMap: Record<string, string> = {}
  for (const p of profiles ?? []) {
    if (p.display_name) nameMap[p.user_id] = p.display_name
  }

  // Practice names for all active commitments in this room.
  const practiceIds = Array.from(new Set((commitments ?? []).map((c) => c.practice_id)))
  const { data: practices } = practiceIds.length
    ? await db.from('practices').select('id, name').in('id', practiceIds)
    : { data: [] as Array<{ id: string; name: string }> }
  const practiceNameFor = (pid: string): string =>
    practices?.find((p) => p.id === pid)?.name ?? 'their practice'

  const activeCommitments: ActiveCommitment[] = (commitments ?? []).map((c) => ({
    id: c.id,
    userId: c.user_id,
    practitionerName: nameFor(c.user_id),
    practiceName: practiceNameFor(c.practice_id),
    dayNumber: dayNumberFromStart(c.started_at),
  }))

  // Sponsorships tying specific members to specific active commitments.
  const commitmentIds = activeCommitments.map((ac) => ac.id)
  const { data: sponsorships } = commitmentIds.length
    ? await db
        .from('sponsorships')
        .select('commitment_id, sponsor_user_id, pledge_amount, status')
        .in('commitment_id', commitmentIds)
        .in('status', ['pledged', 'released', 'paid'])
    : { data: [] as Array<{
        commitment_id: string
        sponsor_user_id: string | null
        pledge_amount: number | string
        status: string
      }> }

  // Affirmations on all messages in this room — one query, filter client-side.
  const messageIds = (messages ?? []).map((m) => m.id)
  const { data: affirmations } = messageIds.length
    ? await db
        .from('message_affirmations')
        .select('message_id, sponsor_user_id')
        .in('message_id', messageIds)
    : { data: [] as Array<{ message_id: string; sponsor_user_id: string }> }

  // ---------------------------------------------------------------------
  // Derive viewer-scoped booleans: am I the practitioner? which
  // commitments do I sponsor?
  // ---------------------------------------------------------------------

  const myActiveCommitment = activeCommitments.find((ac) => ac.userId === user.id) ?? null
  const mySponsoredCommitmentIds = new Set(
    (sponsorships ?? [])
      .filter((s) => s.sponsor_user_id === user.id)
      .map((s) => s.commitment_id)
  )

  // Has the viewer already marked a session today? Governs the
  // composer's session-mark toggle state.
  const today = todayUtcDate()
  const alreadyMarkedToday = (messages ?? []).some((m) => {
    if (m.user_id !== user.id) return false
    if (!m.is_session) return false
    if (m.message_type !== 'practitioner_post') return false
    return m.posted_at.slice(0, 10) === today
  })

  // ---------------------------------------------------------------------
  // Build the roster with transparent pledges.
  // ---------------------------------------------------------------------

  const roster: RosterLine[] = (memberships ?? []).map((m) => {
    const name = nameFor(m.user_id)

    // Practitioner of an active commitment?
    const own = activeCommitments.find((ac) => ac.userId === m.user_id)
    if (own) {
      return {
        userId: m.user_id,
        name,
        role: 'practitioner',
        tail: `"${own.practiceName}" — day ${own.dayNumber} of 90`,
      }
    }

    // Sponsor of someone specific?
    const theirSponsorships = (sponsorships ?? []).filter(
      (s) => s.sponsor_user_id === m.user_id
    )
    if (theirSponsorships.length > 0) {
      const parts = theirSponsorships.map((s) => {
        const target = activeCommitments.find((ac) => ac.id === s.commitment_id)
        const amt = Number(s.pledge_amount)
        const amtStr = Number.isFinite(amt) ? `$${amt.toFixed(0)}` : 'pledged'
        return target ? `${amtStr} backing ${target.practitionerName}` : amtStr
      })
      return {
        userId: m.user_id,
        name,
        role: 'sponsor',
        tail: parts.join('; '),
      }
    }

    return { userId: m.user_id, name, role: 'member', tail: 'present' }
  })

  // ---------------------------------------------------------------------
  // Shape messages for the UI. Includes affirmation summary + viewer's
  // own affirmation state + whether the viewer can affirm this one.
  // ---------------------------------------------------------------------

  const shapedMessages: RoomMessageData[] = (messages ?? []).map((m) => {
    const isCompanion =
      m.message_type === 'companion_response' ||
      m.message_type === 'companion_welcome' ||
      m.message_type === 'companion_milestone' ||
      m.message_type === 'companion_moderation'

    const affirmsForMsg = (affirmations ?? []).filter((a) => a.message_id === m.id)
    const viewerAffirmed = affirmsForMsg.some((a) => a.sponsor_user_id === user.id)

    const canAffirm =
      m.is_session &&
      m.message_type === 'practitioner_post' &&
      !!m.commitment_id &&
      mySponsoredCommitmentIds.has(m.commitment_id) &&
      m.user_id !== user.id

    return {
      id: m.id,
      user_id: m.user_id,
      commitment_id: m.commitment_id,
      message_type: m.message_type as MessageType,
      body: m.body,
      media_urls: (m.media_urls ?? []) as string[],
      transcript: m.transcript,
      is_session: m.is_session,
      posted_at: m.posted_at,
      author_name: isCompanion ? 'Companion' : nameFor(m.user_id),
      affirmation_count: affirmsForMsg.length,
      viewer_affirmed: viewerAffirmed,
      viewer_can_affirm: canAffirm,
    }
  })

  // ---------------------------------------------------------------------
  // Heading + context for the composer.
  // ---------------------------------------------------------------------

  const headerTitle = myActiveCommitment
    ? `"${myActiveCommitment.practiceName}" — day ${myActiveCommitment.dayNumber} of 90`
    : activeCommitments[0]
      ? `${activeCommitments[0].practitionerName}'s room`
      : 'Your room'

  const practitionerCount = activeCommitments.length
  const memberCount = (memberships ?? []).length

  // Viewer's own name for the composer.
  const myName = nameFor(user.id)

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f5f5f5',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <header
        style={{
          background: '#1a3a6b',
          borderBottom: '3px solid #112a4f',
          padding: '16px 24px',
          color: '#ffffff',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div>
            <Link
              href="/home"
              style={{
                fontFamily: '"Crimson Text", Georgia, serif',
                fontSize: '20px',
                fontWeight: 700,
                color: '#ffffff',
                textDecoration: 'none',
                letterSpacing: '0.01em',
              }}
            >
              Search Star
            </Link>
            <p
              style={{
                fontFamily: 'Roboto, sans-serif',
                fontSize: '11px',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.55)',
                marginTop: '2px',
              }}
            >
              {memberCount} {memberCount === 1 ? 'member' : 'members'}
              {practitionerCount > 0
                ? ` · ${practitionerCount} active ${practitionerCount === 1 ? 'practitioner' : 'practitioners'}`
                : ''}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Link
              href="/dashboard"
              style={{
                fontFamily: 'Roboto, sans-serif',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.75)',
                textDecoration: 'none',
                padding: '7px 14px',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: '3px',
              }}
            >
              Dashboard
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* Main body: roster + stream */}
      <div
        style={{
          flex: 1,
          maxWidth: '1200px',
          width: '100%',
          margin: '0 auto',
          padding: '24px',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 300px',
          gap: '24px',
          alignItems: 'start',
        }}
        className="room-main"
      >
        {/* Center: message stream */}
        <section
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            minWidth: 0,
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: '"Crimson Text", Georgia, serif',
                fontSize: '28px',
                fontWeight: 700,
                color: '#1a1a1a',
                lineHeight: 1.2,
                margin: '0 0 6px',
              }}
            >
              {headerTitle}
            </h1>
            {myActiveCommitment && (
              <p
                style={{
                  fontFamily: 'Roboto, sans-serif',
                  fontSize: '13px',
                  color: '#5a5a5a',
                  margin: 0,
                }}
              >
                {alreadyMarkedToday
                  ? "Today's session is marked. You can still post chat."
                  : 'You can mark one message per day as your session for today.'}
              </p>
            )}
          </div>

          <RealtimeMessages
            initialMessages={shapedMessages}
            roomId={roomId}
            viewerUserId={user.id}
            nameMap={nameMap}
            mySponsoredCommitmentIds={Array.from(mySponsoredCommitmentIds)}
            emptyStateText={
              myActiveCommitment
                ? 'The room is quiet. Post the first session below.'
                : 'The room is quiet. Wait for the practitioner to begin.'
            }
          />

          {/* Composer — only shown to the practitioner (who can both
              session-mark and chat) and to members who might want to
              chat. For the v1 room surface we let any active member
              compose; the POST handler enforces that only practitioners
              can session-mark. */}
          <div style={{ marginTop: '20px' }}>
            <RoomComposer
              roomId={roomId}
              myCommitmentId={myActiveCommitment?.id ?? null}
              myName={myName}
              alreadyMarkedToday={alreadyMarkedToday}
              isPractitioner={!!myActiveCommitment}
            />
          </div>
        </section>

        {/* Right: roster + invite CTA */}
        <aside
          style={{
            background: '#ffffff',
            border: '1px solid #d4d4d4',
            borderRadius: '3px',
            padding: '20px 22px',
            position: 'sticky',
            top: '24px',
          }}
        >
          <p
            style={{
              fontFamily: 'Roboto, sans-serif',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: '#767676',
              margin: '0 0 12px',
            }}
          >
            In the room
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {roster.map((r) => (
              <li
                key={r.userId}
                style={{
                  padding: '10px 0',
                  borderBottom: '1px solid #eee',
                  fontFamily: 'Roboto, sans-serif',
                }}
              >
                <p
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#1a1a1a',
                    margin: '0 0 2px',
                  }}
                >
                  {r.name}
                  {r.userId === user.id && (
                    <span style={{ fontWeight: 400, color: '#767676' }}> (you)</span>
                  )}
                </p>
                <p
                  style={{
                    fontSize: '12px',
                    color: r.role === 'practitioner' ? '#1a3a6b' : '#5a5a5a',
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      fontSize: '10px',
                      fontWeight: 700,
                      color: '#767676',
                      marginRight: '6px',
                    }}
                  >
                    {r.role === 'practitioner'
                      ? 'Practitioner'
                      : r.role === 'sponsor'
                        ? 'Sponsor'
                        : 'Member'}
                  </span>
                  {r.tail}
                </p>
              </li>
            ))}
          </ul>

          {myActiveCommitment && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #eee' }}>
              <Link
                href={`/room/${roomId}/invite`}
                style={{
                  display: 'block',
                  textAlign: 'center',
                  fontFamily: 'Roboto, sans-serif',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: '#1a3a6b',
                  background: '#eef2f8',
                  border: '1px solid #d4d4d4',
                  borderRadius: '3px',
                  padding: '10px 14px',
                  textDecoration: 'none',
                }}
              >
                Invite a sponsor
              </Link>
            </div>
          )}
        </aside>
      </div>

      {/* Narrow-viewport single-column layout */}
      <style>
        {`
          @media (max-width: 880px) {
            .room-main {
              grid-template-columns: 1fr !important;
            }
            .room-main > aside {
              position: static !important;
            }
          }
        `}
      </style>
    </div>
  )
}
