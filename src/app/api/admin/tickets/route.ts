import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminApi } from '@/lib/auth'

// Admin ticket reply / status route.
//
// Pass 3d (Cluster 3, F11/F34/F38): the inline `checkAdmin` (which read
// profiles.role through the SSR anon client) and the inline anon-client
// writes are replaced with `requireAdminApi` (canonical service-client
// role read) plus service-client writes. The previous shape depended on
// the `is_admin()` RLS policies on support_tickets / ticket_messages
// being correct — under Pass 3a those policies do work, but
// service-client writes after an explicit auth check is the convention
// every other admin surface in this repo already uses.

// POST — Admin reply to ticket
export async function POST(request: NextRequest) {
  try {
    const guard = await requireAdminApi()
    if (guard instanceof NextResponse) return guard
    const adminUser = guard

    const body = await request.json()
    const { ticket_id, body: msgBody, author_id } = body

    if (!ticket_id || !msgBody) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const db = createServiceClient()

    // Insert message. author_id is optional in the request body;
    // fall back to the authenticated admin's user.id. Mirrors
    // /api/tickets (POST line 62, PATCH line 111). Pass 3e
    // dropped the client-side adminProfileId prop on
    // <AdminTicketActions>, which had always forwarded an empty
    // string in production — the fallback path was already the
    // only path that ever ran.
    const { error: msgError } = await db
      .from('ticket_messages')
      .insert({
        ticket_id,
        author_id: author_id || adminUser.id,
        is_admin: true,
        body: msgBody,
      })

    if (msgError) {
      return NextResponse.json({ error: msgError.message }, { status: 500 })
    }

    // Auto-update ticket status to in_progress if it was open
    const { data: ticket } = await db
      .from('support_tickets')
      .select('status')
      .eq('id', ticket_id)
      .single()

    if (ticket && ticket.status === 'open') {
      await db
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
    const guard = await requireAdminApi()
    if (guard instanceof NextResponse) return guard

    const body = await request.json()
    const { ticket_id, status } = body

    if (!ticket_id || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['open', 'in_progress', 'resolved'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const db = createServiceClient()
    const { error: updateError } = await db
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
