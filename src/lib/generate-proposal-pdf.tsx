import React from 'react'
import { Document, Page, Text, View, pdf } from '@react-pdf/renderer'

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface ProposalData {
  type: 'proposal_v2'
  companyName: string
  contactName: string
  contactTitle?: string
  siteAddress: string
  proposalDateDisplay: string
  refNumber: string
  openingParagraph: string
  additionalNote?: string
  scopeAreas: Record<string, boolean>
  scopeNotes?: Record<string, string>
  otherInclusions?: string
  additionalServices: Record<string, boolean>
  cleansPerWeek: number
  preferredDays: string
  pricePerVisit: number
  weeklyTotal: number
}

// ─── Colours ───────────────────────────────────────────────────────────────────
const INK = '#111111'
const INK_SOFT = '#555550'
const INK_FAINT = '#999999'
const RULE = '#E8E6E2'
const DARK = '#1A1A1A'
const WHITE = '#FFFFFF'
const BG = '#F7F6F4'
const BG_LIGHT = '#FAFAF8'

// ─── Data ──────────────────────────────────────────────────────────────────────
const SCOPE_INCLUSIONS: Record<string, { label: string; items: string[] }> = {
  general: {
    label: 'General Offices & Workspaces',
    items: [
      'Wipe all accessible surfaces — desks, shelves, ledges, windowsills',
      'Vacuum all carpeted areas',
      'Mop all hard floor surfaces',
      'Empty and reline all waste bins',
      'Clean internal glass and mirrors',
      'Sanitise high-touch points — door handles, light switches',
      'Leave all areas neat and organised',
    ],
  },
  bathrooms: {
    label: 'Bathrooms & Amenities',
    items: [
      'Clean and sanitise toilets, urinals, and basins',
      'Polish taps, clean countertops and mirrors',
      'Restock consumables — client-supplied',
      'Apply sanitary and odour-control solutions',
      'Sweep and mop all floors',
      'Remove and reline all bins',
    ],
  },
  kitchen: {
    label: 'Kitchen & Break Room',
    items: [
      'Wipe benchtops, splashbacks, and sink',
      'Clean exterior of all appliances',
      'Empty bins and replace liners',
      'Sweep and mop floor, wipe tables and chairs',
    ],
  },
  reception: {
    label: 'Reception & Lobby',
    items: [
      'Wipe reception desk and front counter',
      'Clean and polish entry glass doors',
      'Tidy and vacuum waiting area',
      'Sweep and mop lobby floor',
    ],
  },
  warehouse: {
    label: 'Warehouse / Workshop',
    items: [
      'Sweep all warehouse and workshop floors',
      'Wipe down workbenches and common surfaces',
      'Empty and reline waste bins',
      'Clean amenities and common areas',
    ],
  },
}

const ADDL_LABELS: Record<string, { label: string; price: string }> = {
  pressure: { label: 'Pressure Washing', price: 'POA' },
  carpet: { label: 'Carpet Extraction', price: 'POA' },
  vinyl: { label: 'Deep Vinyl Cleaning', price: 'POA' },
  windows: { label: 'Window Washing', price: 'POA' },
}

const REVIEWS = [
  { quote: 'Jackson has clear communication and frequently checks in on each customer to ensure they are receiving the best service. We have used Delta Cleaning for approximately 12 months and would recommend them.', name: 'Braden L.', role: 'Physiotherapy Clinic' },
  { quote: 'We have been really impressed. They have been reliable and a big improvement on the previous contractors.', name: 'Duncan K.', role: 'Office Manager' },
  { quote: 'They understand the high hygiene standards required in a medical environment and consistently deliver. Communication is clear and quality is always high.', name: 'Keziah W.', role: 'Medical Clinic Manager' },
  { quote: 'Fantastic service — our office has never been cleaner. Jackson has been an absolute pleasure to deal with. Highly recommend.', name: 'Ashleigh B.', role: 'Office Administrator' },
]

