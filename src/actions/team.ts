'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// ─── Compliance document upload ───────────────────────────────────────────────

export async function uploadComplianceDocAction(formData: FormData) {
  const supabase = createClient()
  const file        = formData.get('file') as File
  const name        = formData.get('name') as string
  const description = (formData.get('description') as string) || null
  const type        = formData.get('type') as string
  const clientId    = formData.get('clientId') as string
  const profileId   = formData.get('profileId') as string
  const expiryDate  = (formData.get('expiryDate') as string) || null

  if (!file || !name || !type) return { error: 'Missing required fields' }

  const ext  = file.name.split('.').pop() ?? 'pdf'
  const path = `compliance/${Date.now()}.${ext}`

  const { error: upErr } = await (supabase as any).storage
    .from('job-photos')
    .upload(path, file, { contentType: file.type })

  if (upErr) return { error: upErr.message }

  const { data } = (supabase as any).storage.from('job-photos').getPublicUrl(path)

  const { error: dbErr } = await (supabase as any)
    .from('compliance_documents')
    .insert({
      name,
      description,
      type,
      file_url:    data.publicUrl.replace(/[\n\r\t\s]/g, ''),
      client_id:   clientId || null,
      profile_id:  profileId || null,
      expiry_date: expiryDate,
    })

  if (dbErr) return { error: dbErr.message }
  revalidatePath('/team/compliance')
  return { success: true }
}

export async function deleteComplianceDocAction(docId: string) {
  const supabase = createClient()
  const { error } = await (supabase as any)
    .from('compliance_documents').delete().eq('id', docId)
  if (error) return { error: error.message }
  revalidatePath('/team/compliance')
  return { success: true }
}

export async function createPortalUserAction(input: {
  email: string
  password: string
  fullName: string
  role: 'cleaner' | 'manager' | 'client'
  linkedClientId?: string | null
}) {
  const adminClient = createAdminClient()

  let authUserId: string

  // 1. Try to create the auth user
  const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
    email:          input.email,
    password:       input.password,
    email_confirm:  true,
    user_metadata:  { role: input.role, full_name: input.fullName },
  })

  if (authErr) {
    // If the email is already registered (orphaned auth user), find and reuse it
    const isAlreadyExists =
      authErr.message.toLowerCase().includes('already been registered') ||
      authErr.message.toLowerCase().includes('already exists') ||
      authErr.message.toLowerCase().includes('email address is already')

    if (!isAlreadyExists) {
      return { error: authErr.message }
    }

    // Find the existing auth user by email
    const { data: listData, error: listErr } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
    if (listErr) return { error: listErr.message }

    const existing = listData.users.find((u) => u.email === input.email)
    if (!existing) return { error: 'Email already registered but user not found. Please contact support.' }

    // Update their password and metadata so they can log in fresh
    const { error: updateErr } = await adminClient.auth.admin.updateUserById(existing.id, {
      password:      input.password,
      email_confirm: true,
      user_metadata: { role: input.role, full_name: input.fullName },
    })
    if (updateErr) return { error: updateErr.message }

    authUserId = existing.id
  } else if (!authData.user) {
    return { error: 'Failed to create user' }
  } else {
    authUserId = authData.user.id
  }

  // 2. Insert or update profile record
  const profileData = {
    user_id:          authUserId,
    role:             input.role,
    full_name:        input.fullName,
    email:            input.email,
    linked_client_id: input.linkedClientId ?? null,
  }

  // Check if a profile already exists for this user_id
  const { data: existing } = await (adminClient as any)
    .from('profiles')
    .select('id')
    .eq('user_id', authUserId)
    .single()

  let profErr: any = null
  if (existing?.id) {
    // Update existing profile
    const { error } = await (adminClient as any)
      .from('profiles')
      .update(profileData)
      .eq('user_id', authUserId)
    profErr = error
  } else {
    // Insert new profile
    const { error } = await (adminClient as any)
      .from('profiles')
      .insert(profileData)
    profErr = error
  }

  if (profErr) {
    // Only roll back auth user if we freshly created it
    if (authData?.user) {
      await adminClient.auth.admin.deleteUser(authUserId)
    }
    return { error: profErr.message }
  }

  revalidatePath('/team')
  revalidatePath('/manager/team')
  return { success: true, userId: authUserId }
}

export async function deletePortalUserAction(userId: string) {
  const adminClient = createAdminClient()

  // Delete profile first (no cascade from auth.users → profiles)
  await (adminClient as any)
    .from('profiles')
    .delete()
    .eq('user_id', userId)

  // Then delete the auth user
  const { error } = await adminClient.auth.admin.deleteUser(userId)
  if (error) return { error: error.message }

  revalidatePath('/team')
  revalidatePath('/manager/team')
  return { success: true }
}

