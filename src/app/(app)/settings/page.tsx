'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import {
  updateBusinessSettingsAction,
  updateMarginThresholdsAction,
  updateSettingAction,
  updateComplianceInfoAction,
} from '@/actions/settings'
import type { AppSettings, SurveyQuestion } from '@/types/app'
import { Settings, Building2, Percent, MessageSquare, Bell, Plus, Trash2, ShieldCheck } from 'lucide-react'

const DEFAULT: AppSettings = {
  business: { name: 'Delta Cleaning', email: 'hello@deltacleaning.com.au', phone: '0412 844 238', website: 'https://www.deltacleaning.com.au', address: 'Brisbane, QLD' },
  margin_thresholds: { red: 24, yellow: 40 },
  valuation_multiple: 2.5,
  survey_frequency_days: 90,
  lead_followup_days: 7,
  contract_renewal_days: 60,
  survey_questions: [],
}

export default function SettingsPage() {
  const [settings, setSettings]           = useState<AppSettings>(DEFAULT)
  const [loading,  setLoading]            = useState(true)
  const [saved,    setSaved]              = useState<string | null>(null)
  const [abn,      setAbn]               = useState('')
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState('')

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => { setSettings(d); setLoading(false) })
      .catch(() => setLoading(false))
    // Load compliance info from settings table directly
    fetch('/api/settings/compliance')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) {
          setAbn(d.abn ?? '')
          setInsurancePolicyNumber(d.insurance_policy_number ?? '')
        }
      })
      .catch(() => {})
  }, [])

  async function save(section: string, fn: () => Promise<void>) {
    await fn()
    setSaved(section)
    setTimeout(() => setSaved(null), 2000)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-sm text-gray-400">Loading settings…</div>
  )

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Settings</h2>
        <p className="text-sm text-gray-500 mt-0.5">Business configuration and system defaults</p>
      </div>

      {/* Business Details */}
      <Card>
        <div className="flex items-center gap-2 mb-5">
          <Building2 className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">Business Details</h3>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            await save('business', () => updateBusinessSettingsAction(new FormData(e.currentTarget)))
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Business Name" name="name"    defaultValue={settings.business.name}    placeholder="Delta Cleaning" />
            <Input label="Email"         name="email"   defaultValue={settings.business.email}   placeholder="hello@example.com" />
            <Input label="Phone"         name="phone"   defaultValue={settings.business.phone}   placeholder="0400 000 000" />
            <Input label="Website"       name="website" defaultValue={settings.business.website} placeholder="https://..." />
            <div className="sm:col-span-2">
              <Input label="Address" name="address" defaultValue={settings.business.address} placeholder="Brisbane, QLD" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm">Save</Button>
            {saved === 'business' && <p className="text-xs text-green-600">Saved ✓</p>}
          </div>
        </form>
      </Card>

      {/* Compliance Info */}
      <Card>
        <div className="flex items-center gap-2 mb-5">
          <ShieldCheck className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">Compliance Info</h3>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            await save('compliance', async () => { await updateComplianceInfoAction(abn, insurancePolicyNumber) })
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="ABN"
              name="abn"
              value={abn}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAbn(e.target.value)}
              placeholder="12 345 678 901"
            />
            <Input
              label="Insurance Policy Number"
              name="insurance_policy_number"
              value={insurancePolicyNumber}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInsurancePolicyNumber(e.target.value)}
              placeholder="e.g. POL-123456"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm">Save</Button>
            {saved === 'compliance' && <p className="text-xs text-green-600">Saved ✓</p>}
          </div>
        </form>
      </Card>

      {/* Margin Thresholds */}
      <Card>
        <div className="flex items-center gap-2 mb-5">
          <Percent className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">Margin Thresholds</h3>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Controls when clients are flagged as Watch or At Risk on the dashboard and client list.
        </p>
        <MarginThresholdsForm
          red={settings.margin_thresholds.red}
          yellow={settings.margin_thresholds.yellow}
          onSave={async (red, yellow) => {
            await save('margin', () => updateMarginThresholdsAction(red, yellow))
            setSettings((s) => ({ ...s, margin_thresholds: { red, yellow } }))
          }}
          saved={saved === 'margin'}
        />
      </Card>

      {/* Numeric Settings */}
      <Card>
        <div className="flex items-center gap-2 mb-5">
          <Bell className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">Alert Thresholds</h3>
        </div>
        <NumericSettingsForm
          settings={settings}
          onSave={async (key, value) => {
            await save(key, () => updateSettingAction(key, value))
            setSettings((s) => ({ ...s, [key]: value }))
          }}
          saved={saved}
        />
      </Card>

      {/* Valuation */}
      <Card>
        <div className="flex items-center gap-2 mb-5">
          <Settings className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">Business Valuation</h3>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Formula: MRR × 12 × multiple. Shown on dashboard.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            const val = parseFloat(fd.get('valuation_multiple') as string)
            await save('valuation', () => updateSettingAction('valuation_multiple', val))
            setSettings((s) => ({ ...s, valuation_multiple: val }))
          }}
          className="flex items-end gap-3"
        >
          <Input label="Valuation Multiple" name="valuation_multiple" type="number" step="0.1" min="1" defaultValue={settings.valuation_multiple.toString()} className="w-32" />
          <Button type="submit" size="sm">Save</Button>
          {saved === 'valuation' && <p className="text-xs text-green-600 mb-2">Saved ✓</p>}
        </form>
      </Card>

      {/* Survey Questions */}
      <Card>
        <div className="flex items-center gap-2 mb-5">
          <MessageSquare className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">Survey Questions</h3>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          These questions are shown on the client-facing survey form.
        </p>
        <SurveyQuestionsEditor
          questions={settings.survey_questions}
          onSave={async (questions) => {
            await save('survey_questions', () => updateSettingAction('survey_questions', questions))
            setSettings((s) => ({ ...s, survey_questions: questions }))
          }}
          saved={saved === 'survey_questions'}
        />
      </Card>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MarginThresholdsForm({ red, yellow, onSave, saved }: { red: number; yellow: number; onSave: (r: number, y: number) => void; saved: boolean }) {
  const [r, setR] = useState(red)
  const [y, setY] = useState(yellow)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Critical (red) below</label>
          <div className="flex items-center gap-2">
            <input type="range" min="10" max="50" value={r} onChange={(e) => setR(Number(e.target.value))} className="flex-1 accent-red-500" />
            <span className="text-sm font-bold text-red-600 w-10 text-right">{r}%</span>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Watch (yellow) below</label>
          <div className="flex items-center gap-2">
            <input type="range" min="20" max="70" value={y} onChange={(e) => setY(Number(e.target.value))} className="flex-1 accent-amber-500" />
            <span className="text-sm font-bold text-amber-600 w-10 text-right">{y}%</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 pt-1 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"/>&lt; {r}% = Critical</span>
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block"/>{r}–{y}% = Watch</span>
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"/>&gt; {y}% = Healthy</span>
      </div>
      <div className="flex items-center gap-3">
        <Button type="button" size="sm" onClick={() => onSave(r, y)}>Save</Button>
        {saved && <p className="text-xs text-green-600">Saved ✓</p>}
      </div>
    </div>
  )
}

