export const dynamic = 'force-dynamic'
export const revalidate = 0

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/Card'
import { ComplianceUploadForm } from '@/components/team/ComplianceUploadForm'
import { DeleteComplianceDocButton } from '@/components/team/DeleteComplianceDocButton'
import { ArrowLeft, FileText, ShieldAlert, ShieldCheck } from 'lucide-react'

const TYPE_LABELS: Record<string, string> = {
  sds: 'SDS', insurance: 'Insurance', contract: 'Client Contract',
  police_check: 'Police Check', white_card: 'White Card', qualification: 'Qualification', other: 'Other',
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr + 'T00:00:00').getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000)
}
function expiryStyle(days: number) {
  if (days < 0)  return { chip: 'bg-red-100 text-red-700 border-red-200', label: `Expired ${-days}d ago` }
  if (days <= 30) return { chip: 'bg-red-50 text-red-600 border-red-200', label: `${days}d left` }
  if (days <= 60) return { chip: 'bg-amber-50 text-amber-700 border-amber-200', label: `${days}d left` }
  return { chip: 'bg-gray-100 text-gray-500 border-gray-200', label: `${days}d left` }
}

export default async function ComplianceAdminPage() {
  const supabase = createClient() as any

  const [{ data: docs }, { data: clients }, { data: cleaners }, { data: contracts }] = await Promise.all([
    supabase.from('compliance_documents')
      .select('*, clients(business_name), profiles(full_name)')
      .order('type').order('created_at', { ascending: false }),
    supabase.from('clients').select('id, business_name').eq('active', true).order('business_name'),
    supabase.from('profiles').select('id, full_name').eq('role', 'cleaner').order('full_name'),
    supabase.from('clients').select('id, business_name, contract_expiry_date')
      .eq('active', true).not('contract_expiry_date', 'is', null),
  ])

  const allDocs = (docs ?? []) as any[]

  // Build the monitor list: documents with an expiry + client contract expiries.
  type Item = { key: string; label: string; who: string; date: string; days: number }
  const items: Item[] = []
  for (const d of allDocs) {
    if (!d.expiry_date) continue
    const who = d.profiles?.full_name ? `${d.profiles.full_name} (cleaner)` : d.clients?.business_name ?? 'Global'
    items.push({ key: `doc-${d.id}`, label: `${TYPE_LABELS[d.type] ?? d.type} — ${d.name}`, who, date: d.expiry_date, days: daysUntil(d.expiry_date) })
  }
  for (const c of (contracts ?? []) as any[]) {
    items.push({ key: `con-${c.id}`, label: 'Client contract', who: c.business_name, date: c.contract_expiry_date, days: daysUntil(c.contract_expiry_date) })
  }
  const watch = items.filter((i) => i.days <= 120).sort((a, b) => a.date.localeCompare(b.date))
  const expiredCount = watch.filter((i) => i.days < 0).length
  const soonCount = watch.filter((i) => i.days >= 0 && i.days <= 30).length

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/team" className="text-gray-500 hover:text-gray-800 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Compliance &amp; Contracts</h1>
      </div>

      {/* ── Monitor ── */}
      <Card padding={false}>
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            {expiredCount > 0
              ? <ShieldAlert className="w-4 h-4 text-red-500" />
              : <ShieldCheck className="w-4 h-4 text-emerald-500" />}
            Expiry Monitor
          </h2>
          <p className="text-xs text-gray-400">
            {expiredCount > 0 && <span className="text-red-600 font-semibold">{expiredCount} expired · </span>}
            {soonCount > 0 && <span className="text-amber-600 font-semibold">{soonCount} due ≤30d · </span>}
            next 120 days
          </p>
        </div>
        <div className="divide-y divide-gray-100">
          {watch.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8">
              Nothing expiring in the next 120 days. Add an expiry date when uploading a document, or set a contract expiry on a client, to start monitoring.
            </p>
          )}
          {watch.map((i) => {
            const st = expiryStyle(i.days)
            return (
              <div key={i.key} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{i.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{i.who} · {new Date(i.date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
                <span className={`flex-shrink-0 text-[11px] font-semibold border rounded-full px-2.5 py-0.5 ${st.chip}`}>{st.label}</span>
              </div>
            )
          })}
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Upload Document</h2>
            <ComplianceUploadForm clients={clients ?? []} cleaners={cleaners ?? []} />
          </Card>
        </div>
        <div className="lg:col-span-2">
          <Card padding={false}>
            <div className="px-5 py-4 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">Documents · {allDocs.length}</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {allDocs.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">No documents uploaded.</p>
              )}
              {allDocs.map((doc: any) => {
                const owner = doc.profiles?.full_name ? `${doc.profiles.full_name} (cleaner)` : doc.clients?.business_name ? doc.clients.business_name : 'Global'
                const exp = doc.expiry_date ? daysUntil(doc.expiry_date) : null
                const st = exp != null ? expiryStyle(exp) : null
                return (
                  <div key={doc.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <a href={`/api/file?url=${Buffer.from(doc.file_url).toString('base64url')}`} target="_blank" rel="noopener noreferrer"
                          className="text-sm font-medium text-gray-800 hover:text-blue-600 transition-colors truncate block">
                          {doc.name}
                        </a>
                        <p className="text-xs text-gray-500 mt-0.5">{TYPE_LABELS[doc.type] ?? doc.type} · {owner}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {st && <span className={`text-[11px] font-semibold border rounded-full px-2 py-0.5 ${st.chip}`}>{st.label}</span>}
                      <DeleteComplianceDocButton docId={doc.id} />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
