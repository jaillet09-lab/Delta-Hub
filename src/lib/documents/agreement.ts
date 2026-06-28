import type { ScopeGroup } from '@/lib/documents/proposal'
import type { ProposalData } from '@/lib/documents/proposal'

// ─── Service Agreement — data model + defaults ───────────────────────────────
// Editable particulars + Schedule 1 scope. The 19 clauses are fixed template
// content (AGREEMENT_CLAUSES) baked into the document component.

export interface AgreementData {
  providerName: string
  providerABN: string
  clientName: string
  clientABN: string
  premises: string
  frequency: string
  commencementDate: string
  initialTerm: string
  serviceFee: string
  paymentTerms: string
  proposalRef: string
  agreementRef: string
  agreementDate: string
  specialConditions: string
  contactName: string
  contactRole: string
  contactPhone: string
  contactEmail: string
  scopeGroups: ScopeGroup[]
  additionalServices: string[]
}

const AGREEMENT_SCOPE: ScopeGroup[] = [
  { title: 'General Offices & Workspaces', items: ['Dust and wipe accessible surfaces: desks, ledges, sills', 'Vacuum carpets and mop hard floors', 'Empty and reline waste and recycling bins', 'Sanitise high-touch points: handles, switches'] },
  { title: 'Washrooms & Amenities', items: ['Clean and sanitise toilets, urinals and basins', 'Polish tapware, benches and mirrors', 'Restock consumables (client-supplied)', 'Mop and disinfect floors; reline bins'] },
  { title: 'Kitchens & Breakout', items: ['Wipe benchtops, splashbacks and sinks', 'Clean exterior of appliances', 'Sweep and mop floors; wipe tables', 'Empty bins and replace liners'] },
  { title: 'Entries, Common & External', items: ['Clean entry foyers, glass doors and reception', 'Sweep / blow down walkways and surrounds', 'Remove cobwebs from awnings and signage', 'Maintain bin store and rear service areas'] },
]

export const DEFAULT_AGREEMENT: AgreementData = {
  providerName: 'Delta Cleaning Pty Ltd',
  providerABN: '00 000 000 000',
  clientName: 'Northpoint Commercial',
  clientABN: '00 000 000 000',
  premises: '6–12 Bunya Park Drive, Eatons Hill QLD 4037',
  frequency: '5 nights per week (Mon to Fri)',
  commencementDate: '',
  initialTerm: '12 months',
  serviceFee: '$5,400 / month',
  paymentTerms: 'Invoiced each service cycle, due within 7 days',
  proposalRef: '',
  agreementRef: '',
  agreementDate: '____ / ____ / 2026',
  specialConditions: 'Nil',
  contactName: 'Jackson Jaillet',
  contactRole: 'Founder & Director',
  contactPhone: '+61 412 844 237',
  contactEmail: 'hello@deltacleaning.com.au',
  scopeGroups: AGREEMENT_SCOPE,
  additionalServices: ['Carpet steam cleaning', 'Hard-floor strip & seal', 'Pressure washing', 'Window cleaning', 'High dusting'],
}

