import type { CSSProperties } from 'react'
import type { CapabilityData } from '@/lib/documents/capability'

// Faithful recreation of the Capability Statement (3 × A4 pages).

const NAVY = '#0F172A'
const SANS = "'Hanken Grotesk', system-ui, sans-serif"
const DISPLAY = "'Schibsted Grotesk', system-ui, sans-serif"
const MONO = "'Space Mono', monospace"
const WORDMARK_BLACK = '/proposal-assets/wordmark-black.png'
const WORDMARK_WHITE = '/proposal-assets/wordmark-white.png'
const MARK_WHITE = '/proposal-assets/mark-white.png'

const page: CSSProperties = { position: 'relative', width: 794, minHeight: 1123, background: '#fff', color: NAVY, overflow: 'hidden', flexShrink: 0, fontFamily: SANS }
const eyebrow: CSSProperties = { fontFamily: SANS, fontSize: 11, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 16 }
const bullet = (text: string, key: number) => (
  <li key={key} style={{ fontSize: 12.6, lineHeight: 1.45, color: '#475569', paddingLeft: 16, position: 'relative' }}>
    <span style={{ position: 'absolute', left: 0, top: 6, width: 5, height: 5, background: NAVY, borderRadius: 1 }} />{text}
  </li>
)
function Foot({ left, n }: { left: string; n: string }) {
  return <div style={{ position: 'absolute', left: 64, right: 64, bottom: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: SANS, fontSize: 10.5, letterSpacing: '.06em', color: '#CBD5E1', textTransform: 'uppercase', borderTop: '1px solid #EEF2F6', paddingTop: 14 }}><span>{left}</span><span style={{ fontFamily: MONO }}>{n}</span></div>
}
function SectorCard({ t, d }: { t: string; d: string }) {
  return <div style={{ border: '1px solid #EEF2F6', borderTop: `3px solid ${NAVY}`, borderRadius: 10, padding: '18px 20px' }}><div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 15, marginBottom: 5 }}>{t}</div><p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: '#64748B' }}>{d}</p></div>
}

