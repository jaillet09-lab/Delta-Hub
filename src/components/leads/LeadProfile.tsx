'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Phone, Mail, MapPin, FileText, FilePen,
  CheckCircle, UserPlus, ChevronRight, Plus, AlertCircle, Check, Eye,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ProposalForm } from '@/components/leads/ProposalForm'
import { AgreementForm } from '@/components/leads/AgreementForm'
import { formatDate, formatAUD } from '@/lib/formatters'
import {
  updateLeadStatusAction,
  saveProposalAction,
  saveAgreementAction,
  convertToClientAction,
  addTimelineNoteAction,
} from '@/actions/leads'
import type { Lead, TimelineEvent } from '@/types/app'

const PIPELINE_STAGES = [
  { key: 'lead',           label: 'Lead' },
  { key: 'contacted',      label: 'Contacted' },
  { key: 'quoted',         label: 'Quoted' },
  { key: 'proposal_sent',  label: 'Proposal Sent' },
  { key: 'agreement_sent', label: 'Agreement Sent' },
]

const STAGE_ORDER = ['lead', 'contacted', 'quoted', 'proposal_sent', 'agreement_sent']

export function LeadProfile({ lead: initialLead }: { lead: Lead }) {
  const router = useRouter()
  const [lead, setLead] = useState(initialLead)
  const [showProposal, setShowProposal] = useState(false)
  const [showAgreement, setShowAgreement] = useState(false)
  const [showConvert, setShowConvert] = useState(false)
  const [showAddNote, setShowAddNote] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isWon  = lead.status === 'won'
  const isLost = lead.status === 'lost'
  const isDone = isWon || isLost

  async function handleStatusChange(status: string) {
    setLoading(status)
    setError(null)
    const result = await updateLeadStatusAction(lead.id, status, lead.timeline || []) as any
    if (result?.error) { setError(result.error); setLoading(null); return }
    setLead(prev => ({ ...prev, status: status as any }))
    setLoading(null)
    router.refresh()
  }

  async function handleSaveProposal(data: Record<string, any>) {
    setLoading('proposal')
    const result = await saveProposalAction(lead.id, data, lead.timeline || []) as any
    if (result?.error) { setError(result.error); setLoading(null); return }
    setLead(prev => ({ ...prev, proposal_data: data, proposal_created_at: new Date().toISOString() }))
    setShowProposal(false)
    setLoading(null)
    router.refresh()
  }

  async function handleSaveAgreement(data: Record<string, any>) {
    setLoading('agreement')
    const result = await saveAgreementAction(lead.id, data, lead.timeline || []) as any
    if (result?.error) { setError(result.error); setLoading(null); return }
    setLead(prev => ({ ...prev, agreement_data: data, agreement_created_at: new Date().toISOString() }))
    setShowAgreement(false)
    setLoading(null)
    router.refresh()
  }

  async function handleConvert() {
    setLoading('convert')
    const result = await convertToClientAction(lead.id, lead) as any
    if (result?.error) { setError(result.error); setLoading(null); return }
    router.push(`/clients/${result.clientId}`)
  }

  async function handleAddNote() {
    if (!noteText.trim()) return
    setLoading('note')
    const result = await addTimelineNoteAction(lead.id, noteText.trim(), lead.timeline || []) as any
    if (result?.error) { setError(result.error); setLoading(null); return }
    setLead(prev => ({
      ...prev,
      timeline: [
        ...(prev.timeline || []),
        {
          id: crypto.randomUUID(),
          type: 'note' as const,
          message: noteText.trim(),
          timestamp: new Date().toISOString(),
        },
      ],
    }))
    setNoteText('')
    setShowAddNote(false)
    setLoading(null)
  }

  const timeline = [...(lead.timeline || [])].reverse()

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back + Header */}
      <div>
        <Link href="/leads" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> Leads
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{lead.business_name}</h1>
            <div className="flex items-center gap-3 mt-2">
              <Badge
                status={lead.status}
                label={
                  lead.status === 'won' ? 'Won'
                  : lead.status === 'lost' ? 'Lost'
                  : PIPELINE_STAGES.find(s => s.key === lead.status)?.label ?? lead.status
                }
              />
              {lead.quote_value && (
                <span className="text-sm text-gray-500 font-medium tabular-nums">
                  {formatAUD(lead.quote_value)}/mo
                </span>
              )}
              <span className="text-xs text-gray-400">Created {formatDate(lead.created_at)}</span>
            </div>
          </div>
          {!isDone && (
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleStatusChange('lost')}
                disabled={!!loading}
              >
                Mark Lost
              </Button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Pipeline progress */}
      {!isDone && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">Pipeline Progress</p>
          <div className="flex items-center">
            {PIPELINE_STAGES.map((stage, i) => {
              const currentIndex = STAGE_ORDER.indexOf(lead.status)
              const isComplete    = currentIndex > i
              const isCurrent     = lead.status === stage.key
              const isNext        = currentIndex === i - 1

              return (
                <div key={stage.key} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-10 h-10 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                        isCurrent
                          ? 'bg-[#1e3a5f] border-[#1e3a5f] text-white'
                          : isComplete
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : isNext
                          ? 'border-gray-400 text-gray-400 bg-gray-100 cursor-pointer hover:border-blue-500 hover:text-blue-600'
                          : 'border-gray-200 text-gray-400 bg-white'
                      }`}
                      onClick={() => isNext && !loading ? handleStatusChange(stage.key) : undefined}
                    >
                      {isComplete && !isCurrent ? <Check className="w-3.5 h-3.5" /> : i + 1}
                    </div>
                    <p className={`text-xs mt-2 text-center leading-tight ${
                      isCurrent ? 'text-blue-600 font-medium'
                      : isComplete ? 'text-emerald-600'
                      : 'text-gray-400'
                    }`}>
                      {stage.label}
                    </p>
                    {isNext && (
                      <button
                        onClick={() => !loading && handleStatusChange(stage.key)}
                        disabled={!!loading}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700 mt-1.5 px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors disabled:opacity-50"
                      >
                        Mark done
                      </button>
                    )}
                  </div>
                  {i < PIPELINE_STAGES.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-1 rounded-full ${
                      STAGE_ORDER.indexOf(lead.status) > i ? 'bg-emerald-500' : 'bg-gray-100'
                    }`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Converted banner */}
      {isWon && lead.converted_client_id && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-emerald-700">Converted to Client</p>
            <p className="text-xs text-gray-500">This lead has been successfully converted</p>
          </div>
          <Link href={`/clients/${lead.converted_client_id}`} className="text-xs text-blue-600 hover:underline">
            View Client →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column: contact + lead info */}
        <div className="lg:col-span-1 space-y-5">
          {/* Contact card */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">Contact Details</p>
            <div className="space-y-3">
              {lead.contact_name && (
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-700">
                    {lead.contact_name.charAt(0)}
                  </div>
                  <p className="text-sm font-medium text-gray-800">{lead.contact_name}</p>
                </div>
              )}
              {lead.contact_email && (
                <a href={`mailto:${lead.contact_email}`} className="flex items-center gap-2.5 text-sm text-gray-500 hover:text-blue-600 transition-colors">
                  <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                  {lead.contact_email}
                </a>
              )}
              {lead.contact_phone && (
                <a href={`tel:${lead.contact_phone}`} className="flex items-center gap-2.5 text-sm text-gray-500 hover:text-blue-600 transition-colors">
                  <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                  {lead.contact_phone}
                </a>
              )}
              {(lead.address || lead.suburb) && (
                <div className="flex items-start gap-2.5 text-sm text-gray-500">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <div>
                    {lead.address && <p>{lead.address}</p>}
                    {(lead.suburb || lead.state) && (
                      <p>{[lead.suburb, lead.state, lead.postcode].filter(Boolean).join(', ')}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Lead info */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">Lead Info</p>
            <div className="space-y-3">
              {lead.source && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Source</span>
                  <span className="text-gray-700">{lead.source}</span>
                </div>
              )}
              {lead.quote_value && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Quote Value</span>
                  <span className="text-gray-700 font-medium tabular-nums">{formatAUD(lead.quote_value)}/mo</span>
                </div>
              )}
              {lead.last_contact_date && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Last Contact</span>
                  <span className="text-gray-700">{formatDate(lead.last_contact_date)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Created</span>
                <span className="text-gray-700">{formatDate(lead.created_at)}</span>
              </div>
            </div>
            {lead.notes && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-400 mb-1.5">Notes</p>
                <p className="text-sm text-gray-700 leading-relaxed">{lead.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right column: documents + timeline */}
        <div className="lg:col-span-2 space-y-5">
          {/* Documents */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200">
              <p className="text-sm font-semibold text-gray-800">Documents</p>
            </div>
            <div className="p-5 space-y-3">
              {/* Proposal */}
              <div className={`rounded-lg border p-4 ${lead.proposal_data ? 'border-gray-300 bg-gray-50' : 'border-dashed border-gray-200'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${lead.proposal_data ? 'bg-blue-50' : 'bg-gray-100'}`}>
                      <FileText className={`w-4 h-4 ${lead.proposal_data ? 'text-blue-600' : 'text-gray-400'}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800">Proposal</p>
                      {lead.proposal_created_at ? (
                        <p className="text-xs text-gray-400">Created {formatDate(lead.proposal_created_at)}</p>
                      ) : (
                        <p className="text-xs text-gray-400">Not yet created</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {lead.proposal_data ? (
                      <>
                        <span className="text-xs text-gray-400 hidden sm:block">
                          {lead.proposal_sent_at ? `Sent ${formatDate(lead.proposal_sent_at)}` : 'Not sent'}
                        </span>
                        <Link
                          href={`/leads/${lead.id}/preview?type=proposal`}
                          target="_blank"
                          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 border border-gray-300 text-gray-700 hover:text-gray-900 hover:border-gray-400 transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </Link>
                        <Button type="button" variant="ghost" size="sm" onClick={() => { setShowAgreement(false); setShowProposal(true) }}>Edit</Button>
                        {!lead.proposal_sent_at && (
                          <Button type="button" size="sm" onClick={() => handleStatusChange('proposal_sent')} disabled={!!loading}>
                            Mark Sent
                          </Button>
                        )}
                      </>
                    ) : !isDone ? (
                      <Button type="button" size="sm" onClick={() => { setShowAgreement(false); setShowProposal(true) }} disabled={!!loading}>
                        <Plus className="w-3.5 h-3.5" /> Create Proposal
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Agreement */}
              <div className={`rounded-lg border p-4 ${lead.agreement_data ? 'border-gray-300 bg-gray-50' : 'border-dashed border-gray-200'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${lead.agreement_data ? 'bg-purple-50' : 'bg-gray-100'}`}>
                      <FilePen className={`w-4 h-4 ${lead.agreement_data ? 'text-purple-600' : 'text-gray-400'}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800">Agreement</p>
                      {lead.agreement_created_at ? (
                        <p className="text-xs text-gray-400">Created {formatDate(lead.agreement_created_at)}</p>
                      ) : (
                        <p className="text-xs text-gray-400">Not yet created</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {lead.agreement_data ? (
                      <>
                        <span className="text-xs text-gray-400 hidden sm:block">
                          {lead.agreement_sent_at ? `Sent ${formatDate(lead.agreement_sent_at)}` : 'Not sent'}
                        </span>
                        <Link
                          href={`/leads/${lead.id}/preview?type=agreement`}
                          target="_blank"
                          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 border border-gray-300 text-gray-700 hover:text-gray-900 hover:border-gray-400 transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </Link>
                        <Button type="button" variant="ghost" size="sm" onClick={() => { setShowProposal(false); setShowAgreement(true) }}>Edit</Button>
                        {!lead.agreement_sent_at && (
                          <Button type="button" size="sm" onClick={() => handleStatusChange('agreement_sent')} disabled={!!loading}>
                            Mark Sent
                          </Button>
                        )}
                      </>
                    ) : !isDone ? (
                      <Button type="button" size="sm" variant="secondary" onClick={() => { setShowProposal(false); setShowAgreement(true) }} disabled={!!loading}>
                        <Plus className="w-3.5 h-3.5" /> Create Agreement
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Convert to client */}
              {lead.agreement_sent_at && !isWon && !isLost && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <UserPlus className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-emerald-700">Ready to Convert</p>
                        <p className="text-xs text-gray-500">Agreement sent — create a client profile</p>
                      </div>
                    </div>
                    <Button onClick={() => setShowConvert(true)} disabled={!!loading}>
                      Convert to Client
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <p className="text-sm font-semibold text-gray-800">Timeline</p>
              <Button variant="ghost" size="sm" onClick={() => setShowAddNote(true)}>
                <Plus className="w-3.5 h-3.5" /> Note
              </Button>
            </div>

            {showAddNote && (
              <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Add a note…"
                  rows={2}
                  className="w-full bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                />
                <div className="flex justify-end gap-2 mt-2">
                  <Button variant="ghost" size="sm" onClick={() => { setShowAddNote(false); setNoteText('') }}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleAddNote} disabled={!noteText.trim() || loading === 'note'}>
                    Save Note
                  </Button>
                </div>
              </div>
            )}

            <div className="divide-y divide-gray-100">
              {timeline.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm text-gray-400">No timeline events yet</p>
                </div>
              ) : (
                timeline.map((event: TimelineEvent) => {
                  const iconMap: Record<string, React.ElementType> = {
                    note:          Plus,
                    status_change: ChevronRight,
                    proposal:      FileText,
                    agreement:     FilePen,
                    signed:        CheckCircle,
                    converted:     UserPlus,
                  }
                  const colorMap: Record<string, string> = {
                    note:          'text-gray-500',
                    status_change: 'text-blue-600',
                    proposal:      'text-blue-600',
                    agreement:     'text-purple-600',
                    signed:        'text-emerald-600',
                    converted:     'text-emerald-600',
                  }
                  const Icon = iconMap[event.type] ?? ChevronRight

                  return (
                    <div key={event.id} className="flex items-start gap-3 px-5 py-3">
                      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon className={`w-3 h-3 ${colorMap[event.type] ?? 'text-gray-500'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 leading-snug">{event.message}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(event.timestamp).toLocaleDateString('en-AU', {
                            day: 'numeric', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Proposal modal */}
      <Modal
        open={showProposal}
        onOpenChange={o => { if (!o) setShowProposal(false) }}
        title={lead.proposal_data ? 'Edit Proposal' : 'Create Proposal'}
        className="max-w-2xl"
      >
        <ProposalForm
          lead={lead}
          onSave={handleSaveProposal}
          onCancel={() => setShowProposal(false)}
          loading={loading === 'proposal'}
        />
      </Modal>

      {/* Agreement modal */}
      <Modal
        open={showAgreement}
        onOpenChange={o => { if (!o) setShowAgreement(false) }}
        title={lead.agreement_data ? 'Edit Agreement' : 'Create Agreement'}
        className="max-w-2xl"
      >
        <AgreementForm
          lead={lead}
          onSave={handleSaveAgreement}
          onCancel={() => setShowAgreement(false)}
          loading={loading === 'agreement'}
        />
      </Modal>

      {/* Convert modal */}
      <Modal
        open={showConvert}
        onOpenChange={o => { if (!o) setShowConvert(false) }}
        title="Convert to Client"
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-gray-50 border border-gray-300 p-4">
            <p className="text-sm font-medium text-gray-800">{lead.business_name}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {[lead.contact_name, lead.contact_email].filter(Boolean).join(' · ')}
            </p>
          </div>
          <p className="text-sm text-gray-500">
            This will create a new client profile with all lead data and retain the full document history.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowConvert(false)}>Cancel</Button>
            <Button onClick={handleConvert} disabled={loading === 'convert'}>
              {loading === 'convert' ? 'Converting…' : 'Convert to Client'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
