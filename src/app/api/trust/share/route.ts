import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = user.id

  // Check profile visibility — private profiles cannot share
  const { data: profile } = await supabase
    .from('profiles')
    .select('visibility')
    .eq('user_id', userId)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  if (profile.visibility === 'private') {
    return NextResponse.json(
      { error: 'Your profile is set to private. Update your visibility settings before sharing your Trust record.' },
      { status: 403 }
    )
  }

  // Get current share state
  const { data: trust } = await supabase
    .from('trust_records')
    .select('share_enabled')
    .eq('user_id', userId)
    .single()

  const newShareEnabled = !(trust?.share_enabled ?? false)

  // Upsert with toggled value
  const { error } = await supabase
    .from('trust_records')
    .upsert({ user_id: userId, share_enabled: newShareEnabled }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const shareUrl = newShareEnabled
    ? `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.searchstar.com'}/trust/${userId}`
    : null

  return NextResponse.json({ share_enabled: newShareEnabled, share_url: shareUrl })
}
