import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

// DocuSign Connect webhook (per-envelope eventNotification). Marks the matching
// agreement signed/declined/voided. Accepts JSON (Connect 2.0) or XML (legacy).
export async function POST(req: Request) {
  const raw = await req.text()
  let envelopeId: string | null = null
  let status: string | null = null

  try {
    const j = JSON.parse(raw)
    envelopeId = j?.data?.envelopeId || j?.envelopeId || null
    status = (j?.event || j?.data?.envelopeSummary?.status || j?.status || '').toLowerCase() || null
  } catch {
    // XML fallback
    envelopeId = raw.match(/<EnvelopeId>([^<]+)<\/EnvelopeId>/i)?.[1] ?? null
    status = raw.match(/<Status>([^<]+)<\/Status>/i)?.[1]?.toLowerCase() ?? null
  }

  if (!envelopeId) return NextResponse.json({ ok: true })

  const map: Record<string, string> = {
    completed: 'signed', 'envelope-completed': 'signed',
    declined: 'declined', 'envelope-declined': 'declined',
    voided: 'declined', 'envelope-voided': 'declined',
  }
  const newStatus = status ? map[status] : undefined
  if (!newStatus) return NextResponse.json({ ok: true })

  const db = createAdminClient() as any
  await db.from('proposal_documents').update({ status: newStatus }).eq('docusign_envelope_id', envelopeId)
  return NextResponse.json({ ok: true })
}
