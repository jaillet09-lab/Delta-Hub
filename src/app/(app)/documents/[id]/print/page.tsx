export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { withProposalDefaults } from '@/lib/documents/proposal'
import { withAgreementDefaults } from '@/lib/documents/agreement'
import { PrintProposal } from '@/components/documents/PrintProposal'
import type { SignatureFill } from '@/components/documents/render/AgreementDocument'

function auDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Brisbane',
  })
}

export default async function PrintDocumentPage({ params }: { params: { id: string } }) {
  const db = createAdminClient() as any
  const { data: doc } = await db
    .from('proposal_documents')
    .select('id, kind, data, signed_name, signed_at')
    .eq('id', params.id).single()
  if (!doc) notFound()
  const data = doc.kind === 'agreement' ? withAgreementDefaults(doc.data) : withProposalDefaults(doc.data)
  // Show the client's signature on a signed agreement (this is the copy opened from the profile).
  const signature: SignatureFill | null =
    doc.kind === 'agreement' && doc.signed_at && doc.signed_name
      ? { name: doc.signed_name, date: auDate(doc.signed_at) }
      : null
  return <PrintProposal kind={doc.kind} data={data} signature={signature} />
}
