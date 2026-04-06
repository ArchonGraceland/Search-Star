import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient, SupabaseClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

// ═══════════════════════════════════════════════════
// POST /api/activate/claim
// Claim flow for unclaimed profile stubs.
//
// Step 1: User requests claim → creates Stripe Identity
//         verification session → returns client_secret
// Step 2: User completes KYC in Stripe's UI
// Step 3: User calls this endpoint again with
//         verification_session_id → we check status,
//         transition seeding_status to 'claimed'
//
// Spec reference: Section 2 (KYC/Stripe Identity),
//                 Section 3.9 "Unclaimed profiles"
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

function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

interface ClaimRequest {
  // Step 1: initiate claim
  directory_id?: string
  profile_number?: string

  // Step 2: verify after KYC
  verification_session_id?: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized — must be logged in to claim a profile' }, { status: 401 })
    }

    const body: ClaimRequest = await request.json()

    // ═══ Step 2: Verify KYC and complete claim ═══
    if (body.verification_session_id) {
      return await verifyAndClaim(body.verification_session_id, user.id)
    }

    // ═══ Step 1: Initiate claim — create Stripe Identity session ═══
    const directoryId = body.directory_id
    const profileNumber = body.profile_number

    if (!directoryId && !profileNumber) {
      return NextResponse.json({
        error: 'Provide directory_id or profile_number to claim',
      }, { status: 400 })
    }

    // Find the unclaimed stub
    let query = admin().from('directory').select('id, display_name, handle, profile_number, seeding_status')
    if (directoryId) {
      query = query.eq('id', directoryId)
    } else {
      query = query.eq('profile_number', profileNumber!)
    }

    const { data: stub, error: findErr } = await query.single()

    if (findErr || !stub) {
      return NextResponse.json({ error: 'Profile stub not found' }, { status: 404 })
    }

    if (stub.seeding_status === 'claimed') {
      return NextResponse.json({ error: 'This profile has already been claimed' }, { status: 409 })
    }

    // Check the user doesn't already have a claimed profile
    const { data: existingClaim } = await admin()
      .from('directory')
      .select('id, profile_number')
      .eq('user_id', user.id)
      .eq('seeding_status', 'claimed')
      .maybeSingle()

    if (existingClaim) {
      return NextResponse.json({
        error: `You already own profile ${existingClaim.profile_number}. One profile per user.`,
      }, { status: 409 })
    }

    // Create Stripe Identity verification session
    const stripe = getStripe()
    const session = await stripe.identity.verificationSessions.create({
      type: 'document',
      metadata: {
        directory_id: stub.id,
        profile_number: stub.profile_number,
        user_id: user.id,
        display_name: stub.display_name,
      },
      options: {
        document: {
          require_matching_selfie: true,
        },
      },
    })

    // Store the verification session reference
    await admin()
      .from('directory')
      .update({
        // Store pending claim info (we'll clear this on success or failure)
        user_id: user.id,
      })
      .eq('id', stub.id)
      .eq('seeding_status', 'unclaimed')

    return NextResponse.json({
      success: true,
      step: 'kyc_required',
      verification_session_id: session.id,
      client_secret: session.client_secret,
      publishable_key: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      profile: {
        id: stub.id,
        display_name: stub.display_name,
        handle: stub.handle,
        profile_number: stub.profile_number,
      },
      message: 'Complete identity verification to claim this profile.',
    })
  } catch (err) {
    console.error('Claim initiation error:', err)
    return NextResponse.json({ error: 'Failed to initiate claim' }, { status: 500 })
  }
}

// ═══ Step 2 handler: verify KYC and transition to claimed ═══

async function verifyAndClaim(verificationSessionId: string, userId: string) {
  try {
    const stripe = getStripe()

    // Retrieve the verification session
    const session = await stripe.identity.verificationSessions.retrieve(verificationSessionId)

    if (session.status !== 'verified') {
      return NextResponse.json({
        error: `Verification not complete. Status: ${session.status}`,
        status: session.status,
        message: session.status === 'requires_input'
          ? 'Please complete the identity verification process.'
          : session.status === 'processing'
            ? 'Verification is still processing. Please try again in a moment.'
            : 'Verification failed. Please try again.',
      }, { status: 400 })
    }

    // Extract the directory_id from metadata
    const directoryId = session.metadata?.directory_id
    const metaUserId = session.metadata?.user_id

    if (!directoryId) {
      return NextResponse.json({ error: 'Invalid verification session — no profile reference' }, { status: 400 })
    }

    // Verify the authenticated user matches the one who started the claim
    if (metaUserId && metaUserId !== userId) {
      return NextResponse.json({ error: 'User mismatch — you can only claim your own verification' }, { status: 403 })
    }

    // Transition the directory entry: unclaimed → claimed
    const { data: updated, error: updateErr } = await admin()
      .from('directory')
      .update({
        seeding_status: 'claimed',
        user_id: userId,
      })
      .eq('id', directoryId)
      .eq('seeding_status', 'unclaimed')
      .select('id, handle, display_name, profile_number')
      .single()

    if (updateErr || !updated) {
      return NextResponse.json({
        error: 'Failed to claim profile — it may have already been claimed',
      }, { status: 409 })
    }

    // Also update the profiles table entry
    await admin()
      .from('profiles')
      .update({
        seeding_status: 'claimed',
        user_id: userId,
      })
      .eq('profile_number', updated.profile_number)
      .eq('seeding_status', 'unclaimed')

    // Update profile_fields provenance: seeded → confirmed for identity fields
    await admin()
      .from('profile_fields')
      .update({
        provenance_status: 'confirmed',
        confirmed_at: new Date().toISOString(),
      })
      .eq('profile_id', directoryId)
      .eq('section', 'Identity')
      .eq('provenance_status', 'seeded')

    return NextResponse.json({
      success: true,
      step: 'claimed',
      profile: {
        id: updated.id,
        handle: updated.handle,
        display_name: updated.display_name,
        profile_number: updated.profile_number,
      },
      message: `Profile ${updated.profile_number} is now yours. You can edit your profile, set pricing, and start earning.`,
    })
  } catch (err) {
    console.error('Claim verification error:', err)
    return NextResponse.json({ error: 'Failed to verify claim' }, { status: 500 })
  }
}