export function CapabilityDocument({ data }: { data: CapabilityData }) {
  return (
    <div data-doc-root style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>

      {/* ── 1 · Cover + about + accreditation ── */}
      <section data-sheet style={{ ...page, boxShadow: '0 8px 40px rgba(15,23,42,.10)' }}>
        <div style={{ background: NAVY, color: '#fff', padding: '52px 64px 46px', position: 'relative', overflow: 'hidden' }}>
          <img src={MARK_WHITE} alt="" style={{ position: 'absolute', right: -100, top: -80, width: 340, opacity: 0.06 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
            <img src={WORDMARK_WHITE} alt="Delta Cleaning" style={{ height: 28, width: 'auto' }} />
            <div style={{ textAlign: 'right', fontFamily: MONO, fontSize: 10.5, letterSpacing: '.14em', color: '#7C8BA1', lineHeight: 1.9 }}><div>CAPABILITY</div><div style={{ color: '#E2E8F0' }}>STATEMENT {data.year}</div></div>
          </div>
          <div style={{ marginTop: 46, position: 'relative' }}>
            <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, letterSpacing: '.2em', textTransform: 'uppercase', color: '#7C8BA1', marginBottom: 16 }}>Commercial Cleaning · Brisbane &amp; South East QLD</div>
            <h1 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 50, lineHeight: 1, letterSpacing: '-.025em', margin: 0, maxWidth: 580 }}>{data.tagline}</h1>
            <p style={{ fontSize: 15, color: '#94A3B8', margin: '18px 0 0', maxWidth: 560, lineHeight: 1.65 }}>{data.intro}</p>
          </div>
          <div style={{ marginTop: 44, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18, position: 'relative' }}>
            {[['5+', 'Years serving SEQ'], ['98%', 'Client retention'], ['100%', 'Owner involvement'], ['0%', 'Cleaner churn on site']].map(([s, l]) => (
              <div key={l}><div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 36, letterSpacing: '-.03em' }}>{s}</div><div style={{ fontSize: 11, color: '#7C8BA1', marginTop: 2, lineHeight: 1.4 }}>{l}</div></div>
            ))}
          </div>
        </div>
        <div style={{ padding: '42px 64px 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 42 }}>
            <div>
              <div style={eyebrow}>Who we are</div>
              <p style={{ fontSize: 14, lineHeight: 1.72, color: '#475569', margin: '0 0 14px' }}>Delta Cleaning is an owner-led commercial cleaning business based in Brisbane, serving offices, medical and healthcare facilities, warehouses, retail and facility-managed sites across South East Queensland.</p>
              <p style={{ fontSize: 14, lineHeight: 1.72, color: '#475569', margin: '0 0 14px' }}>We keep things deliberately hands-on. The owner is involved in every account, from the first walkthrough through to the ongoing service, so the standard is set and held by the person you actually deal with.</p>
              <p style={{ fontSize: 14, lineHeight: 1.72, color: '#475569', margin: 0 }}>Each site is run by a dedicated team with its own on-site supervisor who holds the standard day to day, with the owner across every site above them. The same crew returns each visit, so quality stays consistent and there is always a named person accountable for it.</p>
            </div>
            <div>
              <div style={eyebrow}>Accreditations &amp; cover</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {[['Quality management', 'ISO-aligned'], ['Environmental practice', 'ISO-aligned'], ['Health & safety', 'ISO-aligned'], ['Public liability', '$20m'], ['Personal accident & income protection', 'In place'], ['Police-checked cleaners', 'All sites']].map(([k, v], i, arr) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: i < arr.length - 1 ? '1px solid #EEF2F6' : undefined, paddingBottom: i < arr.length - 1 ? 11 : 0 }}>
                    <span style={{ fontSize: 13, color: '#334155' }}>{k}</span><span style={{ fontFamily: MONO, fontSize: 11.5, color: NAVY }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 22, background: '#F8FAFC', border: '1px solid #EEF2F6', borderRadius: 10, padding: '16px 18px' }}>
                <div style={{ fontSize: 12.5, lineHeight: 1.55, color: '#64748B' }}>Certificates of currency and Safety Data Sheets are available on request at any time.</div>
              </div>
            </div>
          </div>
        </div>
        <Foot left="Delta Cleaning · Capability Statement" n="01" />
      </section>

      {/* ── 2 · Sectors + approach + env/H&S ── */}
      <section data-sheet style={{ ...page, padding: '60px 64px', boxShadow: '0 8px 40px rgba(15,23,42,.10)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 18, borderBottom: '1px solid #E2E8F0' }}>
          <img src={WORDMARK_BLACK} alt="Delta Cleaning" style={{ height: 20, width: 'auto' }} />
          <div style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: 600, letterSpacing: '.12em', color: '#94A3B8', textTransform: 'uppercase' }}>Sectors &amp; Approach</div>
        </div>
        <div style={{ marginTop: 36 }}>
          <div style={eyebrow}>Sectors we serve</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            <SectorCard t="Corporate offices" d="Workspaces, reception and shared floors kept presentation-ready." />
            <SectorCard t="Medical & healthcare" d="Clinics and practices held to strict hygiene standards." />
            <SectorCard t="Warehouse & industrial" d="Large-floor and back-of-house environments cleaned safely." />
            <SectorCard t="Retail & shopping villages" d="Common areas and entries kept clean through trading hours." />
            <SectorCard t="Shared residential" d="Lobbies, lifts and common areas for body corporates." />
            <SectorCard t="Facility-managed sites" d="Reliable subcontract partner for FM providers and portfolios." />
          </div>
        </div>
        <div style={{ marginTop: 34 }}>
          <div style={eyebrow}>How we work</div>
          <h2 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 28, lineHeight: 1.06, letterSpacing: '-.025em', margin: '0 0 8px' }}>A clean handover, then a standard that holds.</h2>
          <p style={{ fontSize: 13.6, lineHeight: 1.65, color: '#475569', margin: '0 0 20px', maxWidth: 640 }}>Every engagement follows the same proven path, so taking us on is low-risk and the transition is smooth from day one.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {[['01', 'Assess', 'Site walkthrough with the owner to scope your needs and risks.', false],
              ['02', 'Mobilise', 'Dedicated cleaners assigned, inducted and set up on your site.', false],
              ['03', 'Deliver', 'Scheduled cleans run by an on-site supervisor, tracked and time-stamped in the portal.', false],
              ['04', 'Review', 'Audits and check-ins with the owner keep the standard honest.', true]].map(([n, t, d, dark]) => (
              <div key={n as string} style={{ background: dark ? NAVY : '#F8FAFC', border: dark ? undefined : '1px solid #EEF2F6', borderRadius: 10, padding: 18, color: dark ? '#fff' : undefined }}>
                <div style={{ fontFamily: MONO, fontSize: 11, color: dark ? '#7C8BA1' : '#94A3B8', marginBottom: 10 }}>{n}</div>
                <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 14, marginBottom: 5 }}>{t}</div>
                <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: dark ? '#94A3B8' : '#64748B' }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 30, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ border: '1px solid #EEF2F6', borderRadius: 12, padding: '22px 24px' }}>
            <div style={{ ...eyebrow, fontSize: 10.5, marginBottom: 10 }}>Environmental commitment</div>
            <p style={{ margin: 0, fontSize: 12.6, lineHeight: 1.6, color: '#64748B' }}>In line with ISO 14001 principles we favour low-tox, environmentally responsible products, concentrate dosing to cut waste, and manage recycling streams on site.</p>
          </div>
          <div style={{ border: '1px solid #EEF2F6', borderRadius: 12, padding: '22px 24px' }}>
            <div style={{ ...eyebrow, fontSize: 10.5, marginBottom: 10 }}>Health &amp; safety</div>
            <p style={{ margin: 0, fontSize: 12.6, lineHeight: 1.6, color: '#64748B' }}>Following ISO 45001 principles we work to Safe Work Method Statements, site risk assessments and incident reporting. All cleaners are inducted, police-checked and trained in safe chemical handling.</p>
          </div>
        </div>
        <Foot left="Delta Cleaning · Capability Statement" n="02" />
      </section>

      {/* ── 3 · Services + differentiators + testimonials + contact ── */}
      <section data-sheet style={{ ...page, padding: '60px 64px', boxShadow: '0 8px 40px rgba(15,23,42,.10)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 18, borderBottom: '1px solid #E2E8F0' }}>
          <img src={WORDMARK_BLACK} alt="Delta Cleaning" style={{ height: 20, width: 'auto' }} />
          <div style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: 600, letterSpacing: '.12em', color: '#94A3B8', textTransform: 'uppercase' }}>Capabilities &amp; Contact</div>
        </div>
        <div style={{ marginTop: 34 }}>
          <div style={eyebrow}>What we deliver</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 36px' }}>
            <div>
              <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: NAVY, borderBottom: `2px solid ${NAVY}`, paddingBottom: 8, marginBottom: 12 }}>Routine contract cleaning</div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                {['Daily, nightly and scheduled cleans', 'Office, washroom, kitchen and common areas', 'Consumable restocking and management', 'Touch-point sanitisation programs', 'Waste and recycling management'].map(bullet)}
              </ul>
            </div>
            <div>
              <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: NAVY, borderBottom: `2px solid ${NAVY}`, paddingBottom: 8, marginBottom: 12 }}>Windows &amp; floor care</div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                {['Window cleaning: internal & external glass, plus high dusting', 'Floor care plans for carpet, vinyl & concrete, built by our specialist', 'Carpet steam extraction & deep cleans', 'Vinyl strip, seal & polish; concrete pressure washing', 'Post-fit-out & post-event detail cleans'].map(bullet)}
              </ul>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 30 }}>
          <div style={eyebrow}>Why clients choose Delta</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[['01', 'Owner-led accountability', 'The owner knows your site and stays your point of contact.'],
              ['02', 'Zero cleaner churn', 'The same vetted crew returns, so the standard is never relearned.'],
              ['03', 'Full transparency', 'Every clean tracked in your portal, with photos and reports.'],
              ['04', 'Insured & compliant', '$20m public liability cover and safe-work practices on every site.']].map(([n, t, d]) => (
              <div key={n} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', borderTop: `2px solid ${NAVY}`, paddingTop: 13 }}>
                <div style={{ fontFamily: MONO, fontSize: 12, color: NAVY }}>{n}</div>
                <div><div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 3 }}>{t}</div><p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: '#64748B' }}>{d}</p></div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 28, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[[data.testimonial, data.testimonialAuthor], [data.testimonial2, data.testimonial2Author]].map(([q, a], i) => (
            <div key={i} style={{ border: '1px solid #EEF2F6', borderRadius: 12, padding: '20px 22px' }}>
              <div style={{ fontFamily: DISPLAY, fontSize: 24, color: NAVY, lineHeight: 0, height: 13 }}>&ldquo;</div>
              <p style={{ margin: '8px 0 12px', fontSize: 12.6, lineHeight: 1.58, color: '#334155' }}>{q}</p>
              <div style={{ fontWeight: 600, fontSize: 12 }}>{a}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 26, background: NAVY, borderRadius: 12, padding: '26px 30px', color: '#fff', display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 30, alignItems: 'end' }}>
          <div>
            <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: '#7C8BA1', marginBottom: 12 }}>Get in touch</div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 19 }}>{data.contactName}</div>
            <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 10 }}>{data.contactRole}, Delta Cleaning</div>
            <div style={{ fontSize: 13.5, color: '#E2E8F0', lineHeight: 1.7 }}>{data.contactPhone}<br />{data.contactEmail}<br />{data.website}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: '#7C8BA1', marginBottom: 8 }}>Service area</div>
            <div style={{ fontSize: 13, color: '#94A3B8', lineHeight: 1.6 }}>Brisbane · Gold Coast · Ipswich<br />Logan · Redlands · Moreton Bay</div>
          </div>
        </div>
        <Foot left="Delta Cleaning · Brisbane QLD · deltacleaning.com.au" n="03" />
      </section>

    </div>
  )
}
