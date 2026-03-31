import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

async function getAdminClient() {
  const cookieStore = await cookies()
  return createServerClient(
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
}

async function checkAdmin(supabase: ReturnType<typeof createServerClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') return null
  return user
}

// POST — Admin reply to ticket
export async function POST(request: NextRequest) {
  try {
    const supabase = await getAdminClient()
    const admin = await checkAdmin(supabase)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { ticket_id, body: msgBody, author_id } = body

    if (!ticket_id || !msgBody || !author_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Insert message
    const { error: msgError } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id,
        author_id,
        is_admin: true,
        body: msgBody,
      })

    if (msgError) {
      return NextResponse.json({ error: msgError.message }, { status: 500 })
    }

    // Auto-update ticket status to in_progress if it was open
    const { data: ticket } = await supabase
      .from('support_tickets')
      .select('status')
      .eq('id', ticket_id)
      .single()

    if (ticket && ticket.status === 'open') {
      await supabase
        .from('support_tickets')
        .update({ status: 'in_progress', updated_at: new Date().toISOString() })
        .eq('id', ticket_id)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Admin ticket reply error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH — Update ticket status
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await getAdminClient()
    const admin = await checkAdmin(supabase)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { ticket_id, status } = body

    if (!ticket_id || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['open', 'in_progress', 'resolved'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('support_tickets')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', ticket_id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, status })
  } catch (err) {
    console.error('Admin ticket status error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