const TERMS = [
  { title: 'Payment Terms', body: 'Invoices issued by email following each service cycle, due within 7 days. A 10% late payment fee applies monthly to overdue invoices.' },
  { title: 'Annual Price Review', body: 'Pricing reviewed annually in line with the Queensland CPI. Minimum 30 days written notice prior to any adjustment.' },
  { title: 'Cancellation Policy', body: 'Either party may terminate with 30 days written notice after the initial term. Early cancellation may incur an equivalent one-month service fee.' },
  { title: 'Site Access', body: 'Client responsible for providing safe, secure access. Keys, fobs, or codes must be provided prior to commencement.' },
  { title: 'Products & Equipment', body: 'Delta Cleaning supplies all equipment and cleaning products. Safety Data Sheets available on request at no additional cost.' },
  { title: 'Confidentiality', body: 'All personnel bound by confidentiality obligations. Client credentials and site information handled with full discretion.' },
]

// ─── Helper components ─────────────────────────────────────────────────────────
const Label = ({ children }: { children: string }) => (
  <Text style={{ fontSize: 7, color: INK_FAINT, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>
    {children}
  </Text>
)

const Divider = ({ color = RULE, marginV = 0 }: { color?: string; marginV?: number }) => (
  <View style={{ borderTopWidth: 0.5, borderTopColor: color, marginTop: marginV, marginBottom: marginV }} />
)

const Bullet = ({ text }: { text: string }) => (
  <View style={{ flexDirection: 'row', marginBottom: 3 }}>
    <Text style={{ fontSize: 9, color: INK_FAINT, marginRight: 6, marginTop: 0.5 }}>–</Text>
    <Text style={{ fontSize: 9, color: INK_SOFT, lineHeight: 1.5, flex: 1 }}>{text}</Text>
  </View>
)

const PageHeader = ({ company, date }: { company: string; date: string }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: RULE }}>
    <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', letterSpacing: 1, color: INK }}>
      DELTA CLEANING
    </Text>
    <View style={{ alignItems: 'flex-end' }}>
      <Text style={{ fontSize: 8.5, color: INK_SOFT }}>Proposal for <Text style={{ color: INK, fontFamily: 'Helvetica-Bold' }}>{company}</Text></Text>
      <Text style={{ fontSize: 8, color: INK_FAINT, marginTop: 1 }}>{date}</Text>
    </View>
  </View>
)

