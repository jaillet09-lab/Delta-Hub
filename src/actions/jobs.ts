'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { sendPushToRole } from '@/lib/push'

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

  // Send admin notification email (non-blocking)
  try {
    const { data: jobData } = await (supabase as any)
      .from('job_assignments')
      .select('scheduled_date, clients(business_name)')
      .eq('id', input.jobId)
      .single()

    const clientName = jobData?.clients?.business_name ?? 'Unknown Client'
    const date       = jobData?.scheduled_date ?? now.split('T')[0]
    const cleanerName = profile.full_name ?? 'Unknown Cleaner'
    const photoCount  = input.photoUrls.length

    await sendEmail(
      'hello@deltacleaning.com.au',
      `Job Submitted — ${clientName} ${date}`,
      `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 20px; color: #111;">
          <h2 style="font-size: 18px; font-weight: 700; margin-bottom: 16px;">Job Submitted</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 8px 0; color: #555; width: 120px;">Client</td><td style="padding: 8px 0; font-weight: 600;">${clientName}</td></tr>
            <tr><td style="padding: 8px 0; color: #555;">Date</td><td style="padding: 8px 0;">${date}</td></tr>
            <tr><td style="padding: 8px 0; color: #555;">Cleaner</td><td style="padding: 8px 0;">${cleanerName}</td></tr>
            <tr><td style="padding: 8px 0; color: #555;">Photos</td><td style="padding: 8px 0;">${photoCount}</td></tr>
            ${input.notes ? `<tr><td style="padding: 8px 0; color: #555; vertical-align: top;">Notes</td><td style="padding: 8px 0;">${input.notes}</td></tr>` : ''}
          </table>
        </div>
      `
    )
  } catch {
    // Email failure should not block job submission
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

export async function startCleanForClientAction(clientId: string) {
  const supabase = createClient()
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Not authenticated' }

  const today = new Date().toISOString().split('T')[0]

  // Block if cleaner already has a job in progress at a different client
  const { data: activeElsewhere } = await (supabase as any)
    .from('job_assignments')
    .select('id, client_id, clients(business_name)')
    .eq('cleaner_id', profile.id)
    .eq('scheduled_date', today)
    .in('status', ['in_progress', 'flagged'])
    .neq('client_id', clientId)
    .limit(1)
    .single()

  if (activeElsewhere?.id) {
    const name = activeElsewhere.clients?.business_name ?? 'another client'
    return { error: `You already have an active job at ${name}. Finish that one first.` }
  }

  // Check if a job already exists for this client today
  const { data: existing } = await (supabase as any)
    .from('job_assignments')
    .select('id, status')
    .eq('client_id', clientId)
    .eq('cleaner_id', profile.id)
    .eq('scheduled_date', today)
    .single()

  let jobId: string

  if (existing?.id) {
    jobId = existing.id
  } else {
    // Fetch client address for the job record
    const { data: client } = await (supabase as any)
      .from('clients')
      .select('address, suburb, frequency')
      .eq('id', clientId)
      .single()

    const address = [client?.address, client?.suburb].filter(Boolean).join(', ')

    const { data: newJob, error: createErr } = await (supabase as any)
      .from('job_assignments')
      .insert({
        client_id:       clientId,
        cleaner_id:      profile.id,
        scheduled_date:  today,
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

  // Upsert override submission (won't touch real cleaner data)
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
  revalidatePath('/manager/dashboard')
  revalidatePath('/cleaner/dashboard')
  revalidatePath(`/manager/jobs/${jobId}`)
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
