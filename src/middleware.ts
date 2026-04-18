import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Handle auth callback codes landing on root
  if (request.nextUrl.pathname === '/' && request.nextUrl.searchParams.has('code')) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/callback'
    return NextResponse.redirect(url)
  }

  // Logged-in users hitting the homepage get routed by commitment state:
  //   - commitment exists (any status) → /log (launch-window shows the
  //     "not yet" splash; active shows the session logger)
  //   - no commitment → /start (stage resolver picks the right onboarding
  //     step — either /start/practice or /start/commitment)
  //
  // We query via a service-role client rather than `supabase` (the SSR
  // anon client) because the same @supabase/ssr JWT-propagation issue
  // diagnosed on dashboard/commit pages would silently return count=0
  // for users who do have a commitment, bouncing them to /start by
  // mistake. Inline here instead of importing createServiceClient from
  // src/lib/supabase/server.ts because that file imports `next/headers`
  // which is not edge-runtime-compatible. The extra lookup is gated on
  // pathname === '/' so it only runs on homepage hits.
  if (user && request.nextUrl.pathname === '/') {
    const service = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { count } = await service
      .from('commitments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .limit(1)

    const url = request.nextUrl.clone()
    url.pathname = (count ?? 0) > 0 ? '/log' : '/start'
    return NextResponse.redirect(url)
  }

  // Protected routes — redirect to login if not authenticated.
  //
  // Note: '/trust' is deliberately NOT in this list. The dashboard variant
  // ('/dashboard/trust') is covered by the '/dashboard' prefix. The public
  // variant ('/trust/[userId]') must be reachable without auth so that
  // sponsors, employers, and anyone with a share link can view a
  // practitioner's record. The page itself handles visibility gating
  // (private profile or share_enabled=false => locked state).
  //
  // IMPORTANT: these are path-boundary prefixes. '/log' protects '/log' and
  // '/log/anything', but must NOT match '/login' — which is why we check
  // `pathname === p || pathname.startsWith(p + '/')` rather than a plain
  // `startsWith(p)`. A naive prefix match caused an infinite redirect loop
  // from '/login' → '/login' because '/login'.startsWith('/log') is true.
  const protectedPrefixes = [
    '/dashboard', '/account', '/admin', '/support',
    '/commit', '/practice',
    '/earnings', '/log',
    '/onboarding/practice', '/onboarding/profile', '/onboarding/visibility',
    '/start',
  ]

  const pathname = request.nextUrl.pathname
  const isProtected = protectedPrefixes.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  )

  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|xlsx)$).*)',
  ],
}