// ─── Page 1: Cover ─────────────────────────────────────────────────────────────
const CoverPage = ({ c }: { c: ProposalData }) => (
  <Page size="A4" style={{ backgroundColor: DARK, flexDirection: 'column' }}>
    {/* Dark top section */}
    <View style={{ flex: 1, padding: '36 44 40' }}>
      {/* Logo bar */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 56 }}>
        <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: WHITE, letterSpacing: 2 }}>Δ DELTA CLEANING</Text>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 7, color: 'rgba(255,255,255,0.35)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 3 }}>Reference</Text>
          <Text style={{ fontSize: 12, color: WHITE, fontFamily: 'Helvetica-Bold' }}>{c.refNumber}</Text>
        </View>
      </View>

      {/* Heading */}
      <Text style={{ fontSize: 36, color: WHITE, fontFamily: 'Times-Roman', lineHeight: 1.15, marginBottom: 12, maxWidth: 340 }}>
        Commercial Cleaning Proposal
      </Text>
      <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 0 }}>
        Prepared exclusively for {c.companyName}  ·  {c.proposalDateDisplay}
      </Text>
    </View>

    {/* White info panel */}
    <View style={{ backgroundColor: WHITE, flexDirection: 'row' }}>
      {/* Submitted to */}
      <View style={{ flex: 1, padding: '28 32', borderRightWidth: 0.5, borderRightColor: RULE }}>
        <Label>Submitted to</Label>
        <Text style={{ fontSize: 16, fontFamily: 'Times-Roman', color: INK, marginBottom: 3 }}>{c.companyName}</Text>
        <Text style={{ fontSize: 10, color: INK_SOFT, marginBottom: 18 }}>{c.siteAddress}</Text>
        <Divider marginV={0} />
        <View style={{ marginTop: 12, marginBottom: 14 }}>
          <Text style={{ fontSize: 7, color: INK_FAINT, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>Attention</Text>
          <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: INK }}>{c.contactName || '—'}</Text>
          {c.contactTitle && <Text style={{ fontSize: 10, color: INK_SOFT, marginTop: 1 }}>{c.contactTitle}</Text>}
        </View>
        <Divider />
        <View style={{ marginTop: 10 }}>
          {[['Date', c.proposalDateDisplay], ['Ref', c.refNumber], ['Valid', '30 days from date of issue']].map(([l, v]) => (
            <View key={l} style={{ flexDirection: 'row', marginBottom: 4 }}>
              <Text style={{ fontSize: 7, color: INK_FAINT, width: 40, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 1 }}>{l}</Text>
              <Text style={{ fontSize: 10, color: INK, fontFamily: 'Helvetica-Bold' }}>{v}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Submitted by */}
      <View style={{ flex: 1, padding: '28 32' }}>
        <Label>Submitted by</Label>
        <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: INK, marginBottom: 2 }}>Jackson Jaillet</Text>
        <Text style={{ fontSize: 10, color: INK_SOFT, marginBottom: 2 }}>Founder & Director, Delta Cleaning</Text>
        <Text style={{ fontSize: 10, color: INK_SOFT, marginBottom: 2 }}>+61 412 844 238</Text>
        <Text style={{ fontSize: 10, color: INK_SOFT, marginBottom: 18 }}>hello@deltacleaning.com.au</Text>
        <Divider />
        <View style={{ marginTop: 12, marginBottom: 14 }}>
          <Label>About this proposal</Label>
          <Text style={{ fontSize: 10, color: INK_SOFT, lineHeight: 1.6 }}>
            This proposal has been prepared for {c.companyName} following a site walkthrough conducted by Jackson Jaillet. It outlines the scope of services, service schedule, and the investment required.
          </Text>
        </View>
        <Divider />
        <View style={{ marginTop: 12 }}>
          <Label>Contents</Label>
          {[['01', 'Introduction'], ['02', 'Scope of Services'], ['03', 'Pricing'], ['04', 'Terms & Next Steps']].map(([n, t]) => (
            <View key={n} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: RULE }}>
              <Text style={{ fontSize: 9, color: INK_FAINT, width: 20 }}>{n}</Text>
              <Text style={{ fontSize: 10, color: INK, fontFamily: 'Helvetica-Bold' }}>{t}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  </Page>
)

