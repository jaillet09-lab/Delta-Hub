'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToRole } from '@/lib/push'
import { actionableDates } from '@/lib/schedule'

// ─── Helper: get current user's profile ───────────────────────────────────────

async function getCurrentProfile() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await (supabase as any)
    .from('profiles').select('*').eq('user_id', user.id).single()
  return data ?? null
}

// ─── Start job (records started_at, sets in_progress) ─────────────────────────

export async function startJobAction(jobId: string) {
  const supabase = createClient()
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Not authenticated' }

  // Update job status
  const { error: jobErr } = await (supabase as any)
    .from('job_assignments')
    .update({ status: 'in_progress' })
    .eq('id', jobId)
    .eq('cleaner_id', profile.id)

  if (jobErr) return { error: jobErr.message }

  // Upsert submission record with started_at
  const { error: subErr } = await (supabase as any)
    .from('job_submissions')
    .upsert(
      { job_id: jobId, cleaner_id: profile.id, started_at: new Date().toISOString() },
      { onConflict: 'job_id' }
    )

  if (subErr) return { error: subErr.message }

  revalidatePath('/cleaner/dashboard')
  revalidatePath(`/cleaner/jobs/${jobId}`)
  return { success: true }
}

// ─── Submit completed job ──────────────────────────────────────────────────────

export async function submitJobAction(input: {
  jobId: string
  photoUrls: string[]
  videoUrls?: string[]
  checklistCompleted: Record<string, boolean>
  notes: string
}) {
  const supabase = createClient()
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Not authenticated' }

  const now = new Date().toISOString()

  // Update submission record
  const { error: subErr } = await (supabase as any)
    .from('job_submissions')
    .upsert(
      {
        job_id:              input.jobId,
        cleaner_id:          profile.id,
        photo_urls:          input.photoUrls,
        video_urls:          input.videoUrls ?? [],
        checklist_completed: input.checklistCompleted,
        notes:               input.notes || null,
        completed_at:        now,
      },
      { onConflict: 'job_id' }
    )

  if (subErr) return { error: subErr.message }

  // Mark job completed
  const { error: jobErr } = await (supabase as any)
    .from('job_assignments')
    .update({ status: 'completed' })
    .eq('id', input.jobId)
    .eq('cleaner_id', profile.id)

  if (jobErr) return { error: jobErr.message }

  // Notify managers + admins by push (replaces the old admin email).
  try {
    const { data: jobData } = await (supabase as any)
      .from('job_assignments')
      .select('clients(business_name)')
      .eq('id', input.jobId)
      .single()

    const clientName  = jobData?.clients?.business_name ?? 'a client'
    const cleanerName = profile.full_name ?? 'A cleaner'

    // "Didn't finish" = submitted with some checklist items left unticked.
    const vals = Object.values(input.checklistCompleted ?? {})
    const unfinished = vals.filter(v => !v).length
    const allDone = vals.length > 0 && unfinished === 0

    const payload = allDone
      ? { title: '✅ Job completed', body: `${cleanerName} finished the clean at ${clientName}.`, url: '/manager/dashboard' }
      : { title: '⚠️ Job left unfinished', body: `${cleanerName} submitted ${clientName} with ${unfinished} item${unfinished === 1 ? '' : 's'} not ticked off.`, url: '/manager/dashboard' }

    sendPushToRole('manager', payload).catch(() => {})
    sendPushToRole('admin', payload).catch(() => {})
  } catch {
    // Notification failure should not block job submission
  }

  revalidatePath('/cleaner/dashboard')
  revalidatePath(`/cleaner/jobs/${input.jobId}`)
  revalidatePath('/manager/dashboard')
  return { success: true }
}

// ─── Flag an issue on a job ───────────────────────────────────────────────────

export async function flagJobAction(input: {
  jobId: string
  clientId: string
  description: string
}) {
  const supabase = createClient()
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Not authenticated' }

  // Create flag record
  const { error: flagErr } = await (supabase as any)
    .from('job_flags')
    .insert({
      job_id:      input.jobId,
      cleaner_id:  profile.id,
      client_id:   input.clientId,
      description: input.description,
    })

  if (flagErr) return { error: flagErr.message }

  // Mark job as flagged
  await (supabase as any)
    .from('job_assignments')
    .update({ status: 'flagged' })
    .eq('id', input.jobId)

  // Notify managers and admin via push
  const cleanerName = profile.full_name ?? 'A cleaner'
  sendPushToRole('manager', {
    title: '⚠️ Job Flagged',
    body:  `${cleanerName} flagged an issue on a job.`,
    url:   '/manager/flags',
  }).catch(() => {})
  sendPushToRole('admin', {
    title: '⚠️ Job Flagged',
    body:  `${cleanerName} flagged an issue on a job.`,
    url:   '/manager/flags',
  }).catch(() => {})

  revalidatePath('/cleaner/dashboard')
  revalidatePath(`/cleaner/jobs/${input.jobId}`)
  revalidatePath('/manager/flags')
  return { success: true }
}

// ─── Resolve a flag (manager) ─────────────────────────────────────────────────

