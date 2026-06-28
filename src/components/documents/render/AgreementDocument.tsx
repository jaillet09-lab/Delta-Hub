import type { CSSProperties } from 'react'
import { AGREEMENT_CLAUSES, type AgreementData } from '@/lib/documents/agreement'

// Faithful recreation of the Service Agreement (7 × A4 pages).

const NAVY = '#0F172A'
const SANS = "'Hanken Grotesk', system-ui, sans-serif"
const DISPLAY = "'Schibsted Grotesk', system-ui, sans-serif"
const MONO = "'Space Mono', monospace"
const WORDMARK_BLACK = '/proposal-assets/wordmark-black.png'
const WORDMARK_WHITE = '/proposal-assets/wordmark-white.png'
const MARK_WHITE = '/proposal-assets/mark-white.png'

const page: CSSProperties = { position: 'relative', width: 794, minHeight: 1123, background: '#fff', color: NAVY, overflow: 'hidden', flexShrink: 0, padding: '64px 72px', fontFamily: SANS, boxShadow: '0 8px 40px rgba(15,23,42,.10)' }
const navyPage: CSSProperties = { position: 'relative', width: 794, minHeight: 1123, background: NAVY, color: '#fff', overflow: 'hidden', flexShrink: 0, boxShadow: '0 8px 40px rgba(15,23,42,.22)' }
const monoEyebrow: CSSProperties = { fontFamily: MONO, fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 14 }

// Invisible anchor token for DocuSign tab placement (white, tiny — in the PDF
// text layer but not visible). DocuSign finds the string and anchors tabs to it.
const Anchor = ({ t }: { t: string }) => (
  <span style={{ color: '#ffffff', fontSize: 1, lineHeight: 0, userSelect: 'none' }}>{t}</span>
)

