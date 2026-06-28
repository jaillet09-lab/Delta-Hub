export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { withProposalDefaults } from '@/lib/documents/proposal'
import { withAgreementDefaults } from '@/lib/documents/agreement'
import { PrintProposal } from '@/components/documents/PrintProposal'

export default async function PrintDocumentPage({ params }: { params: { id: string } }) {
  const db = createAdminClient() as any
  const { data: doc } = await db.from('proposal_documents').select('id, kind, data').eq('id', params.id).single()
  if (!doc) notFound()
  const data = doc.kind === 'agreement' ? withAgreementDefaults(doc.data) : withProposalDefaults(doc.data)
  return <PrintProposal kind={doc.kind} data={data} />
}
