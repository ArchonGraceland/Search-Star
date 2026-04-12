import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function AdminDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== 'admin') redirect('/dashboard')

  // Platform stats
  const [
    { count: totalProfiles },
    { count: activePractices },
    { count: activeCommitments },
    { count: completedCommitments },
  ] = await Promise.all([
    supabase.from('profiles').select('user_id', { count: 'exact', head: true }),
    supabase.from('practices').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('commitments').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('commitments').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
  ])

  // Recent signups
  const { data: recentUsers } = await supabase
    .from('profiles')
    .select('user_id, display_name, trust_stage, created_at')
    .order('created_at', { ascending: false })
    .limit(8)

  // Recent support tickets
  const { data: recentTickets } = await supabase
    .from('support_tickets')
    .select('id, subject, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5)

  const openTickets = recentTickets?.filter(t => t.status === 'open').length ?? 0

  return (
    <div className="p-8">
      <div className="max-w-[1100px]">
        <div className="mb-8">
          <p className="font-body text-[11px] font-bold tracking-[0.2em] uppercase text-[#767676] mb-2">Admin</p>
          <h1 className="font-heading text-[32px] font-bold mb-1">Platform Overview</h1>
          <p className="font-body text-sm text-[#767676]">Search Star v3.0</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Practitioners', value: totalProfiles ?? 0, href: '/admin/users' },
            { label: 'Active Practices', value: activePractices ?? 0, href: '/admin/users' },
            { label: 'Active Streaks', value: activeCommitments ?? 0, href: '/admin/users' },
            { label: 'Open Tickets', value: openTickets, href: '/admin/tickets', alert: openTickets > 0 },
          ].map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="card-grace p-5 no-underline block hover:shadow-md transition-shadow"
              style={s.alert ? { borderTop: '3px solid #991b1b' } : {}}
            >
              <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">{s.label}</div>
              <div className={`font-mono text-2xl font-medium ${s.alert ? 'text-[#991b1b]' : 'text-[#1a1a1a]'}`}>{s.value}</div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recent Signups */}
          <div className="card-grace p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-xl font-bold">Recent Signups</h2>
              <Link href="/admin/users" className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#1a3a6b] no-underline hover:underline">
                View All →
              </Link>
            </div>
            {recentUsers && recentUsers.length > 0 ? (
              <div className="space-y-1">
                {recentUsers.map((u) => (
                  <Link
                    key={u.user_id}
                    href={`/admin/users/${u.user_id}`}
                    className="flex items-center justify-between py-2 border-b border-[#f0f0f0] last:border-0 no-underline hover:bg-[#fafafa] -mx-2 px-2 rounded-[3px] transition-colors"
                  >
                    <div>
                      <div className="font-body text-sm font-medium text-[#1a1a1a]">{u.display_name || 'Unnamed'}</div>
                      <div className="font-body text-xs text-[#767676]">{formatDate(u.created_at)}</div>
                    </div>
                    <span className="font-body text-[10px] font-bold tracking-[0.1em] uppercase px-2 py-0.5 rounded-[2px] bg-[#f5f5f5] text-[#767676]">
                      {u.trust_stage}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="font-body text-sm text-[#b8b8b8]">No signups yet.</p>
            )}
          </div>

          {/* Support Tickets */}
          <div className="card-grace p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-xl font-bold">Support Tickets</h2>
              <Link href="/admin/tickets" className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#1a3a6b] no-underline hover:underline">
                View All →
              </Link>
            </div>
            {recentTickets && recentTickets.length > 0 ? (
              <div className="space-y-1">
                {recentTickets.map((t) => (
                  <Link
                    key={t.id}
                    href={`/admin/tickets/${t.id}`}
                    className="flex items-center justify-between py-2 border-b border-[#f0f0f0] last:border-0 no-underline hover:bg-[#fafafa] -mx-2 px-2 rounded-[3px] transition-colors"
                  >
                    <div className="flex-1 min-w-0 mr-3">
                      <div className="font-body text-sm font-medium text-[#1a1a1a] truncate">{t.subject}</div>
                      <div className="font-body text-xs text-[#767676]">{formatDate(t.created_at)}</div>
                    </div>
                    <span className={`font-body text-[10px] font-bold tracking-[0.1em] uppercase px-2 py-0.5 rounded-[2px] flex-shrink-0 ${
                      t.status === 'open'
                        ? 'bg-[#fffbeb] text-[#92400e]'
                        : t.status === 'resolved'
                        ? 'bg-[#f0fdf4] text-[#166534]'
                        : 'bg-[#f5f5f5] text-[#767676]'
                    }`}>
                      {t.status}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="font-body text-sm text-[#b8b8b8]">No tickets yet.</p>
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div className="card-grace p-6 mt-6">
          <h2 className="font-heading text-xl font-bold mb-4">Quick Links</h2>
          <div className="flex flex-wrap gap-3">
            {[
              { href: '/admin/users', label: 'All Users' },
              { href: '/admin/tickets', label: 'Support Tickets' },
              { href: '/spec', label: 'Product Spec' },
              { href: '/roadmap', label: 'Roadmap' },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="btn-secondary no-underline"
                style={{ padding: '8px 18px', fontSize: '11px' }}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Stats footer */}
        <p className="font-body text-xs text-[#b8b8b8] mt-6 text-center">
          {completedCommitments ?? 0} completed 90-day streaks on the platform
        </p>
      </div>
    </div>
  )
}
