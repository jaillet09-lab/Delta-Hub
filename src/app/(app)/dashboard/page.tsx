import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getSettings } from '@/actions/settings'
import { buildDashboardAlerts, computeClientHealth } from '@/lib/health'
import { getUpcomingDates } from '@/lib/schedule'
import { KPIGrid } from '@/components/dashboard/KPIGrid'
import { AlertPanel } from '@/components/dashboard/AlertPanel'
import { RevenueByServiceType } from '@/components/analytics/RevenueByServiceType'
import { AdminCompleteJobButton } from '@/components/dashboard/AdminCompleteJobButton'
import { XeroFinanceWidget } from '@/components/admin/XeroFinanceWidget'
import { formatAUD } from '@/lib/formatters'
import { HEALTH_STATUS_LABELS } from '@/lib/constants'
import { ChevronRight, CheckCircle, AlertTriangle, TrendingDown, Info, Activity, TrendingUp, XCircle, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'

type InsightType = 'good' | 'warn' | 'bad' | 'info'
interface Insight { type: InsightType; title: string; body: string }

const INSIGHT_STYLES: Record<InsightType, { bg: string; border: string; iconColor: string; titleColor: string; Icon: any }> = {
  good: { bg: 'bg-emerald-50',  border: 'border-emerald-100', iconColor: 'text-emerald-600', titleColor: 'text-emerald-800',  Icon: CheckCircle },
  warn: { bg: 'bg-amber-50',    border: 'border-amber-100',   iconColor: 'text-amber-600',   titleColor: 'text-amber-800',    Icon: AlertTriangle },
  bad:  { bg: 'bg-red-50',      border: 'border-red-100',     iconColor: 'text-red-600',     titleColor: 'text-red-800',      Icon: TrendingDown },
  info: { bg: 'bg-blue-50',     border: 'border-blue-100',    iconColor: 'text-blue-600',    titleColor: 'text-blue-800',     Icon: Info },
}

function generateInsights(activeClients: any[], mrr: number): Insight[] {
  const insights: Insight[] = []
  if (activeClients.length === 0) return insights

  const withMargin = activeClients.filter(c => c.margin_pct != null)

  // Best margin
  if (withMargin.length > 0) {
    const best = [...withMargin].sort((a, b) => b.margin_pct - a.margin_pct)[0]
    if (best.margin_pct > 0) {
      insights.push({
        type: 'good',
        title: `${best.business_name} is your most profitable client`,
        body: `Gross margin of ${best.margin_pct.toFixed(0)}%, generating ${formatAUD(best.monthly_profit || 0)} gross profit per month.`,
      })
    }
  }

  // Worst margin (<35%)
  if (withMargin.length > 1) {
    const worst = [...withMargin].sort((a, b) => a.margin_pct - b.margin_pct)[0]
    if (worst.margin_pct < 35) {
      insights.push({
        type: 'bad',
        title: `${worst.business_name} has the lowest gross margin`,
        body: `At ${worst.margin_pct.toFixed(0)}% — below the 35% target. Review direct costs or consider a pricing conversation.`,
      })
    }
  }

  // Multiple clients below target
  const belowTarget = withMargin.filter(c => c.margin_pct < 35)
  if (belowTarget.length >= 2) {
    insights.push({
      type: 'warn',
      title: `${belowTarget.length} clients are below the 35% margin target`,
      body: belowTarget.map(c => `${c.business_name} (${c.margin_pct.toFixed(0)}%)`).join(', '),
    })
  }

  // Revenue concentration
  const topClient = [...activeClients].sort((a, b) => (b.monthly_value || 0) - (a.monthly_value || 0))[0]
  if (mrr > 0 && topClient) {
    const pct = ((topClient.monthly_value || 0) / mrr) * 100
    if (pct > 35) {
      insights.push({
        type: 'warn',
        title: `${topClient.business_name} represents ${pct.toFixed(0)}% of total revenue`,
        body: `High client concentration is a business risk. A loss here would drop MRR by ${formatAUD(topClient.monthly_value || 0)}.`,
      })
    }
  }

  // Labour vs revenue
  const totalLabour = activeClients.reduce((s, c) => s + (c.monthly_labour_cost || 0), 0)
  if (totalLabour > 0 && mrr > 0) {
    const grossMargin = ((mrr - totalLabour) / mrr) * 100
    if (grossMargin >= 55) {
      insights.push({
        type: 'good',
        title: `Strong gross margin at ${grossMargin.toFixed(0)}%`,
        body: `After all cleaner wages, you're keeping ${formatAUD(mrr - totalLabour)}/month. Above the 55% benchmark.`,
      })
    } else if (grossMargin < 30) {
      insights.push({
        type: 'bad',
        title: `Gross margin is low at ${grossMargin.toFixed(0)}%`,
        body: `Labour costs of ${formatAUD(totalLabour)}/month are eating into profit. Target is 40–55% for a healthy cleaning business.`,
      })
    }
  }

  // Client count
  if (activeClients.length >= 8) {
    insights.push({
      type: 'good',
      title: `Strong client base — ${activeClients.length} active contracts`,
      body: `Annualised revenue of ${formatAUD(mrr * 12)}. Above 8 clients indicates a scalable operation.`,
    })
  } else if (activeClients.length <= 3) {
    insights.push({
      type: 'warn',
      title: `Only ${activeClients.length} active clients — consider growing the pipeline`,
      body: `Low client count increases revenue risk. Focus on new business development.`,
    })
  }

  return insights
}

const LEAD_STATUS_LABELS: Record<string, string> = {
  lead: 'New', contacted: 'Contacted', quoted: 'Quoted',
  proposal_sent: 'Proposal Sent', agreement_sent: 'Agreement Sent',
  won: 'Won', lost: 'Lost',
}

function brisbaneToday(): string {
  return new Date().toLocaleString('en-AU', {
    timeZone: 'Australia/Brisbane',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).split('/').reverse().join('-')
}

export const dynamic   = 'force-dynamic'
export const revalidate = 0

export default async function DashboardPage() {
  const supabase = createClient()
  const settings = await getSettings()
  const today    = brisbaneToday()
  const pastFrom = new Date(Date.now() - 7 * 86_400_000).toISOString().split('T')[0]

  const [clientsRes, surveysRes, lastSurveysRes, leadsRes, pastJobsRes, scheduleClientsRes] = await Promise.all([
    (supabase as any)
      .from('clients')
      .select('id, business_name, active, monthly_value, monthly_profit, margin_pct, profile_complete, contract_expiry_date, frequency, start_date, ref_number, monthly_labour_cost, service_type')
      .order('business_name'),
    (supabase as any)
      .from('surveys')
      .select('client_id, quality_score, reliability_score, communication_score, value_score, nps_score, submitted_at')
      .order('submitted_at', { ascending: false }),
    (supabase as any)
      .from('surveys')
      .select('client_id, submitted_at')
      .order('submitted_at', { ascending: false }),
    (supabase as any)
      .from('leads')
      .select('id, business_name, status, last_contact_date, quote_value')
      .not('status', 'in', '("won","lost")')
      .order('created_at', { ascending: false }),
    // All job_assignments in the past 7 days
    (supabase as any)
      .from('job_assignments')
      .select('id, scheduled_date, status, client_id, clients(business_name, suburb), profiles(full_name), job_submissions(completed_at, completed_by_role, completed_by_name)')
      .gte('scheduled_date', pastFrom)
      .lt('scheduled_date', today)
      .order('scheduled_date', { ascending: false }),
    // Clients with schedules for missed-clean detection
    (supabase as any)
      .from('clients')
      .select('id, business_name, suburb, frequency, service_days, start_date, assigned_cleaner_id, profiles!assigned_cleaner_id(full_name)')
      .eq('active', true)
      .eq('is_multi_site', false)
      .not('frequency', 'is', null),
  ])

  const clients           = clientsRes.data        || []
  const surveys           = surveysRes.data         || []
  const lastSurveys       = lastSurveysRes.data      || []
  const leads             = leadsRes.data            || []
  const pastJobs          = (pastJobsRes.data        || []) as any[]
  const scheduleClients   = (scheduleClientsRes.data || []) as any[]

  // ── Missed clean detection ──────────────────────────────────────────────────
  // Build a lookup of clientId::date → job for all past job records
  const pastJobMap = new Map<string, any>()
  for (const job of pastJobs) {
    pastJobMap.set(`${job.client_id}::${job.scheduled_date}`, job)
  }

  // Walk each client's schedule backwards 7 days, find gaps
  const fromDate = new Date(pastFrom + 'T00:00:00')
  type MissedItem =
    | { kind: 'no_record';   clientId: string; clientName: string; suburb: string | null; cleanerName: string | null; date: string }
    | { kind: 'not_started'; jobId: string;    clientName: string; suburb: string | null; cleanerName: string | null; date: string }

  const missedItems: MissedItem[] = []

  for (const client of scheduleClients) {
    if (!(client.service_days ?? []).length) continue
    const dates = getUpcomingDates(
      { id: client.id, business_name: client.business_name, address: null, suburb: client.suburb ?? null,
        frequency: client.frequency, service_days: client.service_days, start_date: client.start_date ?? null },
      8, fromDate
    )
    for (const d of dates) {
      const dateStr = d.toISOString().split('T')[0]
      if (dateStr >= today) continue // only past dates
      const job        = pastJobMap.get(`${client.id}::${dateStr}`)
      const cleanerName = client.profiles?.full_name ?? null
      if (!job) {
        missedItems.push({ kind: 'no_record', clientId: client.id, clientName: client.business_name, suburb: client.suburb ?? null, cleanerName, date: dateStr })
      } else if (job.status === 'not_started') {
        missedItems.push({ kind: 'not_started', jobId: job.id, clientName: job.clients?.business_name ?? client.business_name, suburb: job.clients?.suburb ?? null, cleanerName: job.profiles?.full_name ?? cleanerName, date: dateStr })
      }
    }
  }
  missedItems.sort((a, b) => b.date.localeCompare(a.date))

  // Recently completed in the past 7 days
  const recentCompleted = pastJobs.filter((j: any) => j.status === 'completed').slice(0, 10)

  const activeClients = clients.filter((c: any) => c.active)
  const mrr = activeClients.reduce((s: number, c: any) => s + (c.monthly_value || 0), 0)

  const clientsWithProfit = activeClients.filter((c: any) => c.monthly_profit != null)
  const netMonthlyProfit  = clientsWithProfit.length > 0
    ? clientsWithProfit.reduce((s: number, c: any) => s + (c.monthly_profit || 0), 0)
    : null

  const marginsWithData = activeClients.filter((c: any) => c.margin_pct != null)
  const avgMarginPct    = marginsWithData.length > 0
    ? marginsWithData.reduce((s: number, c: any) => s + (c.margin_pct || 0), 0) / marginsWithData.length
    : null

  // Build survey maps
  const surveyAvgs: Record<string, number | null>   = {}
  const lastSurveyDates: Record<string, string | null> = {}

  for (const s of lastSurveys as any[]) {
    if (!lastSurveyDates[s.client_id]) {
      lastSurveyDates[s.client_id] = s.submitted_at
    }
  }
  for (const s of surveys as any[]) {
    if (surveyAvgs[s.client_id] == null) {
      const scores = [s.quality_score, s.reliability_score, s.communication_score, s.value_score, s.nps_score]
        .filter((x: any) => x != null) as number[]
      surveyAvgs[s.client_id] = scores.length > 0
        ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length
        : null
    }
  }

  // Health per client
  const clientsWithHealth = activeClients.map((c: any) => ({
    ...c,
    health: computeClientHealth(c, surveyAvgs[c.id] ?? null, settings.margin_thresholds),
  }))

  // Problem clients
  const problemClients = clientsWithHealth
    .filter((c: any) => c.health.status === 'at_risk' || c.health.status === 'watch' || c.health.status === 'incomplete')
    .sort((a: any, b: any) => {
      const order: Record<string, number> = { at_risk: 0, incomplete: 1, watch: 2 }
      return (order[a.health.status] ?? 3) - (order[b.health.status] ?? 3)
    })
    .slice(0, 8)

  // Alerts (no unsigned docs since docs are removed from nav)
  const alerts = buildDashboardAlerts({
    clients,
    surveyAvgs,
    lastSurveyDates,
    unsignedDocs: [], // documents removed from sidebar
    leads,
    settings,
  })

  const insights       = generateInsights(activeClients, mrr)
  const totalLabour    = activeClients.reduce((s: number, c: any) => s + (c.monthly_labour_cost || 0), 0)
  const grossProfit    = mrr - totalLabour
  const grossMarginPct = mrr > 0 && totalLabour > 0 ? (grossProfit / mrr) * 100 : null

  const dotColors: Record<string, string> = {
    healthy:    'bg-emerald-400',
    watch:      'bg-amber-400',
    at_risk:    'bg-red-400',
    incomplete: 'bg-slate-500',
  }
  const pillColors: Record<string, string> = {
    healthy:    'bg-emerald-50 text-emerald-700',
    watch:      'bg-amber-50 text-amber-700',
    at_risk:    'bg-red-50 text-red-600',
    incomplete: 'bg-gray-100 text-gray-600',
  }

  const brisbaneHour = Number(
    new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', hour: 'numeric', hour12: false })
  )
  const greeting = brisbaneHour < 12 ? 'Good morning' : brisbaneHour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="space-y-4">
      {/* Greeting header */}
      <div className="pb-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
          {new Date().toLocaleDateString('en-AU', { timeZone: 'Australia/Brisbane', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <h1 className="font-display text-[26px] lg:text-[32px] font-extrabold tracking-tight text-gray-900 mt-1">
          {greeting}, Jackson
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {activeClients.length} active client{activeClients.length === 1 ? '' : 's'} · {formatAUD(mrr)} monthly revenue
        </p>
      </div>

      <KPIGrid
        activeClients={activeClients.length}
        mrr={mrr}
        netMonthlyProfit={netMonthlyProfit}
        avgMarginPct={avgMarginPct}
        valuationMultiple={settings.valuation_multiple}
      />

      {alerts.length > 0 && <AlertPanel alerts={alerts} />}

      {/* ── MISSED CLEANS ────────────────────────────────────────────────── */}
      {missedItems.length > 0 && (
        <div className="bg-white border border-red-100 rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-red-100 bg-red-50">
            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <h3 className="text-sm font-semibold text-red-700">Missed Cleans — {missedItems.length} job{missedItems.length !== 1 ? 's' : ''} not completed</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {missedItems.map((item, i) => {
              const d = new Date(item.date + 'T00:00:00')
              const dateLabel = d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
              return (
                <div key={i} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{item.clientName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {dateLabel}
                      {item.cleanerName ? ` · ${item.cleanerName}` : ' · No cleaner assigned'}
                    </p>
                  </div>
                  {item.kind === 'not_started'
                    ? <AdminCompleteJobButton jobId={item.jobId} />
                    : <AdminCompleteJobButton clientId={item.clientId} scheduledDate={item.date} />
                  }
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── RECENTLY COMPLETED ───────────────────────────────────────────── */}
      {recentCompleted.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <h3 className="text-sm font-semibold text-gray-900">Recently Completed Jobs</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {recentCompleted.map((job: any) => {
              const sub = Array.isArray(job.job_submissions) ? job.job_submissions[0] : job.job_submissions
              const d = new Date(job.scheduled_date + 'T00:00:00')
              const dateLabel = d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
              const completedBy = sub?.completed_by_name
                ? `${sub.completed_by_role === 'admin' ? 'Admin' : 'Manager'}: ${sub.completed_by_name}`
                : (job.profiles?.full_name ?? 'Cleaner')
              return (
                <div key={job.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{job.clients?.business_name ?? '—'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{dateLabel} · {completedBy}</p>
                  </div>
                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 flex-shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Complete
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Problem clients — 2 cols */}
        <div className="xl:col-span-2">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Clients Needing Attention</h3>
              <Link href="/clients?health=at_risk" className="text-xs text-blue-600 hover:text-blue-700 hover:underline">
                View all →
              </Link>
            </div>
            {problemClients.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm font-medium text-emerald-600">All clients are healthy</p>
                <p className="text-xs text-gray-500 mt-1">No margin or health issues detected</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {problemClients.map((c: any) => {
                  const hcfg       = c.health
                  const statusLabel = HEALTH_STATUS_LABELS[hcfg.status as keyof typeof HEALTH_STATUS_LABELS]
                  const dot         = dotColors[hcfg.status] ?? 'bg-gray-400'
                  const pill        = pillColors[hcfg.status] ?? 'bg-gray-100 text-gray-600'
                  return (
                    <Link
                      key={c.id}
                      href={`/clients/${c.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{c.business_name}</p>
                        <p className="text-xs text-gray-500 truncate">{hcfg.reasons[0] ?? ''}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {c.margin_pct != null && (
                          <span className={`text-sm font-semibold tabular-nums ${
                            c.margin_pct < 24 ? 'text-red-600' : c.margin_pct < 40 ? 'text-amber-600' : 'text-emerald-600'
                          }`}>
                            {c.margin_pct.toFixed(0)}%
                          </span>
                        )}
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${pill}`}>
                          {statusLabel}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column: leads pipeline widget */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900">Pipeline</h3>
              </div>
              <Link href="/leads" className="text-xs text-blue-600 hover:text-blue-700 hover:underline">
                View all →
              </Link>
            </div>
            {leads.length === 0 ? (
              <div className="px-5 py-6 text-center">
                <p className="text-xs text-gray-500">No active leads</p>
                <Link href="/leads" className="text-xs text-blue-400 hover:underline mt-1 block">
                  Add first lead →
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {(leads as any[]).slice(0, 6).map((lead: any) => (
                  <Link
                    key={lead.id}
                    href={`/leads/${lead.id}`}
                    className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors"
                  >
                    <p className="text-sm text-gray-800 flex-1 min-w-0 truncate">{lead.business_name}</p>
                    <Badge
                      status={lead.status}
                      label={LEAD_STATUS_LABELS[lead.status] ?? lead.status}
                    />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Analytics section */}
      <div className="pt-4 space-y-4">
        <div className="flex items-center gap-3">
          <Activity className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-[0.14em] whitespace-nowrap">Business Insights</p>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {activeClients.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-1">
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="px-5 py-3.5 border-b border-gray-200">
                  <p className="text-sm font-semibold text-gray-900">Revenue by Service Type</p>
                </div>
                <div className="p-5">
                  <RevenueByServiceType clients={activeClients} />
                </div>
              </div>
            </div>

            <div className="xl:col-span-2">
              {insights.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {insights.slice(0, 4).map((ins, i) => {
                    const s = INSIGHT_STYLES[ins.type]
                    return (
                      <div key={i} className={`rounded-xl p-4 border ${s.bg} ${s.border}`}>
                        <div className="flex items-start gap-2.5">
                          <s.Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${s.iconColor}`} />
                          <div>
                            <p className={`text-sm font-semibold leading-snug ${s.titleColor}`}>{ins.title}</p>
                            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{ins.body}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="h-full bg-white rounded-xl border border-dashed border-gray-200 flex items-center justify-center p-8">
                  <p className="text-sm text-gray-500 text-center">
                    Add cleaner costs to client profiles to unlock margin insights
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 12-month forecast — navy ink panel */}
        {mrr > 0 && (
          <div className="relative overflow-hidden bg-[#0b1320] rounded-2xl p-6">
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse 70% 90% at 85% -20%, rgba(30,58,95,0.95), transparent 60%)' }}
            />
            <span aria-hidden className="font-display absolute -right-6 -bottom-16 text-[11rem] font-black leading-none select-none text-white/[0.04]">Δ</span>
            <p className="relative text-sky-400/80 text-[11px] font-semibold uppercase tracking-[0.18em] mb-5">12-Month Forecast</p>
            <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-6">
              <div>
                <p className="text-slate-400 text-xs mb-1.5">Annual Revenue</p>
                <p className="font-display text-2xl font-extrabold text-white tabular-nums tracking-tight">{formatAUD(mrr * 12)}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-1.5">Annual Gross Profit</p>
                <p className="font-display text-2xl font-extrabold text-white tabular-nums tracking-tight">
                  {totalLabour > 0 ? formatAUD(grossProfit * 12) : '—'}
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-1.5">Labour Cost / Year</p>
                <p className="font-display text-2xl font-extrabold text-white tabular-nums tracking-tight">
                  {totalLabour > 0 ? formatAUD(totalLabour * 12) : '—'}
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-1.5">Gross Margin</p>
                <p className={`font-display text-2xl font-extrabold tabular-nums tracking-tight ${
                  grossMarginPct == null ? 'text-slate-500'
                  : grossMarginPct < 30 ? 'text-red-400'
                  : grossMarginPct >= 55 ? 'text-emerald-400'
                  : 'text-amber-400'
                }`}>
                  {grossMarginPct != null ? `${grossMarginPct.toFixed(0)}%` : '—'}
                </p>
              </div>
            </div>
            <p className="relative text-slate-500 text-xs mt-5">
              Projections assume current MRR remains constant · Add cleaner costs on client profiles to see gross profit
            </p>
          </div>
        )}
      </div>

      {/* ── XERO FINANCE ─────────────────────────────────────────────────────── */}
      <div className="pt-4">
        <div className="flex items-center gap-3 mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-[0.14em] whitespace-nowrap">Accounting</p>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
        <XeroFinanceWidget />
      </div>
    </div>
  )
}
