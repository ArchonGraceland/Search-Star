import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
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

  const { data, error } = await supabase
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
