import { z } from 'zod'

export const serviceTypeEnum = z.enum([
  'general_cleaning',
  'pressure_washing',
  'window_cleaning',
  'floor_care',
  'carpet_cleaning',
  'hygiene_bins',
])

export const frequencyEnum = z.enum([
  'daily',
  'weekly',
  'fortnightly',
  'monthly',
  'quarterly',
  'annual',
  'one_off',
])

export const clientSchema = z.object({
  business_name: z.string().min(1, 'Business name is required').max(200),
  contact_name: z.string().max(100).optional().or(z.literal('')),
  contact_email: z
    .string()
    .email('Invalid email address')
    .optional()
    .or(z.literal('')),
  contact_phone: z.string().max(20).optional().or(z.literal('')),
  address: z.string().max(300).optional().or(z.literal('')),
  suburb: z.string().max(100).optional().or(z.literal('')),
  state: z.string().default('QLD'),
  postcode: z
    .string()
    .regex(/^\d{4}$/, 'Must be a 4-digit postcode')
    .optional()
    .or(z.literal('')),
  service_type: z
    .array(serviceTypeEnum)
    .min(0),
  frequency: frequencyEnum.optional(),
  rate_per_visit: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.coerce.number().positive('Must be a positive amount').optional()
  ),
  start_date: z.string().optional().or(z.literal('')),
  active: z.boolean().default(true),
  notes: z.string().max(2000).optional().or(z.literal('')),
  days_per_week: z.coerce.number().int().min(1).max(7).optional(),
  scope_of_work: z.string().max(5000).optional().or(z.literal('')),
  access_details: z.string().max(2000).optional().or(z.literal('')),
  assigned_cleaner_id: z.string().uuid().optional().or(z.literal('')),
})

export type ClientFormData = z.infer<typeof clientSchema>
