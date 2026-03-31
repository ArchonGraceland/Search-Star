import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

async function getAuthClient() {
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

// POST — Create a new support ticket
export async function POST(request: NextRequest) {
  try {
    const supabase = await getAuthClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { subject, priority, body: ticketBody, author_id } = body

    if (!subject || !ticketBody) {
      return NextResponse.json({ error: 'Subject and description are required' }, { status: 400 })
    }

    if (priority && !['normal', 'urgent'].includes(priority)) {
      return NextResponse.json({ error: 'Priority must be normal or urgent' }, { status: 400 })
    }

    // Create ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .insert({
        user_id: user.id,
        subject: subject.trim(),
        priority: priority || 'normal',
        status: 'open',
      })
      .select('id')
      .single()

    if (ticketError) {
      return NextResponse.json({ error: ticketError.message }, { status: 500 })
    }

    // Create initial message
    const { error: msgError } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: ticket.id,
        author_id: author_id || user.id,
        is_admin: false,
        body: ticketBody.trim(),
      })

    if (msgError) {
      console.error('Failed to create initial message:', msgError)
    }

    return NextResponse.json({ success: true, ticket_id: ticket.id })
  } catch (err) {
    console.error('Ticket creation error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH — User reply to own ticket
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await getAuthClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { ticket_id, author_id, body: msgBody } = body

    if (!ticket_id || !msgBody) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify ticket belongs to user
    const { data: ticket } = await supabase
      .from('support_tickets')
      .select('id, user_id')
      .eq('id', ticket_id)
      .eq('user_id', user.id)
      .single()

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Insert reply
    const { error: msgError } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id,
        author_id: author_id || user.id,
        is_admin: false,
        body: msgBody.trim(),
      })

    if (msgError) {
      return NextResponse.json({ error: msgError.message }, { status: 500 })
    }

    // Update ticket timestamp
    await supabase
      .from('support_tickets')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', ticket_id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Ticket reply error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
