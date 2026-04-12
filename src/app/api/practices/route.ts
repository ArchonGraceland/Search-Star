import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { name, label, category_id } = body

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'Practice name is required.' }, { status: 400 })
  }

  const validLabels = ['skill', 'craft', 'pursuit']
  if (!label || !validLabels.includes(label)) {
    return NextResponse.json({ error: 'Invalid label. Must be skill, craft, or pursuit.' }, { status: 400 })
  }

  if (!category_id) {
    return NextResponse.json({ error: 'Category is required.' }, { status: 400 })
  }

  // Verify category exists
  const { data: category } = await supabase
    .from('skill_categories')
    .select('id')
    .eq('id', category_id)
    .single()

  if (!category) {
    return NextResponse.json({ error: 'Invalid category.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('practices')
    .insert({
      user_id: user.id,
      name: name.trim(),
      label,
      category_id,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating practice:', error)
    return NextResponse.json({ error: 'Failed to create practice.' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id })
}
