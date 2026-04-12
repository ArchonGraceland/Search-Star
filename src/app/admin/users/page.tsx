import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

interface Profile {
  user_id: string
  display_name: string | null
  location: string | null
  trust_stage: string
  mentor_role: string | null
  created_at: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STAGE_COLORS: Record<string, string> = {
  seedling:    'background:#f5f5f5;color:#767676',
  rooting:     'background:#f0fdf4;color:#166534',
  growing:     'background:#eef2f8;color:#1a3a6b',
  established: 'background:#fffbeb;color:#92400e',
  mature:      'background:#fef2f2;color:#991b1b',
}

export default async function AdminUsers({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const params = await searchParams
  const query = params.q || ''
  const page = parseInt(params.page || '1', 10)
  const perPage = 20
  const offset = (page - 1) * perPage

  const supabase = await createClient()

  let dbQuery = supabase
    .from('profiles')
    .select('user_id, display_name, location, trust_stage, mentor_role, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1)

  if (query) {
    dbQuery = dbQuery.ilike('display_name', `%${query}%`)
  }

  const { data: profiles, count } = await dbQuery as { data: Profile[] | null; count: number | null }
  const users = profiles || []
  const totalCount = count || 0
  const totalPages = Math.ceil(totalCount / perPage)

  return (
    <div className="p-8">
      <div className="max-w-[1100px]">
        <div className="mb-8">
          <h1 className="font-heading text-[32px] font-bold mb-1">User Management</h1>
          <p className="font-body text-sm text-[#767676]">
            {totalCount} registered {totalCount === 1 ? 'practitioner' : 'practitioners'}
          </p>
        </div>

        <div className="card-grace p-4 mb-6">
          <form method="GET" className="flex gap-3">
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Search by display name..."
              className="flex-1 font-body text-sm px-4 py-2.5 border border-[#d4d4d4] rounded-[3px] outline-none focus:border-[#1a3a6b] transition-colors"
            />
            <button type="submit" className="btn-primary" style={{ padding: '10px 24px', fontSize: '11px' }}>
              Search
            </button>
            {query && (
              <Link href="/admin/users" className="btn-secondary no-underline flex items-center" style={{ padding: '10px 24px', fontSize: '11px' }}>
                Clear
              </Link>
            )}
          </form>
        </div>

        <div className="card-grace p-6 mb-6">
          {users.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#d4d4d4]">
                    <th className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] text-left py-3">Name</th>
                    <th className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] text-left py-3">Location</th>
                    <th className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] text-center py-3">Trust Stage</th>
                    <th className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] text-center py-3">Mentor Role</th>
                    <th className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] text-right py-3">Joined</th>
                    <th className="font-body text-[10px] font-bold tracking-[0.1em] uppercase text-[#767676] text-center py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.user_id} className="border-b border-[#f0f0f0] last:border-0 hover:bg-[#fafafa] transition-colors">
                      <td className="py-3">
                        <div className="font-body text-sm font-medium text-[#1a1a1a]">{u.display_name || '—'}</div>
                      </td>
                      <td className="font-body text-sm text-[#767676] py-3">{u.location || '—'}</td>
                      <td className="text-center py-3">
                        <span
                          className="font-body text-[10px] font-bold tracking-[0.1em] uppercase px-2 py-0.5 rounded-[2px]"
                          style={Object.fromEntries((STAGE_COLORS[u.trust_stage] || STAGE_COLORS.seedling).split(';').map(s => s.split(':')))}
                        >
                          {u.trust_stage}
                        </span>
                      </td>
                      <td className="text-center py-3">
                        {u.mentor_role ? (
                          <span className="font-body text-[10px] font-bold tracking-[0.1em] uppercase px-2 py-0.5 rounded-[2px] bg-[#eef2f8] text-[#1a3a6b]">
                            {u.mentor_role.replace('_', ' ')}
                          </span>
                        ) : (
                          <span className="font-body text-xs text-[#b8b8b8]">—</span>
                        )}
                      </td>
                      <td className="font-body text-xs text-[#767676] text-right py-3 whitespace-nowrap">
                        {formatDate(u.created_at)}
                      </td>
                      <td className="text-center py-3">
                        <Link
                          href={`/admin/users/${u.user_id}`}
                          className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#1a3a6b] no-underline hover:underline"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="font-body text-sm text-[#b8b8b8] text-center py-8">
              {query ? `No practitioners matching "${query}"` : 'No practitioners yet.'}
            </p>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            {page > 1 && (
              <Link href={`/admin/users?q=${encodeURIComponent(query)}&page=${page - 1}`} className="btn-secondary no-underline" style={{ padding: '8px 16px', fontSize: '11px' }}>
                ← Previous
              </Link>
            )}
            <span className="font-body text-sm text-[#767676] px-4">Page {page} of {totalPages}</span>
            {page < totalPages && (
              <Link href={`/admin/users?q=${encodeURIComponent(query)}&page=${page + 1}`} className="btn-secondary no-underline" style={{ padding: '8px 16px', fontSize: '11px' }}>
                Next →
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
