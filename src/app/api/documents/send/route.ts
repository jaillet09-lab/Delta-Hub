import { NextResponse } from 'next/server'
import React from 'react'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { renderDocumentPdf } from '@/lib/documents/pdf'
import { ProposalDocument } from '@/components/documents/render/ProposalDocument'
import { CapabilityDocument } from '@/components/documents/render/CapabilityDocument'
import { AgreementDocument } from '@/components/documents/render/AgreementDocument'
import { withProposalDefaults } from '@/lib/documents/proposal'
import { withAgreementDefaults } from '@/lib/documents/agreement'
import { DEFAULT_CAPABILITY } from '@/lib/documents/capability'
import { buildProposalEmailBody, firstNameFromAttention } from '@/lib/emails/proposal-email-body'

export const runtime = 'nodejs'
export const maxDuration = 60

const safe = (s: string) => s.replace(/[^\w.\- ]/g, '').trim()

// Render a plain-text email body (what the owner edits in the Send box) into simple,
// safe HTML: escape everything, turn URLs / emails into links, blank lines into
// paragraphs and single newlines into <br/>.
function bodyTextToHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const linkify = (s: string) => {
    // URLs (with or without scheme) in one pass so we never double-wrap.
    let out = s.replace(/(https?:\/\/[^\s<]+|www\.[^\s<]+|portal\.deltacleaning\.com\.au\/[^\s<]+)/g, (m) => {
      const href = m.startsWith('http') ? m : `https://${m}`
      const shown = m.replace(/^https?:\/\//, '')
      return `<a href="${href}" style="color:#1e3a5f;">${shown}</a>`
    })
    // Bare email addresses (won't sit inside the anchors above — those have no @).
    out = out.replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, (m) => `<a href="mailto:${m}" style="color:#1e3a5f;">${m}</a>`)
    return out
  }
  const blocks = text.replace(/\r\n/g, '\n').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)
  const inner = blocks.map((b) => `<p>${linkify(esc(b)).replace(/\n/g, '<br/>')}</p>`).join('\n')
  return `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; color: #1a1a1a; line-height: 1.65; max-width: 560px;">${inner}</div>`
}

export async function POST(req: Request) {
  const { id, toEmail, attachCapability, message } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing document id' }, { status: 400 })
  if (!toEmail) return NextResponse.json({ error: 'Enter a recipient email address.' }, { status: 400 })

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Email is not configured.' }, { status: 500 })

  const db = createAdminClient() as any
  const { data: doc } = await db.from('proposal_documents').select('*').eq('id', id).single()
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  const isAgreement = doc.kind === 'agreement'
  const data = isAgreement ? withAgreementDefaults(doc.data) : withProposalDefaults(doc.data)
  const clientName = (data as any).clientName

  // A signed agreement's PDF must carry the client's signature.
  const signature = isAgreement && doc.signed_at && doc.signed_name
    ? { name: doc.signed_name, date: new Date(doc.signed_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Brisbane' }) }
    : null

  let mainPdf: Buffer
  try {
    mainPdf = await renderDocumentPdf(
      isAgreement
        ? React.createElement(AgreementDocument, { data: data as any, signature })
        : React.createElement(ProposalDocument, { data: data as any })
    )
  } catch (e: any) {
    return NextResponse.json({ error: `Could not generate the PDF: ${e?.message ?? 'unknown error'}` }, { status: 500 })
  }

  const label = isAgreement ? 'Service Agreement' : 'Proposal'
  const ref = isAgreement ? (data as any).agreementRef : (data as any).refNumber
  const attachments: { filename: string; content: Buffer }[] = [
    { filename: `${safe(`${label} ${ref} ${clientName}`)}.pdf`, content: mainPdf },
  ]

  if (!isAgreement && attachCapability) {
    try {
      const capPdf = await renderDocumentPdf(React.createElement(CapabilityDocument, { data: DEFAULT_CAPABILITY }))
      attachments.push({ filename: 'Delta Cleaning Capability Statement.pdf', content: capPdf })
    } catch { /* optional */ }
  }

  // The email body: use exactly what the owner edited in the Send box if they sent
  // one, otherwise fall back to the standard default. Either way it's plain text
  // that we render to simple HTML below (escaping, auto-linking, paragraphs).
  const bodyText = (message && String(message).trim())
    ? String(message)
    : buildProposalEmailBody({
        firstName: firstNameFromAttention((data as any).attention),
        clientName,
        isAgreement,
        attachCapability: !isAgreement && !!attachCapability,
      })

  const html = bodyTextToHtml(bodyText)

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)
    const res = await resend.emails.send({
      from: 'Delta Cleaning <hello@deltacleaning.com.au>',
      reply_to: 'hello@deltacleaning.com.au',
      to: toEmail,
      subject: isAgreement ? `Service agreement for ${clientName}` : `Cleaning proposal for ${clientName}`,
      html,
      attachments,
    })
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Email failed to send' }, { status: 500 })
  }

  const newStatus = isAgreement ? 'out_for_signature' : 'sent'
  await db.from('proposal_documents').update({ status: newStatus, sent_at: new Date().toISOString() }).eq('id', id)
  await db.from('proposal_document_versions').insert({ document_id: id, data, label: `Sent to ${toEmail}` })

  revalidatePath('/documents')
  revalidatePath(`/documents/${id}`)
  return NextResponse.json({ success: true })
}
