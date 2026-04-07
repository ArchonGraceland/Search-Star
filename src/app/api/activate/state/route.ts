import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ═══════════════════════════════════════════════════
// GET /api/activate/state — Load activation progress
// POST /api/activate/state — Save activation progress
// ═══════════════════════════════════════════════════

interface LockedIdentityData {
  candidateId: string
  name: string
  employer?: string
  location?: string
  photoUrl?: string
  summary: string
  sourceUrls: string[]
  confidence: number
  lockedAt: string
}

interface ActivationState {
  current_step: string
  full_name: string | null
  employer: string | null
  city: string | null
  linkedin_url: string | null
  profile_id: string | null
  field_ids: string[]
  photo_ids: string[]
  public_price: number
  private_price: number
  marketing_price: number
  published_handle: string | null
  published_profile_number: string | null
  // Phase 11 — locked identity from Step 0 identity-lock
  locked_identity: LockedIdentityData | null
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('activation_state')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      console.error('Load activation state error:', error)
      return NextResponse.json({ error: 'Failed to load state' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ state: null })
    }

    return NextResponse.json({ state: data })
  } catch (err) {
    console.error('Activation state GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = (await request.json()) as Partial<ActivationState>

    // Build the update object — only include fields that were sent
    const update: Record<string, unknown> = {
      user_id: user.id,
      updated_at: new Date().toISOString(),
    }

    if (body.current_step !== undefined) update.current_step = body.current_step
    if (body.full_name !== undefined) update.full_name = body.full_name
    if (body.employer !== undefined) update.employer = body.employer
    if (body.city !== undefined) update.city = body.city
    if (body.linkedin_url !== undefined) update.linkedin_url = body.linkedin_url
    if (body.profile_id !== undefined) update.profile_id = body.profile_id
    if (body.field_ids !== undefined) update.field_ids = body.field_ids
    if (body.photo_ids !== undefined) update.photo_ids = body.photo_ids
    if (body.public_price !== undefined) update.public_price = body.public_price
    if (body.private_price !== undefined) update.private_price = body.private_price
    if (body.marketing_price !== undefined) update.marketing_price = body.marketing_price
    if (body.published_handle !== undefined) update.published_handle = body.published_handle
    if (body.published_profile_number !== undefined) update.published_profile_number = body.published_profile_number
    if (body.locked_identity !== undefined) update.locked_identity = body.locked_identity

    // Upsert — create if not exists, update if exists
    const { data, error } = await supabase
      .from('activation_state')
      .upsert(update, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) {
      console.error('Save activation state error:', error)
      return NextResponse.json({ error: 'Failed to save state', details: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, state: data })
  } catch (err) {
    console.error('Activation state POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
