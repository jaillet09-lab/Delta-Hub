import type { FrequencyType } from '@/types/app'

/**
 * Converts a per-visit rate to a monthly value based on service frequency.
 * Formula: monthly = ratePerVisit × (visitsPerYear / 12)
 */
export const FREQUENCY_MULTIPLIERS: Record<FrequencyType, number> = {
  daily:        365 / 12,  // ~30.42 visits/month (every day)
  weekly:       52  / 12,  // ~4.33 visits/month PER cleaning day
  fortnightly:  26  / 12,  // ~2.17 visits/month PER cleaning day
  monthly:      1,          // 1 visit/month
  quarterly:    4   / 12,  // ~0.33 visits/month
  annual:       1   / 12,  // ~0.083 visits/month
  one_off:      1,          // treated as one visit
}

/**
 * Visits per month for a given frequency, factoring in how many days per week
 * the site is cleaned. Weekly @ 5 days/wk = 5 × 4.33 ≈ 21.65 visits/month.
 * days/week only applies to weekly & fortnightly cadences; daily already covers
 * the whole week, and monthly/quarterly/annual/one-off are single occurrences.
 */
export function visitsPerMonth(frequency: FrequencyType, daysPerWeek = 1): number {
  const d = daysPerWeek && daysPerWeek > 0 ? daysPerWeek : 1
  switch (frequency) {
    case 'weekly':      return d * (52 / 12)
    case 'fortnightly': return d * (26 / 12)
    default:            return FREQUENCY_MULTIPLIERS[frequency] ?? 1
  }
}

export function calculateMonthlyValue(
  ratePerVisit: number,
  frequency: FrequencyType,
  daysPerWeek = 1,
): number {
  return Math.round(ratePerVisit * visitsPerMonth(frequency, daysPerWeek) * 100) / 100
}

export function calculateAnnualValue(monthlyValue: number): number {
  return Math.round(monthlyValue * 12 * 100) / 100
}

export interface BillingBreakdown {
  ratePerVisit: number
  frequency: FrequencyType
  monthlyValue: number
  annualValue: number
  visitsPerMonth: number
}

export function calculateBillingBreakdown(
  ratePerVisit: number,
  frequency: FrequencyType
): BillingBreakdown {
  const multiplier = FREQUENCY_MULTIPLIERS[frequency]
  const monthlyValue = calculateMonthlyValue(ratePerVisit, frequency)
  return {
    ratePerVisit,
    frequency,
    monthlyValue,
    annualValue:    calculateAnnualValue(monthlyValue),
    visitsPerMonth: Math.round(multiplier * 100) / 100,
  }
}

// ─── Labour & profit calculations ─────────────────────────────────────────────

export interface ProfitBreakdown {
  visitsPerMonth:   number
  monthlyRevenue:   number
  monthlyLabour:    number
  monthlyProfit:    number
  marginPct:        number
  annualRevenue:    number
  annualLabour:     number
  annualProfit:     number
}

export function calculateProfitBreakdown(
  ratePerVisit: number,
  frequency: FrequencyType,
  cleanerHourlyRate: number,
  cleanerHoursPerVisit: number,
  daysPerWeek = 1,
): ProfitBreakdown {
  const visits          = visitsPerMonth(frequency, daysPerWeek)
  const monthlyRevenue  = Math.round(ratePerVisit * visits * 100) / 100
  const monthlyLabour   = Math.round(cleanerHourlyRate * cleanerHoursPerVisit * visits * 100) / 100
  const monthlyProfit   = Math.round((monthlyRevenue - monthlyLabour) * 100) / 100
  const marginPct       = monthlyRevenue > 0 ? Math.round((monthlyProfit / monthlyRevenue) * 1000) / 10 : 0

  return {
    visitsPerMonth:  Math.round(visits * 100) / 100,
    monthlyRevenue,
    monthlyLabour,
    monthlyProfit,
    marginPct,
    annualRevenue:  calculateAnnualValue(monthlyRevenue),
    annualLabour:   calculateAnnualValue(monthlyLabour),
    annualProfit:   calculateAnnualValue(monthlyProfit),
  }
}

/**
 * Returns margin health level based on thresholds.
 * thresholds.red = below this → critical
 * thresholds.yellow = below this → watch
 */
export function getMarginHealth(
  marginPct: number | null | undefined,
  thresholds = { red: 24, yellow: 40 }
): 'critical' | 'watch' | 'healthy' | 'unknown' {
  if (marginPct == null) return 'unknown'
  if (marginPct < thresholds.red)    return 'critical'
  if (marginPct < thresholds.yellow) return 'watch'
  return 'healthy'
}
