import 'server-only'

// Delta Hub self-diagnosis. A set of cheap, read-only health checks run against
// the live database. Shared by the weekly cron (which pushes the summary to the
// owner) and the /diagnostics page (which shows the full report on demand).

export interface DiagCheck {
  label: string
  status: 'ok' | 'warn' | 'alert'
  detail: string
}

// Brisbane calendar date (YYYY-MM-DD) offset by N days. Date columns compare
// lexically = chronologically, so string comparison is safe.
function brisbaneDate(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86_400_000)
    .toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit' })
    .split('/').reverse().join('-')
}

export async function runDiagnostics(db: any): Promise<{ checks: DiagCheck[]; generatedAt: string }> {
  const checks: DiagCheck[] = []
  const today    = brisbaneDate(0)
  const weekAgo  = brisbaneDate(-7)
  const soon     = brisbaneDate(60)

  // 1 · Cleans started but never submitted (stuck before today)
  try {
    const { data } = await db.from('job_assignments')
      .select('id').eq('status', 'in_progress').lt('scheduled_date', today)
    const n = data?.length ?? 0
    checks.push({
      label: 'Jobs stuck in progress',
      status: n === 0 ? 'ok' : n <= 2 ? 'warn' : 'alert',
      detail: n === 0 ? 'Every started clean was submitted.' : `${n} clean${n > 1 ? 's were' : ' was'} started before today and never submitted.`,
    })
  } catch { checks.push({ label: 'Jobs stuck in progress', status: 'warn', detail: 'Could not check this.' }) }

  // 2 · Cleaner flags still open
  try {
    const { data } = await db.from('job_flags').select('id').eq('resolved', false)
    const n = data?.length ?? 0
    checks.push({
      label: 'Unresolved flags',
      status: n === 0 ? 'ok' : n <= 2 ? 'warn' : 'alert',
      detail: n === 0 ? 'No open issues flagged by cleaners.' : `${n} flag${n > 1 ? 's are' : ' is'} still open.`,
    })
  } catch { checks.push({ label: 'Unresolved flags', status: 'warn', detail: 'Could not check this.' }) }

  // 3 · Insurance & certificate expiries (subcontractors + company compliance docs)
  try {
    const { data: subs } = await db.from('subcontractors').select('company_name, insurance_expiry')
    const { data: docs } = await db.from('compliance_documents')
      .select('name, expiry_date, type').in('type', ['certificate_of_currency', 'insurance']).not('expiry_date', 'is', null)
    const items: string[] = []
    for (const s of subs ?? []) {
      if (s.insurance_expiry && s.insurance_expiry <= soon)
        items.push(`${s.company_name || 'Subcontractor'} insurance ${s.insurance_expiry < today ? 'EXPIRED' : 'expiring'} ${s.insurance_expiry}`)
    }
    for (const d of docs ?? []) {
      if (d.expiry_date && d.expiry_date <= soon)
        items.push(`${d.name} ${d.expiry_date < today ? 'EXPIRED' : 'expiring'} ${d.expiry_date}`)
    }
    const expired = items.some((i) => i.includes('EXPIRED'))
    checks.push({
      label: 'Insurance & certificates',
      status: items.length === 0 ? 'ok' : expired ? 'alert' : 'warn',
      detail: items.length === 0 ? 'All current (nothing expiring within 60 days).' : items.join('; '),
    })
  } catch { checks.push({ label: 'Insurance & certificates', status: 'warn', detail: 'Could not check this.' }) }

  // 4 · Draft proposals sitting unsent for a while (gentle nudge, never an alert)
  try {
    const { data } = await db.from('proposal_documents').select('id').eq('status', 'draft')
    const n = data?.length ?? 0
    checks.push({
      label: 'Proposals in draft',
      status: 'ok',
      detail: n === 0 ? 'No drafts waiting.' : `${n} proposal${n > 1 ? 's' : ''} still in draft.`,
    })
  } catch { checks.push({ label: 'Proposals in draft', status: 'warn', detail: 'Could not check this.' }) }

  // 5 · Activity this week (a positive signal)
  try {
    const { data } = await db.from('job_assignments')
      .select('id').eq('status', 'completed').gte('scheduled_date', weekAgo)
    const n = data?.length ?? 0
    checks.push({
      label: 'Cleans completed (last 7 days)',
      status: 'ok',
      detail: `${n} clean${n === 1 ? '' : 's'} submitted this week.`,
    })
  } catch { checks.push({ label: 'Cleans completed (last 7 days)', status: 'warn', detail: 'Could not check this.' }) }

  return { checks, generatedAt: new Date().toISOString() }
}
