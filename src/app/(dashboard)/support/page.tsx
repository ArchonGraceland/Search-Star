import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { TicketForm } from '@/components/ticket-form'

interface Ticket {
  id: string
  subject: string
  status: string
  priority: string
  created_at: string
  updated_at: string
}

interface TicketMessage {
  id: string
  is_admin: boolean
  body: string
  created_at: string
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
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

export default async function SupportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Fetch user's tickets
  const { data: tickets } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false }) as { data: Ticket[] | null }

  // For each ticket, get latest message to show preview
  const ticketIds = (tickets || []).map(t => t.id)
  let messagesByTicket: Record<string, TicketMessage[]> = {}
  if (ticketIds.length > 0) {
    const { data: allMessages } = await supabase
      .from('ticket_messages')
      .select('id, ticket_id, is_admin, body, created_at')
      .in('ticket_id', ticketIds)
      .order('created_at', { ascending: false }) as { data: (TicketMessage & { ticket_id: string })[] | null }

    messagesByTicket = (allMessages || []).reduce((acc, m) => {
      if (!acc[m.ticket_id]) acc[m.ticket_id] = []
      acc[m.ticket_id].push(m)
      return acc
    }, {} as Record<string, TicketMessage[]>)
  }

  return (
    <div className="p-8">
      <div className="max-w-[960px]">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-[32px] font-bold mb-1">Support</h1>
          <p className="font-body text-sm text-[#767676]">
            Submit a ticket and our team will respond as soon as possible.
          </p>
        </div>

        {/* Submit Ticket */}
        <div className="card-grace p-6 mb-6">
          <h2 className="font-heading text-xl font-bold mb-5">Submit a Ticket</h2>
          <TicketForm userId={user.id} />
        </div>

        {/* My Tickets */}
        <div className="card-grace p-6">
          <h2 className="font-heading text-xl font-bold mb-5">My Tickets</h2>
          {(tickets && tickets.length > 0) ? (
            <div className="space-y-0">
              {tickets.map((ticket) => {
                const s = statusBadge(ticket.status)
                const msgs = messagesByTicket[ticket.id] || []
                const hasAdminReply = msgs.some(m => m.is_admin)
                return (
                  <Link
                    key={ticket.id}
                    href={`/support/${ticket.id}`}
                    className="flex items-center gap-4 px-4 py-4 no-underline border-b border-[#f0f0f0] last:border-0 hover:bg-[#fafafa] transition-colors rounded-[3px]"
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      ticket.priority === 'urgent' ? 'bg-[#991b1b]' : 'bg-[#d4d4d4]'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-body text-sm font-medium text-[#1a1a1a] truncate">{ticket.subject}</div>
                      <div className="font-body text-xs text-[#767676] mt-0.5">
                        {formatDateTime(ticket.created_at)}
                        {hasAdminReply && (
                          <span className="ml-2 text-[#1a3a6b] font-medium">· Admin replied</span>
                        )}
                      </div>
                    </div>
                    <span className={`font-body text-[10px] font-bold tracking-[0.1em] uppercase px-2 py-0.5 rounded-[2px] ${s.bg} ${s.text}`}>
                      {statusLabel(ticket.status)}
                    </span>
                  </Link>
                )
              })}
            </div>
          ) : (
            <p className="font-body text-sm text-[#b8b8b8] text-center py-4">
              No tickets submitted yet.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
