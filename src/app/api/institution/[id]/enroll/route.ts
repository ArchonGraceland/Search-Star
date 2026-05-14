import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isCurrentUserAdmin } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { isInstitutionalPortalEnabled } from '@/lib/feature-flags'

// Institution enrollment route.
//
// Pass 5 §2 (F24 pattern): the SSR client is retained only for
// `auth.getUser()` (cookie-bound — that's correct). Every database
// call — the institution access lookup, the per-email
// `get_user_id_by_email` RPC, the membership INSERT, the
// `profiles.institution_id` UPDATE — runs on the service client.
// The RPC moved to service client (2026-05-14) so EXECUTE can be
// revoked from the `authenticated` role on a SECURITY DEFINER
// function that would otherwise let any signed-in user enumerate
// other users by email via /rest/v1/rpc.
//
// Authorization is layered:
//   1. Authentication: SSR `auth.getUser()` (gate at the door).
//   2. Access: caller email matches `institution.contact_email` OR
//      caller is platform admin (the existing application-layer gate).
//   3. Authorization on writes: explicit WHERE-clause filters tie
//      every write to the `institution_id` from the URL path and the
//      `targetUserId` resolved from email — both of which are values
//      the access gate above has already validated. RLS becomes
//      defense-in-depth.
//
// Mirrors the F24 shape settled at /api/profiles and
// /api/profiles/visibility (Pass 4 §3) and the Pass 3d migration at
// /api/admin/users (commit b3fe91c).

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isInstitutionalPortalEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const { id } = await params

  // Auth gate — SSR client, cookie-bound.
  const ssr = await createClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { emails } = body as { emails: string[] }

  if (!Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: 'emails must be a non-empty array.' }, { status: 400 })
  }
  if (emails.length > 50) {
    return NextResponse.json({ error: 'Maximum 50 emails per request.' }, { status: 400 })
  }

  // Service client for the access-gating institution lookup and all
  // subsequent writes. SSR client retained above only for the auth
  // check and below for the per-email RPC read.
  const db = createServiceClient()

  // Verify caller is institution contact or admin. Service-client
  // read because a silent-empty on this lookup would bounce a
  // legitimate contact_email to 404.
  const { data: institution } = await db
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
    // Look up user by email via RPC. Service-client call so we can
    // REVOKE EXECUTE on this SECURITY DEFINER function from the
    // `authenticated` role — only the service role needs it, since
    // every callsite is server-side after the access gate above.
    const { data: targetUserId, error: rpcError } = await db
      .rpc('get_user_id_by_email', { p_email: email })

    if (rpcError || !targetUserId) {
      not_found++
      continue
    }

    // Check if already a member — service client to avoid the silent-
    // empty pattern that would let us double-insert under a JWT-
    // propagation failure.
    const { data: existing } = await db
      .from('institution_memberships')
      .select('id')
      .eq('institution_id', id)
      .eq('user_id', targetUserId)
      .maybeSingle()

    if (existing) {
      already_members++
      continue
    }

    // Insert membership — service client. Authorization on this write
    // is the WHERE-clause: `institution_id = id` is the value the
    // access gate above just validated, and `user_id = targetUserId`
    // came from the SECURITY DEFINER RPC.
    const { error: insertError } = await db
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

    // Update profiles.institution_id — service client. WHERE-clause
    // ties the write to the targetUserId resolved above.
    await db
      .from('profiles')
      .update({ institution_id: id })
      .eq('user_id', targetUserId)

    enrolled++
  }

  return NextResponse.json({ enrolled, already_members, not_found })
}
