import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AdminTicketActions } from '@/components/admin-ticket-actions'

interface TicketMessage {
  id: string
  ticket_id: string
  author_id: string
  is_admin: boolean
  body: string
  created_at: string
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function statusLabel(s: string): string {
  return s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)
}

function statusBadge(status: string): { bg: string; text: string } {
  switch (status) {
    case 'open': return { bg: 'bg-[#fffbeb]', text: 'text-[#92400e]' }
    case 'in_progress': return { bg: 'bg-[#eef2f8]', text: 'text-[#1a3a6b]' }
    case 'resolved': return { bg: 'bg-[#f0fdf4]', text: 'text-[#166534]' }
    default: return { bg: 'bg-[#f5f5f5]', text: 'text-[#767676]' }
  }
}

export default async function AdminTicketDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch ticket
  const { data: ticket, error } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !ticket) {
    return (
      <div className="p-8">
        <div className="max-w-[960px]">
          <Link href="/admin/tickets" className="font-body text-sm text-[#1a3a6b] no-underline hover:underline mb-4 block">← Back to Tickets</Link>
          <h1 className="font-heading text-[32px] font-bold mb-1">Ticket Not Found</h1>
        </div>
      </div>
    )
  }

  // Fetch user profile
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('id, display_name, profile_number, handle')
    .eq('user_id', ticket.user_id)
    .single()

  // Fetch messages
  const { data: messages } = await supabase
    .from('ticket_messages')
    .select('*')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true }) as { data: TicketMessage[] | null }

  // Get current admin user id
  const { data: { user } } = await supabase.auth.getUser()
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user!.id)
    .single()

  const s = statusBadge(ticket.status)

  return (
    <div className="p-8">
      <div className="max-w-[960px]">
        {/* Back link */}
        <Link href="/admin/tickets" className="font-body text-sm text-[#1a3a6b] no-underline hover:underline mb-4 block">
          ← Back to Tickets
        </Link>

        {/* Ticket Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="font-heading text-[28px] font-bold mb-1">{ticket.subject}</h1>
            <p className="font-body text-sm text-[#767676]">
              Submitted by {userProfile?.display_name || 'Unknown'}
              {userProfile?.profile_number ? ` (${userProfile.profile_number})` : ''} · {formatDateTime(ticket.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {ticket.priority === 'urgent' && (
              <span className="font-body text-[10px] font-bold tracking-[0.1em] uppercase px-3 py-1 rounded-[2px] bg-[#fef2f2] text-[#991b1b]">
                Urgent
              </span>
            )}
            <span className={`font-body text-[10px] font-bold tracking-[0.1em] uppercase px-3 py-1 rounded-[2px] ${s.bg} ${s.text}`}>
              {statusLabel(ticket.status)}
            </span>
          </div>
        </div>

        {/* Message Thread */}
        <div className="card-grace p-6 mb-6">
          <h2 className="font-heading text-xl font-bold mb-5">Conversation</h2>
          <div className="space-y-4">
            {(messages || []).map((msg) => {
              const isAdmin = msg.is_admin
              return (
                <div
                  key={msg.id}
                  className={`p-4 rounded-[3px] border-l-[3px] ${
                    isAdmin
                      ? 'bg-[#fef2f2] border-[#991b1b]'
                      : 'bg-[#f5f5f5] border-[#d4d4d4]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-body text-xs font-bold text-[#767676]">
                      {isAdmin ? '🛡️ Admin Response' : `${userProfile?.display_name || 'User'}`}
                    </span>
                    <span className="font-body text-xs text-[#b8b8b8]">{formatDateTime(msg.created_at)}</span>
                  </div>
                  <p className="font-body text-sm text-[#1a1a1a] m-0 whitespace-pre-wrap">{msg.body}</p>
                </div>
              )
            })}

            {(!messages || messages.length === 0) && (
              <p className="font-body text-sm text-[#b8b8b8] text-center py-4">No messages yet.</p>
            )}
          </div>
        </div>

        {/* Admin Actions */}
        <AdminTicketActions
          ticketId={id}
          currentStatus={ticket.status}
          adminProfileId={adminProfile?.id || ''}
        />
      </div>
    </div>
  )
}
