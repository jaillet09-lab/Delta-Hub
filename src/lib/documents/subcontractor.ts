// Delta Cleaning — Subcontractor Services Agreement + Contractor Induction.
// Templates baked in as Delta's onboarding pack. The Agreement is a binding
// contract and should be reviewed by an accountant/lawyer once (contractor-vs-
// employee is a real ATO / Fair Work line in Australia) — see the note on the doc.

export const SUBCONTRACTOR_AGREEMENT = {
  code: 'DCA-SUB',
  slug: 'subcontractor-agreement',
  title: 'Subcontractor Services Agreement',
  intro:
    'This Agreement sets out the terms on which the Subcontractor provides cleaning services to Delta Cleaning Pty Ltd as an independent contractor. By signing, the Subcontractor agrees to be bound by these terms.',
  clauses: [
    { n: 1, title: 'Engagement & Independent Contractor Status', body: 'Delta Cleaning engages the Subcontractor to perform cleaning services at sites allocated from time to time. The Subcontractor is an independent contractor, not an employee, partner or agent of Delta Cleaning. The Subcontractor is responsible for their own tax, superannuation, insurances and business costs, and is free to accept or decline allocated work.' },
    { n: 2, title: 'Services & Standards', body: 'The Subcontractor will perform the services to a professional commercial standard, in accordance with the site scope, Delta Cleaning’s procedures and any reasonable direction as to the result required. The Subcontractor provides their own skill, method and supervision. Deficiencies notified within a reasonable time will be rectified at the Subcontractor’s cost.' },
    { n: 3, title: 'Fees, Invoicing & Payment', body: 'Delta Cleaning will pay the agreed fee for completed services. The Subcontractor invoices Delta Cleaning (with a valid ABN and, where registered, GST) per the agreed cycle. Payment is made within the agreed payment period to the Subcontractor’s nominated account. The Subcontractor is not entitled to leave, allowances or employment entitlements.' },
    { n: 4, title: 'Insurance', body: 'The Subcontractor must hold and maintain current Public Liability insurance of not less than $10 million, and Workers’ Compensation insurance where they engage workers, for the term of this Agreement. Certificates of Currency must be provided to Delta Cleaning on request and kept current. Work must not be performed while cover has lapsed.' },
    { n: 5, title: 'Work Health & Safety', body: 'The Subcontractor will comply with the Work Health and Safety Act 2011 (Qld) and related regulations, Delta Cleaning’s Safe Work Method Statements (SWMS) and Safety Data Sheets (SDS), and all site safety rules. The Subcontractor is responsible for the safety of their own personnel and for reporting incidents and hazards promptly.' },
    { n: 6, title: 'Confidentiality & Non-Solicitation', body: 'The Subcontractor will keep confidential all client, site and business information and access credentials, and use them only to perform the services. During the term and for six months after, the Subcontractor will not directly solicit or service Delta Cleaning’s clients introduced through this engagement without Delta Cleaning’s written consent.' },
    { n: 7, title: 'Equipment, Materials & Chemicals', body: 'Unless otherwise agreed, the Subcontractor supplies their own equipment and materials, maintained in safe working order (electrical items tested and tagged). Chemicals must be used strictly per the SDS and correct dilution. The Subcontractor must not mix products or use unapproved chemicals on site.' },
    { n: 8, title: 'Conduct, Uniform & Presentation', body: 'The Subcontractor and their personnel will present neatly and professionally, wear the required uniform/ID where applicable, conduct themselves courteously on site, and respect client property and privacy. Behaviour that damages Delta Cleaning’s reputation or a client relationship is a breach of this Agreement.' },
    { n: 9, title: 'Incident & Hazard Reporting', body: 'The Subcontractor will report any incident, injury, near-miss, damage or hazard to Delta Cleaning management without delay, and cooperate with any investigation. Serious incidents must be reported immediately by phone.' },
    { n: 10, title: 'Subcontractor’s Personnel', body: 'The Subcontractor is responsible for the recruitment, vetting, right-to-work checks, training, induction, supervision and payment of their own personnel, and ensures each has read and understood the relevant induction and SWMS before commencing work.' },
    { n: 11, title: 'Compliance with Laws & Modern Slavery', body: 'The Subcontractor will comply with all applicable workplace, employment, tax and human-rights laws, and with Delta Cleaning’s Modern Slavery position: no forced labour, child labour, human trafficking or exploitation in its operations or supply chain. Any suspected breach must be reported immediately.' },
    { n: 12, title: 'Liability & Indemnity', body: 'The Subcontractor indemnifies Delta Cleaning against loss or claims arising from the Subcontractor’s negligence, breach of this Agreement, or the acts of its personnel. Each party is responsible for its own insurable risks. Nothing limits rights that cannot be excluded under the Australian Consumer Law.' },
    { n: 13, title: 'Term, Suspension & Termination', body: 'This Agreement applies from the date signed and continues until terminated. Either party may terminate on reasonable written notice. Delta Cleaning may suspend or terminate immediately for a material breach, a lapse of insurance, a serious safety breach, or conduct that harms a client relationship. On termination the Subcontractor returns all keys, fobs, access devices and confidential material.' },
    { n: 14, title: 'GST, ABN & General', body: 'The Subcontractor warrants its ABN and, where applicable, GST registration. This Agreement is governed by the laws of Queensland. It is the entire agreement between the parties; any variation must be in writing. A failure to enforce a term is not a waiver. If a provision is unenforceable it is severed and the remainder continues. This Agreement may be signed electronically.' },
  ],
}

