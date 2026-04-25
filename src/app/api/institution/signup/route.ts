import { createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { isInstitutionalPortalEnabled } from '@/lib/feature-flags'

// Institution signup route.
//
// Pass 5 §2 (F24 pattern, applied to institutional surface): the route
// is unauthenticated by design — anyone behind the
// `INSTITUTIONAL_PORTAL_ENABLED` feature flag can create an institution
// (Phase 9 product decision, not a Pass 5 question). The migration
// here is purely about the client choice on the INSERT: previously it
// ran through the SSR cookie-bound client, which is exactly the
// `@supabase/ssr` JWT-propagation pattern that silently no-ops when
// RLS rejects the unauthenticated session. F24 (Pass 4 §3) settled
// the pattern at /api/profiles and /api/profiles/visibility; this is
// the same shape, applied to the institutional surface.
//
// No auth gate added. No semantics change. The only difference is
// that the INSERT now lands instead of silently no-opping.

export async function POST(request: Request) {
  if (!isInstitutionalPortalEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await request.json()
  const { name, type, contact_name, contact_email, skill_category_id } = body

  if (!name || !type || !contact_email) {
    return NextResponse.json(
      { error: 'name, type, and contact_email are required.' },
      { status: 400 }
    )
  }

  const validTypes = ['employer', 'university', 'trade_program', 'foundation', 'civic', 'brand']
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: 'Invalid institution type.' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from('institutions')
    .insert({
      name,
      type,
      contact_name: contact_name ?? null,
      contact_email,
      skill_category_id: skill_category_id ?? null,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'An institution with that contact email already exists.' },
        { status: 409 }
      )
    }
    console.error('institution signup error:', error)
    return NextResponse.json({ error: 'Failed to create institution.' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id })
}
