import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

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
    const {
      publisher_profile_id,
      item_id,
      title,
      summary,
      content_type,
      body: itemBody,
    } = body

    if (!publisher_profile_id) {
      return NextResponse.json({ error: 'Missing publisher_profile_id' }, { status: 400 })
    }

    if (!title) {
      return NextResponse.json({ error: 'Missing title' }, { status: 400 })
    }

    // Verify publisher exists
    const { data: publisher, error: pubErr } = await admin()
      .from('profiles')
      .select('id, display_name, has_content_feed')
      .eq('id', publisher_profile_id)
      .single()

    if (pubErr || !publisher) {
      return NextResponse.json({ error: 'Publisher profile not found' }, { status: 404 })
    }

    // Get all active subscribers
    const { data: subscriptions, error: subErr } = await admin()
      .from('feed_subscriptions')
      .select('subscriber_id')
      .eq('publisher_id', publisher_profile_id)
      .eq('status', 'active')

    if (subErr) {
      return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        delivered_to: 0,
        message: 'No active subscribers',
      })
    }

    // Deliver feed item to each subscriber
    const messages = subscriptions.map(sub => ({
      recipient_id: sub.subscriber_id,
      sender_id: null,
      type: 'feed_item' as const,
      subject: title,
      body: itemBody || null,
      price_paid: null,
      feed_item_id: item_id || null,
      feed_source_profile_id: publisher_profile_id,
      feed_item_title: title,
      feed_item_summary: summary || null,
      feed_item_type: content_type || null,
      read: false,
      blocked: false,
    }))

    const { data: inserted, error: insertErr } = await admin()
      .from('messages')
      .insert(messages)
      .select('id')

    if (insertErr) {
      console.error('Feed delivery error:', insertErr)
      return NextResponse.json({ error: 'Failed to deliver feed items' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      delivered_to: inserted?.length || 0,
      item_title: title,
    })
  } catch (err) {
    console.error('Feed delivery API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
