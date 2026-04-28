import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getSettings } from '@/actions/settings'
import { computeClientHealth } from '@/lib/health'
import { ClientDocuments } from '@/components/clients/ClientDocuments'
import { ClientSurveys } from '@/components/clients/ClientSurveys'
import { SendSurveyButton } from '@/components/clients/SendSurveyButton'
import { ImportToPortalButton } from '@/components/clients/ImportToPortalButton'
import { Button } from '@/components/ui/Button'
import { ActiveBadge, ServiceTypeBadge } from '@/components/ui/Badge'
import { formatAUD, formatDate, formatTenure } from '@/lib/formatters'
import { calculateMonthlyValue } from '@/lib/billing'
import { monthLabel } from '@/lib/calendar'
import {
  FREQUENCY_LABELS,
  HEALTH_STATUS_LABELS,
  HEALTH_STATUS_COLORS,
  HEALTH_STATUS_DOT,
} from '@/lib/constants'
import { toggleClientActiveAction } from '@/actions/clients'
import {
  ArrowLeft, Edit, Phone, Mail, MapPin, AlertTriangle, Calendar, ChevronRight,
  TrendingUp, DollarSign, BarChart3, Clock, Building2,
} from 'lucide-react'
import type { ServiceType, AdditionalService } from '@/types/app'
import { ADDITIONAL_SERVICE_MULTIPLIERS as MULT, calcAdditionalMonthlyRevenue, calcAdditionalMonthlyLabour } from '@/types/app'

