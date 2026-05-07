import { createClient } from '@/lib/supabase/server'
import { RevenueByServiceType } from '@/components/analytics/RevenueByServiceType'
import { ClientRatioSection } from '@/components/analytics/ClientRatioSection'
import { TenureTable } from '@/components/analytics/TenureTable'
import { MoMGrowthChart } from '@/components/analytics/MoMGrowthChart'
import { formatAUD } from '@/lib/formatters'
import { format, subMonths } from 'date-fns'
import { CheckCircle, AlertTriangle, TrendingDown, Info, Activity, Users, DollarSign } from 'lucide-react'

const FREQ_MULTIPLIERS: Record<string, number> = {
  daily: 365 / 12, weekly: 52 / 12, fortnightly: 26 / 12,
  monthly: 1, quarterly: 4 / 12, annual: 1 / 12, one_off: 1,
}

type InsightType = 'good' | 'warn' | 'bad' | 'info'
interface Insight { type: InsightType; title: string; body: string }

const insightStyles: Record<InsightType, { bg: string; border: string; icon: any; iconColor: string; titleColor: string }> = {
  good: { bg: 'bg-emerald-50', border: 'border-emerald-100', icon: CheckCircle,   iconColor: 'text-emerald-600', titleColor: 'text-emerald-800' },
  warn: { bg: 'bg-amber-50',   border: 'border-amber-100',   icon: AlertTriangle, iconColor: 'text-amber-600',   titleColor: 'text-amber-800' },
  bad:  { bg: 'bg-red-50',     border: 'border-red-100',     icon: TrendingDown,  iconColor: 'text-red-600',     titleColor: 'text-red-800' },
  info: { bg: 'bg-blue-50',    border: 'border-blue-100',    icon: Info,          iconColor: 'text-blue-600',    titleColor: 'text-blue-800' },
}

function generateInsights(activeClients: any[], mrr: number): Insight[] {
  const insights: Insight[] = []
  if (activeClients.length === 0) return insights

  const withMargin = activeClients.filter(c => c.margin_pct != null)

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

  const belowTarget = withMargin.filter(c => c.margin_pct < 35)
  if (belowTarget.length >= 2) {
    insights.push({
      type: 'warn',
      title: `${belowTarget.length} clients are below the 35% margin target`,
      body: belowTarget.map(c => `${c.business_name} (${c.margin_pct.toFixed(0)}%)`).join(', '),
    })
  }

  const topClient = [...activeClients].sort((a, b) => (b.monthly_value || 0) - (a.monthly_value || 0))[0]
  if (mrr > 0 && topClient) {
    const pct = ((topClient.monthly_value || 0) / mrr) * 100
    if (pct > 35) {
      insights.push({
        type: 'warn',
        title: `${topClient.business_name} represents ${pct.toFixed(0)}% of total revenue`,
        body: `High client concentration creates business risk. A loss here would drop MRR by ${formatAUD(topClient.monthly_value || 0)}.`,
      })
    }
  }

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

  return insights
}

