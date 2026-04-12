import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

interface Ticket {
  id: string
  user_id: string
  subject: string
  status: string
  priority: string
  created_at: string
  updated_at: string
}

interface ProfileName {
  id: string
  user_id: string
  display_name: string

}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function statusBadge(status: string): { bg: string; text: string } {
  switch (status) {
    case 'open': return { bg: 'bg-[#fffbeb]', text: 'text-[#92400e]' }
    case 'in_progress': return { bg: 'bg-[#eef2f8]', text: 'text-[#1a3a6b]' }
    case 'resolved': return { bg: 'bg-[#f0fdf4]', text: 'text-[#166534]' }
    default: return { bg: 'bg-[#f5f5f5]', text: 'text-[#767676]' }
  }
}

function priorityBadge(priority: string): { bg: string; text: string } {
  switch (priority) {
    case 'urgent': return { bg: 'bg-[#fef2f2]', text: 'text-[#991b1b]' }
    default: return { bg: 'bg-[#f5f5f5]', text: 'text-[#767676]' }
  }
}

function statusLabel(s: string): string {
  return s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)
}

export default async function AdminTickets({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; priority?: string }>
}) {
  const params = await searchParams
  const filterStatus = params.status || ''
  const filterPriority = params.priority || ''

  const supabase = await createClient()

  let query = supabase
    .from('support_tickets')
    .select('*')
    .order('created_at', { ascending: false })

  if (filterStatus) {
    query = query.eq('status', filterStatus)
  }
  if (filterPriority) {
    query = query.eq('priority', filterPriority)
  }

  const { data: tickets } = await query as { data: Ticket[] | null }
  const allTickets = tickets || []

  // Get user names
  const userIds = [...new Set(allTickets.map(t => t.user_id))]
  let nameMap: Record<string, ProfileName> = {}
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, user_id, display_name')
      .in('user_id', userIds) as { data: ProfileName[] | null }
    nameMap = (profiles || []).reduce((acc, p) => {
      acc[p.user_id] = p
      return acc
    }, {} as Record<string, ProfileName>)
  }

  // Counts by status
  const statusCounts = allTickets.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="p-8">
      <div className="max-w-[1100px]">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-[32px] font-bold mb-1">Support Tickets</h1>
          <p className="font-body text-sm text-[#767676]">
            {allTickets.length} {allTickets.length === 1 ? 'ticket' : 'tickets'}
            {filterStatus ? ` · Filtered by: ${statusLabel(filterStatus)}` : ''}
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          <FilterTab href="/admin/tickets" label="All" active={!filterStatus} />
          <FilterTab href="/admin/tickets?status=open" label="Open" active={filterStatus === 'open'} count={statusCounts['open']} />
          <FilterTab href="/admin/tickets?status=in_progress" label="In Progress" active={filterStatus === 'in_progress'} count={statusCounts['in_progress']} />
          <FilterTab href="/admin/tickets?status=resolved" label="Resolved" active={filterStatus === 'resolved'} count={statusCounts['resolved']} />
        </div>

        {/* Ticket List */}
        <div className="card-grace p-6">
          {allTickets.length > 0 ? (
            <div className="space-y-0">
              {allTickets.map((ticket) => {
                const user = nameMap[ticket.user_id]
                const s = statusBadge(ticket.status)
                const p = priorityBadge(ticket.priority)
                return (
                  <Link
                    key={ticket.id}
                    href={`/admin/tickets/${ticket.id}`}
                    className="flex items-center gap-4 px-4 py-4 no-underline border-b border-[#f0f0f0] last:border-0 hover:bg-[#fafafa] transition-colors rounded-[3px]"
                  >
                    {/* Priority indicator */}
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      ticket.priority === 'urgent' ? 'bg-[#991b1b]' : 'bg-[#d4d4d4]'
                    }`} />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="font-body text-sm font-medium text-[#1a1a1a] truncate">{ticket.subject}</div>
                      <div className="font-body text-xs text-[#767676] mt-0.5">
                        {user?.display_name || 'Unknown'} · {formatDateTime(ticket.created_at)}
                      </div>
                    </div>

                    {/* Badges */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {ticket.priority === 'urgent' && (
                        <span className={`font-body text-[10px] font-bold tracking-[0.1em] uppercase px-2 py-0.5 rounded-[2px] ${p.bg} ${p.text}`}>
                          Urgent
                        </span>
                      )}
                      <span className={`font-body text-[10px] font-bold tracking-[0.1em] uppercase px-2 py-0.5 rounded-[2px] ${s.bg} ${s.text}`}>
                        {statusLabel(ticket.status)}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <p className="font-body text-sm text-[#b8b8b8] text-center py-8">
              {filterStatus ? `No ${statusLabel(filterStatus).toLowerCase()} tickets.` : 'No support tickets yet.'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function FilterTab({ href, label, active, count }: { href: string; label: string; active: boolean; count?: number }) {
  return (
    <Link
      href={href}
      className={`font-body text-[11px] font-bold tracking-[0.1em] uppercase px-4 py-2 rounded-[3px] no-underline transition-colors ${
        active
          ? 'bg-[#1a1a1a] text-white'
          : 'bg-white border border-[#d4d4d4] text-[#767676] hover:border-[#1a1a1a] hover:text-[#1a1a1a]'
      }`}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className={`ml-1.5 text-[10px] ${active ? 'text-white/70' : 'text-[#b8b8b8]'}`}>
          {count}
        </span>
      )}
    </Link>
  )
}
