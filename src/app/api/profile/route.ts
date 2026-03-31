import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch { /* server component */ }
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { endpoint_url } = body

    // Validate URL format if provided
    let domain: string | null = null
    if (endpoint_url && endpoint_url.trim() !== '') {
      try {
        const url = new URL(endpoint_url.trim())
        if (!['http:', 'https:'].includes(url.protocol)) {
          return NextResponse.json({ error: 'URL must use http or https' }, { status: 400 })
        }
        domain = url.hostname
      } catch {
        return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
      }
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        endpoint_url: endpoint_url?.trim() || null,
        domain: domain,
      })
      .eq('user_id', user.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, endpoint_url: endpoint_url?.trim() || null, domain })
  } catch (err) {
    console.error('Profile update error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
