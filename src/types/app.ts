import type { Database } from './database'

type Tables = Database['public']['Tables']
type Enums = Database['public']['Enums']

export type Client = Tables['clients']['Row']
export type ClientInsert = Tables['clients']['Insert']
export type ClientUpdate = Tables['clients']['Update']

export type Document = Tables['documents']['Row']
export type DocumentInsert = Tables['documents']['Insert']
export type DocumentUpdate = Tables['documents']['Update']

export type FinancialRecord = Tables['financial_records']['Row']
export type FinancialRecordInsert = Tables['financial_records']['Insert']

export type SOP = Tables['sops']['Row']
export type SOPInsert = Tables['sops']['Insert']
export type SOPUpdate = Tables['sops']['Update']

export type Survey = Tables['surveys']['Row']
export type SurveyInsert = Tables['surveys']['Insert']

export type ServiceType = Enums['service_type']
export type FrequencyType = Enums['frequency_type']
export type DocumentType = Enums['document_type']
export type DocumentStatus = Enums['document_status']

// ─── Lead pipeline ───────────────────────────────────────────────────────────

export type LeadStatus = 'lead' | 'contacted' | 'quoted' | 'proposal_sent' | 'agreement_sent' | 'won' | 'lost'

export interface TimelineEvent {
  id: string
  type: 'note' | 'status_change' | 'proposal' | 'agreement' | 'signed' | 'converted'
  message: string
  timestamp: string
  metadata?: Record<string, any>
}

export interface Lead {
  id: string
  business_name: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  address: string | null
  suburb: string | null
  state: string | null
  postcode: string | null
  source: string | null
  status: LeadStatus
  last_contact_date: string | null
  quote_value: number | null
  notes: string | null
  proposal_data: Record<string, any> | null
  agreement_data: Record<string, any> | null
  proposal_created_at: string | null
  proposal_sent_at: string | null
  agreement_created_at: string | null
  agreement_sent_at: string | null
  signed_date: string | null
  contract_expiry: string | null
  converted_client_id: string | null
  timeline: TimelineEvent[]
  created_at: string
  updated_at: string
}

export interface LeadInsert {
  business_name: string
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  address?: string | null
  suburb?: string | null
  state?: string | null
  postcode?: string | null
  source?: string | null
  status?: LeadStatus
  last_contact_date?: string | null
  quote_value?: number | null
  notes?: string | null
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface AppSettings {
  business: {
    name: string
    email: string
    phone: string
    website: string
    address: string
  }
  margin_thresholds: {
    red: number    // below this = critical
    yellow: number // below this = watch
  }
  valuation_multiple: number
  survey_frequency_days: number
  lead_followup_days: number
  contract_renewal_days: number
  survey_questions: SurveyQuestion[]
}

export interface SurveyQuestion {
  id: string
  key: string
  text: string
  min: number
  max: number
}

// ─── Client health ───────────────────────────────────────────────────────────

export type HealthStatus = 'healthy' | 'watch' | 'at_risk' | 'incomplete'

export interface ClientHealth {
  status: HealthStatus
  reasons: string[]
}

// Clients enriched with computed health + latest survey avg
export interface ClientWithHealth extends Client {
  health: HealthStatus
  healthReasons: string[]
  latestSurveyAvg: number | null
  // These come from DB columns added in migration 005:
  visits_per_month: number | null
  monthly_labour_cost: number | null
  monthly_profit: number | null
  margin_pct: number | null
  profile_complete: boolean
  contract_expiry_date: string | null
  // Added in migration 009:
  additional_services: AdditionalService[]
}

// ─── Dashboard alerts ─────────────────────────────────────────────────────────

export type AlertType =
  | 'low_margin'
  | 'contract_expiry'
  | 'contract_renewal'
  | 'proposal_stale'
  | 'survey_overdue'
  | 'profile_incomplete'
  | 'lead_followup'

export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface DashboardAlert {
  id: string
  type: AlertType
  severity: AlertSeverity
  message: string
  subtext?: string
  href: string
  resolveHint: string
}

// ─── Enriched types ──────────────────────────────────────────────────────────

export type ClientWithDocuments = Client & {
  documents: Document[]
}

export type ClientWithSurveys = Client & {
  surveys: Survey[]
}

export type SurveyWithClient = Survey & {
  clients: Pick<Client, 'id' | 'business_name' | 'ref_number'> | null
}

export type FinancialRecordWithClient = FinancialRecord & {
  clients: Pick<Client, 'id' | 'business_name'> | null
}

export interface EmailTemplate {
  id: string
  name: string
  type: string
  subject: string
  body: string
  created_at: string
  updated_at: string
}

export interface EmailSent {
  id: string
  client_id: string | null
  template_id: string | null
  to_email: string
  to_name: string | null
  subject: string
  body: string
  sent_at: string
  status: string
}

// ─── Additional services ──────────────────────────────────────────────────────

export type AdditionalServiceFrequency = 'monthly' | 'quarterly' | 'bi-annual' | 'annual' | 'one_off'

export interface AdditionalService {
  id: string
  name: string
  frequency: AdditionalServiceFrequency
  my_rate_per_visit: number
  cleaner_cost_per_visit: number
}

/** Monthly revenue multiplier for additional service frequencies */
export const ADDITIONAL_SERVICE_MULTIPLIERS: Record<AdditionalServiceFrequency, number> = {
  monthly:    1,
  quarterly:  1 / 3,
  'bi-annual': 1 / 6,
  annual:     1 / 12,
  one_off:    0,
}

export function calcAdditionalMonthlyRevenue(services: AdditionalService[]): number {
  return services.reduce((sum, s) => {
    const mult = ADDITIONAL_SERVICE_MULTIPLIERS[s.frequency] ?? 0
    return sum + s.my_rate_per_visit * mult
  }, 0)
}

export function calcAdditionalMonthlyLabour(services: AdditionalService[]): number {
  return services.reduce((sum, s) => {
    const mult = ADDITIONAL_SERVICE_MULTIPLIERS[s.frequency] ?? 0
    return sum + s.cleaner_cost_per_visit * mult
  }, 0)
}

// ─── Document content (JSONB) ─────────────────────────────────────────────────

export interface DocumentContent {
  clientId: string
  clientName: string
  clientAddress: string
  contactName: string | null
  clientEmail: string | null
  generatedDate: string
  expiryDate?: string
  billing: {
    serviceTypes: ServiceType[]
    frequency: FrequencyType
    ratePerVisit: number
    monthlyValue: number
    annualValue: number
    visitsPerMonth: number
    gstInclusive: boolean
  }
  proposal?: {
    scopeOfWork: string
    inclusions: string
    exclusions: string
    termsAndConditions: string
  }
  cleaningAgreement?: {
    commencementDate: string
    contractLength: string
    noticePeriod: string
    specialInstructions: string
    paymentTerms: string
    terminationClause: string
    signatoryName: string
    signatoryTitle: string
  }
  specialistAgreement?: {
    specialistServiceType: string
    commencementDate: string
    specialConditions: string
    signatoryName: string
    signatoryTitle: string
  }
}
