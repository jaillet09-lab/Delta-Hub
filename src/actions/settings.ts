'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { AppSettings } from '@/types/app'

const DEFAULT_SETTINGS: AppSettings = {
  business: {
    name:    'Delta Cleaning',
    email:   'hello@deltacleaning.com.au',
    phone:   '0412 844 238',
    website: 'https://www.deltacleaning.com.au',
    address: 'Brisbane, QLD',
  },
  margin_thresholds:      { red: 24, yellow: 40 },
  valuation_multiple:     2.5,
  survey_frequency_days:  90,
  lead_followup_days:     7,
  contract_renewal_days:  60,
  survey_questions: [
    { id: 'q1', key: 'quality_score',       text: 'How would you rate the quality of our cleaning service?',             min: 1, max: 10 },
    { id: 'q2', key: 'reliability_score',   text: 'How reliable is our team (on time, consistent)?',                    min: 1, max: 10 },
    { id: 'q3', key: 'communication_score', text: 'How would you rate our communication and responsiveness?',            min: 1, max: 10 },
    { id: 'q4', key: 'value_score',         text: 'How well does our service represent value for money?',                min: 1, max: 10 },
    { id: 'q5', key: 'nps_score',           text: 'How likely are you to recommend Delta Cleaning? (0 = not at all, 10 = extremely likely)', min: 0, max: 10 },
  ],
}

export async function getSettings(): Promise<AppSettings> {
  try {
    const supabase = createClient()
    const db = supabase as any
    const { data } = await db.from('settings').select('key, value')
    if (!data || data.length === 0) return DEFAULT_SETTINGS

    const map: Record<string, unknown> = {}
    for (const row of data) map[row.key] = row.value

    return {
      business:             (map.business as AppSettings['business'])             ?? DEFAULT_SETTINGS.business,
      margin_thresholds:    (map.margin_thresholds as AppSettings['margin_thresholds']) ?? DEFAULT_SETTINGS.margin_thresholds,
      valuation_multiple:   typeof map.valuation_multiple === 'number' ? map.valuation_multiple : Number(map.valuation_multiple ?? DEFAULT_SETTINGS.valuation_multiple),
      survey_frequency_days: typeof map.survey_frequency_days === 'number' ? map.survey_frequency_days : Number(map.survey_frequency_days ?? DEFAULT_SETTINGS.survey_frequency_days),
      lead_followup_days:    typeof map.lead_followup_days === 'number' ? map.lead_followup_days : Number(map.lead_followup_days ?? DEFAULT_SETTINGS.lead_followup_days),
      contract_renewal_days: typeof map.contract_renewal_days === 'number' ? map.contract_renewal_days : Number(map.contract_renewal_days ?? DEFAULT_SETTINGS.contract_renewal_days),
      survey_questions:      (map.survey_questions as AppSettings['survey_questions']) ?? DEFAULT_SETTINGS.survey_questions,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export async function updateSettingAction(key: string, value: unknown) {
  const supabase = createClient()
  const db = supabase as any
  await db
    .from('settings')
    .upsert({ key, value }, { onConflict: 'key' })
  revalidatePath('/settings')
}

export async function updateBusinessSettingsAction(formData: FormData) {
  const value = {
    name:    formData.get('name'),
    email:   formData.get('email'),
    phone:   formData.get('phone'),
    website: formData.get('website'),
    address: formData.get('address'),
  }
  await updateSettingAction('business', value)
  revalidatePath('/settings')
}

export async function updateMarginThresholdsAction(red: number, yellow: number) {
  await updateSettingAction('margin_thresholds', { red, yellow })
}

export async function updateSurveyQuestionsAction(questions: AppSettings['survey_questions']) {
  await updateSettingAction('survey_questions', questions)
}

export async function updateComplianceInfoAction(abn: string, insurancePolicyNumber: string) {
  const supabase = createClient()
  // Try to update existing row, insert if none exists
  const { data: existing } = await (supabase as any).from('settings').select('id').limit(1).single()
  if (existing?.id) {
    await (supabase as any).from('settings').update({ abn: abn || null, insurance_policy_number: insurancePolicyNumber || null }).eq('id', existing.id)
  } else {
    await (supabase as any).from('settings').insert({ abn: abn || null, insurance_policy_number: insurancePolicyNumber || null })
  }
  revalidatePath('/settings')
  return { success: true }
}