export default async function AnalyticsPage() {
  const supabase = createClient()

  const [clientsRes, financialRes, expensesRes, surveysRes, plRes] = await Promise.all([
    supabase.from('clients').select('*').order('start_date'),
    supabase.from('financial_records').select('record_date, amount, type').eq('type', 'income').order('record_date'),
    supabase.from('financial_records').select('record_date, amount, type').eq('type', 'expense').order('record_date'),
    supabase.from('surveys').select('quality_score, reliability_score, communication_score, value_score, submitted_at, client_id').order('submitted_at', { ascending: false }),
    (supabase as any).from('client_monthly_financials').select('month, cleaner_cost_ex_gst, income_ex_gst').order('month', { ascending: false }),
  ])

  const clients          = clientsRes.data  || []
  const financialRecords = financialRes.data || []
  const expenseRecords   = expensesRes.data  || []
  const surveys          = surveysRes.data   || []
  const plRows: any[]    = plRes.data        || []

  // Group P&L rows by month and sum cleaner costs per month
  const plByMonth: Record<string, { cleanerCost: number; revenue: number }> = {}
  for (const r of plRows) {
    const mk = (r.month as string)?.substring(0, 7) ?? ''
    if (!plByMonth[mk]) plByMonth[mk] = { cleanerCost: 0, revenue: 0 }
    plByMonth[mk].cleanerCost += r.cleaner_cost_ex_gst ?? 0
    plByMonth[mk].revenue     += r.income_ex_gst      ?? 0
  }
  // Latest invoiced month's cleaner cost (real invoices only)
  const invoicedMonths = Object.keys(plByMonth).sort().reverse()
  const latestInvoicedMonth = invoicedMonths[0] ?? null
  const latestCleanerCost   = latestInvoicedMonth ? plByMonth[latestInvoicedMonth].cleanerCost : 0

  const activeClients = clients.filter(c => c.active)
  const mrr = activeClients.reduce((s, c) => s + (c.monthly_value || 0), 0)
  const arr = mrr * 12

  const totalLabour    = activeClients.reduce((s, c) => s + ((c as any).monthly_labour_cost || 0), 0)
  const grossProfit    = mrr - totalLabour
  const grossMarginPct = mrr > 0 && totalLabour > 0 ? (grossProfit / mrr) * 100 : null

  const manualExpenses = expenseRecords.reduce((s, r) => s + r.amount, 0)
  // Total expenses = latest month's cleaner invoice cost + any manual overhead expenses
  const totalExpenses  = latestCleanerCost + manualExpenses
  const expenseLabel   = latestInvoicedMonth
    ? `Cleaner costs · ${latestInvoicedMonth}${manualExpenses > 0 ? ' + overhead' : ''}`
    : manualExpenses > 0 ? 'Recorded overhead expenses' : 'No expenses recorded yet'

  const monthlyRevenue = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), 11 - i)
    const monthStr = format(d, 'yyyy-MM')
    const revenue = financialRecords
      .filter(r => r.record_date.startsWith(monthStr))
      .reduce((s, r) => s + r.amount, 0)
    return { month: format(d, 'MMM yy'), revenue, monthStr }
  })

  const growthData = monthlyRevenue.map((m, i) => {
    const prev = i > 0 ? monthlyRevenue[i - 1].revenue : null
    const growth = prev && prev > 0 ? ((m.revenue - prev) / prev) * 100 : null
    return { month: m.month, revenue: m.revenue, growth }
  })

  const topClients  = [...activeClients].sort((a, b) => (b.monthly_value || 0) - (a.monthly_value || 0)).slice(0, 8)
  const lowMargin   = activeClients.filter(c => (c as any).margin_pct != null && (c as any).margin_pct < 35)
    .sort((a, b) => ((a as any).margin_pct ?? 0) - ((b as any).margin_pct ?? 0))
    .slice(0, 8)

  const surveyCount = surveys.length
  const avgOverall  = surveyCount > 0
    ? surveys.reduce((s, r) => s + (((r.quality_score || 0) + (r.reliability_score || 0) + (r.communication_score || 0) + (r.value_score || 0)) / 4), 0) / surveyCount
    : 0

  const insights = generateInsights(activeClients, mrr)

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Analytics</h2>
        <p className="text-sm text-gray-400 mt-0.5">{activeClients.length} active clients · {formatAUD(mrr)}/month</p>
      </div>

      {/* ── Revenue KPIs ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <DollarSign className="w-4 h-4 text-gray-400" />
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Revenue</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'MRR',             value: formatAUD(mrr),      sub: 'Monthly recurring revenue' },
            { label: 'ARR',             value: formatAUD(arr),      sub: 'Annualised revenue' },
            { label: 'Gross Profit/Mo', value: totalLabour > 0 ? formatAUD(grossProfit) : '—', sub: totalLabour > 0 && grossMarginPct != null ? `${grossMarginPct.toFixed(0)}% margin` : 'Add cleaner costs to unlock' },
            { label: 'Total Expenses',  value: formatAUD(totalExpenses), sub: expenseLabel },
          ].map(kpi => (
            <div key={kpi.label} className="bg-white border border-gray-100 shadow-sm rounded-xl p-4">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{kpi.label}</p>
              <p className="text-xl font-bold text-gray-900 mt-2 tabular-nums">{kpi.value}</p>
              <p className="text-xs text-gray-400 mt-1">{kpi.sub}</p>
            </div>
          ))}
        </div>

        {/* MoM Growth Chart */}
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-gray-900">Month-on-Month Revenue Growth</p>
            <span className="text-xs text-gray-400">Last 12 months</span>
          </div>
          <MoMGrowthChart data={growthData} />
        </div>

        {/* Revenue by service type */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
            <p className="text-sm font-semibold text-gray-900 mb-4">Revenue by Service Type</p>
            <RevenueByServiceType clients={activeClients} />
          </div>

          {/* Top clients */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900">Top Clients by Revenue</p>
            </div>
            <div className="divide-y divide-gray-100">
              {topClients.map((c: any) => {
                const pct = mrr > 0 ? ((c.monthly_value || 0) / mrr) * 100 : 0
                return (
                  <div key={c.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex-1 min-w-0 mr-4">
                      <p className="text-sm text-gray-900 truncate">{c.business_name}</p>
                      <div className="h-1 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                        <div className="h-full bg-black rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {c.margin_pct != null && (
                        <span className={`text-xs font-medium ${
                          c.margin_pct >= 40 ? 'text-emerald-600' : c.margin_pct >= 24 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          {c.margin_pct.toFixed(0)}%
                        </span>
                      )}
                      <span className="text-sm font-medium text-gray-900 tabular-nums">
                        {formatAUD(c.monthly_value || 0)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── Client Health ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-4 h-4 text-gray-400" />
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Client Health</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Active Clients',  value: String(activeClients.length), sub: `${clients.length - activeClients.length} inactive` },
            { label: 'Retention Rate',  value: clients.length > 0 ? `${((activeClients.length / clients.length) * 100).toFixed(0)}%` : '—', sub: 'Active vs all-time' },
            { label: 'Avg Survey Score', value: surveyCount > 0 ? `${avgOverall.toFixed(1)}/10` : '—', sub: `${surveyCount} response${surveyCount !== 1 ? 's' : ''}` },
            { label: 'Low Margin Count', value: String(lowMargin.length), sub: 'Below 35% target' },
          ].map(kpi => (
            <div key={kpi.label} className="bg-white border border-gray-100 shadow-sm rounded-xl p-4">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{kpi.label}</p>
              <p className="text-xl font-bold text-gray-900 mt-2">{kpi.value}</p>
              <p className="text-xs text-gray-400 mt-1">{kpi.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
            <p className="text-sm font-semibold text-gray-900 mb-4">Client Retention</p>
            <ClientRatioSection clients={clients} />
          </div>
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
            <p className="text-sm font-semibold text-gray-900 mb-4">Client Tenure</p>
            <TenureTable clients={clients} />
          </div>
        </div>

        {/* Low margin alert */}
        {lowMargin.length > 0 && (
          <div className="bg-white border border-amber-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-amber-100 bg-amber-50">
              <p className="text-sm font-semibold text-amber-800">Low Margin Clients (&lt;35%)</p>
              <p className="text-xs text-amber-600 mt-0.5">These clients may need a pricing review</p>
            </div>
            <div className="divide-y divide-gray-100">
              {lowMargin.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between px-5 py-3">
                  <p className="text-sm text-gray-900">{c.business_name}</p>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-400">{formatAUD(c.monthly_value || 0)}/mo</span>
                    <span className={`text-sm font-bold ${c.margin_pct < 24 ? 'text-red-600' : 'text-amber-600'}`}>
                      {c.margin_pct?.toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Business Insights ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Activity className="w-4 h-4 text-gray-400" />
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Business Insights</p>
        </div>

        {insights.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {insights.map((ins, i) => {
              const s   = insightStyles[ins.type]
              const Icon = s.icon
              return (
                <div key={i} className={`rounded-xl p-4 border ${s.bg} ${s.border}`}>
                  <div className="flex items-start gap-2.5">
                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${s.iconColor}`} />
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
          <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 p-8 text-center">
            <Activity className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Add cleaner costs to client profiles to unlock profit insights</p>
          </div>
        )}

        {/* 12-month forecast */}
        {mrr > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-4">12-Month Forecast</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              <div>
                <p className="text-gray-500 text-xs mb-1">Annual Revenue</p>
                <p className="text-xl font-bold text-gray-900 tabular-nums">{formatAUD(arr)}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-1">Annual Gross Profit</p>
                <p className="text-xl font-bold text-gray-900 tabular-nums">
                  {totalLabour > 0 ? formatAUD(grossProfit * 12) : '—'}
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-1">Labour Cost / Year</p>
                <p className="text-xl font-bold text-gray-900 tabular-nums">
                  {totalLabour > 0 ? formatAUD(totalLabour * 12) : '—'}
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-1">Gross Margin</p>
                <p className={`text-xl font-bold ${
                  grossMarginPct == null ? 'text-gray-300'
                  : grossMarginPct < 30 ? 'text-red-600'
                  : grossMarginPct >= 55 ? 'text-emerald-600'
                  : 'text-amber-600'
                }`}>
                  {grossMarginPct != null ? `${grossMarginPct.toFixed(0)}%` : '—'}
                </p>
              </div>
            </div>
            <p className="text-gray-400 text-xs mt-4">
              Projections assume current MRR remains constant · Add cleaner costs on client profiles to see gross profit
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
