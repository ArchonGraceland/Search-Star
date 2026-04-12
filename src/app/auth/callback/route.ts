import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Route new users through onboarding; returning users go to dashboard
        const { data: practices } = await supabase
          .from('practices')
          .select('id')
          .eq('user_id', user.id)
          .limit(1)

        if (practices && practices.length > 0) {
          return NextResponse.redirect(`${origin}/dashboard`)
        } else {
          return NextResponse.redirect(`${origin}/onboarding/practice`)
        }
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
