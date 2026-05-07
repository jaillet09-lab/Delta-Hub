/**
 * Calendar-accurate visit calculation.
 * All revenue figures are ex-GST.
 * No approximations — real calendar dates only.
 */

const DAY_NAME_INDEX: Record<string, number> = {
  // Full names
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
  // 3-letter abbreviations (stored by SiteBuilder / ClientForm)
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
}

export interface VisitResult {
  count: number
  dates: string[]        // ISO date strings e.g. "2025-03-03"
  income_ex_gst: number  // rate_per_visit * count
  rate_per_visit: number
}

/**
 * Count actual service visits for a client in a given calendar month.
 *
 * @param year         Full year e.g. 2025
 * @param month        1-indexed month (1=January … 12=December)
 * @param frequency    Client's service frequency from the DB
 * @param serviceDays  Array of lowercase day names e.g. ['monday','thursday']
 * @param startDate    Client's service start date
 * @param ratePerVisit Price per visit ex GST
 */
export function calculateMonthlyVisits(
  year: number,
  month: number,
  frequency: string,
  serviceDays: string[],
  startDate: Date,
  ratePerVisit: number,
): VisitResult {
  const visitDates: Date[] = []

  const monthStart = new Date(year, month - 1, 1)
  const monthEnd   = new Date(year, month, 0)         // last day of month

  // Don't count dates before the client's start date
  const effectiveStart = startDate > monthStart ? new Date(startDate) : new Date(monthStart)

  // Normalise service days to indices; fall back to start-date's weekday
  const resolvedDayNames =
    serviceDays && serviceDays.length > 0
      ? serviceDays.map(d => d.toLowerCase())
      : [Object.keys(DAY_NAME_INDEX)[startDate.getDay()]]

  const dayIndices = resolvedDayNames
    .map(d => DAY_NAME_INDEX[d])
    .filter(i => i !== undefined)

  switch (frequency) {
    case 'daily': {
      for (const d = new Date(effectiveStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
        visitDates.push(new Date(d))
      }
      break
    }

    case 'weekly': {
      for (const idx of dayIndices) {
        for (const d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
          if (d.getDay() === idx && d >= effectiveStart) {
            visitDates.push(new Date(d))
          }
        }
      }
      break
    }

    case 'fortnightly': {
      for (const idx of dayIndices) {
        // Find the very first occurrence of this weekday on-or-after startDate
        const anchor = new Date(startDate)
        while (anchor.getDay() !== idx) anchor.setDate(anchor.getDate() + 1)

        // Walk forward in 14-day steps; collect those that land in this month
        for (const d = new Date(anchor); d <= monthEnd; d.setDate(d.getDate() + 14)) {
          if (d >= monthStart && d >= effectiveStart) {
            visitDates.push(new Date(d))
          }
        }
      }
      break
    }

    case 'monthly': {
      // One visit per month on the client's service day (or start-date day if none set)
      if (startDate <= monthEnd) {
        const targetIdx = dayIndices[0] ?? startDate.getDay()

        // Find first occurrence of that weekday in the month on-or-after effectiveStart
        let found = false
        for (const d = new Date(effectiveStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
          if (d.getDay() === targetIdx) {
            visitDates.push(new Date(d))
            found = true
            break
          }
        }

        // If no match (start date is late in the month), use the start-date day-of-month
        if (!found && startDate.getFullYear() <= year) {
          const fallback = new Date(year, month - 1, Math.min(startDate.getDate(), getDaysInMonth(year, month)))
          if (fallback >= effectiveStart && fallback <= monthEnd) {
            visitDates.push(fallback)
          }
        }
      }
      break
    }

    case 'quarterly': {
      // Every 3 months from start date's month
      const diffMonths =
        (year - startDate.getFullYear()) * 12 + (month - 1 - startDate.getMonth())
      if (diffMonths >= 0 && diffMonths % 3 === 0 && startDate <= monthEnd) {
        const day = Math.min(startDate.getDate(), getDaysInMonth(year, month))
        const d = new Date(year, month - 1, day)
        if (d >= effectiveStart) visitDates.push(d)
      }
      break
    }

    case 'annual': {
      if (
        startDate.getMonth() === month - 1 &&
        startDate.getFullYear() <= year &&
        startDate <= monthEnd
      ) {
        const day = Math.min(startDate.getDate(), getDaysInMonth(year, month))
        const d = new Date(year, month - 1, day)
        if (d >= effectiveStart) visitDates.push(d)
      }
      break
    }

    case 'one_off': {
      // Only counts if startDate is inside this month
      if (
        startDate.getFullYear() === year &&
        startDate.getMonth() === month - 1
      ) {
        visitDates.push(new Date(startDate))
      }
      break
    }
  }

  // Deduplicate (fortnightly with multiple days can produce same date twice in edge cases)
  const unique = Array.from(new Map(visitDates.map(d => [d.toISOString().split('T')[0], d])).values())
  unique.sort((a, b) => a.getTime() - b.getTime())

  const count = unique.length
  const income_ex_gst = Math.round(count * ratePerVisit * 100) / 100

  return {
    count,
    dates: unique.map(d => d.toISOString().split('T')[0]),
    income_ex_gst,
    rate_per_visit: ratePerVisit,
  }
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/** Parse "YYYY-MM" or Date into year+month components */
export function parseYearMonth(input: string | Date): { year: number; month: number } {
  if (input instanceof Date) {
    return { year: input.getFullYear(), month: input.getMonth() + 1 }
  }
  const [y, m] = input.split('-').map(Number)
  return { year: y, month: m }
}

/** Return "YYYY-MM-01" for a given year and 1-indexed month */
export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`
}

/** Human-readable month label e.g. "March 2025" */
export function monthLabel(isoDate: string): string {
  const [y, m] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
}

/**
 * Given a GST-inclusive amount, extract the ex-GST and GST components.
 * Australia: GST = 10% → ex-GST = total / 1.1
 */
export function splitGST(totalInclGST: number): { exGST: number; gst: number } {
  const exGST = Math.round((totalInclGST / 1.1) * 100) / 100
  const gst   = Math.round((totalInclGST - exGST) * 100) / 100
  return { exGST, gst }
}

/**
 * Given an ex-GST amount, compute the GST component and total.
 */
export function addGST(exGST: number): { exGST: number; gst: number; inclGST: number } {
  const gst     = Math.round(exGST * 0.1 * 100) / 100
  const inclGST = Math.round((exGST + gst) * 100) / 100
  return { exGST, gst, inclGST }
}
