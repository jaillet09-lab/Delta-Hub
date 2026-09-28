import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { LeadProfile } from '@/components/leads/LeadProfile'
import type { CallRow } from '@/components/calls/CallHistory'

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: lead, error } = await (supabase as any)
    .from('leads')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!lead || error) notFound()

  const { data: callRows } = await (supabase as any)
    .from('calls')
    .select('id, direction, started_at, duration_seconds, outcome, summary, next_step, transcript, recording_path, status')
    .eq('lead_id', params.id)
    .order('started_at', { ascending: false })

  return (
    <div className="-m-4 lg:-m-6 p-4 lg:p-6">
      <LeadProfile lead={lead} calls={(callRows ?? []) as CallRow[]} />
    </div>
  )
}
