export const dynamic = 'force-dynamic'
export const revalidate = 0

import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { NewProposalButton } from '@/components/documents/NewProposalButton'
import { FileText, FilePen, ChevronRight } from 'lucide-react'

const KIND_LABEL: Record<string, string> = {
  proposal: 'Proposal', agreement: 'Service Agreement', one_off: 'One-Off Agreement', capability: 'Capability Statement',
}
const STATUS_STYLE: Record<string, string> = {
  draft:             'bg-gray-100 text-gray-600 border-gray-200',
  sent:              'bg-blue-50 text-blue-700 border-blue-200',
  accepted:          'bg-emerald-50 text-emerald-700 border-emerald-200',
  declined:          'bg-red-50 text-red-600 border-red-200',
  out_for_signature: 'bg-amber-50 text-amber-700 border-amber-200',
  signed:            'bg-[#1e3a5f] text-white border-[#1e3a5f]',
}
const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', sent: 'Sent', accepted: 'Accepted', declined: 'Declined',
  out_for_signature: 'Out for signature', signed: 'Signed',
}

export default async function DocumentsPage() {
  const db = createAdminClient() as any
  const { data: docs } = await db
    .from('proposal_documents')
    .select('id, kind, status, ref_number, client_name, updated_at')
    .order('updated_at', { ascending: false })

  const list: any[] = docs ?? []

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-gray-900">Documents</h2>
          <p className="text-sm text-gray-400 mt-0.5">Proposals and service agreements · {list.length}</p>
        </div>
        <NewProposalButton />
      </div>

      {list.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-16 text-center">
          <FileText className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">No documents yet</p>
          <p className="text-xs text-gray-400 mt-1">Create your first proposal to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(16,24,40,0.05)] overflow-hidden divide-y divide-gray-100">
          {list.map((d) => {
            const Icon = d.kind === 'proposal' ? FileText : FilePen
            return (
              <Link key={d.id} href={`/documents/${d.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-[#1e3a5f]/5 border border-[#1e3a5f]/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-[#1e3a5f]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">{d.client_name || 'Untitled'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{KIND_LABEL[d.kind] ?? d.kind} · {d.ref_number}</p>
                </div>
                <span className={`text-[11px] font-semibold border rounded-full px-2.5 py-0.5 ${STATUS_STYLE[d.status] ?? STATUS_STYLE.draft}`}>
                  {STATUS_LABEL[d.status] ?? d.status}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
