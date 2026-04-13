import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // My mentor (I am the mentee)
  const { data: mentorRel } = await supabase
    .from('mentor_relationships')
    .select('id, mentor_user_id, started_at')
    .eq('mentee_user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  let my_mentor = null
  if (mentorRel) {
    const { data: mentorProfile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', mentorRel.mentor_user_id)
      .single()

    my_mentor = {
      id: mentorRel.id,
      mentor_user_id: mentorRel.mentor_user_id,
      display_name: mentorProfile?.display_name ?? null,
      started_at: mentorRel.started_at,
    }
  }

  // My mentees (I am the mentor)
  const { data: menteeRels } = await supabase
    .from('mentor_relationships')
    .select('id, mentee_user_id, started_at, status')
    .eq('mentor_user_id', user.id)
    .eq('status', 'active')

  const my_mentees = []
  for (const rel of menteeRels ?? []) {
    const { data: menteeProfile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', rel.mentee_user_id)
      .single()

    my_mentees.push({
      id: rel.id,
      mentee_user_id: rel.mentee_user_id,
      display_name: menteeProfile?.display_name ?? null,
      started_at: rel.started_at,
      status: rel.status,
    })
  }

  return NextResponse.json({ my_mentor, my_mentees })
}
