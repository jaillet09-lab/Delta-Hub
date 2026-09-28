'use server'

import { createClient } from '@/lib/supabase/server'

// Dashboard alert dismissals, stored in the shared settings table so they persist
// across sessions and devices (the old localStorage approach reset every session).
// Each dismissal carries a timestamp and expires after TTL_DAYS, so a still-true
// alert resurfaces later rather than being hidden forever.

const KEY = 'dismissed_alerts'
const TTL_DAYS = 45

interface Entry { id: string; at: string }

async function loadEntries(db: any): Promise<Entry[]> {
  const { data } = await db.from('settings').select('value').eq('key', KEY).maybeSingle()
  const list = (data?.value as Entry[] | null) ?? []
  const cutoff = Date.now() - TTL_DAYS * 86_400_000
  return list.filter((e) => e?.id && e?.at && new Date(e.at).getTime() > cutoff)
}

export async function getDismissedAlertIds(): Promise<string[]> {
  try {
    const db = createClient() as any
    return (await loadEntries(db)).map((e) => e.id)
  } catch {
    return []
  }
}

export async function dismissAlertsAction(ids: string[]): Promise<{ ok: boolean }> {
  try {
    if (!ids.length) return { ok: true }
    const db = createClient() as any
    const existing = await loadEntries(db)
    const now = new Date().toISOString()
    const map = new Map(existing.map((e) => [e.id, e]))
    for (const id of ids) map.set(id, { id, at: now })
    await db.from('settings').upsert({ key: KEY, value: Array.from(map.values()) }, { onConflict: 'key' })
    return { ok: true }
  } catch {
    return { ok: false }
  }
}
