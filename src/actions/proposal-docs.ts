'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_PROPOSAL, type ProposalData } from '@/lib/documents/proposal'

export type DocKind = 'proposal' | 'agreement' | 'one_off' | 'capability'

export interface ProposalDoc {
  id: string
  kind: DocKind
  status: string
  ref_number: string | null
  client_name: string | null
  data: any
  source_id: string | null
  client_id: string | null
  lead_id: string | null
  pdf_url: string | null
  signed_pdf_url: string | null
  docusign_envelope_id: string | null
  sent_at: string | null
  created_at: string
  updated_at: string
}

function nextRef(prefix: string): string {
  // e.g. DC-PROP-4821 — short, human, unique enough for display
  return `${prefix}-${Math.floor(1000 + Math.random() * 8999)}`
}

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createProposalAction(seed?: Partial<ProposalData> & { clientId?: string }) {
  const db = createAdminClient() as any
  const ref = nextRef('DC-PROP')
  const data: ProposalData = { ...DEFAULT_PROPOSAL, ...(seed ?? {}), refNumber: ref }

  const { data: row, error } = await db.from('proposal_documents').insert({
    kind: 'proposal',
    status: 'draft',
    ref_number: ref,
    client_name: data.clientName,
    client_id: seed?.clientId ?? null,
    data,
  }).select('id').single()

  if (error) return { error: error.message }
  revalidatePath('/documents')
  redirect(`/documents/${row.id}`)
}

// ─── Save (with optional version snapshot) ───────────────────────────────────

export async function saveProposalDocAction(id: string, data: ProposalData, snapshotLabel?: string) {
  const db = createAdminClient() as any
  const { error } = await db.from('proposal_documents').update({
    data,
    client_name: data.clientName,
    ref_number: data.refNumber,
  }).eq('id', id)
  if (error) return { error: error.message }

  if (snapshotLabel) {
    await db.from('proposal_document_versions').insert({ document_id: id, data, label: snapshotLabel })
  }
  revalidatePath('/documents')
  revalidatePath(`/documents/${id}`)
  return { success: true }
}

export async function setDocStatusAction(id: string, status: string) {
  const db = createAdminClient() as any
  const { error } = await db.from('proposal_documents').update({ status }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/documents')
  revalidatePath(`/documents/${id}`)
  return { success: true }
}

// ─── Duplicate / delete ──────────────────────────────────────────────────────

export async function duplicateProposalDocAction(id: string) {
  const db = createAdminClient() as any
  const { data: orig } = await db.from('proposal_documents').select('*').eq('id', id).single()
  if (!orig) return { error: 'Document not found' }
  const ref = nextRef(orig.kind === 'proposal' ? 'DC-PROP' : 'DC-DOC')
  const data = { ...(orig.data ?? {}), refNumber: ref }
  const { error } = await db.from('proposal_documents').insert({
    kind: orig.kind, status: 'draft', ref_number: ref,
    client_name: orig.client_name, client_id: orig.client_id, data,
  })
  if (error) return { error: error.message }
  revalidatePath('/documents')
  return { success: true }
}

export async function deleteProposalDocAction(id: string) {
  const db = createAdminClient() as any
  const { error } = await db.from('proposal_documents').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/documents')
  return { success: true }
}

// ─── Restore a prior version ─────────────────────────────────────────────────

export async function restoreVersionAction(documentId: string, versionId: string) {
  const db = createAdminClient() as any
  const { data: v } = await db.from('proposal_document_versions').select('data').eq('id', versionId).single()
  if (!v) return { error: 'Version not found' }
  await db.from('proposal_documents').update({
    data: v.data, client_name: v.data?.clientName, ref_number: v.data?.refNumber,
  }).eq('id', documentId)
  revalidatePath(`/documents/${documentId}`)
  return { success: true }
}
