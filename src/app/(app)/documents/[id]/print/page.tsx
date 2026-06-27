export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { withProposalDefaults } from '@/lib/documents/proposal'
import { PrintProposal } from '@/components/documents/PrintProposal'

export default async function PrintProposalPage({ params }: { params: { id: string } }) {
  const db = createAdminClient() as any
  const { data: doc } = await db.from('proposal_documents').select('id, data').eq('id', params.id).single()
  if (!doc) notFound()
  return <PrintProposal data={withProposalDefaults(doc.data)} />
}
