import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { SWMS_LIST, MODERN_SLAVERY, SDS_REGISTER, POLICIES } from '@/lib/documents/safety'
import { SUBCONTRACTOR_AGREEMENT, CONTRACTOR_INDUCTION } from '@/lib/documents/subcontractor'
import { SubcontractorPanel } from '@/components/clients/SubcontractorPanel'
import { ShieldCheck, FileText, ChevronRight, HardHat, FlaskConical, UserCheck, FileSignature } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function SafetyPage() {
  const db = createAdminClient() as any
  const { data: sub } = await db
    .from('subcontractors')
    .select('company_name, abn, contact_name, contact_email, insurance_expiry, sign_code, signed_at, signed_name')
    .order('created_at', { ascending: false }).limit(1).maybeSingle()

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-gray-900">Safety &amp; compliance</h2>
        <p className="text-sm text-gray-400 mt-0.5">Safe Work Method Statements and policies — view, print, or share with clients and auditors.</p>
      </div>

      <SubcontractorPanel sub={sub ?? null} />

      {/* SWMS */}
      <div className="flex items-center gap-2 mb-3">
        <HardHat className="w-4 h-4 text-gray-400" />
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Safe Work Method Statements · {SWMS_LIST.length}</p>
      </div>
      <div className="space-y-2 mb-8">
        {SWMS_LIST.map((s) => {
          const slug = s.code.replace(/\s+/g, '-').toLowerCase()
          return (
            <Link key={s.code} href={`/safety/${slug}`} target="_blank" className="block">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 flex items-center justify-between gap-3 hover:border-gray-300 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#1e3a5f]/5 border border-[#1e3a5f]/10 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="w-4 h-4 text-[#1e3a5f]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{s.title}</p>
                    <p className="text-xs text-gray-400 font-mono">{s.code} · {s.rows.length} hazards</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </div>
            </Link>
          )
        })}
      </div>

      {/* Policies */}
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-gray-400" />
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Policies</p>
      </div>
      <div className="space-y-2">
        {POLICIES.map((p) => (
          <Link key={p.slug} href={`/safety/${p.slug}`} target="_blank" className="block">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 flex items-center justify-between gap-3 hover:border-gray-300 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#1e3a5f]/5 border border-[#1e3a5f]/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-[#1e3a5f]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{p.title}</p>
                  <p className="text-xs text-gray-400">Policy statement · {p.code}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
            </div>
          </Link>
        ))}
        <Link href="/safety/modern-slavery" target="_blank" className="block">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 flex items-center justify-between gap-3 hover:border-gray-300 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#1e3a5f]/5 border border-[#1e3a5f]/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-[#1e3a5f]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{MODERN_SLAVERY.title}</p>
                <p className="text-xs text-gray-400">Policy statement</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
          </div>
        </Link>
        <Link href="/safety/sds-register" target="_blank" className="block">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 flex items-center justify-between gap-3 hover:border-gray-300 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#1e3a5f]/5 border border-[#1e3a5f]/10 flex items-center justify-center flex-shrink-0">
                <FlaskConical className="w-4 h-4 text-[#1e3a5f]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{SDS_REGISTER.title}</p>
                <p className="text-xs text-gray-400">{SDS_REGISTER.products.length} products · SDS on the cleaner portal</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
          </div>
        </Link>
      </div>

      {/* Contractor onboarding */}
      <div className="flex items-center gap-2 mb-3 mt-8">
        <UserCheck className="w-4 h-4 text-gray-400" />
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Contractor Onboarding</p>
      </div>
      <div className="space-y-2">
        {[
          { slug: SUBCONTRACTOR_AGREEMENT.slug, title: SUBCONTRACTOR_AGREEMENT.title, sub: `Binding contract · ${SUBCONTRACTOR_AGREEMENT.code}`, icon: FileSignature },
          { slug: CONTRACTOR_INDUCTION.slug, title: CONTRACTOR_INDUCTION.title, sub: `Acknowledgment · ${CONTRACTOR_INDUCTION.code}`, icon: UserCheck },
        ].map((d) => {
          const Icon = d.icon
          return (
            <Link key={d.slug} href={`/safety/${d.slug}`} target="_blank" className="block">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 flex items-center justify-between gap-3 hover:border-gray-300 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#1e3a5f]/5 border border-[#1e3a5f]/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-[#1e3a5f]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{d.title}</p>
                    <p className="text-xs text-gray-400">{d.sub}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </div>
            </Link>
          )
        })}
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-4 text-xs text-gray-500">
          <span className="font-semibold text-gray-600">Next:</span> a one-link onboarding pack — a subbie opens a single secure link, reviews all of the above, enters their company / ABN / insurance, and signs once to stamp and save everything to your hub.
        </div>
      </div>
    </div>
  )
}
