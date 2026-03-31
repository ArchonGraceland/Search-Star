import { createClient } from '@/lib/supabase/server'

export default async function Account() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="p-8">
      <div className="max-w-[960px]">
        <div className="mb-8">
          <h1 className="font-heading text-[32px] font-bold mb-1">Account</h1>
          <p className="font-body text-sm text-[#767676]">Your profile, earnings breakdown, and settings.</p>
        </div>

        {/* Profile info */}
        <div className="bg-white border border-[#d4d4d4] rounded-[3px] shadow-sm p-8 mb-4">
          <h2 className="font-heading text-xl font-bold mb-4">Profile</h2>
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Display Name" value={user?.user_metadata?.display_name || '—'} />
            <InfoRow label="Email" value={user?.email || '—'} />
            <InfoRow label="Profile Number" value="Pending" />
            <InfoRow label="Member Since" value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'} />
          </div>
        </div>

        {/* Earnings breakdown placeholder */}
        <div className="bg-white border border-[#d4d4d4] rounded-[3px] shadow-sm p-8">
          <h2 className="font-heading text-xl font-bold mb-4">Earnings</h2>
          <div className="text-center py-8">
            <p className="font-body text-sm text-[#b8b8b8]">No earnings yet. Complete your profile setup to start earning.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-body text-[11px] font-bold tracking-[0.1em] uppercase text-[#767676] mb-1">{label}</div>
      <div className="font-body text-sm text-[#1a1a1a]">{value}</div>
    </div>
  )
}
