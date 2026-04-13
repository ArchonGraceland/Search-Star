import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getResend } from '@/lib/resend'

// GET — fetch public commitment data for the sponsor page (no auth)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const commitment_id = searchParams.get('commitment_id')

  if (!commitment_id) {
    return NextResponse.json({ error: 'commitment_id is required' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: commitment, error } = await supabase
    .from('commitments')
    .select(`
      id, title, status, launch_ends_at,
      practices (name)
    `)
    .eq('id', commitment_id)
    .single()

  if (error || !commitment) {
    return NextResponse.json({ error: 'Commitment not found.' }, { status: 404 })
  }

  // Get practitioner name
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, user_id')
    .eq('user_id', (await supabase.from('commitments').select('user_id').eq('id', commitment_id).single()).data?.user_id ?? '')
    .single()

  // Get pledge stats
  const { data: pledges } = await supabase
    .from('sponsorships')
    .select('pledge_amount')
    .eq('commitment_id', commitment_id)
    .in('status', ['pledged', 'paid'])

  const total_pledged = (pledges ?? []).reduce((sum, p) => sum + (p.pledge_amount ?? 0), 0)
  const pledge_count = (pledges ?? []).length

  const practice = commitment.practices as { name: string } | { name: string }[] | null
  const practice_name = practice
    ? (Array.isArray(practice) ? practice[0]?.name : practice.name) ?? null
    : null

  return NextResponse.json({
    commitment_id: commitment.id,
    title: commitment.title,
    status: commitment.status,
    launch_ends_at: commitment.launch_ends_at,
    practitioner_name: profile?.display_name ?? 'the practitioner',
    practice_name,
    total_pledged,
    pledge_count,
  })
}

// POST — record a sponsorship pledge (no auth required)
export async function POST(request: Request) {
  const body = await request.json()
  const { commitment_id, sponsor_email, sponsor_name, pledge_amount, message } = body

  if (!commitment_id || !sponsor_email || !sponsor_name || !pledge_amount) {
    return NextResponse.json({ error: 'commitment_id, sponsor_email, sponsor_name, and pledge_amount are required.' }, { status: 400 })
  }

  if (typeof pledge_amount !== 'number' || pledge_amount < 5) {
    return NextResponse.json({ error: 'Minimum pledge amount is $5.' }, { status: 400 })
  }

  if (!sponsor_email.includes('@')) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 })
  }

  const supabase = await createClient()

  // Fetch commitment and verify launch status
  const { data: commitment, error: commError } = await supabase
    .from('commitments')
    .select('id, title, status, user_id')
    .eq('id', commitment_id)
    .single()

  if (commError || !commitment) {
    return NextResponse.json({ error: 'Commitment not found.' }, { status: 404 })
  }

  if (commitment.status !== 'launch') {
    return NextResponse.json({ error: 'The sponsorship window for this commitment is closed.' }, { status: 409 })
  }

  // Get practitioner profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('user_id', commitment.user_id)
    .single()

  const practitionerName = profile?.display_name ?? 'the practitioner'

  // Insert sponsorship
  const { data: sponsorship, error: insertError } = await supabase
    .from('sponsorships')
    .insert({
      commitment_id,
      sponsor_email: sponsor_email.trim().toLowerCase(),
      sponsor_name: sponsor_name.trim(),
      sponsor_type: 'personal',
      pledge_amount,
      status: 'pledged',
      pledged_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (insertError || !sponsorship) {
    console.error('Error inserting sponsorship:', insertError)
    return NextResponse.json({ error: 'Failed to record pledge.' }, { status: 500 })
  }

  // Get practitioner email for notification
  const { data: authUser } = await supabase.auth.admin.getUserById(commitment.user_id)
  const practitionerEmail = authUser?.user?.email

  // Send confirmation email to sponsor
  try {
    await getResend().emails.send({
      from: 'noreply@searchstar.com',
      to: sponsor_email.trim().toLowerCase(),
      subject: `Your pledge to support ${practitionerName} has been recorded`,
      html: `
        <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
          <div style="background: #1a3a6b; padding: 20px 24px; margin-bottom: 32px;">
            <span style="font-family: Georgia, serif; font-size: 20px; font-weight: 700; color: #ffffff;">Search Star</span>
          </div>
          <div style="padding: 0 24px 32px;">
            <h2 style="font-family: Georgia, serif; font-size: 24px; font-weight: 700; color: #1a1a1a; margin: 0 0 16px;">
              Your pledge has been recorded
            </h2>
            <p style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #3a3a3a; margin: 0 0 12px;">
              Thank you for supporting <strong>${practitionerName}</strong> on their commitment:
            </p>
            <div style="background: #f5f5f5; border-left: 3px solid #1a3a6b; padding: 16px 20px; margin: 0 0 24px; border-radius: 2px;">
              <p style="font-family: Georgia, serif; font-size: 18px; font-weight: 700; margin: 0 0 8px; color: #1a1a1a;">${commitment.title}</p>
              <p style="font-family: Arial, sans-serif; font-size: 15px; color: #1a3a6b; font-weight: 700; margin: 0;">
                Pledge amount: $${pledge_amount.toFixed(2)}
              </p>
            </div>
            <p style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #767676; margin: 0;">
              Your pledge is recorded now. Funds are collected when ${practitionerName} completes their 90-day commitment. If they don't complete it, no payment is collected.
            </p>
          </div>
        </div>
      `,
      text: `Your pledge of $${pledge_amount.toFixed(2)} to support ${practitionerName}'s commitment "${commitment.title}" has been recorded. Funds are collected when they complete their 90-day commitment.`,
    })
  } catch (err) {
    console.error('Failed to send sponsor confirmation email:', err)
  }

  // Send notification to practitioner
  if (practitionerEmail) {
    try {
      await getResend().emails.send({
        from: 'noreply@searchstar.com',
        to: practitionerEmail,
        subject: `${sponsor_name} pledged $${pledge_amount.toFixed(2)} to your commitment`,
        html: `
          <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
            <div style="background: #1a3a6b; padding: 20px 24px; margin-bottom: 32px;">
              <span style="font-family: Georgia, serif; font-size: 20px; font-weight: 700; color: #ffffff;">Search Star</span>
            </div>
            <div style="padding: 0 24px 32px;">
              <h2 style="font-family: Georgia, serif; font-size: 24px; font-weight: 700; color: #1a1a1a; margin: 0 0 16px;">
                New sponsor pledge 🎉
              </h2>
              <p style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #3a3a3a; margin: 0 0 12px;">
                <strong>${sponsor_name}</strong> has pledged <strong>$${pledge_amount.toFixed(2)}</strong> to your commitment:
              </p>
              <div style="background: #f5f5f5; border-left: 3px solid #2d6a2d; padding: 16px 20px; margin: 0 0 24px; border-radius: 2px;">
                <p style="font-family: Georgia, serif; font-size: 18px; font-weight: 700; margin: 0 0 8px; color: #1a1a1a;">${commitment.title}</p>
                ${message ? `<p style="font-family: Arial, sans-serif; font-size: 14px; color: #3a3a3a; margin: 0; font-style: italic;">"${message}"</p>` : ''}
              </div>
              <a href="https://searchstar.com/commit/${commitment_id}/sponsors" style="display: inline-block; background: #1a3a6b; color: #ffffff; font-family: Arial, sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 12px 24px; border-radius: 3px; text-decoration: none;">
                View all sponsors →
              </a>
            </div>
          </div>
        `,
        text: `${sponsor_name} pledged $${pledge_amount.toFixed(2)} to your commitment "${commitment.title}". View sponsors: https://searchstar.com/commit/${commitment_id}/sponsors`,
      })
    } catch (err) {
      console.error('Failed to send practitioner notification email:', err)
    }
  }

  return NextResponse.json({ id: sponsorship.id })
}
