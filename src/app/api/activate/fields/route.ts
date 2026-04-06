import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ═══════════════════════════════════════════════════
// GET/POST/PATCH /api/activate/fields
// CRUD for profile fields with provenance tracking
// ═══════════════════════════════════════════════════

// Confidence scores by source — matches the DB function source_confidence()
function getConfidenceScore(sourceName: string): number {
  const s = sourceName.toLowerCase()
  if (s.includes('github')) return 0.9
  if (s.includes('scholar')) return 0.85
  if (s.includes('calbar') || s.includes('nysed') || s.includes('aicpa') || s.includes('npi')) return 0.8
  if (s.includes('linkedin')) return 0.7
  if (s.includes('athlinks') || s.includes('runsignup')) return 0.75
  if (s.includes('meetup')) return 0.65
  if (s === 'user-input') return 0.5
  return 0.6
}

// ═══ GET — Load all fields for a profile ═══

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const profileId = searchParams.get('profileId')

    if (!profileId) {
      return NextResponse.json({ error: 'profileId is required' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('profile_fields')
      .select('*')
      .eq('profile_id', profileId)
      .neq('provenance_status', 'removed')
      .order('section')
      .order('sort_order')
      .order('created_at')

    if (error) {
      console.error('Load fields error:', error)
      return NextResponse.json({ error: 'Failed to load fields' }, { status: 500 })
    }

    return NextResponse.json({ fields: data || [] })
  } catch (err) {
    console.error('GET fields error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ═══ POST — Bulk save discovered fields ═══

interface SaveFieldInput {
  profileId: string
  fields: Array<{
    section: string
    label: string
    value: string
    sourceName: string
    sourceUrl: string
    provenanceStatus?: string
    seededAt?: string
  }>
}

export async function POST(request: NextRequest) {
  try {
    const body: SaveFieldInput = await request.json()
    const { profileId, fields } = body

    if (!profileId || !fields || fields.length === 0) {
      return NextResponse.json({ error: 'profileId and fields are required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Build rows with computed confidence scores
    const now = new Date().toISOString()
    const rows = fields.map((f, i) => ({
      profile_id: profileId,
      section: f.section,
      label: f.label,
      value: f.value,
      provenance_status: f.provenanceStatus || 'seeded',
      source_url: f.sourceUrl || null,
      source_name: f.sourceName || null,
      seeded_at: f.seededAt || now,
      confidence_score: getConfidenceScore(f.sourceName || ''),
      sort_order: i,
    }))

    const { data, error } = await supabase
      .from('profile_fields')
      .insert(rows)
      .select()

    if (error) {
      console.error('Save fields error:', error)
      return NextResponse.json({ error: 'Failed to save fields', details: error.message }, { status: 500 })
    }

    return NextResponse.json({ saved: data?.length || 0, fields: data })
  } catch (err) {
    console.error('POST fields error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ═══ PATCH — Update individual field provenance ═══

interface UpdateFieldInput {
  fieldId: string
  action: 'confirm' | 'correct' | 'remove' | 'self_report'
  correctedValue?: string
}

export async function PATCH(request: NextRequest) {
  try {
    const body: UpdateFieldInput = await request.json()
    const { fieldId, action, correctedValue } = body

    if (!fieldId || !action) {
      return NextResponse.json({ error: 'fieldId and action are required' }, { status: 400 })
    }

    const supabase = await createClient()
    const now = new Date().toISOString()

    // First, get the current field to log original value on correction
    const { data: existing, error: fetchError } = await supabase
      .from('profile_fields')
      .select('*')
      .eq('id', fieldId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Field not found' }, { status: 404 })
    }

    let updateData: Record<string, unknown> = {}

    switch (action) {
      case 'confirm':
        updateData = {
          provenance_status: 'confirmed',
          confirmed_at: now,
        }
        break

      case 'correct':
        if (!correctedValue) {
          return NextResponse.json({ error: 'correctedValue is required for corrections' }, { status: 400 })
        }
        updateData = {
          provenance_status: 'corrected',
          original_value: existing.value,  // Log what the system found
          value: correctedValue,           // Replace with user's correction
          corrected_at: now,
        }
        break

      case 'remove':
        updateData = {
          provenance_status: 'removed',
        }
        break

      case 'self_report':
        // This is for adding new fields — should already be inserted via POST
        // But if called on an existing field, mark it as self-reported
        updateData = {
          provenance_status: 'self_reported',
          source_name: 'self-reported',
          confidence_score: 0.5,
        }
        break

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('profile_fields')
      .update(updateData)
      .eq('id', fieldId)
      .select()

    if (error) {
      console.error('Update field error:', error)
      return NextResponse.json({ error: 'Failed to update field', details: error.message }, { status: 500 })
    }

    return NextResponse.json({ updated: data?.[0] || null })
  } catch (err) {
    console.error('PATCH fields error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