// ─── Page 2: Introduction ──────────────────────────────────────────────────────
const IntroPage = ({ c }: { c: ProposalData }) => (
  <Page size="A4" style={{ backgroundColor: WHITE, padding: '36 44', fontFamily: 'Helvetica' }}>
    <PageHeader company={c.companyName} date={c.proposalDateDisplay} />

    <Label>Introduction</Label>
    <Text style={{ fontSize: 22, fontFamily: 'Times-Roman', color: INK, marginBottom: 18, lineHeight: 1.2 }}>
      From Jackson Jaillet, Founder & Director
    </Text>

    {/* Letter */}
    <View style={{ borderWidth: 0.5, borderColor: RULE, borderRadius: 3, padding: '18 22', marginBottom: 20 }}>
      <Text style={{ fontSize: 11, color: INK, marginBottom: 10 }}>Dear {c.contactName || c.companyName},</Text>
      {c.openingParagraph.split('\n').filter(l => l.trim()).map((para, i) => (
        <Text key={i} style={{ fontSize: 10, color: INK_SOFT, lineHeight: 1.65, marginBottom: 8 }}>{para}</Text>
      ))}
      {c.additionalNote && (
        <View style={{ borderTopWidth: 0.5, borderTopColor: RULE, marginTop: 6, paddingTop: 8 }}>
          <Text style={{ fontSize: 10, color: INK_SOFT, lineHeight: 1.6 }}>{c.additionalNote}</Text>
        </View>
      )}
    </View>

    {/* Value props */}
    <View style={{ flexDirection: 'row', borderWidth: 0.5, borderColor: RULE, borderRadius: 3, overflow: 'hidden', marginBottom: 20 }}>
      {[
        { title: 'Reliable', body: 'A consistent standard on every visit. Same process, same team, every time.' },
        { title: 'Accountable', body: 'If something is not right, we address it immediately — no need to follow up twice.' },
        { title: 'Communicative', body: 'Jackson personally checks in with every client to ensure the service meets expectations.' },
      ].map((v, i) => (
        <View key={v.title} style={{ flex: 1, padding: '14 16', borderLeftWidth: i > 0 ? 0.5 : 0, borderLeftColor: RULE }}>
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: INK, marginBottom: 5 }}>{v.title}</Text>
          <Text style={{ fontSize: 9, color: INK_SOFT, lineHeight: 1.55 }}>{v.body}</Text>
        </View>
      ))}
    </View>

    {/* Reviews */}
    <Label>What our clients say</Label>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', borderWidth: 0.5, borderColor: RULE, borderRadius: 3, overflow: 'hidden', marginBottom: 16 }}>
      {REVIEWS.map((r, i) => (
        <View key={r.name} style={{
          width: '50%',
          padding: '14 16',
          borderLeftWidth: i % 2 === 1 ? 0.5 : 0,
          borderLeftColor: RULE,
          borderTopWidth: i >= 2 ? 0.5 : 0,
          borderTopColor: RULE,
        }}>
          <Text style={{ fontSize: 9, color: INK_SOFT, lineHeight: 1.55, marginBottom: 10 }}>"{r.quote}"</Text>
          <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: INK, marginBottom: 1 }}>{r.name}</Text>
          <Text style={{ fontSize: 8.5, color: INK_FAINT }}>{r.role}</Text>
        </View>
      ))}
    </View>

    {/* Owner involvement - subtle */}
    <View style={{ paddingTop: 12, borderTopWidth: 0.5, borderTopColor: RULE }}>
      <Text style={{ fontSize: 9, color: INK_FAINT, lineHeight: 1.6, textAlign: 'center' }}>
        Every Delta Cleaning client is managed directly by Jackson Jaillet — the owner. Jackson personally handles onboarding, conducts quality checks, and remains your single point of contact throughout the engagement.
      </Text>
    </View>
  </Page>
)