export const CONTRACTOR_INDUCTION = {
  code: 'IND-001',
  slug: 'contractor-induction',
  title: 'Contractor Induction',
  intro:
    'Welcome to Delta Cleaning. This induction sets out how we work and what we expect on every site. Please read it in full before commencing. It applies to you and to any of your personnel.',
  sections: [
    { heading: 'Business rules', bullets: ['Perform every clean to the agreed site scope and a professional commercial standard', 'Follow reasonable directions about the result required', 'Respect client property, privacy and premises at all times'] },
    { heading: 'Uniform & presentation', bullets: ['Wear clean, neat, appropriate clothing and closed footwear', 'Wear the required uniform / ID where applicable', 'Maintain a tidy, professional appearance on every site'] },
    { heading: 'Conduct expectations', bullets: ['Be courteous and professional with clients and the public', 'No smoking, alcohol or drugs on site', 'Do not use client facilities, phones or equipment without permission'] },
    { heading: 'Site security & access', bullets: ['Follow each site’s access, key/fob and alarm procedure exactly', 'Never share access codes or keys', 'Lock up and re-set alarms when leaving; leave the site secure'] },
    { heading: 'Client confidentiality', bullets: ['Keep all client and site information confidential', 'Do not photograph or share client premises except for approved job photos', 'Secure and do not disturb client documents, cash or valuables'] },
    { heading: 'Safety & SWMS', bullets: ['Read and follow the relevant Safe Work Method Statement for your work', 'Assess each site for hazards before starting', 'Use "Wet Floor" signage; keep walkways and cords clear'] },
    { heading: 'Chemical handling & SDS', bullets: ['Read the Safety Data Sheet before first use of any product', 'Use correct dilution ratios; never mix products', 'Keep chemicals labelled, lidded and stored safely'] },
    { heading: 'PPE requirements', bullets: ['Wear the PPE specified in the SWMS/SDS (gloves, safety glasses, etc.)', 'Inspect PPE before use; replace damaged items', 'Use hearing protection with high-noise equipment'] },
    { heading: 'Incident & hazard reporting', bullets: ['Report any incident, injury, near-miss, damage or hazard to Delta management without delay', 'Report serious incidents immediately by phone', 'Cooperate with any investigation'] },
    { heading: 'Emergency procedures', bullets: ['Emergency: 000 · Poisons Information Centre: 13 11 26', 'Delta Cleaning Management: 0412 844 238', 'Know the site’s exits and evacuation points'] },
    { heading: 'Invoicing process', bullets: ['Invoice Delta Cleaning per the agreed cycle with a valid ABN', 'Include GST only if registered', 'Payment is made to your nominated account within the agreed terms'] },
    { heading: 'Communication standards', bullets: ['Respond to Delta Cleaning communications promptly', 'Advise as early as possible if you cannot attend a clean', 'Raise any issues on site with Delta management, not the client'] },
    { heading: 'Attendance & reliability', bullets: ['Attend allocated cleans on the scheduled day/time', 'Arrange a suitable replacement from your team if you are unavailable', 'Consistent no-shows are a breach of your agreement'] },
  ],
  acknowledgment: 'I confirm I have read and understood this induction.',
}
