import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ═══════════════════════════════════════════════════
// POST /api/activate/publish
// Validates JSON-LD structure, creates an unclaimed
// directory stub in Supabase, returns profile number
// ═══════════════════════════════════════════════════

interface PublishRequest {
  profileJson: Record<string, unknown>
  fullName: string
  handle: string
}

function validateJsonLd(profile: Record<string, unknown>): string | null {
  if (!profile['@context']) return 'Missing @context'
  if (!profile['@type']) return 'Missing @type'
  if (!profile.identity) return 'Missing identity block'
  const identity = profile.identity as Record<string, unknown>
  if (!identity.displayName) return 'Missing identity.displayName'
  if (!profile.accessPolicy) return 'Missing accessPolicy'
  return null
}

async function getNextProfileNumber(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  // Get the highest existing profile number
  const { data } = await supabase
    .from('directory')
    .select('profile_number')
    .order('profile_number', { ascending: false })
    .limit(1)

  if (data && data.length > 0) {
    const last = data[0].profile_number as string
    const num = parseInt(last.replace('SS-', ''), 10)
    return `SS-${String(num + 1).padStart(6, '0')}`
  }
  return 'SS-000001'
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PublishRequest
    const { profileJson, fullName, handle } = body

    if (!profileJson || !fullName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate JSON-LD structure
    const validationError = validateJsonLd(profileJson)
    if (validationError) {
      return NextResponse.json({ error: `Invalid JSON-LD: ${validationError}` }, { status: 400 })
    }

    const supabase = await createClient()

    // Generate sequential profile number
    const profileNumber = await getNextProfileNumber(supabase)

    // Extract metadata for directory entry
    const identity = profileJson.identity as Record<string, unknown>
    const accessPolicy = profileJson.accessPolicy as Record<string, unknown>
    const tiers = (accessPolicy?.tiers || {}) as Record<string, unknown>
    const meta = (profileJson._meta || {}) as Record<string, unknown>

    // Extract interest/skill tags for directory indexing
    const skills = (profileJson.skills || []) as Array<Record<string, unknown>>
    const interests = (profileJson.interests || {}) as Record<string, unknown>
    const skillTags = skills.map(s => String(s.name || '')).filter(Boolean)
    const interestTags = [
      ...((interests.athletic || []) as Array<Record<string, unknown>>).map(i => String(i.name || '')),
      ...((interests.social || []) as Array<Record<string, unknown>>).map(i => String(i.name || '')),
      ...((interests.intellectual || []) as Array<Record<string, unknown>>).map(i => String(i.name || '')),
    ].filter(Boolean)

    const handleValue = handle || (identity.handle as string) || `@${fullName.toLowerCase().replace(/\s+/g, '.')}`

    // Create unclaimed directory stub
    const { data, error } = await supabase
      .from('directory')
      .insert({
        profile_number: profileNumber,
        handle: handleValue,
        display_name: fullName,
        endpoint_url: '', // Empty until self-hosted
        domain: '',       // Empty until domain verification
        domain_verified: false,
        location: (identity.location as string) || null,
        age_cohort: null,
        trust_score: meta.provenanceBreakdown
          ? Math.min(30, (
              ((meta.provenanceBreakdown as Record<string, number>).confirmed || 0) * 2 +
              ((meta.provenanceBreakdown as Record<string, number>).corrected || 0) * 3 +
              (((profileJson.media as unknown[])?.length || 0) > 0 ? 5 : 0)
            ))
          : 0,
        presence_score: null,
        interest_tags: interestTags,
        skills_tags: skillTags,
        status: 'active',
        seeding_status: 'unclaimed',
      })
      .select()

    if (error) {
      console.error('Supabase insert error:', error)
      // If it's a unique constraint violation on handle, suggest a variation
      if (error.code === '23505') {
        return NextResponse.json({
          error: 'Handle already taken. Please choose a different handle.',
          details: error.message,
        }, { status: 409 })
      }
      return NextResponse.json({ error: 'Failed to create directory entry', details: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      profileNumber,
      handle: handleValue,
      status: 'active',
      seedingStatus: 'unclaimed',
      message: `Profile ${profileNumber} registered. Host your profile.json at your domain and verify to claim it.`,
      directoryEntry: data?.[0] || null,
    })

  } catch (err) {
    console.error('Publish error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
