import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import RoomInviteForm from './room-invite-form'

// /room/[id]/invite — sponsor invitation for the caller's active
// commitment in this room. This is the UI counterpart to
// /api/rooms/[id]/invite. Practitioners only; if the viewer is a
// sponsor or member with no active commitment, we redirect them back
// to the room.
export const dynamic = 'force-dynamic'

export default async function RoomInvitePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: roomId } = await params

  const ssr = await createClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) redirect('/login')

  const db = createServiceClient()

  const { data: membership } = await db
    .from('room_memberships')
    .select('id, state')
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership || membership.state !== 'active') redirect('/dashboard')

  // Practitioner-only: must have an active commitment in this room.
  type CommitmentRow = {
    id: string
    practices: { name: string } | { name: string }[] | null
  }
  const { data: commitment } = await db
    .from('commitments')
    .select('id, practices(name)')
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<CommitmentRow>()

  if (!commitment) redirect(`/room/${roomId}`)

  const practiceJoin = Array.isArray(commitment.practices)
    ? commitment.practices[0]
    : commitment.practices
  const practiceName = practiceJoin?.name ?? 'your commitment'

  // Pending invites, so the practitioner can see who's been emailed.
  const { data: pending } = await db
    .from('sponsor_invitations')
    .select('id, invitee_email, status, sent_at')
    .eq('commitment_id', commitment.id)
    .order('sent_at', { ascending: false })

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: '24px' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto' }}>
        <Link
          href={`/room/${roomId}`}
          style={{
            fontFamily: 'Roboto, sans-serif',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#1a3a6b',
            textDecoration: 'none',
          }}
        >
          ← Back to room
        </Link>

        <h1
          style={{
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '30px',
            fontWeight: 700,
            color: '#1a1a1a',
            marginTop: '16px',
            marginBottom: '8px',
            lineHeight: 1.2,
          }}
        >
          Invite a sponsor
        </h1>
        <p
          style={{
            fontFamily: '"Crimson Text", Georgia, serif',
            fontSize: '17px',
            color: '#3a3a3a',
            lineHeight: 1.6,
            marginBottom: '24px',
          }}
        >
          Invite someone who believes in what you&rsquo;re building. They
          pledge now, stay present in the room through your 90 days, and
          release the pledge when you finish. Commitment:{' '}
          <strong style={{ color: '#1a3a6b' }}>&ldquo;{practiceName}&rdquo;</strong>.
        </p>

        <RoomInviteForm roomId={roomId} />

        {pending && pending.length > 0 && (
          <div
            style={{
              marginTop: '32px',
              background: '#ffffff',
              border: '1px solid #d4d4d4',
              borderRadius: '3px',
              padding: '18px 20px',
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
              Sent invitations
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {pending.map((p) => (
                <li
                  key={p.id}
                  style={{
                    padding: '8px 0',
                    borderBottom: '1px solid #eee',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '12px',
                    fontFamily: 'Roboto, sans-serif',
                    fontSize: '13px',
                  }}
                >
                  <span style={{ color: '#1a1a1a' }}>{p.invitee_email}</span>
                  <span
                    style={{
                      fontSize: '11px',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color:
                        p.status === 'accepted'
                          ? '#2d6a2d'
                          : p.status === 'declined' || p.status === 'expired'
                            ? '#991b1b'
                            : '#767676',
                      fontWeight: 700,
                    }}
                  >
                    {p.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
