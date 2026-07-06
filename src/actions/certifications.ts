'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export interface CertInput {
  id?: string
  name: string
  category: string
  holder?: string
  issuer?: string
  reference?: string
  issue_date?: string | null
  expiry_date?: string | null
  file_url?: string | null
  notes?: string
}

const clean = (v?: string | null) => (v ?? '').toString().trim() || null

export async function saveCertificationAction(input: CertInput): Promise<{ id?: string; error?: string }> {
  if (!input.name?.trim()) return { error: 'Give the certificate a name.' }

  const db = createAdminClient() as any
  const row = {
    name: input.name.trim(),
    category: input.category || 'insurance',
    holder: clean(input.holder),
    issuer: clean(input.issuer),
    reference: clean(input.reference),
    issue_date: clean(input.issue_date),
    expiry_date: clean(input.expiry_date),
    file_url: clean(input.file_url),
    notes: clean(input.notes),
    updated_at: new Date().toISOString(),
  }

  if (input.id) {
    const { error } = await db.from('certifications').update(row).eq('id', input.id)
    if (error) return { error: error.message }
    revalidatePath('/safety')
    return { id: input.id }
  }

  const { data, error } = await db.from('certifications').insert(row).select('id').single()
  if (error) return { error: error.message }
  revalidatePath('/safety')
  return { id: data.id }
}

export async function deleteCertificationAction(id: string): Promise<{ error?: string }> {
  const db = createAdminClient() as any
  const { error } = await db.from('certifications').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/safety')
  return {}
}