// ─── Page 3: Scope & Pricing ───────────────────────────────────────────────────
const ScopePage = ({ c }: { c: ProposalData }) => {
  const selectedAreas = Object.entries(c.scopeAreas).filter(([, on]) => on).map(([k]) => k)
  const selectedAddl = Object.entries(c.additionalServices).filter(([, on]) => on).map(([k]) => k)
  const freqLabel = `${c.cleansPerWeek}× per week`
  const half = Math.ceil(selectedAreas.length / 2)
  const leftAreas = selectedAreas.slice(0, half)
  const rightAreas = selectedAreas.slice(half)

  return (
    <Page size="A4" style={{ backgroundColor: WHITE, padding: '36 44', fontFamily: 'Helvetica' }}>
      <PageHeader company={c.companyName} date={c.proposalDateDisplay} />

      <Label>Scope of services</Label>
      <Text style={{ fontSize: 22, fontFamily: 'Times-Roman', color: INK, marginBottom: 10, lineHeight: 1.2 }}>
        Service inclusions
      </Text>
      <Text style={{ fontSize: 10, color: INK_SOFT, lineHeight: 1.6, marginBottom: 20 }}>
        The following inclusions apply to every scheduled visit at {c.siteAddress || c.companyName}, performed {freqLabel}. This scope was confirmed during a site walkthrough of your facility.
      </Text>

      {/* Scope two-column */}
      {selectedAreas.length > 0 && (
        <View style={{ flexDirection: 'row', marginBottom: 18 }}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            {leftAreas.map(key => {
              const area = SCOPE_INCLUSIONS[key]
              if (!area) return null
              const note = c.scopeNotes?.[key]
              return (
                <View key={key} style={{ marginBottom: 18 }}>
                  <Text style={{ fontSize: 7, color: INK_FAINT, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>{area.label}</Text>
                  <View style={{ borderTopWidth: 0.5, borderTopColor: RULE, paddingTop: 8 }}>
                    {area.items.map((item, i) => <Bullet key={i} text={item} />)}
                    {note && <Text style={{ fontSize: 9, color: INK_FAINT, marginTop: 5 }}>Note: {note}</Text>}
                  </View>
                </View>
              )
            })}
          </View>
          <View style={{ flex: 1, paddingLeft: 16, borderLeftWidth: 0.5, borderLeftColor: RULE }}>
            {rightAreas.map(key => {
              const area = SCOPE_INCLUSIONS[key]
              if (!area) return null
              const note = c.scopeNotes?.[key]
              return (
                <View key={key} style={{ marginBottom: 18 }}>
                  <Text style={{ fontSize: 7, color: INK_FAINT, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>{area.label}</Text>
                  <View style={{ borderTopWidth: 0.5, borderTopColor: RULE, paddingTop: 8 }}>
                    {area.items.map((item, i) => <Bullet key={i} text={item} />)}
                    {note && <Text style={{ fontSize: 9, color: INK_FAINT, marginTop: 5 }}>Note: {note}</Text>}
                  </View>
                </View>
              )
            })}
            {/* Available on request */}
            <View style={{ marginBottom: 18 }}>
              <Text style={{ fontSize: 7, color: INK_FAINT, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>Available on request</Text>
              <View style={{ borderTopWidth: 0.5, borderTopColor: RULE, paddingTop: 8 }}>
                <Bullet text="Periodic deep clean — by arrangement" />
                <Bullet text="Post-event or post-renovation clean" />
                <Bullet text="Ad hoc tasks — quoted separately" />
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Additional services */}
      {selectedAddl.length > 0 && (
        <View style={{ marginBottom: 14 }}>
          <Label>Additional services</Label>
          <View style={{ borderWidth: 0.5, borderColor: RULE, borderRadius: 3 }}>
            <View style={{ flexDirection: 'row', backgroundColor: BG, padding: '6 12' }}>
              <Text style={{ flex: 2, fontSize: 7, color: INK_FAINT, letterSpacing: 1, textTransform: 'uppercase' }}>Service</Text>
              <Text style={{ flex: 1, fontSize: 7, color: INK_FAINT, letterSpacing: 1, textTransform: 'uppercase' }}>Frequency</Text>
              <Text style={{ flex: 1, fontSize: 7, color: INK_FAINT, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'right' }}>Pricing (excl. GST)</Text>
            </View>
            {selectedAddl.map(key => {
              const svc = ADDL_LABELS[key]
              return (
                <View key={key} style={{ flexDirection: 'row', padding: '8 12', borderTopWidth: 0.5, borderTopColor: RULE }}>
                  <Text style={{ flex: 2, fontSize: 10, color: INK }}>{svc?.label}</Text>
                  <Text style={{ flex: 1, fontSize: 10, color: INK_SOFT }}>On request</Text>
                  <Text style={{ flex: 1, fontSize: 10, fontFamily: 'Helvetica-Bold', color: INK, textAlign: 'right' }}>{svc?.price}</Text>
                </View>
              )
            })}
          </View>
        </View>
      )}

      {/* Pricing table */}
      <Label>Pricing</Label>
      <View style={{ borderWidth: 0.5, borderColor: RULE, borderRadius: 3, marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', backgroundColor: BG, padding: '6 12' }}>
          {['Service', 'Frequency', 'Days', 'Rate (excl. GST)'].map((h, i) => (
            <Text key={h} style={{ flex: i === 0 ? 2 : 1, fontSize: 7, color: INK_FAINT, letterSpacing: 1, textTransform: 'uppercase', textAlign: i === 3 ? 'right' : 'left' }}>{h}</Text>
          ))}
        </View>
        <View style={{ flexDirection: 'row', padding: '10 12', borderTopWidth: 0.5, borderTopColor: RULE }}>
          <View style={{ flex: 2 }}>
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: INK, marginBottom: 2 }}>Standard Commercial Clean</Text>
            <Text style={{ fontSize: 9, color: INK_FAINT }}>Full inclusions as listed above</Text>
          </View>
          <Text style={{ flex: 1, fontSize: 10, color: INK_SOFT }}>{freqLabel}</Text>
          <Text style={{ flex: 1, fontSize: 10, color: INK_SOFT }}>{c.preferredDays || 'TBC'}</Text>
          <Text style={{ flex: 1, fontSize: 10, fontFamily: 'Helvetica-Bold', color: INK, textAlign: 'right' }}>
            {c.pricePerVisit > 0 ? `$${c.pricePerVisit.toFixed(2)} / visit` : 'TBC'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', padding: '10 12', borderTopWidth: 0.5, borderTopColor: RULE, backgroundColor: BG_LIGHT }}>
          <Text style={{ flex: 2, fontSize: 11, fontFamily: 'Helvetica-Bold', color: INK }}>Weekly Investment (excl. GST)</Text>
          <Text style={{ flex: 1 }} />
          <Text style={{ flex: 1 }} />
          <Text style={{ flex: 1, fontSize: 11, fontFamily: 'Helvetica-Bold', color: INK, textAlign: 'right' }}>
            {c.pricePerVisit > 0 ? `$${c.pricePerVisit.toFixed(2)} per visit` : 'TBC'}
          </Text>
        </View>
      </View>

      <View style={{ borderWidth: 0.5, borderColor: RULE, borderRadius: 3, padding: '10 14', backgroundColor: BG_LIGHT }}>
        <Text style={{ fontSize: 7, color: INK_FAINT, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>Please note</Text>
        <Text style={{ fontSize: 9, color: INK_SOFT, lineHeight: 1.6 }}>
          All cleaning products and equipment are supplied by Delta Cleaning. Safety Data Sheets are available on request. Any site-specific requirements must be communicated prior to commencement.
        </Text>
      </View>
    </Page>
  )
}

// ─── Page 4: Terms ─────────────────────────────────────────────────────────────
const TermsPage = ({ c }: { c: ProposalData }) => (
  <Page size="A4" style={{ backgroundColor: WHITE, padding: '36 44', fontFamily: 'Helvetica' }}>
    <PageHeader company={c.companyName} date={c.proposalDateDisplay} />

    <Label>Terms & acceptance</Label>
    <Text style={{ fontSize: 22, fontFamily: 'Times-Roman', color: INK, marginBottom: 18, lineHeight: 1.2 }}>
      Terms of engagement
    </Text>

    {/* Terms grid */}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', borderWidth: 0.5, borderColor: RULE, borderRadius: 3, overflow: 'hidden', marginBottom: 24 }}>
      {TERMS.map((t, i) => (
        <View key={t.title} style={{
          width: '50%',
          padding: '14 16',
          borderLeftWidth: i % 2 === 1 ? 0.5 : 0,
          borderLeftColor: RULE,
          borderTopWidth: i >= 2 ? 0.5 : 0,
          borderTopColor: RULE,
        }}>
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: INK, marginBottom: 5 }}>{t.title}</Text>
          <Text style={{ fontSize: 9, color: INK_SOFT, lineHeight: 1.55 }}>{t.body}</Text>
        </View>
      ))}
    </View>

    {/* How we get started */}
    <Label>How we get started</Label>
    <View style={{ flexDirection: 'row', borderWidth: 0.5, borderColor: RULE, borderRadius: 3, overflow: 'hidden', marginBottom: 20 }}>
      {[
        { step: 'Step 01', tag: 'Accept', body: 'Confirm acceptance via email. A formal Service Agreement will then be issued for your review.' },
        { step: 'Step 02', tag: 'Agreement', body: 'Review and sign the Service Agreement to formalise the engagement and confirm all terms.' },
        { step: 'Step 03', tag: 'Commence', body: 'Services begin on the agreed start date. Jackson will follow up after the first visit to confirm all is in order.' },
      ].map((s, i) => (
        <View key={s.step} style={{ flex: 1, padding: '14 16', borderLeftWidth: i > 0 ? 0.5 : 0, borderLeftColor: RULE }}>
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: INK, marginBottom: 2 }}>{s.step}</Text>
          <Text style={{ fontSize: 7, color: INK_FAINT, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 }}>{s.tag}</Text>
          <Text style={{ fontSize: 9, color: INK_SOFT, lineHeight: 1.55 }}>{s.body}</Text>
        </View>
      ))}
    </View>

    {/* Validity */}
    <View style={{ borderTopWidth: 0.5, borderTopColor: RULE, paddingTop: 14, marginBottom: 28 }}>
      <Text style={{ fontSize: 7, color: INK_FAINT, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>Proposal validity</Text>
      <Text style={{ fontSize: 10, color: INK_SOFT, lineHeight: 1.6 }}>
        This proposal is valid for 30 days from the date of issue. Pricing and availability are subject to change after this period. A formal Service Agreement will be issued upon acceptance.
      </Text>
    </View>

    {/* Signature block */}
    <View style={{ borderWidth: 0.5, borderColor: RULE, borderRadius: 3, backgroundColor: BG }}>
      <View style={{ padding: '14 18', borderBottomWidth: 0.5, borderBottomColor: RULE }}>
        <Text style={{ fontSize: 9, color: INK_SOFT }}>
          To accept this proposal, please reply via email confirming your acceptance or contact Jackson Jaillet directly on <Text style={{ color: INK, fontFamily: 'Helvetica-Bold' }}>+61 412 844 238</Text> or <Text style={{ color: INK, fontFamily: 'Helvetica-Bold' }}>hello@deltacleaning.com.au</Text>.
        </Text>
      </View>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1, padding: '18 18 28' }}>
          <Text style={{ fontSize: 8, color: INK_FAINT, marginBottom: 20 }}>Client signature</Text>
          <View style={{ borderBottomWidth: 0.5, borderBottomColor: INK_FAINT, marginBottom: 6 }} />
          <Text style={{ fontSize: 9, color: INK_SOFT }}>{c.contactName || c.companyName}</Text>
        </View>
        <View style={{ flex: 1, padding: '18 18 28', borderLeftWidth: 0.5, borderLeftColor: RULE }}>
          <Text style={{ fontSize: 8, color: INK_FAINT, marginBottom: 20 }}>Date</Text>
          <View style={{ borderBottomWidth: 0.5, borderBottomColor: INK_FAINT, marginBottom: 6 }} />
          <Text style={{ fontSize: 9, color: INK_SOFT }}> </Text>
        </View>
      </View>
    </View>

    {/* Footer */}
    <View style={{ marginTop: 20, paddingTop: 14, borderTopWidth: 0.5, borderTopColor: RULE }}>
      <Text style={{ fontSize: 8, color: INK_FAINT, textAlign: 'center' }}>
        Delta Cleaning · Brisbane, QLD · hello@deltacleaning.com.au · +61 412 844 238 · deltacleaning.com.au
      </Text>
    </View>
  </Page>
)

// ─── Main PDF Document ─────────────────────────────────────────────────────────
const ProposalPDF = ({ c }: { c: ProposalData }) => (
  <Document title={`Commercial Cleaning Proposal — ${c.companyName}`} author="Delta Cleaning" creator="Delta Operations Hub">
    <CoverPage c={c} />
    <IntroPage c={c} />
    <ScopePage c={c} />
    <TermsPage c={c} />
  </Document>
)

// ─── Export ────────────────────────────────────────────────────────────────────
export async function generateProposalPDF(data: ProposalData): Promise<Buffer> {
  const instance = pdf(<ProposalPDF c={data} />)
  const stream = await instance.toBuffer() // returns ReadableStream in v4
  const chunks: Buffer[] = []
  for await (const chunk of stream as any) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}
