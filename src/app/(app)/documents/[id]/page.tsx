export const dynamic = 'force-dynamic'
export const revalidate = 0

import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { ProposalEditor } from '@/components/documents/ProposalEditor'
import { AgreementEditor } from '@/components/documents/AgreementEditor'
import { withProposalDefaults } from '@/lib/documents/proposal'
import { withAgreementDefaults } from '@/lib/documents/agreement'
import { ensureSignCode } from '@/actions/signing'

export default async function DocumentEditorPage({ params }: { params: { id: string } }) {
  const db = createAdminClient() as any
  const { data: doc } = await db.from('proposal_documents').select('*').eq('id', params.id).single()
  if (!doc) notFound()

  if (doc.kind === 'agreement') {
    const signCode = await ensureSignCode(doc.id)
    const { data: clients } = await db
      .from('clients').select('id, business_name').eq('active', true).order('business_name')
    return (
      <AgreementEditor
        id={doc.id}
        status={doc.status}
        initialData={withAgreementDefaults(doc.data)}
        signCode={signCode}
        clients={clients ?? []}
        clientId={doc.client_id}
      />
    )
  }
  return <ProposalEditor id={doc.id} status={doc.status} initialData={withProposalDefaults(doc.data)} />
}
