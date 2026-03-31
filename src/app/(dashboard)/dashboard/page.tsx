import { createClient } from '@/lib/supabase/server'

export default async function Dashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const displayName = user?.user_metadata?.display_name || 'User'

  return (
    <div className="p-8">
      <div className="max-w-[960px]">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="font-heading text-[32px] font-bold mb-1">Welcome, {displayName}</h1>
          <p className="font-body text-sm text-[#767676]">Your Search Star dashboard — earnings, activity, and profile status.</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <StatCard label="Total Earnings" value="$0.00" sublabel="Lifetime" />
          <StatCard label="This Week" value="$0.00" sublabel="Next settlement: Monday" />
          <StatCard label="Profile Queries" value="0" sublabel="Last 30 days" />
        </div>

        {/* Activity placeholder */}
        <div className="bg-white border border-[#d4d4d4] rounded-[3px] shadow-sm p-8">
          <h2 className="font-heading text-xl font-bold mb-4">Recent Activity</h2>
          <div className="text-center py-12">
            <p className="font-body text-sm text-[#b8b8b8] mb-4">No activity yet.</p>
            <p className="font-body text-sm text-[#767676]">
              Once platforms start querying your profile, you&apos;ll see earnings and activity here.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, sublabel }: { label: string; value: string; sublabel: string }) {
  return (
    <div className="bg-white border border-[#d4d4d4] rounded-[3px] shadow-sm p-6">
      <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-2">{label}</div>
      <div className="font-heading text-[28px] font-bold text-[#1a3a6b]">{value}</div>
      <div className="font-mono text-[11px] text-[#b8b8b8] mt-1">{sublabel}</div>
    </div>
  )
}
