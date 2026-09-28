import { NextResponse } from 'next/server'
import React from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { renderDocumentPdf } from '@/lib/documents/pdf'
import { SubcontractorAgreementDocument, InductionDocument } from '@/components/documents/render/SwmsDocument'

export const runtime = 'nodejs'
export const maxDuration = 60

const safe = (s: string) => s.replace(/[^\w.\- ]/g, '').trim()
function auDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Brisbane' })
}

// The signed subcontractor pack (Agreement + Induction) as a clean PDF. Keyed by
// the secret sign_code — the same access model as the /onboard/<code> page, so a
// subbie who just signed (no login) and the owner can both download it.
export async function GET(_req: Request, { params }: { params: { code: string } }) {
  const db = createAdminClient() as any
  const { data: sub } = await db
    .from('subcontractors')
    .select('company_name, signed_name, signed_at')
    .eq('sign_code', params.code)
    .maybeSingle()

  if (!sub) return new NextResponse('Not found', { status: 404 })
  if (!sub.signed_at || !sub.signed_name) return new NextResponse('This pack has not been signed yet.', { status: 400 })

  const signature = { name: sub.signed_name, date: auDate(sub.signed_at), company: sub.company_name ?? undefined }

  let pdf: Buffer
  try {
    pdf = await renderDocumentPdf(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(SubcontractorAgreementDocument, { signature }),
        React.createElement(InductionDocument, { signature }),
      ),
    )
  } catch (e: any) {
    return new NextResponse(`Could not generate the PDF: ${e?.message ?? 'unknown error'}`, { status: 500 })
  }

  const filename = `${safe(`Subcontractor Pack ${sub.company_name || ''} signed`)}.pdf`
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
