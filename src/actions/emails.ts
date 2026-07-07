'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { generateProposalPDF, type ProposalData } from '@/lib/generate-proposal-pdf'

export async function sendEmailAction(data: {
  client_id: string | null
  to_email: string
  to_name: string
  subject: string
  body: string
  template_id: string | null
  document_id?: string | null
}) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { error: 'RESEND_API_KEY not configured' }

  const resend = new Resend(apiKey)
  const supabase = createClient()

  // Build clean plain-style HTML email (looks like a real email, not a marketing template)
  const htmlBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">

    <!-- Body -->
    <div style="font-size:15px;color:#1a1a1a;line-height:1.7;">
      ${data.body
        .split('\n')
        .map(line =>
          line.trim() === ''
            ? '<div style="height:8px;"></div>'
            : `<p style="margin:0 0 14px 0;font-size:15px;color:#1a1a1a;line-height:1.7;font-family:Arial,sans-serif;">${line}</p>`
        )
        .join('')}
    </div>

    <!-- Signature -->
    <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb;">
      <p style="margin:0 0 2px;font-size:14px;color:#1a1a1a;font-family:Arial,sans-serif;">Best regards,</p>
      <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#1a1a1a;font-family:Arial,sans-serif;">Jackson Jaillet</p>
      <p style="margin:0 0 1px;font-size:13px;color:#555555;font-family:Arial,sans-serif;">Founder &amp; Director, Delta Cleaning</p>
      <p style="margin:0 0 1px;font-size:13px;color:#555555;font-family:Arial,sans-serif;">0412 844 238</p>
      <a href="https://www.deltacleaning.com.au" style="font-size:13px;color:#1a56db;text-decoration:none;font-family:Arial,sans-serif;">deltacleaning.com.au</a>
    </div>

  </div>
</body>
</html>`

  // Generate PDF attachment if document_id provided
  let attachments: { filename: string; content: string }[] = []

  if (data.document_id) {
    const db = supabase as any
    const { data: docData, error: docError } = await db
      .from('documents')
      .select('*')
      .eq('id', data.document_id)
      .single()

    if (docError) return { error: `Could not load document: ${docError.message}` }

    if (docData?.content?.type === 'proposal_v2') {
      try {
        const pdfBuffer = await generateProposalPDF(docData.content as ProposalData)
        const refNum = (docData.content as ProposalData).refNumber || docData.ref_number || 'proposal'
        attachments = [{
          filename: `Delta-Cleaning-Proposal-${refNum}.pdf`,
          content: pdfBuffer.toString('base64'),
        }]
      } catch (err: any) {
        return { error: `PDF generation failed: ${err?.message || String(err)}` }
      }
    }
  }

  const sendParams: any = {
    from: 'Jackson Jaillet <hello@deltacleaning.com.au>',
    to: data.to_email,
    reply_to: 'hello@deltacleaning.com.au',
    bcc: 'hello@deltacleaning.com.au',
    subject: data.subject,
    html: htmlBody,
  }

  if (attachments.length > 0) {
    sendParams.attachments = attachments
  }

  const { error } = await resend.emails.send(sendParams)

  if (error) return { error: (error as any).message || 'Failed to send' }

  // Log to emails_sent
  const db = supabase as any
  await db.from('emails_sent').insert({
    client_id: data.client_id || null,
    template_id: data.template_id || null,
    to_email: data.to_email,
    to_name: data.to_name || null,
    subject: data.subject,
    body: data.body,
  })

  return { success: true }
}

export async function saveTemplateAction(data: {
  id?: string
  name: string
  type: string
  subject: string
  body: string
}) {
  const supabase = createClient()
  const db = supabase as any

  if (data.id) {
    const { error } = await db.from('email_templates').update({
      name: data.name, type: data.type, subject: data.subject, body: data.body,
      updated_at: new Date().toISOString(),
    }).eq('id', data.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await db.from('email_templates').insert({
      name: data.name, type: data.type, subject: data.subject, body: data.body,
    })
    if (error) return { error: error.message }
  }
  return { success: true }
}
