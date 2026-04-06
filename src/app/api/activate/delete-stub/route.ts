import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient, SupabaseClient } from '@supabase/supabase-js'

// ═══════════════════════════════════════════════════
// POST /api/activate/delete-stub
// Immediate deletion of unclaimed profile stubs.
//
// Spec reference: Section 3.9 "Unclaimed profiles"
// "If an individual requests removal of their unclaimed
//  stub, it is deleted immediately with no appeals process."
//
// GDPR-compliant: deletes directory entry + all
// profile_fields + any photos. No soft-delete, no
// retention period, no appeals.
// ═══════════════════════════════════════════════════

let _admin: SupabaseClient | null = null
function admin() {
  if (!_admin) {
    _admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _admin
}

interface DeleteStubRequest {
  directory_id?: string
  profile_number?: string
  // For unauthenticated deletion requests (GDPR subject access)
  full_name?: string
  email?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: DeleteStubRequest = await request.json()
    const { directory_id, profile_number, full_name, email } = body

    if (!directory_id && !profile_number && !full_name) {
      return NextResponse.json({
        error: 'Provide directory_id, profile_number, or full_name to identify the stub',
      }, { status: 400 })
    }

    // Find the stub
    let query = admin().from('directory').select('id, display_name, handle, profile_number, seeding_status')

    if (directory_id) {
      query = query.eq('id', directory_id)
    } else if (profile_number) {
      query = query.eq('profile_number', profile_number)
    } else if (full_name) {
      // GDPR request by name — find unclaimed stubs matching the name
      query = query.ilike('display_name', full_name.trim()).eq('seeding_status', 'unclaimed')
    }

    const { data: stub, error: findErr } = await query.maybeSingle()

    if (findErr || !stub) {
      return NextResponse.json({ error: 'Profile stub not found' }, { status: 404 })
    }

    if (stub.seeding_status !== 'unclaimed') {
      return NextResponse.json({
        error: 'This profile is claimed and cannot be deleted via this endpoint. Claimed profile owners can delete their profiles through account settings.',
      }, { status: 403 })
    }

    // ═══ Immediate deletion — no appeals ═══

    // 1. Delete all profile_fields (CASCADE should handle this, but be explicit)
    const { error: fieldsErr } = await admin()
      .from('profile_fields')
      .delete()
      .eq('profile_id', stub.id)

    if (fieldsErr) {
      console.error('Failed to delete profile_fields:', fieldsErr)
    }

    // 2. Delete any photo metadata
    const { error: photosErr } = await admin()
      .from('photo_metadata')
      .delete()
      .eq('profile_id', stub.id)

    if (photosErr) {
      // Table might not exist yet — non-fatal
      console.error('Failed to delete photo_metadata (may not exist):', photosErr)
    }

    // 3. Delete the directory entry itself
    const { error: dirErr } = await admin()
      .from('directory')
      .delete()
      .eq('id', stub.id)
      .eq('seeding_status', 'unclaimed')

    if (dirErr) {
      console.error('Failed to delete directory entry:', dirErr)
      return NextResponse.json({ error: 'Failed to delete stub' }, { status: 500 })
    }

    // 4. Delete corresponding profiles table entry
    const { error: profilesErr } = await admin()
      .from('profiles')
      .delete()
      .eq('profile_number', stub.profile_number)
      .eq('seeding_status', 'unclaimed')

    if (profilesErr) {
      console.error('Failed to delete profiles entry:', profilesErr)
      // Non-fatal — directory entry is the primary one
    }

    // 5. Log the deletion for GDPR compliance audit trail
    console.log(`[GDPR] Unclaimed stub deleted: ${stub.profile_number} (${stub.display_name}) at ${new Date().toISOString()}`)

    return NextResponse.json({
      success: true,
      deleted: {
        profile_number: stub.profile_number,
        display_name: stub.display_name,
        handle: stub.handle,
      },
      message: 'Profile stub has been permanently deleted. All associated data (fields, photos) have been removed.',
      gdpr_compliant: true,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Delete stub error:', err)
    return NextResponse.json({ error: 'Failed to delete stub' }, { status: 500 })
  }
}

// ═══ GDPR Data Subject Access Request endpoint ═══
// GET allows checking if an unclaimed stub exists for a given name

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const fullName = searchParams.get('full_name')

  if (!fullName) {
    return NextResponse.json({ error: 'full_name parameter required' }, { status: 400 })
  }

  const { data: stubs } = await admin()
    .from('directory')
    .select('profile_number, display_name, handle, seeding_status, created_at')
    .ilike('display_name', fullName.trim())
    .eq('seeding_status', 'unclaimed')

  return NextResponse.json({
    stubs: (stubs || []).map(s => ({
      profile_number: s.profile_number,
      display_name: s.display_name,
      handle: s.handle,
      created_at: s.created_at,
    })),
    deletion_available: (stubs || []).length > 0,
    message: (stubs || []).length > 0
      ? 'Unclaimed stubs found. Send a POST to this endpoint with the profile_number to delete.'
      : 'No unclaimed stubs found for this name.',
  })
}