export async function resolveFlagAction(flagId: string) {
  const supabase = createClient()
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Not authenticated' }

  const { error } = await (supabase as any)
    .from('job_flags')
    .update({ resolved: true, resolved_at: new Date().toISOString(), resolved_by: profile.id })
    .eq('id', flagId)

  if (error) return { error: error.message }

  revalidatePath('/manager/flags')
  revalidatePath('/manager/dashboard')
  return { success: true }
}

// ─── Resolve a client issue (manager) ────────────────────────────────────────

export async function resolveClientIssueAction(issueId: string) {
  const supabase = createClient()
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Not authenticated' }

  const { error } = await (supabase as any)
    .from('client_issues')
    .update({ resolved: true, resolved_at: new Date().toISOString(), resolved_by: profile.id })
    .eq('id', issueId)

  if (error) return { error: error.message }

  revalidatePath('/manager/flags')
  return { success: true }
}

// ─── Upload job photo to Supabase storage ─────────────────────────────────────

export async function uploadJobPhotoAction(jobId: string, formData: FormData) {
  const supabase = createClient()
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Not authenticated' }

  const file = formData.get('photo') as File
  if (!file) return { error: 'No file provided' }

  const ext   = file.name.split('.').pop() ?? 'jpg'
  const path  = `${jobId}/${Date.now()}.${ext}`

  const { error: upErr } = await (supabase as any).storage
    .from('job-photos')
    .upload(path, file, { contentType: file.type, upsert: false })

  if (upErr) return { error: upErr.message }

  const { data } = (supabase as any).storage.from('job-photos').getPublicUrl(path)
  return { success: true, url: data.publicUrl as string }
}

// ─── Start a clean for a client (creates job + marks in_progress) ────────────

export async function startCleanForClientAction(clientId: string, siteId?: string | null) {
  const supabase = createClient()
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Not authenticated' }

  const today = new Date().toISOString().split('T')[0]
  // Saturday jobs stay actionable on Sunday, so consider the whole weekend window
  const dates = actionableDates()

  // Block if cleaner already has a job in progress at a different client
  const { data: activeElsewhere } = await (supabase as any)
    .from('job_assignments')
    .select('id, client_id, clients(business_name)')
    .eq('cleaner_id', profile.id)
    .in('scheduled_date', dates)
    .in('status', ['in_progress', 'flagged'])
    .neq('client_id', clientId)
    .limit(1)
    .single()

  if (activeElsewhere?.id) {
    const name = activeElsewhere.clients?.business_name ?? 'another client'
    return { error: `You already have an active job at ${name}. Finish that one first.` }
  }

  // Resume an existing job within the weekend window (today, or Saturday's job
  // when it's Sunday) rather than creating a duplicate. Prefer a not-yet-done one.
  // For multi-site clients, scope to the specific site so each site has its own job.
  let resumeQ = (supabase as any)
    .from('job_assignments')
    .select('id, status, scheduled_date')
    .eq('client_id', clientId)
    .eq('cleaner_id', profile.id)
    .in('scheduled_date', dates)
  resumeQ = siteId ? resumeQ.eq('site_id', siteId) : resumeQ.is('site_id', null)
  const { data: existingJobs } = await resumeQ.order('scheduled_date', { ascending: false })

  const existing = (existingJobs ?? []).find((j: any) => j.status !== 'completed')
    ?? (existingJobs ?? [])[0]

  let jobId: string

  if (existing?.id) {
    jobId = existing.id
  } else {
    // Address/frequency for the job record — from the site when site-scoped, else the client
    let jobAddress: string | null = null
    let freqLabel: string | null = null
    if (siteId) {
      const { data: site } = await (supabase as any)
        .from('client_sites').select('address, suburb, frequency').eq('id', siteId).single()
      jobAddress = [site?.address, site?.suburb].filter(Boolean).join(', ') || null
      freqLabel  = site?.frequency ?? null
    } else {
      const { data: client } = await (supabase as any)
        .from('clients').select('address, suburb, frequency').eq('id', clientId).single()
      jobAddress = [client?.address, client?.suburb].filter(Boolean).join(', ') || null
      freqLabel  = client?.frequency ?? null
    }

    const { data: newJob, error: createErr } = await (supabase as any)
      .from('job_assignments')
      .insert({
        client_id:       clientId,
        cleaner_id:      profile.id,
        scheduled_date:  today,
        address:         jobAddress,
        status:          'not_started',
        checklist:       [],
        frequency_label: freqLabel,
        site_id:         siteId ?? null,
      })
      .select('id')
      .single()

    if (createErr) return { error: createErr.message }
    jobId = newJob.id
  }

  // Mark in_progress
  await (supabase as any)
    .from('job_assignments')
    .update({ status: 'in_progress' })
    .eq('id', jobId)

  // Upsert submission with started_at
  await (supabase as any)
    .from('job_submissions')
    .upsert(
      { job_id: jobId, cleaner_id: profile.id, started_at: new Date().toISOString() },
      { onConflict: 'job_id' }
    )

  revalidatePath(`/cleaner/clients/${clientId}`)
  return { success: true, jobId }
}