function Header({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 18, borderBottom: '1px solid #E2E8F0' }}>
      <img src={WORDMARK_BLACK} alt="Delta Cleaning" style={{ height: 20, width: 'auto' }} />
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.14em', color: '#94A3B8', textTransform: 'uppercase' }}>{label}</div>
    </div>
  )
}
function Foot({ n }: { n: string }) {
  return <div style={{ position: 'absolute', left: 72, right: 72, bottom: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: MONO, fontSize: 10, letterSpacing: '.1em', color: '#CBD5E1', textTransform: 'uppercase', borderTop: '1px solid #EEF2F6', paddingTop: 14 }}><span>Delta Cleaning · Service Agreement</span><span>{n}</span></div>
}
function Clause({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '34px 1fr', gap: 12, marginBottom: 16 }}>
      <div style={{ fontFamily: MONO, fontSize: 13, color: NAVY, paddingTop: 1 }}>{n}</div>
      <div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 15, marginBottom: 6 }}>{title}</div>
        <p style={{ fontSize: 12.6, lineHeight: 1.55, color: '#475569', margin: 0 }} dangerouslySetInnerHTML={{ __html: body }} />
      </div>
    </div>
  )
}
function PRow({ k, children, last }: { k: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', borderBottom: last ? undefined : '1px solid #EEF2F6' }}>
      <div style={{ padding: '15px 22px', background: '#F8FAFC', fontFamily: MONO, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: '#64748B' }}>{k}</div>
      <div style={{ padding: '15px 22px', fontSize: 13.5 }}>{children}</div>
    </div>
  )
}
function ScopeCol({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: NAVY, borderBottom: `2px solid ${NAVY}`, paddingBottom: 8, marginBottom: 12 }}>{title}</div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {items.map((it, i) => (
          <li key={i} style={{ fontSize: 12.6, lineHeight: 1.45, color: '#475569', paddingLeft: 16, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 0, top: 6, width: 5, height: 5, background: NAVY, borderRadius: 1 }} />{it}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function AgreementDocument({ data }: { data: AgreementData }) {
  const c1to6 = AGREEMENT_CLAUSES.slice(0, 6)
  const c7to13 = AGREEMENT_CLAUSES.slice(6, 13)
  const c14to19 = AGREEMENT_CLAUSES.slice(13, 19)

  return (
    <div data-doc-root style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>

      {/* ── 1 · Cover ── */}
      <section data-sheet style={navyPage}>
        <img src={MARK_WHITE} alt="" style={{ position: 'absolute', right: -150, top: -110, width: 520, opacity: 0.05 }} />
        <img src={MARK_WHITE} alt="" style={{ position: 'absolute', left: -180, bottom: -200, width: 560, opacity: 0.04 }} />
        <div style={{ position: 'relative', padding: '64px 72px', display: 'flex', flexDirection: 'column', minHeight: 1123 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <img src={WORDMARK_WHITE} alt="Delta Cleaning" style={{ height: 30, width: 'auto' }} />
            <div style={{ textAlign: 'right', fontFamily: MONO, fontSize: 11, letterSpacing: '.16em', color: '#64748B', lineHeight: 1.8 }}><div>AGREEMENT</div><div style={{ color: '#E2E8F0' }}>{data.agreementRef}</div></div>
          </div>
          <div style={{ marginTop: 'auto' }}>
            <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '.28em', textTransform: 'uppercase', color: '#7C8BA1', marginBottom: 26 }}>Commercial Cleaning</div>
            <h1 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 74, lineHeight: 0.98, letterSpacing: '-.03em', margin: 0, color: '#fff' }}>Service<br />Agreement</h1>
            <div style={{ width: 64, height: 3, background: '#fff', margin: '36px 0 26px' }} />
            <p style={{ fontSize: 15.5, lineHeight: 1.7, color: '#94A3B8', maxWidth: 480, margin: 0 }}>This Agreement sets out the terms on which Delta Cleaning will provide commercial cleaning services to the Client identified below.</p>
          </div>
          <div style={{ marginTop: 60, paddingTop: 30, borderTop: '1px solid rgba(255,255,255,.12)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div><div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: '#64748B', marginBottom: 8 }}>Between</div><div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{data.providerName}</div><div style={{ fontSize: 13, color: '#94A3B8' }}>ABN {data.providerABN}</div></div>
            <div><div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: '#64748B', marginBottom: 8 }}>And</div><div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{data.clientName}</div><div style={{ fontSize: 13, color: '#94A3B8' }}>ABN {data.clientABN}</div></div>
            <div><div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: '#64748B', marginBottom: 8 }}>Date</div><div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{data.agreementDate}</div></div>
            <div><div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: '#64748B', marginBottom: 8 }}>Governing law</div><div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>Queensland, Australia</div></div>
          </div>
        </div>
      </section>

      {/* ── 2 · Schedule of Particulars ── */}
      <section data-sheet style={page}>
        <Header label={`Agreement · ${data.agreementRef}`} />
        <div style={{ marginTop: 46 }}>
          <div style={monoEyebrow}>Schedule of particulars</div>
          <h2 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 32, lineHeight: 1.06, letterSpacing: '-.025em', margin: 0 }}>Key terms.</h2>
          <p style={{ margin: '14px 0 0', fontSize: 13.5, lineHeight: 1.6, color: '#64748B', maxWidth: 620 }}>These particulars form part of this Agreement and prevail over the general terms to the extent of any inconsistency. Complete each field for the engagement.</p>
        </div>
        <div style={{ marginTop: 30, border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
          <PRow k="Service Provider">{data.providerName} · ABN {data.providerABN}</PRow>
          <PRow k="Client">{data.clientName} · ABN {data.clientABN}</PRow>
          <PRow k="Premises / Site">{data.premises}</PRow>
          <PRow k="Services">Commercial cleaning per Schedule 1 and accepted Proposal {data.proposalRef}</PRow>
          <PRow k="Frequency">{data.frequency}</PRow>
          <PRow k="Commencement">{data.commencementDate || '—'}</PRow>
          <PRow k="Initial Term">{data.initialTerm}</PRow>
          <PRow k="Service Fee">{data.serviceFee} <span style={{ color: '#94A3B8' }}>(excl. GST)</span></PRow>
          <PRow k="Payment Terms">{data.paymentTerms}</PRow>
          <PRow k="Price Review">Annually, in line with Queensland CPI, minimum 30 days&apos; written notice</PRow>
          <PRow k="Special Conditions" last>{data.specialConditions}</PRow>
        </div>
        <Foot n="02" />
      </section>

      {/* ── 3 · Clauses 1-6 ── */}
      <section data-sheet style={page}>
        <Header label="Terms & Conditions" />
        <h2 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 24, letterSpacing: '-.02em', margin: '34px 0 24px' }}>Terms &amp; Conditions</h2>
        {c1to6.map(c => <Clause key={c.n} {...c} />)}
        <Foot n="03" />
      </section>

      {/* ── 4 · Clauses 7-13 ── */}
      <section data-sheet style={page}>
        <Header label="Terms & Conditions" />
        <div style={{ height: 34 }} />
        {c7to13.map(c => <Clause key={c.n} {...c} />)}
        <Foot n="04" />
      </section>

      {/* ── 5 · Clauses 14-19 ── */}
      <section data-sheet style={page}>
        <Header label="Terms & Conditions" />
        <div style={{ height: 34 }} />
        {c14to19.map(c => <Clause key={c.n} {...c} />)}
        <Foot n="05" />
      </section>

      {/* ── 6 · Schedule 1 Scope ── */}
      <section data-sheet style={page}>
        <Header label="Schedule 1" />
        <div style={{ marginTop: 46 }}>
          <div style={monoEyebrow}>Schedule 1</div>
          <h2 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 30, lineHeight: 1.06, letterSpacing: '-.025em', margin: 0 }}>Scope of services.</h2>
          <p style={{ margin: '14px 0 0', fontSize: 13, lineHeight: 1.6, color: '#64748B', maxWidth: 640 }}>The Services comprise the following inclusions at {data.premises}, performed {data.frequency}, together with any items in the accepted Proposal. The scope may be tailored by written agreement.</p>
        </div>
        <div style={{ marginTop: 28, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 40px' }}>
          {data.scopeGroups.map((g, i) => <ScopeCol key={i} title={g.title} items={g.items} />)}
        </div>
        <div style={{ marginTop: 26, background: '#F8FAFC', border: '1px solid #EEF2F6', borderRadius: 12, padding: '22px 26px' }}>
          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 12 }}>Periodic &amp; on request, quoted separately</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {data.additionalServices.map((s, i) => <span key={i} style={{ fontSize: 12.5, border: '1px solid #CBD5E1', borderRadius: 999, padding: '6px 13px', color: '#334155', background: '#fff', whiteSpace: 'nowrap' }}>{s}</span>)}
          </div>
        </div>
        <Foot n="06" />
      </section>

      {/* ── 7 · Execution ── */}
      <section data-sheet style={page}>
        <Header label="Execution" />
        <div style={{ marginTop: 52 }}>
          <div style={monoEyebrow}>Execution</div>
          <h2 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 32, lineHeight: 1.06, letterSpacing: '-.025em', margin: 0 }}>Executed as an agreement.</h2>
          <p style={{ margin: '16px 0 0', fontSize: 13.5, lineHeight: 1.65, color: '#475569', maxWidth: 620 }}>By signing below, each party acknowledges it has read and agrees to be bound by this Agreement, including the Schedule of Particulars and Schedule 1, as at the date written below.</p>
        </div>
        <div style={{ marginTop: 46, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30 }}>
          {/* Provider block — anchor for DocuSign provider tabs */}
          <div data-sign-provider style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: 30 }}>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 18 }}>Service Provider</div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 16 }}>{data.providerName}</div>
            <div style={{ fontSize: 12.5, color: '#64748B', marginBottom: 30 }}>ABN {data.providerABN}</div>
            <div style={{ borderBottom: `1px solid ${NAVY}`, height: 38 }}><Anchor t="DSPROVIDERSIGN" /></div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>Signature</div>
            <div style={{ marginTop: 22, borderBottom: '1px solid #CBD5E1', height: 24 }} />
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>Name · {data.contactName}, {data.contactRole}</div>
            <div style={{ marginTop: 22, borderBottom: '1px solid #CBD5E1', height: 24 }}><Anchor t="DSPROVIDERDATE" /></div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>Date</div>
          </div>
          {/* Client block — anchor for DocuSign client tabs */}
          <div data-sign-client style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: 30 }}>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 18 }}>Client</div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 16 }}>{data.clientName}</div>
            <div style={{ fontSize: 12.5, color: '#64748B', marginBottom: 30 }}>ABN {data.clientABN}</div>
            <div style={{ borderBottom: `1px solid ${NAVY}`, height: 38 }}><Anchor t="DSCLIENTSIGN" /></div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>Signature</div>
            <div style={{ marginTop: 22, borderBottom: '1px solid #CBD5E1', height: 24 }}><Anchor t="DSCLIENTNAME" /></div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>Name &amp; position</div>
            <div style={{ marginTop: 22, borderBottom: '1px solid #CBD5E1', height: 24 }}><Anchor t="DSCLIENTDATE" /></div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>Date</div>
          </div>
        </div>
        <div style={{ marginTop: 34, background: NAVY, borderRadius: 12, padding: '26px 30px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24 }}>
          <div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Questions before signing?</div>
            <div style={{ fontSize: 13, color: '#94A3B8' }}>{data.contactName} · {data.contactPhone} · {data.contactEmail}</div>
          </div>
          <img src={WORDMARK_WHITE} alt="Delta Cleaning" style={{ height: 22, width: 'auto', opacity: 0.9 }} />
        </div>
        <div style={{ marginTop: 22, border: '1px dashed #CBD5E1', borderRadius: 10, padding: '14px 18px', fontSize: 11.5, lineHeight: 1.55, color: '#94A3B8' }}>
          This document is a template provided for convenience. We recommend it is reviewed by your legal adviser before use to ensure it suits your circumstances.
        </div>
        <Foot n="07" />
      </section>

    </div>
  )
}
