import { NextResponse } from 'next/server'
import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { renderDocumentPdf } from '@/lib/documents/pdf'
import { ProposalDocument } from '@/components/documents/render/ProposalDocument'
import { AgreementDocument } from '@/components/documents/render/AgreementDocument'
import { withProposalDefaults } from '@/lib/documents/proposal'
import { withAgreementDefaults } from '@/lib/documents/agreement'

export const runtime = 'nodejs'
export const maxDuration = 60

const safe = (s: string) => s.replace(/[^\w.\- ]/g, '').trim()

// Serve the real, server-rendered PDF (same output that gets emailed) so the
// "PDF" button downloads a clean, correctly-paginated document — instead of the
// browser printing the in-app page and dragging the nav in / clipping to one page.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  // Only for a signed-in staff session (the button lives in the admin area).
  const auth = createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const db = createAdminClient() as any
  const { data: doc } = await db.from('proposal_documents').select('*').eq('id', params.id).single()
  if (!doc) return new NextResponse('Document not found', { status: 404 })

  const isAgreement = doc.kind === 'agreement'
  const data = isAgreement ? withAgreementDefaults(doc.data) : withProposalDefaults(doc.data)

  // A signed agreement carries the client's signature.
  const signature = isAgreement && doc.signed_at && doc.signed_name
    ? { name: doc.signed_name, date: new Date(doc.signed_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Brisbane' }) }
    : null

  let pdf: Buffer
  try {
    pdf = await renderDocumentPdf(
      isAgreement
        ? React.createElement(AgreementDocument, { data: data as any, signature })
        : React.createElement(ProposalDocument, { data: data as any })
    )
  } catch (e: any) {
    return new NextResponse(`Could not generate the PDF: ${e?.message ?? 'unknown error'}`, { status: 500 })
  }

  const label = isAgreement ? 'Service Agreement' : 'Proposal'
  const ref = isAgreement ? (data as any).agreementRef : (data as any).refNumber
  const filename = `${safe(`${label} ${ref} ${(data as any).clientName}`)}.pdf`

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
