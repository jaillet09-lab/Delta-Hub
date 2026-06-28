import { NextResponse } from 'next/server'
import React from 'react'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { renderDocumentPdf } from '@/lib/documents/pdf'
import { AgreementDocument } from '@/components/documents/render/AgreementDocument'
import { withAgreementDefaults } from '@/lib/documents/agreement'
import { isDocusignConfigured, createAgreementEnvelope, consentUrl } from '@/lib/documents/docusign'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  const { id, toEmail } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing document id' }, { status: 400 })
  if (!toEmail) return NextResponse.json({ error: 'Enter the client email address.' }, { status: 400 })

  // Not configured yet → tell the client to use the email fallback
  if (!isDocusignConfigured()) {
    return NextResponse.json({ configured: false })
  }

  const db = createAdminClient() as any
  const { data: doc } = await db.from('proposal_documents').select('*').eq('id', id).single()
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  const data = withAgreementDefaults(doc.data)

  let pdf: Buffer
  try {
    pdf = await renderDocumentPdf(React.createElement(AgreementDocument, { data }))
  } catch (e: any) {
    return NextResponse.json({ error: `Could not generate the agreement PDF: ${e?.message ?? 'unknown error'}` }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://portal.deltacleaning.com.au'
  const result = await createAgreementEnvelope({
    pdfBase64: pdf.toString('base64'),
    subject: `Service Agreement — ${data.clientName}`,
    clientEmail: toEmail,
    clientName: data.clientName,
    providerEmail: data.contactEmail,
    providerName: data.contactName,
    webhookUrl: `${appUrl}/api/docusign/webhook`,
  })

  if (result.consentRequired) {
    return NextResponse.json({ consentRequired: true, consentUrl: consentUrl() })
  }
  if (result.error || !result.envelopeId) {
    return NextResponse.json({ error: result.error || 'DocuSign envelope failed.' }, { status: 500 })
  }

  await db.from('proposal_documents').update({
    status: 'out_for_signature',
    docusign_envelope_id: result.envelopeId,
    sent_at: new Date().toISOString(),
  }).eq('id', id)
  await db.from('proposal_document_versions').insert({ document_id: id, data, label: `Sent for signature to ${toEmail}` })

  revalidatePath('/documents')
  revalidatePath(`/documents/${id}`)
  return NextResponse.json({ success: true, mode: 'docusign' })
}