// ─── Admin / Manager override: mark a job complete ───────────────────────────

export async function adminMarkJobCompleteAction(
  jobId: string,
  note?: string,
  role: 'admin' | 'manager' = 'admin',
) {
  const supabase = createClient()
  const now = new Date().toISOString()

  // Get the acting user's name
  const profile = await getCurrentProfile()
  const actorName = profile?.full_name ?? (role === 'admin' ? 'Admin' : 'Manager')

  // Check if a cleaner already submitted this job — never overwrite
  const { data: existing } = await (supabase as any)
    .from('job_submissions')
    .select('id, completed_at, completed_by_role')
    .eq('job_id', jobId)
    .maybeSingle()

  const cleanerAlreadyDone =
    existing?.completed_at &&
    (existing.completed_by_role === 'cleaner' || existing.completed_by_role == null)

  if (cleanerAlreadyDone) {
    return { error: 'Cleaner has already submitted this job — no override needed.' }
  }

  // Upsert override submission
  const { error: subErr } = await (supabase as any)
    .from('job_submissions')
    .upsert(
      {
        job_id:              jobId,
        completed_at:        now,
        notes:               note || null,
        photo_urls:          [],
        video_urls:          [],
        checklist_completed: {},
        completed_by_role:   role,
        completed_by_name:   actorName,
      },
      { onConflict: 'job_id' }
    )

  if (subErr) return { error: subErr.message }

  const { error } = await (supabase as any)
    .from('job_assignments')
    .update({ status: 'completed' })
    .eq('id', jobId)

  if (error) return { error: error.message }

  revalidatePath('/team/jobs')
  revalidatePath('/dashboard')
  revalidatePath('/manager/dashboard')
  revalidatePath('/cleaner/dashboard')
  revalidatePath(`/manager/jobs/${jobId}`)
  return { success: true }
}

// ─── Admin: create a job record for a past scheduled clean and mark complete ──
// Used when no job_assignment was ever created (cleaner never started the app)

export async function adminCreateAndCompleteJobAction(input: {
  clientId: string
  scheduledDate: string
  cleanerProfileId?: string | null
}) {
  const supabase  = createClient()
  const adminClient = createAdminClient()
  const now       = new Date().toISOString()

  const profile   = await getCurrentProfile()
  const actorName = profile?.full_name ?? 'Admin'

  // Fetch client details for the job record
  const { data: client } = await (supabase as any)
    .from('clients')
    .select('address, suburb, frequency, assigned_cleaner_id')
    .eq('id', input.clientId)
    .single()

  const cleanerId = input.cleanerProfileId ?? client?.assigned_cleaner_id ?? null
  const address   = [client?.address, client?.suburb].filter(Boolean).join(', ')

  // Check if a job_assignment already exists for this client+date
  const { data: existing } = await (supabase as any)
    .from('job_assignments')
    .select('id, status')
    .eq('client_id', input.clientId)
    .eq('scheduled_date', input.scheduledDate)
    .maybeSingle()

  let jobId: string

  if (existing?.id) {
    jobId = existing.id
    if (existing.status === 'completed') {
      return { error: 'This job is already marked as complete.' }
    }
  } else {
    // Create the job_assignment
    const { data: newJob, error: createErr } = await (supabase as any)
      .from('job_assignments')
      .insert({
        client_id:       input.clientId,
        cleaner_id:      cleanerId,
        scheduled_date:  input.scheduledDate,
        address:         address || null,
        status:          'not_started',
        checklist:       [],
        frequency_label: client?.frequency ?? null,
      })
      .select('id')
      .single()

    if (createErr) return { error: createErr.message }
    jobId = newJob.id
  }

  // Upsert completion record
  const { error: subErr } = await (adminClient as any)
    .from('job_submissions')
    .upsert(
      {
        job_id:              jobId,
        completed_at:        now,
        notes:               `Marked complete by admin (${actorName})`,
        photo_urls:          [],
        video_urls:          [],
        checklist_completed: {},
        completed_by_role:   'admin',
        completed_by_name:   actorName,
      },
      { onConflict: 'job_id' }
    )

  if (subErr) return { error: subErr.message }

  const { error: jobErr } = await (adminClient as any)
    .from('job_assignments')
    .update({ status: 'completed' })
    .eq('id', jobId)

  if (jobErr) return { error: jobErr.message }

  revalidatePath('/dashboard')
  revalidatePath('/manager/dashboard')
  revalidatePath('/client/dashboard')
  return { success: true }
}

// ─── Assign or unassign a cleaner to a job (manager only) ────────────────────

export async function assignCleanerToJobAction(jobId: string, cleanerId: string | null) {
  const supabase = createClient()
  const { error } = await (supabase as any)
    .from('job_assignments')
    .update({ cleaner_id: cleanerId || null })
    .eq('id', jobId)

  if (error) return { error: error.message }

  revalidatePath('/manager/dashboard')
  revalidatePath('/manager/team')
  revalidatePath('/cleaner/dashboard')
  return { success: true }
}
