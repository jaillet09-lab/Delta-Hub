'use client'

import Image from 'next/image'
import type { Document, DocumentContent } from '@/types/app'

// ─── Types ────────────────────────────────────────────────────────────────────
interface ProposalV2 {
  type: 'proposal_v2'
  companyName: string
  contactName: string
  contactTitle?: string
  contactEmail?: string
  siteAddress: string
  proposalDate: string
  proposalDateDisplay: string
  refNumber: string
  openingParagraph: string
  additionalNote?: string
  scopeAreas: Record<string, boolean>
  scopeNotes: Record<string, string>
  otherInclusions?: string
  additionalServices: Record<string, boolean>
  cleansPerWeek: number
  preferredDays: string
  pricePerVisit: number
  weeklyTotal: number
  startDate?: string
}

interface DocumentPreviewProps {
  document: Document
  content: DocumentContent | Record<string, unknown> | null
}

// ─── Scope inclusions ────────────────────────────────────────────────────────
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

const ADDL_SERVICE_LABELS: Record<string, { label: string; price: string }> = {
  pressure: { label: 'Pressure Washing', price: 'POA' },
  carpet: { label: 'Carpet Extraction', price: 'POA' },
  vinyl: { label: 'Deep Vinyl Cleaning', price: 'POA' },
  windows: { label: 'Window Washing', price: 'POA' },
}

const REVIEWS = [
  { quote: 'Jackson has clear communication and frequently checks in on each customer to ensure they are receiving the best service. We have used Delta Cleaning for approximately 12 months now and would recommend them to other commercial sites.', name: 'Braden L.', role: 'Physiotherapy Clinic' },
  { quote: 'We have engaged Delta Cleaning for the past 8 months at our Banyo office and have been really impressed. They have been reliable and a big improvement on the previous contractors.', name: 'Duncan K.', role: 'Office Manager' },
  { quote: 'Jackson and the team have been cleaning our clinic since early 2025. They understand the high hygiene standards required in a medical environment and consistently deliver. Communication is clear and quality is always high.', name: 'Keziah W.', role: 'Medical Clinic Manager' },
  { quote: 'Fantastic service — our office has never been cleaner. Jackson has been an absolute pleasure to deal with and any extra requests are taken care of with our next clean. Highly recommend.', name: 'Ashleigh B.', role: 'Office Administrator' },
]

const TERMS = [
  { title: 'Payment Terms', body: 'Invoices issued by email following each service cycle, due within 7 days. A 5% late fee applies to overdue invoices.' },
  { title: 'Annual Price Review', body: 'Pricing reviewed annually in line with the Queensland CPI. Minimum 30 days\' written notice prior to any adjustment.' },
  { title: 'Cancellation Policy', body: 'Either party may terminate with 30 days\' written notice after the initial term. Early cancellation may incur an equivalent one-month service fee.' },
  { title: 'Site Access', body: 'Client responsible for providing safe, secure access. Keys, fobs, or codes must be provided prior to commencement.' },
  { title: 'Products & Equipment', body: 'Delta Cleaning supplies all equipment and cleaning products. Safety Data Sheets available on request at no additional cost.' },
  { title: 'Confidentiality', body: 'All personnel bound by confidentiality obligations. Client credentials and site information handled with full discretion.' },
]

// ─── Design tokens ────────────────────────────────────────────────────────────
const INK = '#111111'
const INK_SOFT = '#555550'
const INK_FAINT = '#AAAAAA'
const RULE = '#E8E6E2'
const RULE_LIGHT = '#F2F1EE'

// ─── Helper components ────────────────────────────────────────────────────────
function PageHeader({ company, dateDisplay }: { company: string; dateDisplay: string }) {
  return (
    <div style={{ marginBottom: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 14, borderBottom: `1px solid ${RULE}`, marginBottom: 36 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Image src="/logo-icon-black.png" alt="" width={16} height={16} style={{ objectFit: 'contain' }} />
          <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: INK }}>Delta Cleaning</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 10, color: INK_SOFT }}>Proposal for <strong style={{ color: INK }}>{company}</strong></p>
          <p style={{ fontSize: 10, color: INK_FAINT }}>{dateDisplay}</p>
        </div>
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: INK_FAINT, marginBottom: 10 }}>{children}</p>
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 30, fontWeight: 400, color: INK, marginBottom: 20, lineHeight: 1.15 }}>{children}</h2>
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr', gap: 6, marginBottom: 3 }}>
      <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: INK_FAINT, paddingTop: 1.5 }}>{label}</span>
      <span style={{ fontSize: 12, color: INK, fontWeight: 500 }}>{value}</span>
    </div>
  )
}

