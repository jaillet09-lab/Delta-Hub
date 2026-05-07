'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { SERVICE_TYPE_LABELS, FREQUENCY_LABELS, STATE_OPTIONS } from '@/lib/constants'
import type { ExtendedServiceType } from '@/lib/constants'
import { calculateMonthlyValue, calculateAnnualValue, calculateProfitBreakdown } from '@/lib/billing'
import { formatAUD } from '@/lib/formatters'
import type { Client, FrequencyType, AdditionalService, AdditionalServiceFrequency } from '@/types/app'
import { ADDITIONAL_SERVICE_MULTIPLIERS as MULT, calcAdditionalMonthlyRevenue as calcAddRev, calcAdditionalMonthlyLabour as calcAddLab } from '@/types/app'
import { AlertTriangle, Globe, Plus, Trash2, Building2, MapPin } from 'lucide-react'
import { SiteBuilder, SiteFormData } from '@/components/clients/SiteBuilder'

interface CleanerOption {
  id: string
  fullName: string
}

interface ClientFormProps {
  defaultValues?: Partial<Client> & { [key: string]: any }
  defaultSites?: SiteFormData[]
  action: (formData: FormData) => Promise<{ error?: Record<string, string[]> } | void>
  submitLabel?: string
  cleaners?: CleanerOption[]
}

const SERVICE_TYPES: ExtendedServiceType[] = [
  'general_cleaning',
  'pressure_washing',
  'window_cleaning',
  'floor_care',
  'carpet_cleaning',
  'hygiene_bins',
]
const FREQUENCY_OPTIONS = Object.entries(FREQUENCY_LABELS).map(([value, label]) => ({ value, label }))
const STATE_SELECT_OPTIONS = STATE_OPTIONS.map((s) => ({ value: s, label: s }))

const ADDITIONAL_SERVICE_PRESETS = [
  'Window Cleaning',
  'Pressure Washing',
  'Vinyl / Floor Polish',
  'Carpet Steam Clean',
  'End of Lease Clean',
  'Custom…',
]

const ADD_SERVICE_FREQ_OPTIONS: { value: AdditionalServiceFrequency; label: string }[] = [
  { value: 'monthly',    label: 'Monthly'    },
  { value: 'quarterly',  label: 'Quarterly'  },
  { value: 'bi-annual',  label: 'Bi-annual'  },
  { value: 'annual',     label: 'Annual'     },
  { value: 'one_off',    label: 'One-off'    },
]

// Frequencies that use a day picker
const MULTI_DAY_FREQUENCIES: FrequencyType[] = ['daily', 'weekly']
const SINGLE_DAY_FREQUENCIES: FrequencyType[] = ['fortnightly']

