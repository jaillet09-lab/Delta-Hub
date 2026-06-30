'use client'

import { useState } from 'react'
import { Plus, Trash2, ClipboardList, Check } from 'lucide-react'
import { saveScopeAction } from '@/actions/schedule'
import {
  type ScopeTask, type ScopeFrequency, FREQ_LABEL, FREQ_ORDER, WEEKDAY_KEYS,
} from '@/lib/scope'

function newId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : 't_' + Math.random().toString(36).slice(2, 10)
}

export function ScopeEditor({
  clientId, initialScope, initialCleanDays, siteId, title,
}: {
  clientId: string
  initialScope: ScopeTask[]
  initialCleanDays: string[]
  siteId?: string
  title?: string
}) {
  const [tasks, setTasks] = useState<ScopeTask[]>(initialScope)
  const [cleanDays, setCleanDays] = useState<string[]>(initialCleanDays)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function dirty() { setSaved(false); setError(null) }

  function addTask() {
    setTasks(t => [...t, { id: newId(), area: '', task: '', frequency: 'visit' }])
    dirty()
  }
  function updateTask(id: string, patch: Partial<ScopeTask>) {
    setTasks(t => t.map(x => x.id === id ? { ...x, ...patch } : x))
    dirty()
  }
  function removeTask(id: string) {
    setTasks(t => t.filter(x => x.id !== id))
    dirty()
  }
  function toggleDay(d: string) {
    setCleanDays(cd => cd.includes(d) ? cd.filter(x => x !== d) : [...cd, d])
    dirty()
  }

  async function save() {
    setSaving(true); setError(null)
    // Drop blank rows, order clean days Mon→Sun
    const clean = tasks.filter(t => t.task.trim())
      .map(t => ({ ...t, area: t.area.trim() || 'General', task: t.task.trim(), day: t.frequency === 'visit' ? undefined : t.day }))
    const orderedDays = WEEKDAY_KEYS.filter(d => cleanDays.includes(d))
    const r = await saveScopeAction(clientId, clean, orderedDays, siteId)
    setSaving(false)
    if (r?.error) { setError(r.error); return }
    setTasks(clean); setSaved(true)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-gray-400" />
          {title ?? 'Cleaning schedule & scope'}
        </h3>
        <button onClick={save} disabled={saving}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#1e3a5f] text-white hover:bg-[#16304f] disabled:opacity-50 transition-colors">
          {saved ? <><Check className="w-3.5 h-3.5" /> Saved</> : saving ? 'Saving…' : 'Save schedule'}
        </button>
      </div>

      <p className="text-xs text-gray-400 mb-4 leading-relaxed">
        This drives the cleaner's tap-to-tick checklist. <b>Every clean</b> tasks show on every visit; periodic tasks
        (weekly, monthly…) appear on the clean day you pick.
      </p>

      {/* Clean days */}
      <div className="mb-5">
        <p className="text-xs font-semibold text-gray-500 mb-2">Clean days</p>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAY_KEYS.map(d => {
            const on = cleanDays.includes(d)
            return (
              <button key={d} onClick={() => toggleDay(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${on ? 'bg-[#0F172A] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                {d}
              </button>
            )
          })}
        </div>
      </div>

      {/* Task rows */}
      <div className="space-y-2">
        <div className="hidden sm:flex items-center gap-2 px-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
          <span className="w-28">Area</span>
          <span className="flex-1">Task</span>
          <span className="w-32">Frequency</span>
          <span className="w-20">Day</span>
          <span className="w-7" />
        </div>
        {tasks.length === 0 && (
          <p className="text-sm text-gray-400 italic py-3">No tasks yet — add the scope of works below.</p>
        )}
        {tasks.map(t => (
          <div key={t.id} className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-gray-50 sm:bg-transparent rounded-lg p-2 sm:p-0">
            <input value={t.area} onChange={e => updateTask(t.id, { area: e.target.value })} placeholder="Office"
              className="w-28 px-2.5 py-2 text-sm rounded-lg border border-gray-200 focus:border-[#1e3a5f] focus:ring-0 outline-none" />
            <input value={t.task} onChange={e => updateTask(t.id, { task: e.target.value })} placeholder="Vacuum carpets and traffic lanes"
              className="flex-1 min-w-[180px] px-2.5 py-2 text-sm rounded-lg border border-gray-200 focus:border-[#1e3a5f] focus:ring-0 outline-none" />
            <select value={t.frequency} onChange={e => updateTask(t.id, { frequency: e.target.value as ScopeFrequency })}
              className="w-32 px-2 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:border-[#1e3a5f] outline-none">
              {FREQ_ORDER.map(f => <option key={f} value={f}>{FREQ_LABEL[f]}</option>)}
            </select>
            <select value={t.day ?? ''} onChange={e => updateTask(t.id, { day: e.target.value || undefined })}
              disabled={t.frequency === 'visit'}
              className="w-20 px-2 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:border-[#1e3a5f] outline-none disabled:bg-gray-100 disabled:text-gray-300">
              <option value="">—</option>
              {(cleanDays.length ? WEEKDAY_KEYS.filter(d => cleanDays.includes(d)) : WEEKDAY_KEYS).map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <button onClick={() => removeTask(t.id)} className="w-7 h-9 flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <button onClick={addTask}
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#1e3a5f] hover:text-[#16304f] transition-colors">
        <Plus className="w-4 h-4" /> Add task
      </button>

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
    </div>
  )
}