// The 19 fixed clauses (bodies may contain <strong> for emphasis).
export const AGREEMENT_CLAUSES: { n: number; title: string; body: string }[] = [
  { n: 1, title: 'Definitions & Interpretation', body: '<strong>Agreement</strong> means these terms, the Schedule of Particulars and Schedules. <strong>Services</strong> means the cleaning services in Schedule 1 and the accepted Proposal. <strong>Premises</strong> means the site in the Particulars. <strong>Fees</strong> means the Service Fee payable by the Client. <strong>GST</strong> has the meaning in the A New Tax System (Goods and Services Tax) Act 1999 (Cth). Headings are for convenience only; the singular includes the plural; a reference to a party includes its successors and permitted assigns.' },
  { n: 2, title: 'Engagement & Term', body: 'The Client engages the Provider to perform the Services at the Premises from the Commencement Date. This Agreement continues for the Initial Term and then automatically on a rolling basis on the same terms until terminated under clause 14. The Provider performs the Services as an independent contractor; nothing in this Agreement creates a partnership, joint venture or employment relationship.' },
  { n: 3, title: 'Scope of Services & Variations', body: 'The Provider will perform the Services described in Schedule 1 and the accepted Proposal. Any change to the scope, frequency or standard of the Services must be agreed in writing and may result in an adjustment to the Fees. Additional or ad hoc tasks are quoted separately and require prior notice.' },
  { n: 4, title: 'Service Standards & Quality', body: 'The Provider will perform the Services with due care and skill, using trained and supervised personnel, to a professional commercial standard and in compliance with all applicable laws. The Provider operates quality-assurance systems and conducts periodic site audits. Where the Client reports a deficiency in the Services within a reasonable time, the Provider will rectify it at the next scheduled service at no additional cost.' },
  { n: 5, title: 'Fees, Invoicing & Payment', body: 'The Client will pay the Fees specified in the Particulars. The Provider invoices by email following each service cycle, and invoices are due within the payment period stated in the Particulars. A late-payment fee of 10% per month applies to any amount overdue. The Provider may suspend the Services where invoices remain unpaid beyond 14 days after written reminder. All amounts are exclusive of GST unless stated otherwise.' },
  { n: 6, title: 'GST', body: 'Unless expressly stated to include GST, amounts payable under this Agreement are exclusive of GST. Where a taxable supply is made, the Client must pay the GST in addition to the consideration on receipt of a valid tax invoice.' },
  { n: 7, title: 'Annual Price Review', body: "The Provider may adjust the Fees once per year in line with the Queensland Consumer Price Index, on a minimum of 30 days' written notice. The Fees may also be reviewed by agreement where there is a material change in scope, frequency, site conditions, consumable costs or applicable award wages." },
  { n: 8, title: 'Client Responsibilities', body: 'The Client will provide safe and secure access to the Premises, including keys, fobs or access codes, prior to commencement; supply power, water and lighting at no charge; notify the Provider of any site-specific hazards or requirements in advance; secure cash, valuables and confidential materials; and supply client-provided consumables unless otherwise agreed.' },
  { n: 9, title: 'Materials & Equipment', body: "The Provider supplies all cleaning equipment and products required to perform the Services. Safety Data Sheets are available on request at no cost. The Provider's products and methods comply with relevant Australian standards and the Provider's environmental management obligations." },
  { n: 10, title: 'Workplace Health & Safety', body: "Both parties will comply with the Work Health and Safety Act 2011 (Qld) and related regulations. The Client will provide a safe working environment and disclose known hazards; the Provider's personnel will observe site safety rules and the Provider's safe-work procedures. Each party will report incidents affecting the other without delay." },
  { n: 11, title: 'Insurance', body: "The Provider maintains public liability insurance of not less than $20 million, personal accident and income protection cover, and any other insurance relevant to the Services. Where the Provider engages workers, it will hold workers' compensation insurance as required by law. Certificates of currency are available to the Client on request." },
  { n: 12, title: 'Confidentiality & Privacy', body: "Each party will keep the other's confidential information secret and use it only for the purposes of this Agreement. The Provider handles personal information in accordance with the Privacy Act 1988 (Cth). All Provider personnel are bound by confidentiality obligations and handle client credentials and site information with discretion." },
  { n: 13, title: 'Subcontracting & Assignment', body: "The Provider may subcontract performance of the Services but remains responsible for the Services performed. Neither party may assign its rights under this Agreement without the other's prior written consent, which will not be unreasonably withheld." },
  { n: 14, title: 'Suspension & Termination', body: "After the Initial Term, either party may terminate this Agreement by giving 30 days' written notice. Either party may terminate immediately if the other commits a material breach not remedied within 14 days of written notice, or becomes insolvent. Early termination by the Client before the end of the Initial Term may incur a fee equivalent to one month's Service Fee. On termination, the Client will pay for Services performed to the termination date and the Provider will return all keys, fobs and access devices." },
  { n: 15, title: 'Personnel & Non-Solicitation', body: "The Provider is responsible for the recruitment, vetting, training and induction of its personnel. During the Term and for six months after, the Client will not solicit or employ any Provider personnel engaged in the Services without the Provider's written consent or payment of a reasonable recruitment fee." },
  { n: 16, title: 'Liability & Indemnity', body: "Each party indemnifies the other against loss arising from its own negligence or breach of this Agreement. To the extent permitted by law, neither party is liable for indirect or consequential loss, and the Provider's total liability is limited to the Fees paid in the 12 months before the relevant claim. The Provider is not liable for pre-existing damage, fair wear and tear, or loss arising from the Client's failure to provide access, information or a safe site. Nothing in this clause limits rights that cannot be excluded under the Australian Consumer Law." },
  { n: 17, title: 'Force Majeure', body: 'Neither party is liable for any delay or failure to perform caused by an event beyond its reasonable control. Affected obligations are suspended for the duration of the event, and either party may terminate if the event continues for more than 30 days.' },
  { n: 18, title: 'Dispute Resolution', body: 'The parties will attempt in good faith to resolve any dispute by negotiation between senior representatives, and will participate in mediation before commencing litigation, except where urgent injunctive relief is required.' },
  { n: 19, title: 'General', body: 'This Agreement is governed by the laws of Queensland and the parties submit to the courts of that State. It constitutes the entire agreement between the parties and supersedes prior discussions. Any variation must be in writing and signed by both parties. A failure to enforce a term is not a waiver of it. If any provision is unenforceable, it is severed and the remainder continues in force. Notices must be in writing and sent to the addresses in the Particulars. This Agreement may be executed in counterparts and by electronic signature.' },
]

export function withAgreementDefaults(data: Partial<AgreementData> | null | undefined): AgreementData {
  return {
    ...DEFAULT_AGREEMENT,
    ...(data ?? {}),
    scopeGroups: data?.scopeGroups?.length ? data.scopeGroups : DEFAULT_AGREEMENT.scopeGroups,
    additionalServices: data?.additionalServices?.length ? data.additionalServices : DEFAULT_AGREEMENT.additionalServices,
  }
}

// Field mapping: accepted proposal → new agreement (editable before issuing).
export function mapProposalToAgreement(p: ProposalData, agreementRef: string): AgreementData {
  return {
    ...DEFAULT_AGREEMENT,
    clientName: p.clientName,
    premises: p.siteAddress,
    frequency: p.frequency,
    commencementDate: p.startDate,
    serviceFee: p.monthlyInvestment,
    proposalRef: p.refNumber,
    agreementRef,
    contactName: p.contactName,
    contactRole: p.contactRole,
    contactPhone: p.contactPhone,
    contactEmail: p.contactEmail,
    scopeGroups: p.scopeGroups?.length ? p.scopeGroups : DEFAULT_AGREEMENT.scopeGroups,
    additionalServices: p.additionalServices?.length ? p.additionalServices : DEFAULT_AGREEMENT.additionalServices,
  }
}
