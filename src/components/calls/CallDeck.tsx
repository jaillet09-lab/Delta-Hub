'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Phone, PhoneCall, PhoneMissed, MessageSquare, Mail, MailCheck,
  CalendarClock, Footprints, Trash2, Plus, Search, X, Check,
  ThumbsDown, Flame, Upload, MapPin, Building2, User, Clock,
  StickyNote, ChevronDown, RotateCcw, TrendingUp,
} from 'lucide-react'
import {
  importColdLeadsAction, previewColdLeadsCsvAction, logCallAction, deleteColdLeadAction,
  sendIntroEmailAction, sendFollowUpEmailAction, markIntroSmsSentAction,
  previewIntroEmailAction, previewFollowUpEmailAction,
  updateColdLeadAction, type ColdLead, type CommsEntry, type ColumnMap,
} from '@/actions/cold-leads'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function brisbaneToday(): string {
  return new Date().toLocaleString('en-AU', {
    timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit',
  }).split('/').reverse().join('-')
}

function cleanPhone(p: string): string {
  return p.replace(/[^\d+]/g, '')
}

function relativeDay(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

function dateLabel(dateStr: string, today: string): string {
  if (dateStr <= today) return 'today'
  const d = new Date(dateStr + 'T00:00:00')
  const tomorrow = new Date(Date.now() + 86_400_000).toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-')
  if (dateStr === tomorrow) return 'tomorrow'
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
}

function smsBody(lead: ColdLead): string {
  const first = (lead.contact_name || '').split(' ')[0]
  const hi = first ? `Hi ${first}, ` : 'Hi, '
  return (
    `${hi}Jackson from Delta Cleaning here. Great chatting just now. As mentioned, happy to come past for a free ` +
    `site visit of about fifteen minutes and a fixed monthly price whenever suits. Just reply here to lock in a time. Jackson`
  )
}

const STATUS_META: Record<ColdLead['status'], { label: string; chip: string; accent: string }> = {
  new:            { label: 'New',            chip: 'bg-sky-50 text-sky-700 border-sky-200',           accent: 'bg-sky-400' },
  called:         { label: 'Called',         chip: 'bg-gray-100 text-gray-600 border-gray-200',       accent: 'bg-gray-300' },
  follow_up:      { label: 'Follow up',      chip: 'bg-amber-50 text-amber-700 border-amber-200',     accent: 'bg-amber-400' },
  walkthrough:    { label: 'Walk-through',   chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', accent: 'bg-emerald-400' },
  converted:      { label: 'Won',            chip: 'bg-[#1e3a5f] text-white border-[#1e3a5f]',        accent: 'bg-[#1e3a5f]' },
  not_interested: { label: 'Not interested', chip: 'bg-red-50 text-red-500 border-red-200',           accent: 'bg-red-300' },
}

const COMM_LABEL: Record<CommsEntry['kind'], string> = {
  email: 'Intro email', follow_up_email: 'Follow-up email', sms: 'Text',
}

type Tab = 'to_call' | 'follow_ups' | 'contacted' | 'booked' | 'all'

const ACTIVE = (l: ColdLead) => l.status !== 'not_interested' && l.status !== 'converted'
function isDue(l: ColdLead, today: string): boolean {
  if (!ACTIVE(l)) return false
  return Boolean((l.next_follow_up && l.next_follow_up <= today) || (l.next_attempt && l.next_attempt <= today))
}

// ─── Small pieces ────────────────────────────────────────────────────────────

function Detail({ icon: Icon, children, href, muted }: {
  icon: React.ElementType; children: React.ReactNode; href?: string; muted?: boolean
}) {
  const body = (
    <span className={`inline-flex items-center gap-1.5 text-[13px] ${muted ? 'text-gray-400' : 'text-gray-700'} ${href ? 'hover:text-[#1e3a5f]' : ''}`}>
      <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      <span className="truncate">{children}</span>
    </span>
  )
  return href ? <a href={href} className="min-w-0">{body}</a> : <span className="min-w-0">{body}</span>
}

function CommsHistory({ comms }: { comms: CommsEntry[] }) {
  const [open, setOpen] = useState(false)
  if (!comms || comms.length === 0) return null
  const last = comms[comms.length - 1]
  return (
    <div className="mt-3 rounded-xl border border-gray-200/70 bg-gray-50/70 overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-100/60 transition-colors">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
          Sent history · {comms.length}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-gray-400">
          {!open && <span className="hidden sm:inline">{COMM_LABEL[last.kind]} {relativeDay(last.at)}</span>}
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3">
          {comms.slice().reverse().map((c, i) => (
            <div key={i} className="border-t border-gray-200/70 pt-2.5 first:border-0 first:pt-0">
              <p className="text-[11px] font-semibold text-gray-600">
                {COMM_LABEL[c.kind]} · {relativeDay(c.at)}
                <span className="font-normal text-gray-400"> · {new Date(c.at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              </p>
              {c.subject && <p className="text-[12px] font-medium text-gray-500 mt-0.5">{c.subject}</p>}
              <p className="text-[12px] text-gray-500 whitespace-pre-wrap mt-1 leading-snug">{c.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Lead card ───────────────────────────────────────────────────────────────

function LeadCard({ lead, today, onChanged }: { lead: ColdLead; today: string; onChanged: () => void }) {
  const [logging, setLogging] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pickDate, setPickDate] = useState<'follow_up' | 'walkthrough' | null>(null)
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [flash, setFlash] = useState<string | null>(null)
  const [editNotes, setEditNotes] = useState(false)
  const [notesText, setNotesText] = useState(lead.notes ?? '')
  const [emailPreview, setEmailPreview] = useState<{ kind: 'intro' | 'follow_up'; to: string; subject: string; body: string } | null>(null)

  const followUpDue = Boolean(lead.next_follow_up && lead.next_follow_up <= today && ACTIVE(lead))
  const retryDue    = Boolean(lead.next_attempt && lead.next_attempt <= today && ACTIVE(lead))
  const dueToday    = followUpDue || retryDue

  async function outcome(kind: 'no_answer' | 'spoke' | 'not_interested') {
    setBusy(kind); await logCallAction(lead.id, kind); setBusy(null); setLogging(false); onChanged()
  }
  async function outcomeWithDate() {
    if (!pickDate || !date) return
    setBusy(pickDate); await logCallAction(lead.id, pickDate, date, note)
    setBusy(null); setPickDate(null); setLogging(false); setDate(''); setNote(''); onChanged()
  }
  // Tapping Email/Follow-up now opens a review first — nothing sends until you confirm.
  async function openEmailPreview(kind: 'intro' | 'follow_up') {
    setBusy('email')
    const res = kind === 'intro' ? await previewIntroEmailAction(lead.id) : await previewFollowUpEmailAction(lead.id)
    setBusy(null)
    if (res.error || !res.to) { setFlash(res.error || 'Could not prepare the email'); setTimeout(() => setFlash(null), 3500); return }
    setEmailPreview({ kind, to: res.to, subject: res.subject ?? '', body: res.body ?? '' })
  }
  async function confirmSendEmail() {
    if (!emailPreview) return
    const kind = emailPreview.kind
    setBusy('email')
    const res = kind === 'intro' ? await sendIntroEmailAction(lead.id) : await sendFollowUpEmailAction(lead.id)
    setBusy(null); setEmailPreview(null)
    setFlash(res.error ? res.error : (kind === 'intro' ? 'Intro email sent' : 'Follow-up sent in the same thread'))
    setTimeout(() => setFlash(null), 3000); onChanged()
  }
  function openSms() {
    if (!lead.phone) return
    markIntroSmsSentAction(lead.id, smsBody(lead)).then(onChanged)
    window.location.href = `sms:${cleanPhone(lead.phone)}&body=${encodeURIComponent(smsBody(lead))}`
  }
  async function saveNotes() {
    setBusy('notes'); await updateColdLeadAction(lead.id, { notes: notesText }); setBusy(null); setEditNotes(false); onChanged()
  }

  const s = STATUS_META[lead.status]

  return (
    <div className={`group relative bg-white rounded-2xl border shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:shadow-[0_4px_16px_rgba(16,24,40,0.08)] overflow-hidden transition-all ${
      dueToday ? 'border-amber-300 ring-1 ring-amber-200' : 'border-gray-200/70'
    }`}>
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${s.accent}`} />

      {dueToday && (
        <div className="pl-5 pr-4 py-1.5 bg-amber-50 border-b border-amber-100 flex items-center gap-1.5">
          {followUpDue ? <Flame className="w-3.5 h-3.5 text-amber-500" /> : <RotateCcw className="w-3.5 h-3.5 text-amber-500" />}
          <span className="text-xs font-semibold text-amber-700">
            {followUpDue
              ? `Follow-up due${lead.follow_up_note ? ` — ${lead.follow_up_note}` : ''}`
              : 'Time to try this lead again'}
          </span>
        </div>
      )}

      <div className="p-4 sm:p-5 pl-5 sm:pl-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-[17px] font-bold text-gray-900 leading-snug truncate">{lead.business_name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">Added {relativeDay(lead.created_at)}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className={`inline-flex items-center gap-1 text-[11px] font-bold rounded-full px-2 py-0.5 tabular-nums border ${
              lead.call_count === 0 ? 'text-gray-400 bg-white border-gray-200' : 'text-[#1e3a5f] bg-[#1e3a5f]/5 border-[#1e3a5f]/15'
            }`}>
              <PhoneCall className="w-3 h-3" />
              {lead.call_count} {lead.call_count === 1 ? 'call' : 'calls'}
            </span>
            <span className={`text-[11px] font-semibold border rounded-full px-2 py-0.5 ${s.chip}`}>{s.label}</span>
          </div>
        </div>

        {/* Detail grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 mt-3">
          {lead.contact_name && <Detail icon={User}>Ask for {lead.contact_name}</Detail>}
          {lead.phone && <Detail icon={Phone} href={`tel:${cleanPhone(lead.phone)}`}>{lead.phone}</Detail>}
          {lead.suburb && <Detail icon={MapPin}>{lead.suburb}</Detail>}
          {lead.email && <Detail icon={Mail} href={`mailto:${lead.email}`}>{lead.email}</Detail>}
          {lead.industry && <Detail icon={Building2}>{lead.industry}</Detail>}
          <Detail icon={Clock} muted={!lead.last_called_at}>
            {lead.last_called_at ? `Last called ${relativeDay(lead.last_called_at)}` : 'Never called'}
          </Detail>
        </div>

        {/* Chips: retry timing, comms sent, follow-up */}
        {(lead.next_attempt || lead.intro_email_sent_at || lead.follow_up_email_sent_at || lead.intro_sms_sent_at || lead.next_follow_up) && (
          <div className="flex items-center flex-wrap gap-1.5 mt-3">
            {lead.next_attempt && ACTIVE(lead) && (
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium rounded-md px-1.5 py-0.5 border ${
                retryDue ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-gray-500 bg-gray-50 border-gray-200'
              }`}>
                <RotateCcw className="w-3 h-3" /> Try again {dateLabel(lead.next_attempt, today)}
              </span>
            )}
            {lead.next_follow_up && !followUpDue && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-1.5 py-0.5">
                <CalendarClock className="w-3 h-3" /> Follow up {dateLabel(lead.next_follow_up, today)}
              </span>
            )}
            {lead.intro_sms_sent_at && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-1.5 py-0.5">
                <MessageSquare className="w-3 h-3" /> Text {relativeDay(lead.intro_sms_sent_at)}
              </span>
            )}
            {lead.intro_email_sent_at && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-1.5 py-0.5">
                <MailCheck className="w-3 h-3" /> Emailed {relativeDay(lead.intro_email_sent_at)}
              </span>
            )}
            {lead.follow_up_email_sent_at && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-1.5 py-0.5">
                <MailCheck className="w-3 h-3" /> Followed up {relativeDay(lead.follow_up_email_sent_at)}
              </span>
            )}
            {lead.lead_id && (
              <a href={`/leads/${lead.lead_id}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1e3a5f] bg-[#1e3a5f]/5 border border-[#1e3a5f]/20 rounded-md px-1.5 py-0.5 hover:bg-[#1e3a5f]/10">
                <TrendingUp className="w-3 h-3" /> In pipeline
              </a>
            )}
          </div>
        )}

        {/* What was actually sent */}
        <CommsHistory comms={lead.comms} />

        {/* Notes */}
        {editNotes ? (
          <div className="mt-3">
            <textarea value={notesText} onChange={e => setNotesText(e.target.value)} rows={2} autoFocus
              placeholder="Notes — gatekeeper name, best time to call, what they said…"
              className="w-full bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl px-3 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none" />
            <div className="flex gap-2 mt-1.5">
              <button onClick={saveNotes} disabled={busy === 'notes'} className="text-xs font-semibold bg-[#1e3a5f] text-white rounded-lg px-3 py-1.5 disabled:opacity-50">
                {busy === 'notes' ? 'Saving…' : 'Save note'}
              </button>
              <button onClick={() => { setEditNotes(false); setNotesText(lead.notes ?? '') }} className="text-xs text-gray-400 hover:text-gray-600 px-2">Cancel</button>
            </div>
          </div>
        ) : lead.notes ? (
          <button onClick={() => setEditNotes(true)} className="flex items-start gap-1.5 mt-3 text-left w-full group/note">
            <StickyNote className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
            <span className="text-[13px] text-gray-600 leading-snug group-hover/note:text-gray-900">{lead.notes}</span>
          </button>
        ) : null}

        {flash && <p className="text-xs font-medium text-emerald-600 mt-3">{flash}</p>}

        {/* Action row */}
        {!logging && !pickDate && !emailPreview && (
          <div className="flex items-center gap-2 mt-4">
            {lead.phone ? (
              <a href={`tel:${cleanPhone(lead.phone)}`} onClick={() => setLogging(true)}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-[#1e3a5f] hover:bg-[#162d4a] active:scale-[0.98] text-white text-sm font-semibold rounded-xl py-3 shadow-[0_4px_12px_rgba(30,58,95,0.25)] transition-all">
                <Phone className="w-4 h-4" /> Call {lead.contact_name ? lead.contact_name.split(' ')[0] : ''}
              </a>
            ) : (
              <span className="flex-1 text-center text-xs text-gray-400 py-3 border border-dashed border-gray-200 rounded-xl">No phone number</span>
            )}

            {/* Text & Email only unlock once you've actually spoken with them */}
            {lead.has_spoken && lead.phone && (
              <button onClick={openSms} title="Send a text (opens Messages)"
                className={`inline-flex items-center gap-1.5 px-3 py-3 rounded-xl border text-sm font-medium transition-colors ${
                  lead.intro_sms_sent_at ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}>
                <MessageSquare className="w-4 h-4" /> <span className="hidden md:inline">Text</span>
              </button>
            )}
            {lead.has_spoken && lead.email && (
              lead.intro_email_sent_at ? (
                <button onClick={() => openEmailPreview('follow_up')} disabled={busy === 'email'} title="Review a follow-up email before sending"
                  className="inline-flex items-center gap-1.5 px-3 py-3 rounded-xl border text-sm font-medium transition-colors disabled:opacity-50 bg-white border-amber-200 text-amber-700 hover:border-amber-300">
                  <Mail className="w-4 h-4" /> <span className="hidden md:inline">{busy === 'email' ? '…' : 'Follow up'}</span>
                </button>
              ) : (
                <button onClick={() => openEmailPreview('intro')} disabled={busy === 'email'} title="Review the intro email before sending"
                  className="inline-flex items-center gap-1.5 px-3 py-3 rounded-xl border text-sm font-medium transition-colors disabled:opacity-50 bg-white border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300">
                  <Mail className="w-4 h-4" /> <span className="hidden md:inline">{busy === 'email' ? '…' : 'Email'}</span>
                </button>
              )
            )}
            <button onClick={() => setLogging(true)} title="Log a call outcome"
              className="inline-flex items-center gap-1.5 px-3 py-3 rounded-xl border bg-white border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300 transition-colors text-sm font-medium">
              <Plus className="w-4 h-4" /> <span className="hidden md:inline">Log</span>
            </button>
            {!lead.notes && !editNotes && (
              <button onClick={() => setEditNotes(true)} title="Add a note"
                className="px-3 py-3 rounded-xl border bg-white border-gray-200 text-gray-400 hover:text-gray-900 hover:border-gray-300 transition-colors">
                <StickyNote className="w-4 h-4" />
              </button>
            )}
            {confirmDelete ? (
              <div className="flex items-center gap-1">
                <button onClick={async () => { setBusy('del'); await deleteColdLeadAction(lead.id); onChanged() }} disabled={busy === 'del'}
                  className="px-3 py-3 rounded-xl bg-red-600 text-white"><Check className="w-4 h-4" /></button>
                <button onClick={() => setConfirmDelete(false)} className="px-3 py-3 rounded-xl border border-gray-200 text-gray-400"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} title="Remove lead"
                className="px-3 py-3 rounded-xl border bg-white border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-200 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Outcome bar */}
        {logging && !pickDate && (
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-2">How did the call go?</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <button onClick={() => outcome('no_answer')} disabled={!!busy}
                className="flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-xl border border-gray-200 bg-white text-gray-600 hover:border-gray-400 active:scale-[0.98] transition-all">
                <PhoneMissed className="w-3.5 h-3.5" /> No answer
              </button>
              <button onClick={() => outcome('spoke')} disabled={!!busy}
                className="flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-xl border border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-400 active:scale-[0.98] transition-all">
                <PhoneCall className="w-3.5 h-3.5" /> Spoke
              </button>
              <button onClick={() => { setPickDate('follow_up'); setDate('') }} disabled={!!busy}
                className="flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-400 active:scale-[0.98] transition-all">
                <CalendarClock className="w-3.5 h-3.5" /> Follow up
              </button>
              <button onClick={() => { setPickDate('walkthrough'); setDate('') }} disabled={!!busy}
                className="flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400 active:scale-[0.98] transition-all">
                <Footprints className="w-3.5 h-3.5" /> Walk-through
              </button>
              <button onClick={() => outcome('not_interested')} disabled={!!busy}
                className="flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 hover:border-red-400 active:scale-[0.98] transition-all col-span-2 sm:col-span-1">
                <ThumbsDown className="w-3.5 h-3.5" /> Not keen
              </button>
            </div>
            <button onClick={() => setLogging(false)} className="text-xs text-gray-400 hover:text-gray-600 mt-2">Cancel</button>
          </div>
        )}

        {/* Date picker */}
        {pickDate && (
          <div className="mt-4 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
              {pickDate === 'walkthrough' ? 'Walk-through date' : 'Follow up on'}
            </p>
            <input type="date" value={date} min={today} onChange={e => setDate(e.target.value)}
              className="w-full bg-white border border-gray-200 text-gray-900 rounded-xl px-3 py-3 text-[16px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
            <input type="text" value={note} onChange={e => setNote(e.target.value)}
              placeholder={pickDate === 'walkthrough' ? 'e.g. 10am, ask for Sarah' : 'e.g. call back after 2pm'}
              className="w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl px-3 py-3 text-[16px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
            <div className="flex gap-2">
              <button onClick={outcomeWithDate} disabled={!date || !!busy}
                className="flex-1 bg-[#1e3a5f] text-white text-sm font-semibold rounded-xl py-2.5 disabled:opacity-40 active:scale-[0.98] transition-all">
                {busy ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setPickDate(null)} className="px-4 text-sm text-gray-400 hover:text-gray-600">Back</button>
            </div>
          </div>
        )}

        {/* Email review — nothing sends until "Send" is tapped here */}
        {emailPreview && (
          <div className="mt-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 mb-2 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
              <span className="text-[11px] font-semibold text-amber-700">Review before sending — this won’t go out until you tap Send</span>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 text-[12px]">
                <p className="text-gray-500"><span className="font-semibold text-gray-700">To:</span> {emailPreview.to}</p>
                <p className="text-gray-500 mt-0.5"><span className="font-semibold text-gray-700">Subject:</span> {emailPreview.subject}</p>
              </div>
              <p className="px-3 py-3 text-[13px] text-gray-700 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">{emailPreview.body}</p>
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={confirmSendEmail} disabled={busy === 'email'}
                className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-sm font-semibold rounded-xl py-3 disabled:opacity-50 active:scale-[0.98] transition-all">
                <Mail className="w-4 h-4" /> {busy === 'email' ? 'Sending…' : 'Send email'}
              </button>
              <button onClick={() => setEmailPreview(null)} disabled={busy === 'email'}
                className="px-4 text-sm text-gray-400 hover:text-gray-600 disabled:opacity-50">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Import modal (drag & drop) ──────────────────────────────────────────────

const MAP_FIELDS: { key: keyof ColumnMap; label: string; required?: boolean }[] = [
  { key: 'business', label: 'Business name', required: true },
  { key: 'contact',  label: 'Contact / ask for' },
  { key: 'phone',    label: 'Phone' },
  { key: 'email',    label: 'Email' },
  { key: 'suburb',   label: 'Suburb / area' },
  { key: 'industry', label: 'Industry' },
]

function ImportPanel({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const [csv, setCsv] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [showPaste, setShowPaste] = useState(false)

  // Mapping step
  const [headers, setHeaders] = useState<string[] | null>(null)
  const [sample, setSample] = useState<string[][]>([])
  const [rowCount, setRowCount] = useState(0)
  const [map, setMap] = useState<ColumnMap | null>(null)

  function readFile(f: File) {
    setFileName(f.name)
    const reader = new FileReader()
    reader.onload = () => setCsv(String(reader.result || ''))
    reader.readAsText(f)
  }
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (f) readFile(f)
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) readFile(f)
  }

  async function preview() {
    setBusy(true); setError(null)
    const res = await previewColdLeadsCsvAction(csv) as any
    setBusy(false)
    if (res.error) { setError(res.error); return }
    setHeaders(res.headers)
    setSample(res.sample ?? [])
    setRowCount(res.rowCount)
    setMap(res.guess)
  }

  async function run() {
    if (!map) return
    if (map.business < 0) { setError('Pick which column is the business name.'); return }
    setBusy(true); setError(null)
    const res = await importColdLeadsAction(csv, map) as any
    setBusy(false)
    if (res.error) { setError(res.error); return }
    onDone(`${res.imported} lead${res.imported === 1 ? '' : 's'} imported${res.skipped ? ` · ${res.skipped} duplicate${res.skipped === 1 ? '' : 's'} skipped` : ''}`)
  }

  const previewBusiness = map && map.business >= 0 && sample[0] ? (sample[0][map.business] || '—') : null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-gray-200 shadow-xl p-5 max-h-[92dvh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-display text-lg font-bold text-gray-900">Import leads</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {headers ? 'Check the columns match, then import' : 'From Google Sheets: File → Download → CSV'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>

        {/* ── Step 2: column mapping ── */}
        {headers ? (
          <>
            <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2.5 mb-3">
              <p className="text-xs text-gray-500">{rowCount} row{rowCount === 1 ? '' : 's'} found · match each field to a column from your sheet.</p>
            </div>
            <div className="space-y-2.5">
              {MAP_FIELDS.map(({ key, label, required }) => (
                <div key={key} className="flex items-center gap-3">
                  <label className="text-xs font-medium text-gray-600 w-32 flex-shrink-0">
                    {label}{required && <span className="text-red-500"> *</span>}
                  </label>
                  <select
                    value={map?.[key] ?? -1}
                    onChange={e => setMap(m => m ? { ...m, [key]: Number(e.target.value) } : m)}
                    className="flex-1 min-w-0 bg-white border border-gray-200 text-gray-900 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  >
                    <option value={-1}>{required ? 'Select a column…' : 'Not in my sheet'}</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {previewBusiness && (
              <p className="text-xs text-gray-400 mt-3">
                First lead will be: <span className="font-semibold text-gray-700">{previewBusiness}</span>
              </p>
            )}

            {error && <div className="mt-3 rounded-xl bg-red-50 border border-red-100 px-3 py-2.5 text-sm text-red-600">{error}</div>}

            <div className="flex gap-2 mt-4">
              <button onClick={() => { setHeaders(null); setMap(null); setError(null) }}
                className="px-4 text-sm text-gray-400 hover:text-gray-600">Back</button>
              <button onClick={run} disabled={busy || !map || map.business < 0}
                className="flex-1 bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-sm font-semibold rounded-xl py-3.5 disabled:opacity-40 active:scale-[0.99] transition-all">
                {busy ? 'Importing…' : `Import ${rowCount} lead${rowCount === 1 ? '' : 's'}`}
              </button>
            </div>
          </>
        ) : (
          /* ── Step 1: choose file ── */
          <>
            <label
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-10 px-4 cursor-pointer transition-colors text-center ${
                dragOver ? 'border-[#1e3a5f] bg-[#1e3a5f]/5' : csv ? 'border-emerald-300 bg-emerald-50/50' : 'border-gray-300 hover:border-[#1e3a5f]/50 hover:bg-gray-50'
              }`}
            >
              {csv ? (
                <>
                  <Check className="w-6 h-6 text-emerald-600" />
                  <p className="text-sm font-semibold text-emerald-700">{fileName || 'CSV ready'}</p>
                  <p className="text-xs text-gray-400">drop another to replace</p>
                </>
              ) : (
                <>
                  <Upload className={`w-6 h-6 ${dragOver ? 'text-[#1e3a5f]' : 'text-gray-400'}`} />
                  <p className="text-sm font-semibold text-gray-700">Drag & drop your CSV here</p>
                  <p className="text-xs text-gray-400">or tap to choose a file</p>
                </>
              )}
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
            </label>

            {showPaste ? (
              <textarea value={csv} onChange={e => { setCsv(e.target.value); setFileName(null) }} rows={4}
                placeholder={'Business,Contact,Phone,Email,Suburb\nAcme Dental,Sarah,0400 111 222,sarah@acme.com,Chermside'}
                className="w-full mt-3 bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl px-3 py-2.5 text-[12px] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none" />
            ) : (
              <button onClick={() => setShowPaste(true)} className="mt-2.5 text-xs text-gray-400 hover:text-gray-600">or paste rows instead</button>
            )}

            {error && <div className="mt-3 rounded-xl bg-red-50 border border-red-100 px-3 py-2.5 text-sm text-red-600">{error}</div>}

            <button onClick={preview} disabled={!csv.trim() || busy}
              className="w-full mt-4 bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-sm font-semibold rounded-xl py-3.5 disabled:opacity-40 active:scale-[0.99] transition-all">
              {busy ? 'Reading…' : 'Next: match columns'}
            </button>
            <p className="text-[11px] text-gray-400 text-center mt-2">You'll confirm which column is which · duplicates skipped</p>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Deck ────────────────────────────────────────────────────────────────────

export function CallDeck({ initialLeads }: { initialLeads: ColdLead[] }) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('to_call')
  const [search, setSearch] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const leads = initialLeads
  const today = brisbaneToday()
  const refresh = () => router.refresh()

  const dueCount     = leads.filter(l => isDue(l, today)).length
  const todayStr     = new Date().toISOString().slice(0, 10)
  const calledToday  = leads.filter(l => l.last_called_at && l.last_called_at.slice(0, 10) === todayStr).length
  const walkthroughs = leads.filter(l => l.status === 'walkthrough').length
  const remaining    = leads.filter(l => l.status === 'new').length
  const contactedCnt = leads.filter(l => l.call_count > 0).length

  const counts = {
    to_call:    remaining,
    follow_ups: leads.filter(l => l.status === 'follow_up' || l.next_follow_up).length,
    contacted:  leads.filter(l => l.status === 'called' || l.status === 'follow_up').length,
    booked:     leads.filter(l => l.status === 'walkthrough' || l.status === 'converted').length,
    all:        leads.length,
  }

  const visible = useMemo(() => {
    let list: ColdLead[]
    if (tab === 'to_call') {
      list = leads.filter(l => l.status === 'new').sort((a, b) => a.business_name.localeCompare(b.business_name))
    } else if (tab === 'follow_ups') {
      // Every lead awaiting a follow-up — overdue/due first, then by soonest follow-up date
      list = leads.filter(l => l.status === 'follow_up' || l.next_follow_up).sort((a, b) => {
        const aDue = isDue(a, today) ? 0 : 1
        const bDue = isDue(b, today) ? 0 : 1
        if (aDue !== bDue) return aDue - bDue
        const aNext = a.next_follow_up || a.next_attempt || '9999'
        const bNext = b.next_follow_up || b.next_attempt || '9999'
        return aNext < bNext ? -1 : aNext > bNext ? 1 : 0
      })
    } else if (tab === 'contacted') {
      // Called or in follow-up — due items first, then soonest scheduled, then oldest contact
      list = leads.filter(l => l.status === 'called' || l.status === 'follow_up').sort((a, b) => {
        const aDue = isDue(a, today) ? 0 : 1
        const bDue = isDue(b, today) ? 0 : 1
        if (aDue !== bDue) return aDue - bDue
        const aNext = a.next_follow_up || a.next_attempt || '9999'
        const bNext = b.next_follow_up || b.next_attempt || '9999'
        if (aNext !== bNext) return aNext < bNext ? -1 : 1
        return (a.last_called_at || '').localeCompare(b.last_called_at || '')
      })
    } else if (tab === 'booked') {
      list = leads.filter(l => l.status === 'walkthrough' || l.status === 'converted')
    } else {
      list = leads
    }
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(l =>
        l.business_name.toLowerCase().includes(q)
        || (l.contact_name || '').toLowerCase().includes(q)
        || (l.suburb || '').toLowerCase().includes(q)
        || (l.industry || '').toLowerCase().includes(q)
        || (l.phone || '').includes(q))
    }
    return list
  }, [leads, tab, search, today])

  const TABS: [Tab, string][] = [
    ['to_call', 'To Call'], ['follow_ups', 'Follow-ups'], ['contacted', 'Contacted'], ['booked', 'Booked'], ['all', 'All'],
  ]

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 mb-5">
        <div>
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-gray-900">Cold Calls</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {remaining > 0 ? `${remaining} lead${remaining === 1 ? '' : 's'} waiting for a first call` : 'No new leads — import more'}
          </p>
        </div>
      </div>

      {/* Scoreboard */}
      <div className="relative overflow-hidden bg-[#0b1320] rounded-2xl p-5 mb-5">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 90% at 85% -20%, rgba(30,58,95,0.95), transparent 60%)' }} />
        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-slate-400 text-[11px] font-semibold uppercase tracking-[0.14em]">Calls today</p>
            <p className="font-display text-3xl font-extrabold text-white tabular-nums mt-1">{calledToday}</p>
          </div>
          <div>
            <p className="text-slate-400 text-[11px] font-semibold uppercase tracking-[0.14em]">Due today</p>
            <p className={`font-display text-3xl font-extrabold tabular-nums mt-1 ${dueCount > 0 ? 'text-amber-400' : 'text-white'}`}>{dueCount}</p>
          </div>
          <div>
            <p className="text-slate-400 text-[11px] font-semibold uppercase tracking-[0.14em]">Walk-throughs</p>
            <p className={`font-display text-3xl font-extrabold tabular-nums mt-1 ${walkthroughs > 0 ? 'text-emerald-400' : 'text-white'}`}>{walkthroughs}</p>
          </div>
          <div>
            <p className="text-slate-400 text-[11px] font-semibold uppercase tracking-[0.14em]">Contacted</p>
            <p className="font-display text-3xl font-extrabold text-white tabular-nums mt-1">
              {contactedCnt}<span className="text-base text-slate-500 font-bold">/{leads.length}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Sticky toolbar — tabs + search + import, always reachable */}
      <div className="sticky top-0 z-20 bg-[#f5f6f8] py-2.5 -mt-1 mb-3 border-b border-transparent">
        <div className="flex items-center gap-2 flex-wrap">
          {TABS.map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl border transition-colors ${
                tab === key ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]' : 'bg-white border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300'
              }`}>
              {label}
              <span className={`tabular-nums ${tab === key ? 'text-sky-200' : 'text-gray-400'}`}>{counts[key]}</span>
            </button>
          ))}
          <div className="relative flex-1 min-w-[140px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              className="w-full pl-8 pr-3 py-2 text-[16px] sm:text-sm bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
          </div>
          <button onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-sm font-semibold rounded-xl px-3.5 py-2 shadow-[0_4px_12px_rgba(30,58,95,0.25)] active:scale-[0.98] transition-all flex-shrink-0">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Import</span>
          </button>
        </div>
      </div>

      {toast && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-medium text-emerald-700 mb-3">{toast}</div>
      )}

      {/* Cards */}
      {visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-14 text-center">
          <Phone className="w-7 h-7 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">
            {tab === 'to_call' && leads.length > 0 ? 'No new leads left to call — nice work' : leads.length === 0 ? 'No leads yet' : 'Nothing here'}
          </p>
          {leads.length === 0 && (
            <button onClick={() => setShowImport(true)} className="text-xs text-[#1e3a5f] font-semibold hover:underline mt-1">Import your first batch →</button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(lead => (
            <LeadCard key={lead.id} lead={lead} today={today} onChanged={refresh} />
          ))}
        </div>
      )}

      {showImport && (
        <ImportPanel onClose={() => setShowImport(false)}
          onDone={msg => { setShowImport(false); setToast(msg); setTimeout(() => setToast(null), 4000); refresh() }} />
      )}
    </div>
  )
}