function NumericSettingsForm({ settings, onSave, saved }: { settings: AppSettings; onSave: (k: string, v: number) => void; saved: string | null }) {
  const fields = [
    { key: 'survey_frequency_days',  label: 'Survey frequency (days)',          value: settings.survey_frequency_days,  min: 30,  max: 365, step: 7, hint: 'How often to prompt for a survey per client' },
    { key: 'lead_followup_days',     label: 'Lead follow-up alert (days)',      value: settings.lead_followup_days,     min: 1,   max: 30,  step: 1, hint: 'Alert if no lead contact after this many days' },
    { key: 'contract_renewal_days',  label: 'Contract renewal warning (days)',  value: settings.contract_renewal_days,  min: 14,  max: 180, step: 7, hint: 'Warn about renewal this many days before expiry' },
  ]
  return (
    <div className="space-y-4">
      {fields.map((f) => (
        <div key={f.key} className="flex items-center justify-between gap-6">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-700">{f.label}</p>
            <p className="text-xs text-gray-400">{f.hint}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <input
              type="number"
              min={f.min}
              max={f.max}
              step={f.step}
              defaultValue={f.value}
              onChange={(e) => onSave(f.key, Number(e.target.value))}
              className="w-20 text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-navy/20 text-right"
            />
            {saved === f.key && <span className="text-xs text-green-600">✓</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

function SurveyQuestionsEditor({ questions, onSave, saved }: { questions: SurveyQuestion[]; onSave: (q: SurveyQuestion[]) => void; saved: boolean }) {
  const [qs, setQs] = useState<SurveyQuestion[]>(questions)

  function updateText(id: string, text: string) {
    setQs((prev) => prev.map((q) => q.id === id ? { ...q, text } : q))
  }

  function addQuestion() {
    const id = `q${Date.now()}`
    setQs((prev) => [...prev, { id, key: id, text: '', min: 1, max: 10 }])
  }

  function removeQuestion(id: string) {
    setQs((prev) => prev.filter((q) => q.id !== id))
  }

  return (
    <div className="space-y-3">
      {qs.map((q, i) => (
        <div key={q.id} className="flex items-start gap-3">
          <span className="text-xs text-gray-400 mt-3 w-4 flex-shrink-0">{i + 1}.</span>
          <input
            value={q.text}
            onChange={(e) => updateText(q.id, e.target.value)}
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
            placeholder="Survey question text…"
          />
          <button type="button" onClick={() => removeQuestion(q.id)} className="mt-2 p-1.5 text-gray-400 hover:text-red-500">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-3 pt-2">
        <button type="button" onClick={addQuestion} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-brand-navy">
          <Plus className="w-3.5 h-3.5" />
          Add question
        </button>
        <Button type="button" size="sm" onClick={() => onSave(qs)}>Save Questions</Button>
        {saved && <p className="text-xs text-green-600">Saved ✓</p>}
      </div>
    </div>
  )
}
