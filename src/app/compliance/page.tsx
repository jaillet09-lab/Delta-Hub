import Link from 'next/link'
import { SWMS_LIST, POLICIES, MODERN_SLAVERY, SDS_REGISTER, COMPANY, LEGISLATION } from '@/lib/documents/safety'
import { MASTER_TERMS } from '@/lib/documents/terms'
import { ShieldCheck, HardHat, FileText, FlaskConical, BadgeCheck, ClipboardCheck, Phone, Mail, ChevronRight, Lock } from 'lucide-react'

export const dynamic = 'force-dynamic'

const INSURANCE_POLICY = 'SPD015763734'
const CONTACT_EMAIL = 'hello@deltacleaning.com.au'
const CONTACT_PHONE = '0412 844 237'

const swmsSlug = (code: string) => code.replace(/\s+/g, '-').toLowerCase()

function DocRow({ href, title, sub, Icon }: { href: string; title: string; sub: string; Icon: any }) {
  return (
    <Link href={href} target="_blank" className="flex items-center justify-between gap-3 bg-white rounded-xl border border-gray-200/80 px-4 py-3.5 hover:border-gray-300 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-[#1e3a5f]/5 border border-[#1e3a5f]/10 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-[#1e3a5f]" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{title}</p>
          <p className="text-xs text-gray-400 truncate">{sub}</p>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
    </Link>
  )
}

function SectionLabel({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-8">
      <Icon className="w-4 h-4 text-gray-400" />
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{children}</p>
    </div>
  )
}

export default function CompliancePackPage() {
  return (
    <div className="min-h-[100dvh] bg-[#f5f6f8]">
      {/* Hero */}
      <header className="bg-[#0b1320] px-5 pt-10 pb-12 text-center" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 2.5rem)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/proposal-assets/wordmark-white.png" alt="Delta Cleaning" className="h-6 w-auto mx-auto mb-6 opacity-95" />
        <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-blue-300 mb-2">Compliance &amp; credentials</p>
        <h1 className="text-white text-2xl sm:text-3xl font-bold tracking-tight max-w-md mx-auto">Everything you need to see before we work together.</h1>
        <p className="text-slate-400 text-sm mt-3 max-w-md mx-auto">Our insurance, safe-work procedures, and policies — open and transparent, so you can sign with confidence.</p>
      </header>

      <main className="max-w-2xl mx-auto px-5 pb-16 -mt-6">
        {/* Trust strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-2">
          {[
            { icon: BadgeCheck, label: 'ABN registered' },
            { icon: ShieldCheck, label: '$20M Public Liability' },
            { icon: HardHat, label: 'WHS-aligned' },
            { icon: ClipboardCheck, label: 'Inducted team' },
          ].map((t) => (
            <div key={t.label} className="bg-white rounded-xl border border-gray-200/80 px-3 py-3 text-center shadow-sm">
              <t.icon className="w-5 h-5 text-[#1e3a5f] mx-auto mb-1.5" />
              <p className="text-[11px] font-semibold text-gray-600 leading-tight">{t.label}</p>
            </div>
          ))}
        </div>

        {/* Business & insurance */}
        <SectionLabel icon={BadgeCheck}>Business &amp; insurance</SectionLabel>
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm divide-y divide-gray-100">
          {[
            ['Registered business', COMPANY.name],
            ['ABN', COMPANY.abn],
            ['Location', COMPANY.location],
            ['Public Liability insurance', `$20 million · Policy ${INSURANCE_POLICY}`],
            ['Certificate of Currency', 'Available on request'],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <span className="text-sm text-gray-400">{k}</span>
              <span className="text-sm font-semibold text-gray-900 text-right">{v}</span>
            </div>
          ))}
        </div>

        {/* SWMS */}
        <SectionLabel icon={HardHat}>Safe Work Method Statements</SectionLabel>
        <p className="text-sm text-gray-500 mb-3">How we keep every job safe. Tap to read any of them.</p>
        <div className="space-y-2">
          {SWMS_LIST.map((s) => (
            <DocRow key={s.code} href={`/compliance/${swmsSlug(s.code)}`} title={s.title} sub={`Safe Work Method Statement · ${s.code}`} Icon={ShieldCheck} />
          ))}
        </div>

        {/* Policies */}
        <SectionLabel icon={FileText}>Policies</SectionLabel>
        <div className="space-y-2">
          {POLICIES.map((p) => (
            <DocRow key={p.slug} href={`/compliance/${p.slug}`} title={p.title} sub={`Policy statement · ${p.code}`} Icon={FileText} />
          ))}
          <DocRow href="/compliance/modern-slavery" title={MODERN_SLAVERY.title} sub="Policy statement" Icon={FileText} />
          <DocRow href="/compliance/sds-register" title={SDS_REGISTER.title} sub={`${SDS_REGISTER.products.length} products · chemical safety`} Icon={FlaskConical} />
        </div>

        {/* Service terms */}
        <SectionLabel icon={FileText}>Service terms</SectionLabel>
        <div className="space-y-2">
          <DocRow href={`/compliance/${MASTER_TERMS.slug}`} title="Terms &amp; Conditions" sub={`The standard terms that apply to every engagement · ${MASTER_TERMS.code}`} Icon={FileText} />
        </div>

        {/* Team */}
        <SectionLabel icon={ClipboardCheck}>Our team</SectionLabel>
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-5">
          <p className="text-sm text-gray-700 leading-relaxed">
            Every cleaner is vetted and inducted before working on any site, and works under a signed services agreement and the safe-work procedures above. We also run our own scored quality inspections, so standards stay high after we start.
          </p>
        </div>

        <p className="text-xs text-gray-400 mt-4 flex items-center gap-1.5"><Lock className="w-3 h-3" /> Documents are view-only. Prepared in accordance with the {LEGISLATION.includes('Work Health and Safety Act 2011 (Qld)') ? 'Work Health and Safety Act 2011 (Qld)' : 'applicable WHS legislation'}.</p>

        {/* Contact */}
        <div className="bg-[#0b1320] rounded-2xl p-6 mt-8 text-center">
          <p className="text-white text-lg font-bold">Questions before you sign?</p>
          <p className="text-slate-400 text-sm mt-1 mb-4">Happy to walk you through any of it.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a href={`tel:${CONTACT_PHONE.replace(/\s/g, '')}`} className="inline-flex items-center gap-2 bg-white text-[#0b1320] text-sm font-semibold rounded-xl px-5 py-2.5">
              <Phone className="w-4 h-4" /> {CONTACT_PHONE}
            </a>
            <a href={`mailto:${CONTACT_EMAIL}`} className="inline-flex items-center gap-2 border border-white/20 text-white text-sm font-semibold rounded-xl px-5 py-2.5">
              <Mail className="w-4 h-4" /> {CONTACT_EMAIL}
            </a>
          </div>
        </div>
      </main>
    </div>
  )
}
