export const dynamic = 'force-dynamic'
export const revalidate = 0

import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { ProposalEditor } from '@/components/documents/ProposalEditor'
import { withProposalDefaults } from '@/lib/documents/proposal'

export default async function DocumentEditorPage({ params }: { params: { id: string } }) {
  const db = createAdminClient() as any
  const { data: doc } = await db.from('proposal_documents').select('*').eq('id', params.id).single()
  if (!doc) notFound()

  // Proposal editor for now; agreement/one-off editors arrive in later phases.
  return <ProposalEditor id={doc.id} status={doc.status} initialData={withProposalDefaults(doc.data)} />
}
