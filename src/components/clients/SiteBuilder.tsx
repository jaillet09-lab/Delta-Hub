'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp, MapPin } from 'lucide-react'
import { FREQUENCY_LABELS } from '@/lib/constants'
import { formatAUD } from '@/lib/formatters'
import { calculateMonthlyValue } from '@/lib/billing'

export interface SiteFormData {
  _localId:               string   // React key only
  dbId?:                  string   // set when editing existing site
  site_name:              string
  address:                string
  suburb:                 string
  state:                  string
  postcode:               string
  scope_of_work:          string
  frequency:              string
  service_days:           string[]
  days_per_week:          string
  access_details:         string
  assigned_cleaner_id:    string
  rate_per_visit:         string
  cleaner_hourly_rate:    string
  cleaner_hours_per_visit: string
  notes:                  string
}

interface CleanerOption { id: string; fullName: string }

interface Props {
  defaultSites?: SiteFormData[]
  cleaners?: CleanerOption[]
  onChange: (sites: SiteFormData[]) => void
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const FREQ_OPTIONS = Object.entries(FREQUENCY_LABELS).map(([v, l]) => ({ value: v, label: l }))

function newSite(): SiteFormData {
  return {
    _localId: crypto.randomUUID(),
    site_name: '', address: '', suburb: '', state: 'QLD', postcode: '',
    scope_of_work: '', frequency: 'weekly', service_days: [], days_per_week: '',
    access_details: '', assigned_cleaner_id: '', rate_per_visit: '',
    cleaner_hourly_rate: '', cleaner_hours_per_visit: '', notes: '',
  }
}

const inp = 'w-full bg-white border border-gray-200 text-gray-900 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#1e3a5f] transition-colors'
const lbl = 'block text-xs font-medium text-gray-600 mb-1'

export function SiteBuilder({ defaultSites, cleaners = [], onChange }: Props) {
  const initialSites = defaultSites?.length ? defaultSites : [newSite()]
  const [sites, setSites]     = useState<SiteFormData[]>(initialSites)
  const [expanded, setExpanded] = useState<Set<string>>(new Set<string>(initialSites[0]?._localId ? [initialSites[0]._localId] : []))

  // Sync initial state to parent so submit always has the correct data
  // even if the user never edits any fields
  useEffect(() => { onChange(initialSites) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function update(id: string, field: keyof SiteFormData, value: string | string[]) {
    const next = sites.map((s) => s._localId === id ? { ...s, [field]: value } : s)
    setSites(next)
    onChange(next)
  }

  function addSite() {
    const s = newSite()
    const next = [...sites, s]
    setSites(next)
    setExpanded((prev) => new Set(Array.from(prev).concat(s._localId)))
    onChange(next)
  }

  function removeSite(id: string) {
    const next = sites.filter((s) => s._localId !== id)
    setSites(next)
    onChange(next)
  }

  function toggleDay(siteId: string, day: string) {
    const site = sites.find((s) => s._localId === siteId)!
    const days = site.service_days.includes(day)
      ? site.service_days.filter((d) => d !== day)
      : [...site.service_days, day]
    update(siteId, 'service_days', days)
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const cleanerOptions = [
    { value: '', label: 'Unassigned' },
    ...cleaners.map((c) => ({ value: c.id, label: c.fullName })),
  ]

  return (
    <div className="space-y-3">
      {sites.map((site, i) => {
        const open = expanded.has(site._localId)
        const rate = parseFloat(site.rate_per_visit) || 0
        const monthly = rate > 0 && site.frequency
          ? calculateMonthlyValue(rate, site.frequency as any)
          : 0

        return (
          <div key={site._localId} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
            {/* Header */}
            <button
              type="button"
              onClick={() => toggleExpand(site._localId)}
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#1e3a5f] text-white text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {site.site_name || `Site ${i + 1}`}
                  </p>
                  {(site.address || site.suburb) && (
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />
                      {[site.address, site.suburb].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {monthly > 0 && (
                  <span className="text-xs font-semibold text-[#1e3a5f] hidden sm:block">
                    {formatAUD(monthly)}/mo
                  </span>
                )}
                {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
            </button>

            {/* Expanded content */}
            {open && (
              <div className="border-t border-gray-100 px-5 py-4 space-y-5">

                {/* Site name */}
                <div>
                  <label className={lbl}>Site Name *</label>
                  <input className={inp} value={site.site_name} onChange={(e) => update(site._localId, 'site_name', e.target.value)} placeholder="e.g. Brisbane CBD Office" />
                </div>

                {/* Address */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className={lbl}>Street Address</label>
                    <input className={inp} value={site.address} onChange={(e) => update(site._localId, 'address', e.target.value)} placeholder="123 Example Street" />
                  </div>
                  <div>
                    <label className={lbl}>Suburb</label>
                    <input className={inp} value={site.suburb} onChange={(e) => update(site._localId, 'suburb', e.target.value)} placeholder="Fortitude Valley" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={lbl}>State</label>
                      <input className={inp} value={site.state} onChange={(e) => update(site._localId, 'state', e.target.value)} placeholder="QLD" />
                    </div>
                    <div>
                      <label className={lbl}>Postcode</label>
                      <input className={inp} value={site.postcode} onChange={(e) => update(site._localId, 'postcode', e.target.value)} placeholder="4000" maxLength={4} />
                    </div>
                  </div>
                </div>

                {/* Scope */}
                <div>
                  <label className={lbl}>Cleaning Scope</label>
                  <textarea className={inp} rows={2} value={site.scope_of_work} onChange={(e) => update(site._localId, 'scope_of_work', e.target.value)} placeholder="What's included in each clean…" />
                </div>

                {/* Schedule */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Schedule</p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className={lbl}>Frequency</label>
                      <select className={inp} value={site.frequency} onChange={(e) => update(site._localId, 'frequency', e.target.value)}>
                        {FREQ_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={lbl}>Times / week</label>
                      <select className={inp} value={site.days_per_week} onChange={(e) => update(site._localId, 'days_per_week', e.target.value)}>
                        <option value="">— Select —</option>
                        {[1,2,3,4,5,6,7].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'day' : 'days'}/wk</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Cleaning Days</label>
                    <div className="flex flex-wrap gap-1.5">
                      {DAYS.map((day) => (
                        <button key={day} type="button" onClick={() => toggleDay(site._localId, day)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${site.service_days.includes(day) ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#1e3a5f]'}`}>
                          {day}
                        </button>
                      ))}
                    </div>
                    {site.service_days.length > 0 && (
                      <p className="text-xs text-[#1e3a5f] font-medium mt-2">Cleans on: {site.service_days.join(', ')}</p>
                    )}
                  </div>
                </div>

                {/* Billing */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Billing</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={lbl}>Rate / Visit ($)</label>
                      <input className={inp} type="number" step="0.01" min="0" value={site.rate_per_visit} onChange={(e) => update(site._localId, 'rate_per_visit', e.target.value)} placeholder="0.00" />
                    </div>
                    <div>
                      <label className={lbl}>Cleaner $/hr</label>
                      <input className={inp} type="number" step="0.25" min="0" value={site.cleaner_hourly_rate} onChange={(e) => update(site._localId, 'cleaner_hourly_rate', e.target.value)} placeholder="0" />
                    </div>
                    <div>
                      <label className={lbl}>Hrs / visit</label>
                      <input className={inp} type="number" step="0.25" min="0" value={site.cleaner_hours_per_visit} onChange={(e) => update(site._localId, 'cleaner_hours_per_visit', e.target.value)} placeholder="0" />
                    </div>
                  </div>
                  {monthly > 0 && (
                    <p className="text-xs text-[#1e3a5f] font-medium mt-2">≈ {formatAUD(monthly)} / month</p>
                  )}
                </div>

                {/* Operations */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Operations</p>
                  {cleaners.length > 0 && (
                    <div className="mb-3">
                      <label className={lbl}>Assigned Cleaner</label>
                      <select className={inp} value={site.assigned_cleaner_id} onChange={(e) => update(site._localId, 'assigned_cleaner_id', e.target.value)}>
                        {cleanerOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="mb-3">
                    <label className={lbl}>Access Details</label>
                    <textarea className={inp} rows={2} value={site.access_details} onChange={(e) => update(site._localId, 'access_details', e.target.value)} placeholder="Entry codes, alarm pin, key location…" />
                  </div>
                  <div>
                    <label className={lbl}>Site Notes</label>
                    <textarea className={inp} rows={2} value={site.notes} onChange={(e) => update(site._localId, 'notes', e.target.value)} placeholder="Any other instructions…" />
                  </div>
                </div>

                {/* Remove */}
                {sites.length > 1 && (
                  <div className="pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => removeSite(site._localId)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove this site
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Add site */}
      <button
        type="button"
        onClick={addSite}
        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm font-medium text-gray-500 hover:border-[#1e3a5f] hover:text-[#1e3a5f] transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add another site
      </button>
    </div>
  )
}
