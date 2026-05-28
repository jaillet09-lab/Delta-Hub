'use server'

import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

export async function sendSurveyEmailAction(clientId: string): Promise<{ success?: boolean; error?: string; tokenId?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { error: 'RESEND_API_KEY not configured' }

  const supabase = createClient()
  const db = supabase as any

  // Load client
  const { data: client, error: clientError } = await db
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single()

  if (clientError || !client) return { error: 'Client not found' }
  if (!client.contact_email) return { error: 'Client has no email address. Add one on the edit page.' }

  // Create survey token
  const { data: tokenRow, error: tokenError } = await db
    .from('survey_tokens')
    .insert({ client_id: clientId })
    .select('token, id')
    .single()

  if (tokenError) return { error: `Failed to create survey token: ${tokenError.message}` }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://delta-operations-hub.vercel.app')
  const surveyUrl = `${baseUrl}/survey/${tokenRow.token}`
  const contactName = (client.contact_name || '').split(' ')[0] || 'there'

  const htmlBody = `<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;font-size:15px;color:#1a1a1a;line-height:1.6;background:#fff;">
<div style="max-width:540px;padding:40px 24px;">
<p>Hi ${contactName},</p>
<p>Hope you're well. I just wanted to personally check in and ask how you feel we've been going at ${client.business_name}.</p>
<p>I put together a short 1-minute survey — your honest feedback really means a lot and helps us keep improving.</p>
<p><a href="${surveyUrl}" style="color:#1a1a1a;">Click here to complete the survey</a></p>
<p>Thanks so much for your time.</p>
<p style="margin-top:24px;">Jackson Jaillet<br>
<span style="color:#555;font-size:14px;">Founder &amp; Director, Delta Cleaning</span><br>
<span style="color:#555;font-size:14px;">0412 844 237</span><br>
<a href="https://www.deltacleaning.com.au" style="color:#555;font-size:14px;text-decoration:none;">deltacleaning.com.au</a></p>
</div>
</body></html>`

  const resend = new Resend(apiKey)
  const { error: sendError } = await resend.emails.send({
    from: 'Jackson Jaillet <hello@deltacleaning.com.au>',
    to: client.contact_email,
    reply_to: 'hello@deltacleaning.com.au',
    bcc: 'hello@deltacleaning.com.au',
    subject: `How are we going at ${client.business_name}?`,
    html: htmlBody,
  })

  if (sendError) {
    // Clean up the token if send failed
    await db.from('survey_tokens').delete().eq('id', tokenRow.id)
    return { error: (sendError as any).message || 'Failed to send survey email' }
  }

  return { success: true, tokenId: tokenRow.id }
}

export async function submitSurveyAction(data: {
  token: string
  qualityScore: number
  reliabilityScore: number
  communicationScore: number
  valueScore: number
  loyaltyScore: number
  comments?: string
}): Promise<{ success?: boolean; error?: string }> {
  // Use plain supabase-js (no SSR/cookie complexity) with anon key for public form
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const db = supabase as any

  // Call SECURITY DEFINER function — bypasses RLS, handles token + insert atomically
  const { data: result, error: rpcError } = await db.rpc('submit_survey', {
    p_token: data.token,
    p_quality: data.qualityScore,
    p_reliability: data.reliabilityScore,
    p_communication: data.communicationScore,
    p_value: data.valueScore,
    p_loyalty: data.loyaltyScore,
    p_comments: data.comments || null,
  })

  if (rpcError) return { error: `Failed to save survey: ${rpcError.message}` }
  if (result?.error) return { error: result.error }

  // Send notification email to Delta Cleaning with results
  try {
    const { data: tokenRow } = await db
      .from('survey_tokens')
      .select('clients(business_name, contact_name)')
      .eq('token', data.token)
      .single()

    const businessName = tokenRow?.clients?.business_name || 'Unknown Client'
    const contactName  = tokenRow?.clients?.contact_name  || ''

    const avg = ((data.qualityScore + data.reliabilityScore + data.communicationScore + data.valueScore + data.loyaltyScore) / 5).toFixed(1)

    function scoreLabel(n: number) {
      return n >= 8 ? '🟢' : n >= 6 ? '🟡' : '🔴'
    }

    const apiKey = process.env.RESEND_API_KEY
    if (apiKey) {
      const { Resend } = await import('resend')
      const resend = new Resend(apiKey)
      await resend.emails.send({
        from: 'Delta Hub <hello@deltacleaning.com.au>',
        to: 'hello@deltacleaning.com.au',
        subject: `New survey from ${businessName} — ${avg}/10 avg`,
        text: [
          `Survey submitted by ${contactName || businessName}`,
          `Client: ${businessName}`,
          ``,
          `${scoreLabel(data.qualityScore)} Quality:        ${data.qualityScore}/10`,
          `${scoreLabel(data.reliabilityScore)} Reliability:    ${data.reliabilityScore}/10`,
          `${scoreLabel(data.communicationScore)} Communication:  ${data.communicationScore}/10`,
          `${scoreLabel(data.valueScore)} Value:          ${data.valueScore}/10`,
          `${scoreLabel(data.loyaltyScore)} Loyalty:        ${data.loyaltyScore}/10`,
          ``,
          `Average: ${avg}/10`,
          ``,
          data.comments ? `Comments:\n${data.comments}` : 'No comments left.',
          ``,
          `View in Delta Hub: https://portal.deltacleaning.com.au/surveys`,
        ].join('\n'),
      })
    }
  } catch (_) {
    // Notification failure should never block the client's submission
  }

  return { success: true }
}