export default async function ClientProfilePage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const settings = await getSettings()

  const [clientRes, docsRes, surveysRes, financialsRes, jobsRes, sitesRes] = await Promise.all([
    (supabase as any).from('clients').select('*').eq('id', params.id).single(),
    (supabase as any)
      .from('documents').select('*').eq('client_id', params.id).order('created_at', { ascending: false }),
    (supabase as any)
      .from('surveys').select('*').eq('client_id', params.id).order('submitted_at', { ascending: false }),
    (supabase as any)
      .from('client_monthly_financials')
      .select('*')
      .eq('client_id', params.id)
      .order('month', { ascending: false })
      .limit(12),
    (supabase as any)
      .from('job_assignments')
      .select('*, profiles(full_name), job_submissions(started_at, completed_at, photo_urls, notes)')
      .eq('client_id', params.id)
      .order('scheduled_date', { ascending: false })
      .limit(30),
    (supabase as any)
      .from('client_sites')
      .select('*')
      .eq('client_id', params.id)
      .order('sort_order', { ascending: true }),
  ])

  if (!clientRes.data) notFound()

  const client     = clientRes.data       as any
  const documents  = docsRes.data         || []
  const surveys    = surveysRes.data      || []
  const financials = financialsRes.data   || []
  const allJobs    = (jobsRes.data        || []) as any[]
  const clientSites = (sitesRes?.data     || []) as any[]

  const latestSurvey = surveys[0]
  const latestSurveyAvg = latestSurvey
    ? ([latestSurvey.quality_score, latestSurvey.reliability_score, latestSurvey.communication_score, latestSurvey.value_score, latestSurvey.nps_score]
        .filter((x: any) => x != null) as number[])
        .reduce((a: number, b: number, _: number, arr: number[]) => a + b / arr.length, 0)
    : null

  const health = computeClientHealth(
    { ...client, profile_complete: client.profile_complete ?? false },
    latestSurveyAvg,
    settings.margin_thresholds
  )

  const mrr             = client.monthly_value        || 0
  const monthlyLabour   = client.monthly_labour_cost  ?? null
  const monthlyProfit   = client.monthly_profit       ?? null
  const marginPct       = client.margin_pct           ?? null
  const profileComplete = client.profile_complete     ?? false
  const contractExpiry  = client.contract_expiry_date ?? null

  const daysToExpiry = contractExpiry
    ? Math.ceil((new Date(contractExpiry).getTime() - Date.now()) / 86_400_000)
    : null

  async function toggleActive() {
    'use server'
    await toggleClientActiveAction(params.id, !client.active)
  }

  const hLabel = HEALTH_STATUS_LABELS[health.status]
  const hColor = HEALTH_STATUS_COLORS[health.status]
  const hDot   = HEALTH_STATUS_DOT[health.status]

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Back + actions */}
      <div className="flex items-start justify-between gap-3">
        <Link href="/clients" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mt-0.5 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Clients
        </Link>
        <div className="flex flex-wrap gap-2 justify-end">
          <SendSurveyButton clientId={params.id} clientEmail={client.contact_email} contactName={client.contact_name} />
          <ImportToPortalButton clientId={params.id} clientName={client.business_name} contactEmail={client.contact_email} />
          <Link href={`/clients/${params.id}/edit`}>
            <Button variant="secondary" size="sm">
              <Edit className="w-3.5 h-3.5" />
              Edit
            </Button>
          </Link>
          <form action={toggleActive}>
            <Button type="submit" variant={client.active ? 'secondary' : 'primary'} size="sm">
              {client.active ? 'Mark Inactive' : 'Reactivate'}
            </Button>
          </form>
        </div>
      </div>

      {/* Hero card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
              <h1 className="text-xl font-bold text-gray-900">{client.business_name}</h1>
              <ActiveBadge active={client.active} />
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${hColor}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${hDot}`} />
                {hLabel}
              </span>
            </div>
            <p className="text-xs text-gray-400 font-mono">{client.ref_number}</p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {((client.service_type as ServiceType[]) || []).map((s) => (
                <ServiceTypeBadge key={s} type={s} />
              ))}
            </div>
            {health.reasons.length > 0 && (
              <div className="mt-3 space-y-1">
                {health.reasons.map((r, i) => (
                  <p key={i} className="text-xs text-amber-600 flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                    {r}
                  </p>
                ))}
              </div>
            )}
          </div>
          {mrr > 0 && (
            <div className="text-right flex-shrink-0">
              <p className="text-2xl font-bold text-gray-900 tabular-nums">{formatAUD(mrr)}</p>
              <p className="text-xs text-gray-400">per month</p>
              {client.annual_value && (
                <p className="text-sm font-medium text-gray-400 mt-0.5 tabular-nums">{formatAUD(client.annual_value)}/yr</p>
              )}
              {client.start_date && (
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1 justify-end">
                  <Clock className="w-3 h-3" />
                  {formatTenure(client.start_date)}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* KPI tiles */}
      {mrr > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm border-t-2 border-t-blue-500 p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3" /> Revenue / Mo
            </p>
            <p className="text-xl font-bold text-gray-900 tabular-nums">{formatAUD(mrr)}</p>
            {client.frequency && <p className="text-xs text-gray-400 mt-1 capitalize">{FREQUENCY_LABELS[client.frequency as keyof typeof FREQUENCY_LABELS]}</p>}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm border-t-2 border-t-red-400 p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <DollarSign className="w-3 h-3" /> Labour / Mo
            </p>
            {monthlyLabour != null ? (
              <>
                <p className="text-xl font-bold text-red-600 tabular-nums">{formatAUD(monthlyLabour)}</p>
                {client.cleaner_hourly_rate && client.cleaner_hours_per_visit && (
                  <p className="text-xs text-gray-400 mt-1">${client.cleaner_hourly_rate}/hr × {client.cleaner_hours_per_visit}h</p>
                )}
              </>
            ) : (
              <Link href={`/clients/${params.id}/edit`} className="text-xs text-amber-600 hover:underline flex items-center gap-1 mt-1">
                Add cost data <ChevronRight className="w-3 h-3" />
              </Link>
            )}
          </div>

          <div className={`bg-white rounded-xl border border-gray-100 shadow-sm border-t-2 p-4 ${monthlyProfit != null && monthlyProfit >= 0 ? 'border-t-emerald-500' : monthlyProfit != null ? 'border-t-red-400' : 'border-t-gray-200'}`}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <DollarSign className="w-3 h-3" /> Profit / Mo
            </p>
            {monthlyProfit != null ? (
              <p className={`text-xl font-bold tabular-nums ${monthlyProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatAUD(monthlyProfit)}
              </p>
            ) : (
              <p className="text-lg font-medium text-gray-300">—</p>
            )}
          </div>

          <div className={`bg-white rounded-xl border border-gray-100 shadow-sm border-t-2 p-4 ${
            marginPct != null
              ? marginPct < settings.margin_thresholds.red ? 'border-t-red-400'
              : marginPct < settings.margin_thresholds.yellow ? 'border-t-amber-400'
              : 'border-t-emerald-500'
              : 'border-t-gray-200'
          }`}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <BarChart3 className="w-3 h-3" /> Gross Margin
            </p>
            {marginPct != null ? (
              <>
                <p className={`text-xl font-bold tabular-nums ${
                  marginPct < settings.margin_thresholds.red ? 'text-red-600'
                  : marginPct < settings.margin_thresholds.yellow ? 'text-amber-600'
                  : 'text-emerald-600'
                }`}>
                  {marginPct.toFixed(0)}%
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {marginPct < settings.margin_thresholds.red ? 'Critical' : marginPct < settings.margin_thresholds.yellow ? 'Watch' : 'Healthy'}
                </p>
              </>
            ) : (
              <p className="text-lg font-medium text-gray-300">—</p>
            )}
          </div>
        </div>
      )}

      {/* Incomplete profile warning */}
      {!profileComplete && client.active && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">Profit data incomplete</p>
            <p className="text-xs text-amber-600 mt-0.5">Add cleaner hourly rate and hours per visit to enable margin tracking.</p>
          </div>
          <Link href={`/clients/${params.id}/edit`}>
            <button className="text-xs font-medium text-amber-700 hover:text-amber-900 flex items-center gap-1">
              Fix now <ChevronRight className="w-3 h-3" />
            </button>
          </Link>
        </div>
      )}

      {/* Details grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Contact */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Contact</h3>
          <div className="space-y-3">
            {client.contact_name && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-gray-700 text-xs font-bold">{client.contact_name.charAt(0).toUpperCase()}</span>
                </div>
                <span className="text-sm font-medium text-gray-800">{client.contact_name}</span>
              </div>
            )}
            {client.contact_email && (
              <a href={`mailto:${client.contact_email}`} className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors">
                <Mail className="w-4 h-4 text-gray-400" />
                {client.contact_email}
              </a>
            )}
            {client.contact_phone && (
              <a href={`tel:${client.contact_phone}`} className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors">
                <Phone className="w-4 h-4 text-gray-400" />
                {client.contact_phone}
              </a>
            )}
            {(client.address || client.suburb) && (
              <div className="flex items-start gap-2 text-sm text-gray-500">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <span>{[client.address, client.suburb, client.state, client.postcode].filter(Boolean).join(', ')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Contract */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Contract</h3>
          <div className="space-y-2.5">
            {[
              { label: 'Frequency',     value: client.frequency ? FREQUENCY_LABELS[client.frequency as keyof typeof FREQUENCY_LABELS] : null },
              { label: 'Days / week',   value: client.days_per_week != null ? `${client.days_per_week} ${client.days_per_week === 1 ? 'day' : 'days'}` : null },
              { label: 'Visits / month', value: client.visits_per_month != null ? Number(client.visits_per_month).toFixed(2) : null },
              { label: 'Rate per visit', value: client.rate_per_visit ? formatAUD(client.rate_per_visit) : null },
              { label: 'Started',       value: client.start_date ? formatDate(client.start_date) : null },
              { label: 'Tenure',        value: client.start_date ? formatTenure(client.start_date) : null },
            ].map(({ label, value }) => value ? (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="text-gray-400">{label}</span>
                <span className="font-medium text-gray-800">{value}</span>
              </div>
            ) : null)}

            {/* Service days */}
            {((client.service_days as string[]) ?? []).length > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Clean days</span>
                <span className="font-medium text-gray-800">
                  {(client.service_days as string[]).join(' · ')}
                </span>
              </div>
            )}

            {contractExpiry && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Contract expires</span>
                <span className={`font-medium flex items-center gap-1 ${daysToExpiry != null && daysToExpiry <= 14 ? 'text-red-600' : daysToExpiry != null && daysToExpiry <= 60 ? 'text-amber-600' : 'text-gray-800'}`}>
                  {daysToExpiry != null && daysToExpiry <= 60 && <Calendar className="w-3.5 h-3.5" />}
                  {formatDate(contractExpiry)}
                  {daysToExpiry != null && daysToExpiry >= 0 && daysToExpiry <= 60 && (
                    <span className="text-xs ml-1">({daysToExpiry}d)</span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Additional Services */}
      {((client as any).additional_services as AdditionalService[] | undefined)?.length ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Additional Services</h3>
          <div className="space-y-3">
            {((client as any).additional_services as AdditionalService[]).map((svc) => {
              const mult = MULT[svc.frequency] ?? 0
              const revMonth  = svc.my_rate_per_visit * mult
              const costMonth = svc.cleaner_cost_per_visit * mult
              const profMonth = revMonth - costMonth
              const freqLabel: Record<string, string> = {
                monthly: 'Monthly', quarterly: 'Quarterly',
                'bi-annual': 'Bi-annual', annual: 'Annual', one_off: 'One-off',
              }
              return (
                <div key={svc.id} className="flex items-start justify-between border border-gray-100 rounded-lg p-3 bg-gray-50">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{svc.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{freqLabel[svc.frequency] ?? svc.frequency}</p>
                  </div>
                  <div className="text-right space-y-0.5">
                    <p className="text-sm font-bold text-[#1e3a5f]">{formatAUD(svc.my_rate_per_visit)} / visit</p>
                    {svc.cleaner_cost_per_visit > 0 && (
                      <p className="text-xs text-gray-400">Cost: {formatAUD(svc.cleaner_cost_per_visit)} / visit</p>
                    )}
                    {mult > 0 && (
                      <p className="text-xs text-gray-400">≈ {formatAUD(revMonth)}/mo revenue
                        {costMonth > 0 ? `, ${formatAUD(profMonth)}/mo profit` : ''}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
            {/* Totals row */}
            {(() => {
              const svcs = (client as any).additional_services as AdditionalService[]
              const totalRev  = calcAdditionalMonthlyRevenue(svcs)
              const totalLab  = calcAdditionalMonthlyLabour(svcs)
              const totalProf = totalRev - totalLab
              if (svcs.length < 2 || totalRev === 0) return null
              return (
                <div className="flex gap-6 pt-2 border-t border-gray-200 text-sm">
                  <div><p className="text-xs text-gray-400">Total / Month</p><p className="font-bold text-[#1e3a5f]">{formatAUD(totalRev)}</p></div>
                  {totalLab > 0 && <div><p className="text-xs text-gray-400">Cost / Month</p><p className="font-bold text-red-500">{formatAUD(totalLab)}</p></div>}
                  {totalLab > 0 && <div><p className="text-xs text-gray-400">Profit / Month</p><p className={`font-bold ${totalProf >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatAUD(totalProf)}</p></div>}
                </div>
              )
            })()}
          </div>
        </div>
      ) : null}

      {/* Sites — multi-site clients */}
      {client.is_multi_site && clientSites.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-400" />
            Sites · {clientSites.length} location{clientSites.length !== 1 ? 's' : ''}
          </h3>
          <div className="space-y-3">
            {clientSites.map((site: any, i: number) => {
              const siteRate = site.rate_per_visit ? parseFloat(site.rate_per_visit) : 0
              const siteMRR  = siteRate && site.frequency
                ? calculateMonthlyValue(siteRate, site.frequency)
                : 0
              return (
                <div key={site.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#1e3a5f] text-white text-xs font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{site.site_name}</p>
                        {(site.address || site.suburb) && (
                          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            {[site.address, site.suburb, site.state, site.postcode].filter(Boolean).join(', ')}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                          {site.frequency && (
                            <span className="text-xs text-gray-500">
                              {FREQUENCY_LABELS[site.frequency as keyof typeof FREQUENCY_LABELS] ?? site.frequency}
                            </span>
                          )}
                          {site.days_per_week && (
                            <span className="text-xs text-gray-500">{site.days_per_week}×/wk</span>
                          )}
                          {(site.service_days ?? []).length > 0 && (
                            <span className="text-xs text-gray-500">{(site.service_days as string[]).join(' · ')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {siteMRR > 0 && (
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-gray-900">{formatAUD(siteRate)}/visit</p>
                        <p className="text-xs text-gray-400">≈ {formatAUD(siteMRR)}/mo</p>
                      </div>
                    )}
                  </div>
                  {site.scope_of_work && (
                    <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-200 leading-relaxed">{site.scope_of_work}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Notes */}
      {client.notes && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Notes</h3>
          <p className="text-sm text-gray-500 whitespace-pre-wrap leading-relaxed">{client.notes}</p>
        </div>
      )}

      {/* Financial History */}
      {financials.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-gray-400" />
            P&amp;L History (last 12 months)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs text-gray-400 font-medium pb-2">Month</th>
                  <th className="text-right text-xs text-gray-400 font-medium pb-2">Visits</th>
                  <th className="text-right text-xs text-gray-400 font-medium pb-2">Revenue</th>
                  <th className="text-right text-xs text-gray-400 font-medium pb-2">Hours</th>
                  <th className="text-right text-xs text-gray-400 font-medium pb-2">Cost</th>
                  <th className="text-right text-xs text-gray-400 font-medium pb-2">Profit</th>
                  <th className="text-center text-xs text-gray-400 font-medium pb-2">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {financials.map((row: any) => {
                  const margin = row.margin_pct
                  const isProjected = !row.invoice_id
                  const marginColor = margin == null ? 'text-gray-400'
                    : margin >= 55 ? 'text-emerald-600'
                    : margin >= 35 ? 'text-amber-600'
                    : 'text-red-600'
                  const profitColor = (row.profit ?? 0) >= 0 ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'
                  return (
                    <tr key={row.id ?? row.client_id + row.month} className="hover:bg-gray-50">
                      <td className="py-2.5 text-gray-700 font-medium">
                        {monthLabel(row.month)}
                        {isProjected && <span className="ml-1.5 text-xs text-gray-300 font-normal">est.</span>}
                      </td>
                      <td className="py-2.5 text-right text-gray-400 tabular-nums">{row.service_count ?? '—'}</td>
                      <td className="py-2.5 text-right text-gray-800 tabular-nums font-medium">
                        {row.income_ex_gst != null ? formatAUD(row.income_ex_gst) : '—'}
                      </td>
                      <td className="py-2.5 text-right text-gray-400 tabular-nums">
                        {row.cleaner_hours != null ? `${row.cleaner_hours}h` : '—'}
                      </td>
                      <td className="py-2.5 text-right text-gray-400 tabular-nums">
                        {row.cleaner_cost_ex_gst != null ? formatAUD(row.cleaner_cost_ex_gst) : '—'}
                      </td>
                      <td className={`py-2.5 text-right tabular-nums ${profitColor}`}>
                        {row.profit != null ? formatAUD(row.profit) : '—'}
                      </td>
                      <td className="py-2.5 text-center">
                        {margin != null ? (
                          <span className={`text-xs font-semibold ${marginColor}`}>{margin.toFixed(0)}%</span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Clean History */}
      {allJobs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            Clean History · {allJobs.length} job{allJobs.length !== 1 ? 's' : ''}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs text-gray-400 font-medium pb-2 pr-4">Date</th>
                  <th className="text-left text-xs text-gray-400 font-medium pb-2 pr-4">Cleaner</th>
                  <th className="text-left text-xs text-gray-400 font-medium pb-2 pr-4">Started</th>
                  <th className="text-left text-xs text-gray-400 font-medium pb-2 pr-4">Finished</th>
                  <th className="text-left text-xs text-gray-400 font-medium pb-2 pr-4">Duration</th>
                  <th className="text-right text-xs text-gray-400 font-medium pb-2 pr-4">Photos</th>
                  <th className="text-center text-xs text-gray-400 font-medium pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allJobs.map((job: any) => {
                  const sub = Array.isArray(job.job_submissions) ? job.job_submissions[0] : job.job_submissions
                  const startedAt   = sub?.started_at   ? new Date(sub.started_at)   : null
                  const completedAt = sub?.completed_at ? new Date(sub.completed_at) : null
                  const photoCount  = (sub?.photo_urls ?? []).length
                  const durationMin = startedAt && completedAt
                    ? Math.round((completedAt.getTime() - startedAt.getTime()) / 60000)
                    : null

                  const fmtTime = (d: Date | null) => d
                    ? d.toLocaleTimeString('en-AU', { timeZone: 'Australia/Brisbane', hour: '2-digit', minute: '2-digit', hour12: true })
                    : '—'

                  const statusStyle =
                    job.status === 'completed'   ? 'bg-emerald-50 text-emerald-700' :
                    job.status === 'in_progress' ? 'border border-blue-200 text-blue-600' :
                    job.status === 'flagged'     ? 'bg-red-50 text-red-600' :
                    'bg-gray-100 text-gray-400'

                  const statusLabel =
                    job.status === 'not_started' ? 'Pending' :
                    job.status === 'in_progress' ? 'Active' :
                    job.status === 'completed'   ? 'Done' :
                    job.status === 'flagged'     ? 'Flagged' : job.status

                  return (
                    <tr key={job.id} className="hover:bg-gray-50">
                      <td className="py-2.5 pr-4 text-gray-700 font-medium whitespace-nowrap">
                        {new Date(job.scheduled_date + 'T00:00:00').toLocaleDateString('en-AU', {
                          weekday: 'short', day: 'numeric', month: 'short',
                        })}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-500 whitespace-nowrap">
                        {job.profiles?.full_name ?? '—'}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-700 tabular-nums whitespace-nowrap">
                        {fmtTime(startedAt)}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-700 tabular-nums whitespace-nowrap">
                        {fmtTime(completedAt)}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-500 tabular-nums whitespace-nowrap">
                        {durationMin != null ? `${durationMin}m` : '—'}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-gray-500 tabular-nums">
                        {photoCount > 0 ? photoCount : '—'}
                      </td>
                      <td className="py-2.5 text-center">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusStyle}`}>
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Documents + Surveys side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ClientDocuments clientId={params.id} documents={documents} />
        <ClientSurveys clientId={params.id} surveys={surveys} />
      </div>
    </div>
  )
}
