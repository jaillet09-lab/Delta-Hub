'use client'

import { useState } from 'react'
import { PhoneIncoming, PhoneOutgoing, ChevronDown, Phone } from 'lucide-react'

export interface CallRow {
  id: string
  direction: 'inbound' | 'outbound'
  started_at: string | null
  duration_seconds: number | null
  outcome: string | null
  summary: string | null
  next_step: string | null
  transcript: string | null
  recording_path: string | null
  status: string | null
}

const OUTCOME_LABEL: Record<string, string> = {
  booked_walkthrough: 'Walkthrough booked',
  callback_requested: 'Callback requested',
  info_requested: 'Info requested',
  follow_up: 'Follow-up',
  not_interested: 'Not interested',
  no_answer: 'No answer',
  wrong_number: 'Wrong number',
}
const OUTCOME_STYLE: Record<string, string> = {
  booked_walkthrough: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  callback_requested: 'bg-blue-50 text-blue-700 border-blue-200',
  info_requested: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  follow_up: 'bg-amber-50 text-amber-700 border-amber-200',
  not_interested: 'bg-gray-100 text-gray-500 border-gray-200',
  no_answer: 'bg-gray-100 text-gray-500 border-gray-200',
  wrong_number: 'bg-gray-100 text-gray-500 border-gray-200',
}

function fmtWhen(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtDuration(s: number | null): string {
  if (!s || s <= 0) return ''
  const m = Math.floor(s / 60), sec = s % 60
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`
}

function CallCard({ call }: { call: CallRow }) {
  const [open, setOpen] = useState(false)
  const Icon = call.direction === 'inbound' ? PhoneIncoming : PhoneOutgoing
  return (
    <div className="px-5 py-4">
      <div className="flex items-start gap-3">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${call.direction === 'inbound' ? 'bg-blue-50' : 'bg-gray-100'}`}>
          <Icon className={`w-3.5 h-3.5 ${call.direction === 'inbound' ? 'text-blue-600' : 'text-gray-600'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-800">{call.direction === 'inbound' ? 'Inbound call' : 'Outbound call'}</span>
            {call.duration_seconds ? <span className="text-xs text-gray-400">{fmtDuration(call.duration_seconds)}</span> : null}
            {call.outcome && (
              <span className={`text-[11px] font-semibold border rounded-full px-2 py-0.5 ${OUTCOME_STYLE[call.outcome] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                {OUTCOME_LABEL[call.outcome] ?? call.outcome}
              </span>
            )}
            {call.status === 'processing' && <span className="text-[11px] text-gray-400">Transcribing…</span>}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{fmtWhen(call.started_at)}</p>

          {call.summary && <p className="text-sm text-gray-700 mt-2 leading-relaxed">{call.summary}</p>}
          {call.next_step && (
            <p className="text-[13px] text-gray-600 mt-1.5"><span className="font-semibold text-gray-700">Next step:</span> {call.next_step}</p>
          )}

          {call.recording_path && (
            <audio controls preload="none" src={`/api/calls/${call.id}/recording`} className="mt-2.5 w-full max-w-sm h-9" />
          )}

          {call.transcript && (
            <div className="mt-2">
              <button onClick={() => setOpen(o => !o)} className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700">
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} /> {open ? 'Hide' : 'Show'} transcript
              </button>
              {open && <p className="text-[13px] text-gray-600 mt-2 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto bg-gray-50 rounded-lg p-3">{call.transcript}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function CallHistory({ calls }: { calls: CallRow[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-200">
        <Phone className="w-4 h-4 text-gray-400" />
        <p className="text-sm font-semibold text-gray-800">Calls</p>
        {calls.length > 0 && <span className="text-xs text-gray-400">· {calls.length}</span>}
      </div>
      {calls.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-gray-400">No calls logged yet</p>
          <p className="text-xs text-gray-300 mt-1">Once calling is live, every call shows here with its recording, summary and outcome.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {calls.map((c) => <CallCard key={c.id} call={c} />)}
        </div>
      )}
    </div>
  )
}
