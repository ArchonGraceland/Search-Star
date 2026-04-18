import { createServerClient } from '@supabase/ssr'
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

  // Logged-in users hitting the homepage go straight to /log
  if (user && request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/log'
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