function BulletItem({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
      <span style={{ color: INK_FAINT, fontSize: 11, marginTop: 1, flexShrink: 0 }}>–</span>
      <span style={{ fontSize: 11, color: INK_SOFT, lineHeight: 1.6 }}>{text}</span>
    </div>
  )
}

// ─── Proposal V2 Preview ─────────────────────────────────────────────────────
function ProposalV2Preview({ c, doc }: { c: ProposalV2; doc: Document }) {
  const selectedAreas = Object.entries(c.scopeAreas).filter(([, on]) => on).map(([k]) => k)
  const selectedAddl = Object.entries(c.additionalServices).filter(([, on]) => on).map(([k]) => k)
  const weeklyInvestment = c.pricePerVisit > 0 ? `$${c.pricePerVisit.toFixed(2)} per visit` : 'TBC'
  const freqLabel = `${c.cleansPerWeek}× per week`

  // Split scope areas into two columns
  const half = Math.ceil(selectedAreas.length / 2)
  const leftAreas = selectedAreas.slice(0, half)
  const rightAreas = selectedAreas.slice(half)

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', background: 'white' }}>

      {/* ═══ COVER PAGE ═══ */}
      <div className="proposal-page proposal-cover" style={{ background: '#161616', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        {/* Dark band — flex grow so it fills remaining space above white panel */}
        <div style={{ padding: '36px 48px 52px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 72 }}>
            <Image src="/logo-white.png" alt="Delta Cleaning" width={110} height={36} style={{ objectFit: 'contain' }} />
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 8, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 3 }}>Reference</p>
              <p style={{ fontSize: 14, color: 'white', fontWeight: 500, letterSpacing: '0.02em' }}>{c.refNumber}</p>
            </div>
          </div>
          <h1 style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 44, fontWeight: 400, color: 'white', lineHeight: 1.12, marginBottom: 14, maxWidth: 420 }}>
            Commercial Cleaning Proposal
          </h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: 300 }}>
            Prepared exclusively for {c.companyName} · {c.proposalDateDisplay}
          </p>
        </div>

        {/* Cover info band */}
        <div style={{ background: 'white', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
          {/* Left: submitted to */}
          <div style={{ padding: '36px 40px', borderRight: `1px solid ${RULE}` }}>
            <SectionLabel>Submitted to</SectionLabel>
            <h3 style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 22, fontWeight: 400, color: INK, marginBottom: 4 }}>{c.companyName}</h3>
            <p style={{ fontSize: 11.5, color: INK_SOFT, marginBottom: 24 }}>{c.siteAddress}</p>
            <div style={{ borderTop: `1px solid ${RULE_LIGHT}`, paddingTop: 16, marginBottom: 20 }}>
              <p style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: INK_FAINT, marginBottom: 6 }}>Attention</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: INK }}>{c.contactName || '—'}</p>
              {c.contactTitle && <p style={{ fontSize: 11, color: INK_SOFT, marginTop: 1 }}>{c.contactTitle}</p>}
            </div>
            <div style={{ borderTop: `1px solid ${RULE_LIGHT}`, paddingTop: 16 }}>
              <MetaRow label="Date" value={c.proposalDateDisplay} />
              <MetaRow label="Ref" value={c.refNumber} />
              <MetaRow label="Valid" value="30 days from date of issue" />
            </div>
          </div>

          {/* Right: submitted by */}
          <div style={{ padding: '36px 40px' }}>
            <SectionLabel>Submitted by</SectionLabel>
            <p style={{ fontSize: 14, fontWeight: 700, color: INK, marginBottom: 2 }}>Jackson Jaillet</p>
            <p style={{ fontSize: 12, color: INK_SOFT, marginBottom: 2 }}>Founder & Director, Delta Cleaning</p>
            <p style={{ fontSize: 12, color: INK_SOFT, marginBottom: 2 }}>+61 412 844 238</p>
            <p style={{ fontSize: 12, color: INK_SOFT, marginBottom: 28 }}>hello@deltacleaning.com.au</p>

            <div style={{ borderTop: `1px solid ${RULE_LIGHT}`, paddingTop: 16, marginBottom: 20 }}>
              <SectionLabel>About this proposal</SectionLabel>
              <p style={{ fontSize: 11.5, color: INK_SOFT, lineHeight: 1.7 }}>
                This proposal has been prepared for <strong style={{ color: INK }}>{c.companyName}</strong> following a site walkthrough conducted by Jackson Jaillet. It outlines the scope of services, any additional services discussed, the service schedule, and the investment required.
              </p>
            </div>

            <div style={{ borderTop: `1px solid ${RULE_LIGHT}`, paddingTop: 16 }}>
              <SectionLabel>Contents</SectionLabel>
              {[['01', 'Introduction'], ['02', 'Scope of Services'], ['03', 'Pricing'], ['04', 'Terms & Next Steps']].map(([num, title]) => (
                <div key={num} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: `1px solid ${RULE_LIGHT}` }}>
                  <span style={{ fontSize: 10, color: INK_FAINT, width: 22 }}>{num}</span>
                  <span style={{ flex: 1, fontSize: 12, color: INK, fontWeight: 500 }}>{title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ PAGE 2: INTRODUCTION ═══ */}
      <div className="proposal-page" style={{ padding: '40px 48px 52px' }}>
        <PageHeader company={c.companyName} dateDisplay={c.proposalDateDisplay} />

        <SectionLabel>Introduction</SectionLabel>
        <SectionHeading>From Jackson Jaillet, Founder & Director</SectionHeading>

        {/* Letter */}
        <div style={{ border: `1px solid ${RULE}`, borderRadius: 4, padding: '24px 28px', marginBottom: 32 }}>
          <p style={{ fontSize: 13, color: INK, marginBottom: 14 }}>Dear {c.contactName || c.companyName},</p>
          {c.openingParagraph.split('\n').filter(l => l.trim()).map((para, i) => (
            <p key={i} style={{ fontSize: 12.5, color: INK_SOFT, lineHeight: 1.75, marginBottom: 10 }}>{para}</p>
          ))}
          {c.additionalNote && (
            <p style={{ fontSize: 12, color: INK_SOFT, lineHeight: 1.7, marginTop: 6, paddingTop: 10, borderTop: `1px solid ${RULE_LIGHT}`, fontStyle: 'italic' }}>{c.additionalNote}</p>
          )}
        </div>

        {/* Value props */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, border: `1px solid ${RULE}`, borderRadius: 4, overflow: 'hidden', marginBottom: 36 }}>
          {[
            { title: 'Reliable', body: 'A consistent standard on every visit. Same process, same team, every time.' },
            { title: 'Accountable', body: 'If something is not right, we address it immediately — no need to follow up twice.' },
            { title: 'Communicative', body: 'Jackson personally checks in with every client to ensure the service meets expectations.' },
          ].map((v, i) => (
            <div key={v.title} style={{ padding: '18px 20px', borderLeft: i > 0 ? `1px solid ${RULE}` : 'none' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: INK, marginBottom: 6 }}>{v.title}</p>
              <p style={{ fontSize: 11, color: INK_SOFT, lineHeight: 1.65 }}>{v.body}</p>
            </div>
          ))}
        </div>

        {/* Client reviews */}
        <SectionLabel>What our clients say</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, border: `1px solid ${RULE}`, borderRadius: 4, overflow: 'hidden', marginBottom: 20 }}>
          {REVIEWS.map((r, i) => (
            <div key={r.name} style={{ padding: '20px 22px', borderLeft: i % 2 === 1 ? `1px solid ${RULE}` : 'none', borderTop: i >= 2 ? `1px solid ${RULE}` : 'none' }}>
              <p style={{ fontSize: 12, color: INK_SOFT, lineHeight: 1.7, fontStyle: 'italic', marginBottom: 14 }}>"{r.quote}"</p>
              <p style={{ fontSize: 12, fontWeight: 700, color: INK, marginBottom: 1 }}>{r.name}</p>
              <p style={{ fontSize: 11, color: INK_FAINT }}>{r.role}</p>
            </div>
          ))}
        </div>

        {/* Direct owner involvement — subtle note below reviews */}
        <div style={{ borderTop: `1px solid ${RULE_LIGHT}`, paddingTop: 14 }}>
          <p style={{ fontSize: 11, color: INK_FAINT, lineHeight: 1.7, textAlign: 'center' }}>
            Every Delta Cleaning client is managed directly by Jackson Jaillet — the owner. Jackson personally handles onboarding, conducts quality checks, and remains your single point of contact throughout the engagement.
          </p>
        </div>
      </div>

      {/* ═══ PAGE 3: SCOPE & PRICING ═══ */}
      <div className="proposal-page" style={{ padding: '40px 48px 52px' }}>
        <PageHeader company={c.companyName} dateDisplay={c.proposalDateDisplay} />

        <SectionLabel>Scope of services</SectionLabel>
        <SectionHeading>Service inclusions</SectionHeading>

        <p style={{ fontSize: 12, color: INK_SOFT, lineHeight: 1.7, marginBottom: 28 }}>
          The following inclusions apply to every scheduled visit at <strong style={{ color: INK }}>{c.siteAddress || c.companyName}</strong>, performed <strong style={{ color: INK }}>{freqLabel}</strong>. This scope was confirmed during a site walkthrough of your facility.
        </p>

        {/* Scope two-column */}
        {selectedAreas.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 28 }}>
            <div>
              {leftAreas.map(key => {
                const area = SCOPE_INCLUSIONS[key]
                if (!area) return null
                const note = c.scopeNotes?.[key]
                return (
                  <div key={key} style={{ marginBottom: 24 }}>
                    <p style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: INK_FAINT, marginBottom: 10 }}>{area.label}</p>
                    <div style={{ borderTop: `1px solid ${RULE_LIGHT}`, paddingTop: 10 }}>
                      {area.items.map((item, i) => <BulletItem key={i} text={item} />)}
                      {note && <p style={{ fontSize: 11, color: INK_FAINT, fontStyle: 'italic', marginTop: 8 }}>Note: {note}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
            <div>
              {rightAreas.map(key => {
                const area = SCOPE_INCLUSIONS[key]
                if (!area) return null
                const note = c.scopeNotes?.[key]
                return (
                  <div key={key} style={{ marginBottom: 24 }}>
                    <p style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: INK_FAINT, marginBottom: 10 }}>{area.label}</p>
                    <div style={{ borderTop: `1px solid ${RULE_LIGHT}`, paddingTop: 10 }}>
                      {area.items.map((item, i) => <BulletItem key={i} text={item} />)}
                      {note && <p style={{ fontSize: 11, color: INK_FAINT, fontStyle: 'italic', marginTop: 8 }}>Note: {note}</p>}
                    </div>
                  </div>
                )
              })}
              {/* Available on request */}
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: INK_FAINT, marginBottom: 10 }}>Available on request</p>
                <div style={{ borderTop: `1px solid ${RULE_LIGHT}`, paddingTop: 10 }}>
                  <BulletItem text="Periodic deep clean — by arrangement" />
                  <BulletItem text="Post-event or post-renovation clean" />
                  <BulletItem text="Ad hoc tasks — quoted separately, prior notice required" />
                </div>
              </div>
              {c.otherInclusions && (
                <div style={{ marginBottom: 24 }}>
                  <p style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: INK_FAINT, marginBottom: 10 }}>Other inclusions</p>
                  <div style={{ borderTop: `1px solid ${RULE_LIGHT}`, paddingTop: 10 }}>
                    {c.otherInclusions.split('\n').filter(l => l.trim()).map((line, i) => <BulletItem key={i} text={line} />)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Additional services table */}
        {selectedAddl.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <SectionLabel>Additional services</SectionLabel>
            <div style={{ border: `1px solid ${RULE}`, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 160px', background: '#F7F6F4', padding: '8px 16px' }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: INK_FAINT }}>Service</span>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: INK_FAINT }}>Frequency</span>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: INK_FAINT, textAlign: 'right' }}>Pricing (excl. GST)</span>
              </div>
              {selectedAddl.map(key => {
                const svc = ADDL_SERVICE_LABELS[key]
                return (
                  <div key={key} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 160px', padding: '10px 16px', borderTop: `1px solid ${RULE_LIGHT}` }}>
                    <span style={{ fontSize: 12, color: INK }}>{svc?.label}</span>
                    <span style={{ fontSize: 12, color: INK_SOFT }}>On request</span>
                    <span style={{ fontSize: 12, color: INK, fontWeight: 600, textAlign: 'right' }}>{svc?.price}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Pricing table */}
        <SectionLabel>Pricing</SectionLabel>
        <div style={{ border: `1px solid ${RULE}`, borderRadius: 4, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px 140px', background: '#F7F6F4', padding: '8px 16px' }}>
            {['Service', 'Frequency', 'Days', 'Rate (excl. GST)'].map((h, i) => (
              <span key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: INK_FAINT, textAlign: i === 3 ? 'right' : 'left' }}>{h}</span>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px 140px', padding: '12px 16px', borderTop: `1px solid ${RULE_LIGHT}` }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 500, color: INK, marginBottom: 2 }}>Standard Commercial Clean</p>
              <p style={{ fontSize: 11, color: INK_FAINT }}>Full inclusions as listed above</p>
            </div>
            <span style={{ fontSize: 12, color: INK_SOFT }}>{freqLabel}</span>
            <span style={{ fontSize: 12, color: INK_SOFT }}>{c.preferredDays || 'TBC'}</span>
            <span style={{ fontSize: 12, color: INK, fontWeight: 600, textAlign: 'right' }}>{c.pricePerVisit > 0 ? `$${c.pricePerVisit.toFixed(2)} per visit` : 'TBC'}</span>
          </div>
          {selectedAddl.map(key => {
            const svc = ADDL_SERVICE_LABELS[key]
            return (
              <div key={key} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px 140px', padding: '10px 16px', borderTop: `1px solid ${RULE_LIGHT}` }}>
                <div>
                  <p style={{ fontSize: 12, color: INK }}>{svc?.label}</p>
                </div>
                <span style={{ fontSize: 12, color: INK_SOFT }}>On request</span>
                <span style={{ fontSize: 12, color: INK_SOFT }}>As agreed</span>
                <span style={{ fontSize: 12, color: INK, fontWeight: 600, textAlign: 'right' }}>{svc?.price}</span>
              </div>
            )
          })}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px 140px', padding: '12px 16px', borderTop: `1px solid ${RULE}`, background: '#FAFAF8' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>Weekly Investment (excl. GST)</span>
            <span />
            <span />
            <span style={{ fontSize: 13, fontWeight: 700, color: INK, textAlign: 'right' }}>{weeklyInvestment}</span>
          </div>
        </div>

        {/* Please note */}
        <div style={{ border: `1px solid ${RULE_LIGHT}`, borderRadius: 4, padding: '14px 18px', background: '#FAFAF8' }}>
          <p style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: INK_FAINT, marginBottom: 6 }}>Please note</p>
          <p style={{ fontSize: 11.5, color: INK_SOFT, lineHeight: 1.7 }}>All cleaning products and equipment are supplied by Delta Cleaning. Safety Data Sheets (SDS) are available on request. Any site-specific requirements or hazards must be communicated prior to commencement of services.</p>
        </div>
      </div>

      {/* ═══ PAGE 4: TERMS ═══ */}
      <div className="proposal-page" style={{ padding: '40px 48px 52px' }}>
        <PageHeader company={c.companyName} dateDisplay={c.proposalDateDisplay} />

        <SectionLabel>Terms & acceptance</SectionLabel>
        <SectionHeading>Terms of engagement</SectionHeading>

        {/* Terms grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, border: `1px solid ${RULE}`, borderRadius: 4, overflow: 'hidden', marginBottom: 36 }}>
          {TERMS.map((t, i) => (
            <div key={t.title} style={{ padding: '18px 20px', borderLeft: i % 2 === 1 ? `1px solid ${RULE}` : 'none', borderTop: i >= 2 ? `1px solid ${RULE}` : 'none' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: INK, marginBottom: 6 }}>{t.title}</p>
              <p style={{ fontSize: 11, color: INK_SOFT, lineHeight: 1.65 }}>{t.body}</p>
            </div>
          ))}
        </div>

        {/* How we get started */}
        <SectionLabel>How we get started</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, border: `1px solid ${RULE}`, borderRadius: 4, overflow: 'hidden', marginBottom: 28 }}>
          {[
            { step: 'Step 01', tag: 'Accept', body: 'Confirm acceptance via email. A formal Service Agreement will then be issued for your review.' },
            { step: 'Step 02', tag: 'Agreement', body: 'Review and sign the Service Agreement to formalise the engagement and confirm all terms.' },
            { step: 'Step 03', tag: 'Commence', body: 'Services begin on the agreed start date. Jackson will follow up after the first visit to confirm all is in order.' },
          ].map((s, i) => (
            <div key={s.step} style={{ padding: '18px 20px', borderLeft: i > 0 ? `1px solid ${RULE}` : 'none' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: INK, marginBottom: 2 }}>{s.step}</p>
              <p style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: INK_FAINT, marginBottom: 8 }}>{s.tag}</p>
              <p style={{ fontSize: 11, color: INK_SOFT, lineHeight: 1.65 }}>{s.body}</p>
            </div>
          ))}
        </div>

        {/* Proposal validity */}
        <div style={{ borderTop: `1px solid ${RULE_LIGHT}`, paddingTop: 18 }}>
          <p style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: INK_FAINT, marginBottom: 6 }}>Proposal validity</p>
          <p style={{ fontSize: 11.5, color: INK_SOFT, lineHeight: 1.7 }}>
            This proposal is valid for 30 days from the date of issue. Pricing and availability are subject to change after this period. A formal Service Agreement will be issued upon acceptance.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Legacy preview (for agreements) ─────────────────────────────────────────
function LegacyPreview({ doc, content }: { doc: Document; content: DocumentContent }) {
  const ink = INK; const inkSoft = INK_SOFT; const inkFaint = INK_FAINT; const rule = RULE; const ruleLight = RULE_LIGHT
  const isProposal = doc.document_type === 'proposal'
  const isAgreement = doc.document_type === 'cleaning_agreement'

  return (
    <div style={{ background: 'white', fontFamily: 'Inter, system-ui, sans-serif', padding: '40px 48px', border: `1px solid ${rule}`, borderRadius: 4 }}>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 9, color: inkFaint, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 4 }}>
          {doc.document_type === 'cleaning_agreement' ? 'Cleaning Agreement' : 'Specialist Agreement'}
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 400, color: ink, fontFamily: "'EB Garamond', Georgia, serif" }}>{doc.title || doc.ref_number}</h1>
        <p style={{ fontSize: 12, color: inkSoft, marginTop: 4 }}>Prepared for {content.clientName}</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <p style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: inkFaint, marginBottom: 8 }}>Client</p>
          <p style={{ fontSize: 14, fontWeight: 600, color: ink }}>{content.clientName}</p>
          {content.contactName && <p style={{ fontSize: 12, color: inkSoft }}>{content.contactName}</p>}
          {content.clientAddress && <p style={{ fontSize: 12, color: inkSoft }}>{content.clientAddress}</p>}
        </div>
        {content.billing && (
          <div>
            <p style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: inkFaint, marginBottom: 8 }}>Pricing</p>
            <p style={{ fontSize: 12, color: inkSoft }}>Rate per visit: <strong style={{ color: ink }}>${content.billing.ratePerVisit?.toFixed(2)}</strong></p>
            <p style={{ fontSize: 12, color: inkSoft }}>Frequency: <strong style={{ color: ink }}>{content.billing.frequency}</strong></p>
            <p style={{ fontSize: 12, color: inkSoft }}>Monthly value: <strong style={{ color: ink }}>${content.billing.monthlyValue?.toFixed(2)}</strong></p>
          </div>
        )}
      </div>
      {content.cleaningAgreement && (
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${ruleLight}` }}>
          <p style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: inkFaint, marginBottom: 10 }}>Agreement details</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {[
              ['Commencement', content.cleaningAgreement.commencementDate || 'TBC'],
              ['Contract length', content.cleaningAgreement.contractLength],
              ['Notice period', content.cleaningAgreement.noticePeriod],
              ['Payment terms', content.cleaningAgreement.paymentTerms],
            ].map(([l, v]) => (
              <div key={l} style={{ padding: '12px', border: `1px solid ${ruleLight}`, borderRadius: 3 }}>
                <p style={{ fontSize: 9, color: inkFaint, marginBottom: 3 }}>{l}</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: ink }}>{v}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function DocumentPreview({ document, content }: DocumentPreviewProps) {
  if (!content) return null

  const raw = content as Record<string, unknown>
  if (raw.type === 'proposal_v2') {
    return <ProposalV2Preview c={raw as unknown as ProposalV2} doc={document} />
  }

  return <LegacyPreview doc={document} content={content as DocumentContent} />
}