export function ClientForm({ defaultValues, defaultSites, action, submitLabel = 'Save Client', cleaners = [] }: ClientFormProps) {
  const router = useRouter()
  const [selectedServices, setSelectedServices] = useState<ExtendedServiceType[]>((defaultValues?.service_type as ExtendedServiceType[]) || [])
  const [selectedDays,     setSelectedDays]     = useState<string[]>((defaultValues?.service_days as string[]) || [])
  const [frequency,    setFrequency]    = useState<FrequencyType>((defaultValues?.frequency as FrequencyType) || 'monthly')
  const [daysPerWeek,  setDaysPerWeek]  = useState<string>(defaultValues?.days_per_week?.toString() || '')
  const [rate,         setRate]         = useState<string>(defaultValues?.rate_per_visit?.toString() || '')
  const [cleanerRate,  setCleanerRate]  = useState<string>(defaultValues?.cleaner_hourly_rate?.toString() || '')
  const [cleanerHours, setCleanerHours] = useState<string>(defaultValues?.cleaner_hours_per_visit?.toString() || '')
  const [errors,       setErrors]       = useState<Record<string, string[]>>({})
  const [loading,      setLoading]      = useState(false)
  const [contactEmail, setContactEmail] = useState(defaultValues?.contact_email || '')
  const [additionalServices, setAdditionalServices] = useState<AdditionalService[]>(
    (defaultValues as any)?.additional_services ?? []
  )
  const [isMultiSite, setIsMultiSite] = useState<boolean>((defaultValues as any)?.is_multi_site ?? false)
  const [sites, setSites] = useState<SiteFormData[]>(defaultSites ?? [])
  const [createPortal, setCreatePortal] = useState(false)
  const [portalEmail,  setPortalEmail]  = useState(defaultValues?.contact_email || '')
  const [portalPass,   setPortalPass]   = useState('')

  const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  // Always show day picker so manager can always see which days a client is cleaned
  const dpwNum = parseInt(daysPerWeek) || 0
  const showMultiDayPicker = MULTI_DAY_FREQUENCIES.includes(frequency) || dpwNum > 1
  const showSingleDayPicker = !showMultiDayPicker && SINGLE_DAY_FREQUENCIES.includes(frequency)
  const showDayPicker = true  // always shown

  function toggleDay(day: string) {
    if (showSingleDayPicker) {
      // Radio behaviour: select only this day
      setSelectedDays([day])
    } else {
      setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
    }
  }

  const rateNum  = parseFloat(rate)         || 0
  const hrNum    = parseFloat(cleanerRate)  || 0
  const hoursNum = parseFloat(cleanerHours) || 0
  const hasCosts = hrNum > 0 && hoursNum > 0 && rateNum > 0

  const breakdown    = hasCosts ? calculateProfitBreakdown(rateNum, frequency, hrNum, hoursNum) : null
  const monthlyValue = rateNum > 0 ? calculateMonthlyValue(rateNum, frequency) : 0
  const annualValue  = calculateAnnualValue(monthlyValue)

  function toggleService(type: ExtendedServiceType) {
    setSelectedServices((prev) => prev.includes(type) ? prev.filter((s) => s !== type) : [...prev, type])
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setErrors({})
    const fd = new FormData(e.currentTarget)
    fd.delete('service_type')
    selectedServices.forEach((s) => fd.append('service_type', s))
    fd.delete('service_days')
    selectedDays.forEach((d) => fd.append('service_days', d))
    fd.set('additional_services', JSON.stringify(additionalServices))
    fd.set('is_multi_site', isMultiSite ? 'true' : 'false')
    if (isMultiSite) {
      fd.set('sites', JSON.stringify(sites))
    }
    // Portal fields
    if (createPortal && portalEmail && portalPass) {
      fd.set('portal_email', portalEmail)
      fd.set('portal_password', portalPass)
    } else {
      fd.delete('portal_email')
      fd.delete('portal_password')
    }
    try {
      const result = await action(fd)
      if (result?.error) {
        setErrors(result.error as Record<string, string[]>)
        setLoading(false)
      }
      // On success, action calls redirect() — Next.js handles navigation
      // setLoading stays true briefly then component unmounts
    } catch (err: any) {
      // Next.js redirect throws internally with NEXT_REDIRECT digest — safe to ignore
      if (err?.digest?.startsWith?.('NEXT_REDIRECT')) return
      setErrors({ _form: ['An unexpected error occurred. Please try again.'] })
      setLoading(false)
    }
  }

  const marginColor = breakdown
    ? breakdown.marginPct < 24 ? 'text-red-600' : breakdown.marginPct < 40 ? 'text-amber-600' : 'text-green-600'
    : ''

  const cleanerOptions = [
    { value: '', label: 'Unassigned' },
    ...cleaners.map((c) => ({ value: c.id, label: c.fullName })),
  ]

  function addAdditionalService() {
    const newSvc: AdditionalService = {
      id: crypto.randomUUID(),
      name: 'Window Cleaning',
      frequency: 'quarterly',
      my_rate_per_visit: 0,
      cleaner_cost_per_visit: 0,
    }
    setAdditionalServices(prev => [...prev, newSvc])
  }

  function removeAdditionalService(id: string) {
    setAdditionalServices(prev => prev.filter(s => s.id !== id))
  }

  function updateAdditionalService(id: string, field: keyof AdditionalService, value: string | number) {
    setAdditionalServices(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  const addRevMonth  = calcAddRev(additionalServices)
  const addLabMonth  = calcAddLab(additionalServices)
  const addProfMonth = addRevMonth - addLabMonth

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errors._form && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {errors._form.join(', ')}
        </div>
      )}

      {/* Business details */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Business Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Input label="Business Name *" name="business_name" defaultValue={defaultValues?.business_name} error={errors.business_name?.[0]} placeholder="e.g. Mitchelton Dental Centre" required />
          </div>
          <Input label="Contact Name"  name="contact_name"  defaultValue={defaultValues?.contact_name  || ''} placeholder="e.g. Jodie Smith" />
          <Input label="Contact Phone" name="contact_phone" type="tel" defaultValue={defaultValues?.contact_phone || ''} placeholder="07 XXXX XXXX" />
          <div className="md:col-span-2">
            <Input label="Contact Email" name="contact_email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="contact@business.com.au" />
          </div>
          <div className="md:col-span-2">
            <Input label="Street Address" name="address" defaultValue={defaultValues?.address || ''} placeholder="123 Example Street" />
          </div>
          <Input label="Suburb"   name="suburb"   defaultValue={defaultValues?.suburb   || ''} placeholder="e.g. Fortitude Valley" />
          <Input label="Postcode" name="postcode" defaultValue={defaultValues?.postcode || ''} placeholder="4000" maxLength={4} error={errors.postcode?.[0]} />
          <Select label="State" name="state" defaultValue={defaultValues?.state || 'QLD'} options={STATE_SELECT_OPTIONS} />
        </div>
      </div>

      {/* Site Type Toggle */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Site Type</h3>
        <p className="text-xs text-gray-400 mb-4">Does this client have one location or multiple separate sites?</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setIsMultiSite(false)}
            className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${!isMultiSite ? 'border-[#1e3a5f] bg-[#1e3a5f]/5' : 'border-gray-200 hover:border-gray-300'}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${!isMultiSite ? 'bg-[#1e3a5f] text-white' : 'bg-gray-100 text-gray-400'}`}>
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <p className={`text-sm font-semibold ${!isMultiSite ? 'text-[#1e3a5f]' : 'text-gray-600'}`}>Single Site</p>
              <p className="text-xs text-gray-400 mt-0.5">One location</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setIsMultiSite(true)}
            className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${isMultiSite ? 'border-[#1e3a5f] bg-[#1e3a5f]/5' : 'border-gray-200 hover:border-gray-300'}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isMultiSite ? 'bg-[#1e3a5f] text-white' : 'bg-gray-100 text-gray-400'}`}>
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <p className={`text-sm font-semibold ${isMultiSite ? 'text-[#1e3a5f]' : 'text-gray-600'}`}>Multi-Site</p>
              <p className="text-xs text-gray-400 mt-0.5">Multiple locations</p>
            </div>
          </button>
        </div>
      </div>

      {/* Multi-Site Builder */}
      {isMultiSite && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Sites</h3>
            <p className="text-xs text-gray-400 mt-0.5">Add each location with its own schedule, billing, and cleaner details.</p>
          </div>
          <SiteBuilder
            defaultSites={sites.length > 0 ? sites : undefined}
            cleaners={cleaners}
            onChange={setSites}
          />
        </div>
      )}

      {/* Service configuration — single site only */}
      {!isMultiSite && (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Service Configuration</h3>

        {/* Service Types */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Service Types *</label>
          {errors.service_type && <p className="text-xs text-red-600 mb-2">{errors.service_type[0]}</p>}
          <div className="flex flex-wrap gap-2">
            {SERVICE_TYPES.map((type) => (
              <button key={type} type="button" onClick={() => toggleService(type)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${selectedServices.includes(type) ? 'bg-brand-navy text-white border-brand-navy' : 'bg-white text-gray-600 border-gray-300 hover:border-brand-navy'}`}>
                {SERVICE_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>

        {/* Scope of Work */}
        <Textarea
          label="Scope of Work"
          name="scope_of_work"
          defaultValue={defaultValues?.scope_of_work || ''}
          placeholder="Describe what's included in each clean..."
          rows={3}
        />

        {/* Access Details */}
        <Textarea
          label="Access Details"
          name="access_details"
          defaultValue={defaultValues?.access_details || ''}
          placeholder="Entry codes, alarm pin, key location..."
          rows={2}
        />

        {/* Cleaning Schedule — days per week + day picker */}
        <div className="border border-gray-200 rounded-xl p-4 space-y-4 bg-gray-50/60">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Cleaning Schedule</p>

          {/* Times per week */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              How many times per week?
            </label>
            <select
              className="w-full bg-white border border-gray-200 text-gray-900 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#1e3a5f]"
              value={daysPerWeek}
              onChange={(e) => {
                setDaysPerWeek(e.target.value)
                // Auto-trim selected days if count drops below current selection
                const n = parseInt(e.target.value) || 0
                if (n > 0 && selectedDays.length > n) {
                  setSelectedDays(selectedDays.slice(0, n))
                }
              }}
            >
              <option value="">— Select —</option>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>{n} {n === 1 ? 'day' : 'days'} per week</option>
              ))}
            </select>
            {errors.days_per_week?.[0] && (
              <p className="text-xs text-red-600 mt-1">{errors.days_per_week[0]}</p>
            )}
          </div>

          {/* Which days */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Which days?
              {daysPerWeek && parseInt(daysPerWeek) > 0 && (
                <span className="text-gray-400 font-normal text-xs ml-1">
                  (select {daysPerWeek} {parseInt(daysPerWeek) === 1 ? 'day' : 'days'})
                </span>
              )}
            </label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => (
                <button key={day} type="button" onClick={() => toggleDay(day)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${selectedDays.includes(day) ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]' : 'bg-white text-gray-600 border-gray-300 hover:border-[#1e3a5f]'}`}>
                  {day}
                </button>
              ))}
            </div>
            {selectedDays.length > 0 && (
              <p className="text-xs text-[#1e3a5f] mt-2 font-medium">
                Cleans on: {selectedDays.join(', ')}
              </p>
            )}
          </div>
        </div>

        {/* Assigned Cleaner */}
        {cleaners.length > 0 && (
          <Select
            label="Assigned Cleaner"
            name="assigned_cleaner_id"
            defaultValue={defaultValues?.assigned_cleaner_id || ''}
            options={cleanerOptions}
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Input label="Start Date *" name="start_date" type="date" defaultValue={defaultValues?.start_date ? String(defaultValues.start_date).substring(0, 10) : ''} />
            <p className="text-xs text-gray-400 mt-1">Required — used to calculate fortnightly &amp; 4-weekly schedules accurately</p>
          </div>
          <Input label="Contract Expiry Date" name="contract_expiry_date" type="date" defaultValue={defaultValues?.contract_expiry_date ? String(defaultValues.contract_expiry_date).substring(0, 10) : ''} />
        </div>
      </div>
      )}

      {/* Billing — single site only */}
      {!isMultiSite && (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Billing</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select label="Service Frequency *" name="frequency" value={frequency} onChange={(e) => setFrequency(e.target.value as FrequencyType)} options={FREQUENCY_OPTIONS} />
          <Input  label="Rate Per Visit ($) *" name="rate_per_visit" type="number" step="0.01" min="0" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0.00" error={errors.rate_per_visit?.[0]} />
        </div>
        {rateNum > 0 && (
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
            <div><p className="text-xs text-gray-500">Monthly Revenue</p><p className="text-lg font-bold text-brand-navy">{formatAUD(monthlyValue)}</p></div>
            <div><p className="text-xs text-gray-500">Annual Revenue</p><p className="text-lg font-bold text-brand-navy">{formatAUD(annualValue)}</p></div>
          </div>
        )}
      </div>
      )}

      {/* Cleaner Costs — single site only */}
      {!isMultiSite && (
      <div className="bg-white rounded-xl border-2 border-brand-navy/20 shadow-sm p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Cleaner Costs</h3>
            <p className="text-xs text-gray-400 mt-0.5">Required for margin and profit tracking</p>
          </div>
          {!hasCosts && (
            <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
              <AlertTriangle className="w-3 h-3" />
              Incomplete
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Cleaner Hourly Rate ($)" name="cleaner_hourly_rate"    type="number" step="0.25" min="0" value={cleanerRate}  onChange={(e) => setCleanerRate(e.target.value)}  placeholder="e.g. 40" />
          <Input label="Hours per Visit"          name="cleaner_hours_per_visit" type="number" step="0.25" min="0" value={cleanerHours} onChange={(e) => setCleanerHours(e.target.value)} placeholder="e.g. 2.5" />
        </div>
        {breakdown && (
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100">
            <div><p className="text-xs text-gray-400">Labour / Month</p><p className="text-base font-bold text-red-500">{formatAUD(breakdown.monthlyLabour)}</p></div>
            <div><p className="text-xs text-gray-400">Profit / Month</p><p className={`text-base font-bold ${breakdown.monthlyProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatAUD(breakdown.monthlyProfit)}</p></div>
            <div><p className="text-xs text-gray-400">Gross Margin</p><p className={`text-base font-bold ${marginColor}`}>{breakdown.marginPct.toFixed(0)}%</p></div>
          </div>
        )}
      </div>
      )}

      {/* Additional Services */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Additional Services</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              One-off or periodic services billed separately — window cleaning, pressure washing, etc.
            </p>
          </div>
          <button
            type="button"
            onClick={addAdditionalService}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#1e3a5f] text-white hover:bg-[#162d4a] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Service
          </button>
        </div>

        {additionalServices.length === 0 && (
          <p className="text-xs text-gray-400 italic">No additional services added yet.</p>
        )}

        {additionalServices.map((svc, i) => (
          <div key={svc.id} className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Service {i + 1}</span>
              <button
                type="button"
                onClick={() => removeAdditionalService(svc.id)}
                className="text-red-400 hover:text-red-600 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Service name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Service Name</label>
                <select
                  className="w-full bg-white border border-gray-200 text-gray-900 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                  value={ADDITIONAL_SERVICE_PRESETS.includes(svc.name) ? svc.name : 'Custom…'}
                  onChange={(e) => {
                    if (e.target.value !== 'Custom…') {
                      updateAdditionalService(svc.id, 'name', e.target.value)
                    } else {
                      updateAdditionalService(svc.id, 'name', '')
                    }
                  }}
                >
                  {ADDITIONAL_SERVICE_PRESETS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                {(!ADDITIONAL_SERVICE_PRESETS.includes(svc.name) || svc.name === '') && (
                  <input
                    type="text"
                    className="mt-1.5 w-full bg-white border border-gray-200 text-gray-900 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                    placeholder="Custom service name…"
                    value={svc.name === 'Custom…' ? '' : svc.name}
                    onChange={(e) => updateAdditionalService(svc.id, 'name', e.target.value)}
                  />
                )}
              </div>

              {/* Frequency */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Frequency</label>
                <select
                  className="w-full bg-white border border-gray-200 text-gray-900 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                  value={svc.frequency}
                  onChange={(e) => updateAdditionalService(svc.id, 'frequency', e.target.value as AdditionalServiceFrequency)}
                >
                  {ADD_SERVICE_FREQ_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">My Charge / Visit ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full bg-white border border-gray-200 text-gray-900 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                  placeholder="0.00"
                  value={svc.my_rate_per_visit || ''}
                  onChange={(e) => updateAdditionalService(svc.id, 'my_rate_per_visit', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cleaner Cost / Visit ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full bg-white border border-gray-200 text-gray-900 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                  placeholder="0.00"
                  value={svc.cleaner_cost_per_visit || ''}
                  onChange={(e) => updateAdditionalService(svc.id, 'cleaner_cost_per_visit', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Per-service monthly preview */}
            {svc.my_rate_per_visit > 0 && svc.frequency !== 'one_off' && (
              <div className="flex gap-4 pt-2 border-t border-gray-200 text-xs text-gray-500">
                <span>≈ <strong className="text-gray-900">{formatAUD(svc.my_rate_per_visit * (MULT[svc.frequency] ?? 0))}</strong> revenue/month</span>
                {svc.cleaner_cost_per_visit > 0 && (
                  <span>≈ <strong className="text-gray-900">{formatAUD(svc.cleaner_cost_per_visit * (MULT[svc.frequency] ?? 0))}</strong> cost/month</span>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Summary row */}
        {additionalServices.length > 1 && addRevMonth > 0 && (
          <div className="flex gap-6 pt-3 border-t border-gray-200 text-sm">
            <div>
              <p className="text-xs text-gray-400">Additional Rev / Month</p>
              <p className="font-bold text-[#1e3a5f]">{formatAUD(addRevMonth)}</p>
            </div>
            {addLabMonth > 0 && (
              <div>
                <p className="text-xs text-gray-400">Additional Cost / Month</p>
                <p className="font-bold text-red-500">{formatAUD(addLabMonth)}</p>
              </div>
            )}
            {addLabMonth > 0 && (
              <div>
                <p className="text-xs text-gray-400">Additional Profit / Month</p>
                <p className={`font-bold ${addProfMonth >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatAUD(addProfMonth)}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Notes */}
      <Textarea label="Notes" name="notes" defaultValue={defaultValues?.notes || ''} placeholder="Site access instructions, special requirements, etc." rows={3} />

      {defaultValues?.id && <input type="hidden" name="active" value={defaultValues?.active ? 'true' : 'false'} />}

      {/* Portal Access — only shown on new client forms */}
      {!defaultValues?.id && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-700">Client Portal Access</h3>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!createPortal) setPortalEmail(contactEmail)
                setCreatePortal((v) => !v)
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${createPortal ? 'bg-brand-navy' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${createPortal ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          {!createPortal && (
            <p className="text-xs text-gray-400">Toggle on to create a client portal login at the same time as adding this client.</p>
          )}
          {createPortal && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">The client will be able to log in to their portal with these credentials.</p>
              <Input
                label="Portal Email"
                type="email"
                value={portalEmail}
                onChange={(e) => setPortalEmail(e.target.value)}
                placeholder="contact@business.com.au"
              />
              <Input
                label="Temporary Password"
                type="text"
                value={portalPass}
                onChange={(e) => setPortalPass(e.target.value)}
                placeholder="Min 5 characters"
              />
              {errors._portal && (
                <p className="text-xs text-red-600">{errors._portal[0]}</p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={loading}>{loading ? 'Saving...' : submitLabel}</Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  )
}
