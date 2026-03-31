import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

let _admin: SupabaseClient | null = null
function admin() {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _admin
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { company_name, billing_email, company_url, password } = body

    if (!company_name || !billing_email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields: company_name, billing_email, password' },
        { status: 400 }
      )
    }

    // 1. Create Supabase auth user with platform role in metadata
    const { data: authData, error: authError } = await admin().auth.admin.createUser({
      email: billing_email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: company_name,
        role: 'platform',
      },
    })

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    const userId = authData.user.id

    // 2. Update the auto-created profile to set role = 'platform'
    const { error: profileUpdateErr } = await admin()
      .from('profiles')
      .update({
        role: 'platform',
        display_name: company_name,
      })
      .eq('user_id', userId)

    if (profileUpdateErr) {
      console.error('Profile update error:', profileUpdateErr)
    }

    // 3. Generate API key
    const apiKey = `sk_live_${randomUUID().replace(/-/g, '')}`

    // 4. Create platform_accounts row
    const { data: platformAccount, error: platErr } = await admin()
      .from('platform_accounts')
      .insert({
        name: company_name,
        api_key: apiKey,
        credit_balance: 0,
        auto_refill: false,
        status: 'active',
        user_id: userId,
        billing_email,
        company_url: company_url || null,
      })
      .select('id')
      .single()

    if (platErr) {
      console.error('Platform account creation error:', platErr)
      return NextResponse.json(
        { error: 'Failed to create platform account: ' + platErr.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      platform_id: platformAccount.id,
      api_key: apiKey,
    })
  } catch (err) {
    console.error('Platform signup error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
