'use client'

import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { toggleTaskAction } from '@/actions/schedule'
import {
  type ScopeTask, type ScopeFrequency, FREQ_LABEL, FREQ_ORDER, defaultDay,
} from '@/lib/scope'

export function CleanerSchedule({
  clientId, clientName, siteShort, scope, cleanDays, todayISO, dateLabel, initialCompleted,
}: {
  clientId: string
  clientName: string
  siteShort: string
  scope: ScopeTask[]
  cleanDays: string[]
  todayISO: string
  dateLabel: string
  initialCompleted: string[]
}) {
  const days = cleanDays.length ? cleanDays : ['Mon', 'Wed', 'Fri']
  const [day, setDay] = useState(() => defaultDay(days))
  const [view, setView] = useState<'today' | 'full'>('today')
  const [done, setDone] = useState<Set<string>>(() => new Set(initialCompleted))
  const [saveError, setSaveError] = useState(false)

  function toggle(taskId: string) {
    const next = new Set(done)
    const nowDone = !next.has(taskId)
    if (nowDone) next.add(taskId); else next.delete(taskId)
    setDone(next)
    setSaveError(false)
    // Persist. On any failure (incl. no signal on site), revert so we never show a tick
    // that didn't save, and tell the cleaner to retry.
    toggleTaskAction(clientId, taskId, todayISO, nowDone)
      .then((r: any) => { if (r?.error) throw new Error(r.error) })
      .catch(() => {
        setDone((cur) => {
          const rb = new Set(cur)
          if (nowDone) rb.delete(taskId); else rb.add(taskId)
          return rb
        })
        setSaveError(true)
      })
  }

  const visitTasks = useMemo(() => scope.filter(t => t.frequency === 'visit'), [scope])
  const dueTasks   = useMemo(() => scope.filter(t => t.frequency !== 'visit' && t.day === day), [scope, day])

  const todayAll = [...visitTasks, ...dueTasks]
  const doneCount = todayAll.filter(t => done.has(t.id)).length
  const totalCount = todayAll.length
  const pct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0

  if (!scope.length) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-12 text-center">
        <p className="text-sm font-medium text-gray-500">No schedule set for this site yet.</p>
        <p className="text-xs text-gray-400 mt-1">A manager can add the scope of works from the client profile.</p>
      </div>
    )
  }

  const Row = ({ t }: { t: ScopeTask }) => {
    const isDone = done.has(t.id)
    return (
      <button onClick={() => toggle(t.id)}
        className="w-full flex items-center gap-3 px-4 border-b border-slate-100 last:border-0 text-left active:bg-slate-50 transition-colors"
        style={{ minHeight: 58 }}>
        <span className="flex-shrink-0 flex items-center justify-center rounded-lg transition-colors"
          style={{ width: 26, height: 26, border: `2px solid ${isDone ? '#0F172A' : '#CBD5E1'}`, background: isDone ? '#0F172A' : '#fff' }}>
          {isDone && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
        </span>
        <span className="flex-1 py-3.5 text-[14.5px] leading-snug"
          style={{ color: isDone ? '#94A3B8' : '#1E293B', textDecoration: isDone ? 'line-through' : 'none' }}>
          {t.task}
        </span>
        <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400 bg-slate-100 rounded-md px-1.5 py-1">{t.area}</span>
      </button>
    )
  }

  const SectionHeader = ({ title, count, dark }: { title: string; count: number; dark?: boolean }) => (
    <div className="flex items-center gap-2 px-1 pb-2">
      <span className={`text-[11px] font-bold uppercase tracking-[0.1em] ${dark ? 'text-slate-900' : 'text-slate-400'}`}>{title}</span>
      <span className="text-[11px] text-slate-300">{count}</span>
    </div>
  )

  return (
    <div className="bg-[#F4F6F9] rounded-2xl overflow-hidden border border-gray-200/70">
      {/* header */}
      <div className="bg-white border-b border-slate-200 px-5 pt-4 pb-3.5">
        <div className="flex items-baseline justify-between">
          <div className="text-base font-bold text-slate-900 tracking-tight">{clientName}</div>
          <div className="text-xs text-slate-400">{dateLabel}</div>
        </div>
        {siteShort && <div className="text-[13px] text-slate-600 mt-0.5">{siteShort}</div>}
      </div>

      {/* day tabs */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex gap-2">
        {days.map(d => (
          <button key={d} onClick={() => setDay(d)}
            className="flex-1 rounded-[10px] py-2.5 text-sm font-bold tracking-wide transition-colors"
            style={d === day ? { background: '#0F172A', color: '#fff' } : { background: '#EEF2F6', color: '#475569' }}>
            {d}
          </button>
        ))}
      </div>

      {saveError && (
        <div className="bg-amber-50 border-b border-amber-200 px-5 py-2.5 text-[12.5px] text-amber-700 text-center">
          Couldn&apos;t save your last tap — check your signal and try again.
        </div>
      )}

      {view === 'today' ? (
        <>
          {/* progress */}
          <div className="px-5 pt-4 pb-2">
            <div className="flex items-baseline justify-between mb-2">
              <div className="font-semibold text-[15px] text-slate-900">{doneCount >= totalCount && totalCount ? 'All done — nice work' : "Today's tasks"}</div>
              <div className="text-xs text-slate-500">{doneCount} of {totalCount} done</div>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-slate-900 rounded-full transition-all duration-200" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* task list */}
          <div className="px-4 pb-5">
            <div className="mt-4">
              <SectionHeader title="Every clean" count={visitTasks.length} />
              <div className="bg-white border border-[#ECEFF3] rounded-2xl overflow-hidden">
                {visitTasks.map(t => <Row key={t.id} t={t} />)}
              </div>
            </div>
            {dueTasks.length > 0 && (
              <div className="mt-4">
                <SectionHeader title="Also due today" count={dueTasks.length} />
                <div className="bg-white border border-[#ECEFF3] rounded-2xl overflow-hidden">
                  {dueTasks.map(t => <Row key={t.id} t={t} />)}
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* full scope grouped by frequency */
        <div className="px-4 pb-5">
          <div className="px-1 pt-4 font-semibold text-base text-slate-900">Full cleaning scope</div>
          <div className="px-1 pb-3 text-[12.5px] text-slate-500 leading-relaxed">Everything in the agreed scope for this site, grouped by how often it's done.</div>
          {FREQ_ORDER.map(freq => {
            const tasks = scope.filter(t => t.frequency === freq)
            if (!tasks.length) return null
            return (
              <div key={freq} className="mt-3.5">
                <SectionHeader title={FREQ_LABEL[freq]} count={tasks.length} dark />
                <div className="bg-white border border-[#ECEFF3] rounded-2xl overflow-hidden">
                  {tasks.map(t => (
                    <div key={t.id} className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0">
                      <span className="flex-shrink-0 w-1.5 h-1.5 rounded-sm bg-slate-900" />
                      <span className="flex-1 text-sm leading-snug text-slate-700">{t.task}</span>
                      <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t.day ?? ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* bottom toggle */}
      <div className="sticky bottom-0 px-4 pt-3 pb-4 bg-gradient-to-t from-[#F4F6F9] from-70% to-transparent">
        <button onClick={() => setView(v => v === 'today' ? 'full' : 'today')}
          className="w-full rounded-2xl py-3.5 text-sm font-bold tracking-wide border-[1.5px] border-slate-900 transition-colors"
          style={view === 'full' ? { background: '#0F172A', color: '#fff' } : { background: 'transparent', color: '#0F172A' }}>
          {view === 'today' ? 'View full scope' : 'Back to today'}
        </button>
      </div>
    </div>
  )
}
