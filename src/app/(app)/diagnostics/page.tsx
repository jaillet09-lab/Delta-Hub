export const dynamic = 'force-dynamic'
export const revalidate = 0

import { createAdminClient } from '@/lib/supabase/admin'
import { runDiagnostics, type DiagCheck } from '@/lib/diagnostics'
import { CheckCircle2, AlertTriangle, AlertOctagon, Activity } from 'lucide-react'

const STYLE: Record<DiagCheck['status'], { icon: any; ring: string; text: string; dot: string }> = {
  ok:    { icon: CheckCircle2,  ring: 'border-emerald-200 bg-emerald-50/40', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  warn:  { icon: AlertTriangle, ring: 'border-amber-200 bg-amber-50/50',     text: 'text-amber-700',   dot: 'bg-amber-500' },
  alert: { icon: AlertOctagon,  ring: 'border-red-200 bg-red-50/50',         text: 'text-red-700',     dot: 'bg-red-500' },
}

export default async function DiagnosticsPage() {
  const db = createAdminClient() as any
  const { checks, generatedAt } = await runDiagnostics(db)

  const alerts = checks.filter((c) => c.status === 'alert').length
  const warns  = checks.filter((c) => c.status === 'warn').length
  const headline = alerts > 0
    ? `${alerts} thing${alerts > 1 ? 's need' : ' needs'} attention`
    : warns > 0
      ? `${warns} thing${warns > 1 ? 's' : ''} to keep an eye on`
      : 'Everything looks healthy'

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Activity className="w-5 h-5 text-[#1e3a5f]" />
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-gray-900">App health check</h2>
      </div>
      <p className="text-sm text-gray-400 mb-6">
        {headline} · Delta Hub runs this automatically every Monday and pushes you a summary.
      </p>

      <div className="space-y-2.5">
        {checks.map((c, i) => {
          const s = STYLE[c.status]
          const Icon = s.icon
          return (
            <div key={i} className={`rounded-2xl border ${s.ring} px-5 py-4 flex items-start gap-3.5`}>
              <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${s.text}`} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">{c.label}</p>
                <p className="text-[13px] text-gray-600 mt-0.5 leading-relaxed">{c.detail}</p>
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-[11px] text-gray-300 mt-6 text-center">
        Generated {new Date(generatedAt).toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', dateStyle: 'medium', timeStyle: 'short' })} · refresh to re-run
      </p>
    </div>
  )
}
