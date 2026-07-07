export const dynamic = 'force-dynamic'
export const revalidate = 0

import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { NewProposalButton } from '@/components/documents/NewProposalButton'
import { DeleteDocButton } from '@/components/documents/DeleteDocButton'
import { CertificateOfCurrencyCard } from '@/components/documents/CertificateOfCurrencyCard'
import { FileText, FilePen, ChevronRight, Sparkles, ExternalLink } from 'lucide-react'

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

  // All saved contract PDFs across clients (stored per client, surfaced here too).
  const { data: contractRows } = await db
    .from('compliance_documents')
    .select('id, name, file_url, client_id, created_at')
    .eq('type', 'contract')
    .order('created_at', { ascending: false })
  const contracts: any[] = contractRows ?? []

  // The current company-level Certificate of Currency (latest global one).
  const { data: cocRows } = await db
    .from('compliance_documents')
    .select('file_url, expiry_date, created_at')
    .eq('type', 'certificate_of_currency')
    .is('client_id', null)
    .is('profile_id', null)
    .order('created_at', { ascending: false })
    .limit(1)
  const coc = (cocRows ?? [])[0] ?? null
  const cocViewHref = coc?.file_url ? `/api/file?url=${Buffer.from(coc.file_url).toString('base64url')}` : null

  const contractClientIds = Array.from(new Set(contracts.map((c) => c.client_id).filter(Boolean)))
  const { data: contractClients } = contractClientIds.length
    ? await db.from('clients').select('id, business_name, ref_number').in('id', contractClientIds)
    : { data: [] }
  const clientMap = new Map((contractClients ?? []).map((c: any) => [c.id, c]))

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
              <div key={d.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                <Link href={`/documents/${d.id}`} className="flex items-center gap-4 min-w-0 flex-1">
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
                <DeleteDocButton id={d.id} />
              </div>
            )
          })}
        </div>
      )}

      {/* Company documents — your standing leave-behinds */}
      <div className="pt-2">
        <p className="text-sm text-gray-500 mb-3">Company documents</p>
        <div className="space-y-2">
          <a href="/documents/capability" target="_blank" rel="noreferrer" className="block">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 flex items-center justify-between gap-3 hover:border-gray-300 transition-colors">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-[#1e3a5f]/5 border border-[#1e3a5f]/10 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-[#1e3a5f]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">Capability Statement</p>
                  <p className="text-xs text-gray-400 mt-0.5">The leave-behind attached to your proposals · view or save as PDF</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1e3a5f] border border-[#1e3a5f]/20 rounded-full px-3.5 py-1.5 flex-shrink-0">View <ExternalLink className="w-3 h-3" /></span>
            </div>
          </a>
          <CertificateOfCurrencyCard current={coc} viewHref={cocViewHref} />
        </div>
      </div>

      {contracts.length > 0 && (
        <div className="pt-2">
          <p className="text-sm text-gray-500 mb-3">Signed contracts on file · {contracts.length}</p>
          <div className="bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(16,24,40,0.05)] overflow-hidden divide-y divide-gray-100">
            {contracts.map((c) => {
              const client = clientMap.get(c.client_id) as any
              return (
                <div key={c.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-[#1e3a5f]/5 border border-[#1e3a5f]/10 flex items-center justify-center flex-shrink-0">
                    <FilePen className="w-4 h-4 text-[#1e3a5f]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{client?.business_name ?? 'Unknown client'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{c.name}{client?.ref_number ? ` · ${client.ref_number}` : ''}</p>
                  </div>
                  {c.file_url && (
                    <a href={`/api/file?url=${Buffer.from(c.file_url).toString('base64url')}`} target="_blank" rel="noreferrer"
                      className="text-[11px] font-semibold text-[#1e3a5f] border border-[#1e3a5f]/20 rounded-full px-4 py-1.5 hover:bg-[#1e3a5f] hover:text-white transition-colors flex-shrink-0">
                      View
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
