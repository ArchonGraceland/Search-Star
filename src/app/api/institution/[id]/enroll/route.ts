import { createClient } from '@/lib/supabase/server'
import { isCurrentUserAdmin } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { isInstitutionalPortalEnabled } from '@/lib/feature-flags'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isInstitutionalPortalEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { emails } = body as { emails: string[] }

  if (!Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: 'emails must be a non-empty array.' }, { status: 400 })
  }
  if (emails.length > 50) {
    return NextResponse.json({ error: 'Maximum 50 emails per request.' }, { status: 400 })
  }

  // Verify caller is institution contact or admin
  const { data: institution } = await supabase
    .from('institutions')
    .select('contact_email')
    .eq('id', id)
    .single()

  if (!institution) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  const callerEmail = user.email ?? ''
  const isAdmin = await isCurrentUserAdmin()

  if (institution.contact_email !== callerEmail && !isAdmin) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })
  }

  let enrolled = 0
  let already_members = 0
  let not_found = 0

  const cleanEmails = emails.map((e) => e.trim().toLowerCase()).filter(Boolean)

  for (const email of cleanEmails) {
    // Look up user by email via RPC
    const { data: targetUserId, error: rpcError } = await supabase
      .rpc('get_user_id_by_email', { p_email: email })

    if (rpcError || !targetUserId) {
      not_found++
      continue
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from('institution_memberships')
      .select('id')
      .eq('institution_id', id)
      .eq('user_id', targetUserId)
      .maybeSingle()

    if (existing) {
      already_members++
      continue
    }

    // Insert membership
    const { error: insertError } = await supabase
      .from('institution_memberships')
      .insert({ institution_id: id, user_id: targetUserId })

    if (insertError) {
      if (insertError.code === '23505') {
        already_members++
      } else {
        console.error('enroll insert error:', insertError)
        not_found++
      }
      continue
    }

    // Update profiles.institution_id
    await supabase
      .from('profiles')
      .update({ institution_id: id })
      .eq('user_id', targetUserId)

    enrolled++
  }

  return NextResponse.json({ enrolled, already_members, not_found })
}
