import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AdminUserActions } from '@/components/admin-user-actions'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default async function AdminUserDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // id is user_id in v3
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('user_id, display_name, location, bio, trust_stage, created_at')
    .eq('user_id', id)
    .single()

  if (error || !profile) {
    return (
      <div className="p-8">
        <div className="max-w-[960px]">
          <Link href="/admin/users" className="font-body text-sm text-[#1a3a6b] no-underline hover:underline mb-4 block">← Back to Users</Link>
          <h1 className="font-heading text-[32px] font-bold mb-1">User Not Found</h1>
          <p className="font-body text-sm text-[#767676]">This profile does not exist.</p>
        </div>
      </div>
    )
  }

  // Trust record
  const { data: trust } = await supabase
    .from('trust_records')
    .select('stage, depth_score, breadth_score, durability_score, completed_streaks, updated_at')
    .eq('user_id', id)
    .single()

  // Practices count
  const { count: practiceCount } = await supabase
    .from('practices')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', id)

  // Completed commitments
  const { count: completedCommitments } = await supabase
    .from('commitments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', id)
    .eq('status', 'completed')

  return (
    <div className="p-8">
      <div className="max-w-[960px]">
        <Link href="/admin/users" className="font-body text-sm text-[#1a3a6b] no-underline hover:underline mb-4 block">
          ← Back to Users
        </Link>

        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-heading text-[32px] font-bold mb-1">{profile.display_name || 'Unnamed'}</h1>
            <p className="font-body text-sm text-[#767676]">
              Member since {formatDate(profile.created_at)}
              {profile.location && ` · ${profile.location}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-body text-[10px] font-bold tracking-[0.1em] uppercase px-3 py-1 rounded-[2px] bg-[#eef2f8] text-[#1a3a6b]">
              {profile.trust_stage}
            </span>
          </div>
        </div>

        {/* Profile Details */}
        <div className="card-grace p-6 mb-6">
          <h2 className="font-heading text-xl font-bold mb-5">Profile</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
            <StatRow label="Display Name" value={profile.display_name || '—'} />
            <StatRow label="Location" value={profile.location || '—'} />
            <StatRow label="Trust Stage" value={profile.trust_stage} />
            <StatRow label="Bio" value={profile.bio || '—'} />
          </div>
        </div>

        {/* Trust Record */}
        <div className="card-grace p-6 mb-6">
          <h2 className="font-heading text-xl font-bold mb-5">Trust Record</h2>
          {trust ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Stage" value={trust.stage} />
              <StatCard label="Depth Score" value={trust.depth_score?.toString() || '0'} />
              <StatCard label="Breadth Score" value={trust.breadth_score?.toString() || '0'} />
              <StatCard label="Durability Score" value={trust.durability_score?.toString() || '0'} />
              <StatCard label="Completed Streaks" value={trust.completed_streaks?.toString() || '0'} />
            </div>
          ) : (
            <p className="font-body text-sm text-[#b8b8b8]">No trust record yet.</p>
          )}
        </div>

        {/* Practice Activity */}
        <div className="card-grace p-6 mb-6">
          <h2 className="font-heading text-xl font-bold mb-5">Practice Activity</h2>
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Active Practices" value={practiceCount?.toString() || '0'} />
            <StatCard label="Completed 90-Day Streaks" value={completedCommitments?.toString() || '0'} />
          </div>
        </div>

        {/* Admin Actions */}
        <div className="card-grace p-6 mb-6" style={{ borderTop: '3px solid #991b1b' }}>
          <h2 className="font-heading text-xl font-bold mb-5">Admin Actions</h2>
          <AdminUserActions
            userId={id}
            currentTrustStage={profile.trust_stage}
          />
        </div>
      </div>
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">{label}</div>
      <div className="font-body text-sm text-[#1a1a1a] break-all">{value}</div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#f5f5f5] rounded-[3px] p-4">
      <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">{label}</div>
      <div className="font-mono text-lg font-medium text-[#1a1a1a]">{value}</div>
    </div>
  )
}
