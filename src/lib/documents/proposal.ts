// ─── Premium Proposal — data model + defaults ────────────────────────────────
// Faithful to the design handoff. Every field here is editable in the document
// editor: client details, dates, frequency, pricing rows, scope groups, and the
// "available on request" additional services.

export interface ScopeGroup {
  title: string
  items: string[]
}

export interface PricingRow {
  service: string
  detail: string
  frequency: string
  days: string
  rate: string
}

export interface ProposalData {
  // Client / cover
  clientName: string
  siteAddress: string
  attention: string
  refNumber: string
  issueDate: string
  startDate: string
  frequency: string
  monthlyInvestment: string
  validity: string
  // Delta contact
  contactName: string
  contactRole: string
  contactPhone: string
  contactEmail: string
  // Editable content blocks
  scopeGroups: ScopeGroup[]
  pricingRows: PricingRow[]
  additionalServices: string[]
}

export const DEFAULT_PROPOSAL: ProposalData = {
  clientName: 'Northpoint Commercial',
  siteAddress: '6–12 Bunya Park Drive, Eatons Hill QLD 4037',
  attention: 'Matisse Brown, Facilities Manager',
  refNumber: 'DC-650360',
  issueDate: '',
  startDate: '',
  frequency: '5 nights per week (Mon to Fri)',
  monthlyInvestment: '$5,400 / month',
  validity: '30 days from the date of issue',
  contactName: 'Jackson Jaillet',
  contactRole: 'Founder & Director',
  contactPhone: '+61 412 844 237',
  contactEmail: 'hello@deltacleaning.com.au',
  scopeGroups: [
    {
      title: 'General Offices & Workspaces',
      items: [
        'Dust and wipe accessible surfaces: desks, ledges, sills, partitions',
        'Vacuum all carpeted areas and traffic lanes',
        'Mop and spot clean all hard floor surfaces',
        'Empty and reline all waste and recycling bins',
        'Sanitise high touch points: handles, switches, rails',
      ],
    },
    {
      title: 'Washrooms & Amenities',
      items: [
        'Clean and sanitise toilets, urinals, basins and fittings',
        'Polish tapware, benches, mirrors and chrome',
        'Restock consumables you supply: paper, towel, soap',
        'Apply sanitary and odour control treatments',
        'Sweep, mop and disinfect all floors, reline bins',
      ],
    },
    {
      title: 'Kitchens & Breakout',
      items: [
        'Wipe benchtops, splashbacks, sinks and tapware',
        'Clean the exterior of appliances: fridge, microwave, dishwasher',
        'Sweep and mop floors, wipe tables and seating',
        'Empty bins and replace liners, restock supplies',
      ],
    },
    {
      title: 'Entries, Common & External',
      items: [
        'Clean entry foyers, glass doors and reception surfaces',
        'Sweep or blow down walkways, entries and surrounds',
        'Remove cobwebs from awnings, eaves and signage',
        'Maintain bin store and rear service areas',
      ],
    },
  ],
  pricingRows: [
    { service: 'Standard Commercial Clean', detail: 'Full inclusions as listed', frequency: '5 nights per week (Mon to Fri)', days: 'As scheduled', rate: 'POA' },
    { service: 'Periodic Detail Services', detail: 'Carpets, floors, high dusting', frequency: 'By arrangement', days: 'Scheduled', rate: 'POA' },
    { service: 'Ad Hoc / One Off Tasks', detail: 'Pre-arranged, prior notice required', frequency: 'On request', days: 'TBC', rate: 'POA' },
  ],
  additionalServices: [
    'Carpet steam cleaning',
    'Hard floor strip & seal',
    'Pressure washing',
    'Window cleaning, all levels',
    'High dusting',
    'Post event & fit out cleans',
  ],
}

/** Merge a stored data object with defaults so older records always render. */
export function withProposalDefaults(data: Partial<ProposalData> | null | undefined): ProposalData {
  return {
    ...DEFAULT_PROPOSAL,
    ...(data ?? {}),
    scopeGroups: data?.scopeGroups?.length ? data.scopeGroups : DEFAULT_PROPOSAL.scopeGroups,
    pricingRows: data?.pricingRows?.length ? data.pricingRows : DEFAULT_PROPOSAL.pricingRows,
    additionalServices: data?.additionalServices?.length ? data.additionalServices : DEFAULT_PROPOSAL.additionalServices,
  }
}