export async function updateCleanerAction(input: {
  profileId: string
  userId: string
  fullName: string
  email: string
}) {
  const adminClient = createAdminClient()

  // Update auth user email + metadata
  const { error: authErr } = await adminClient.auth.admin.updateUserById(input.userId, {
    email:         input.email,
    user_metadata: { full_name: input.fullName },
  })
  if (authErr) return { error: authErr.message }

  // Update profile record
  const { error: profErr } = await (adminClient as any)
    .from('profiles')
    .update({ full_name: input.fullName, email: input.email })
    .eq('id', input.profileId)

  if (profErr) return { error: profErr.message }

  revalidatePath('/team')
  revalidatePath('/manager/team')
  return { success: true }
}

export async function updatePortalUserAction(input: {
  profileId: string
  userId: string
  fullName: string
  email: string
  newPassword?: string | null
  linkedClientId?: string | null
}) {
  const adminClient = createAdminClient()

  // Build auth update payload
  const authUpdate: Record<string, any> = {
    email:         input.email,
    user_metadata: { full_name: input.fullName },
  }
  if (input.newPassword && input.newPassword.trim().length >= 5) {
    authUpdate.password = input.newPassword.trim()
  }

  const { error: authErr } = await adminClient.auth.admin.updateUserById(input.userId, authUpdate)
  if (authErr) return { error: authErr.message }

  const profileUpdate: Record<string, any> = {
    full_name: input.fullName,
    email:     input.email,
  }
  if (input.linkedClientId !== undefined) {
    profileUpdate.linked_client_id = input.linkedClientId || null
  }

  const { error: profErr } = await (adminClient as any)
    .from('profiles')
    .update(profileUpdate)
    .eq('id', input.profileId)

  if (profErr) return { error: profErr.message }

  revalidatePath('/team')
  revalidatePath('/manager/team')
  return { success: true }
}

export async function linkClientToUserAction(profileId: string, clientId: string | null) {
  const supabase = createClient()
  const { error } = await (supabase as any)
    .from('profiles')
    .update({ linked_client_id: clientId || null })
    .eq('id', profileId)

  if (error) return { error: error.message }
  revalidatePath('/team')
  return { success: true }
}

export async function listPortalUsersAction() {
  const supabase = createClient()
  const { data, error } = await (supabase as any)
    .from('profiles')
    .select('*, clients(business_name)')
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }
  return { data: data ?? [] }
}

// ─── Cleaner by name (no email required) ─────────────────────────────────────

export async function addCleanerAction(input: {
  firstName: string
  lastName: string
  password: string
}) {
  const adminClient = createAdminClient()

  const first = input.firstName.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || 'cleaner'
  const last  = input.lastName.trim().toLowerCase().replace(/[^a-z0-9]/g, '')  || 'user'
  const fullName = `${input.firstName.trim()} ${input.lastName.trim()}`.trim()

  // Try john.smith@delta-cleaner.internal, then john.smith2, john.smith3 ...
  let email = `${first}.${last}@delta-cleaner.internal`
  let attempt = 1
  while (attempt < 20) {
    const { data: existing } = await (adminClient as any)
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (!existing) break
    attempt++
    email = `${first}.${last}${attempt}@delta-cleaner.internal`
  }

  return createPortalUserAction({
    email,
    password: input.password,
    fullName,
    role: 'cleaner',
    linkedClientId: null,
  })
}

export async function updateCleanerNameAction(input: {
  profileId: string
  userId: string
  firstName: string
  lastName: string
  newPassword?: string | null
}) {
  const adminClient = createAdminClient()
  const fullName = `${input.firstName.trim()} ${input.lastName.trim()}`.trim()

  // Update auth metadata only (email stays as-is — it's just an internal login handle)
  const authUpdate: Record<string, any> = {
    user_metadata: { full_name: fullName },
  }
  if (input.newPassword && input.newPassword.trim().length >= 5) {
    authUpdate.password = input.newPassword.trim()
  }

  const { error: authErr } = await adminClient.auth.admin.updateUserById(input.userId, authUpdate)
  if (authErr) return { error: authErr.message }

  const { error: profErr } = await (adminClient as any)
    .from('profiles')
    .update({ full_name: fullName })
    .eq('id', input.profileId)

  if (profErr) return { error: profErr.message }

  revalidatePath('/team')
  revalidatePath('/manager/team')
  return { success: true }
}

export async function createJobAction(input: {
  clientId: string
  cleanerId: string | null
  scheduledDate: string
  address: string
  accessNotes: string | null
  frequencyLabel: string | null
  checklist: { id: string; label: string; required: boolean }[]
}) {
  const supabase = createClient()

  const { error } = await (supabase as any)
    .from('job_assignments')
    .insert({
      client_id:       input.clientId,
      cleaner_id:      input.cleanerId || null,
      scheduled_date:  input.scheduledDate,
      address:         input.address || null,
      access_notes:    input.accessNotes,
      frequency_label: input.frequencyLabel,
      checklist:       input.checklist,
      status:          'not_started',
    })

  if (error) return { error: error.message }
  revalidatePath('/team/jobs')
  revalidatePath('/manager/dashboard')
  revalidatePath('/cleaner/dashboard')
  return { success: true }
}
