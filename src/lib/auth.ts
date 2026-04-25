// Admin auth helpers — the canonical source of "is this user an admin?".
//
// Pass 3d (Cluster 3, F11/F27/F33/F34/F42) consolidated four prior
// detection mechanisms — `profiles.role`, `user_metadata.role==='admin'`,
// `user_metadata.role==='platform'`, the DB `is_admin()` function — onto
// a single read of `profiles.role` (Pass 3a column landing). 13 call
// sites collapsed onto these three helpers.
//
// Read mechanism: service client. The @supabase/ssr JWT-propagation bug
// (commits 0710ce4 / 1dccc46 / 501d976 / 0f28db9) can silently return
// empty owner-RLS reads even for the row's owner, which would boot a
// real admin out. The service client bypasses RLS so the role lookup is
// reliable. Auth is still gated by the explicit `getUser()` check on
// the SSR client at the top of each helper.
//
// The DB `is_admin()` function continues to exist and back four RLS
// policies on support_tickets / ticket_messages — no app code needs to
// call it via rpc(); reads here go directly against the column.

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'

/**
 * Returns true if the currently authenticated user has `profiles.role
 * = 'admin'`. Returns false for anonymous callers, missing rows, and
 * any other role value.
 *
 * Use this when you need a boolean for conditional rendering (e.g.
 * showing an Admin nav link). For server-side gating on admin pages
 * or admin route handlers, prefer `requireAdminPage` or
 * `requireAdminApi`.
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const ssr = await createClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) return false

  const db = createServiceClient()
  const { data } = await db
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle<{ role: string | null }>()

  return data?.role === 'admin'
}

/**
 * Server-component / server-page admin gate. If the caller is not an
 * authenticated admin, redirects them to `/login` (no auth) or
 * `/dashboard` (authed but not admin) and never returns.
 *
 * Returns the authenticated `User` on success so the page can use
 * `user.id`, `user.email`, etc. without a second `getUser()` call.
 */
export async function requireAdminPage(): Promise<User> {
  const ssr = await createClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) redirect('/login')

  const db = createServiceClient()
  const { data } = await db
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle<{ role: string | null }>()

  if (data?.role !== 'admin') redirect('/dashboard')
  return user
}

/**
 * Route-handler admin gate. Returns the authenticated `User` on
 * success, or a `NextResponse` with the appropriate JSON error on
 * failure (401 anon, 403 not-admin). Callers should narrow on the
 * return type:
 *
 *   const guard = await requireAdminApi()
 *   if (guard instanceof NextResponse) return guard
 *   const user = guard
 */
export async function requireAdminApi(): Promise<User | NextResponse> {
  const ssr = await createClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceClient()
  const { data } = await db
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle<{ role: string | null }>()

  if (data?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return user
}
