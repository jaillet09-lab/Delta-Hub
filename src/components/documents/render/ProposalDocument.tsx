import type { CSSProperties } from 'react'
import type { ProposalData } from '@/lib/documents/proposal'

// ─── Faithful recreation of the Premium Proposal design (10 × A4 pages) ───────
// Renders the same component for the editor preview, the print route, and the
// server-side PDF. Pure presentational — all content comes from `data`.

const NAVY = '#0F172A'
const SANS = "'Hanken Grotesk', system-ui, sans-serif"
const DISPLAY = "'Schibsted Grotesk', system-ui, sans-serif"
const MONO = "'Space Mono', monospace"

const WORDMARK_BLACK = '/proposal-assets/wordmark-black.png'
const WORDMARK_WHITE = '/proposal-assets/wordmark-white.png'
const MARK_WHITE = '/proposal-assets/mark-white.png'

const page: CSSProperties = {
  position: 'relative', width: 794, minHeight: 1123, background: '#fff', color: NAVY,
  overflow: 'hidden', flexShrink: 0, padding: '66px 72px', fontFamily: SANS,
}
const navyPage: CSSProperties = { ...page, background: NAVY, color: '#fff', padding: 0 }
const eyebrow: CSSProperties = {
  fontFamily: SANS, fontSize: 11, fontWeight: 600, letterSpacing: '.14em',
  textTransform: 'uppercase', color: '#94A3B8', marginBottom: 16,
}

function Header({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 18, borderBottom: '1px solid #E2E8F0' }}>
      <img src={WORDMARK_BLACK} alt="Delta Cleaning" style={{ height: 20, width: 'auto' }} />
      <div style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: 600, letterSpacing: '.12em', color: '#94A3B8', textTransform: 'uppercase' }}>{label}</div>
    </div>
  )
}
function Footer({ n }: { n: string }) {
  return (
    <div style={{ position: 'absolute', left: 72, right: 72, bottom: 42, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: SANS, fontSize: 10.5, letterSpacing: '.06em', color: '#CBD5E1', textTransform: 'uppercase', borderTop: '1px solid #EEF2F6', paddingTop: 14 }}>
      <span>Delta Cleaning · Service Proposal</span>
      <span style={{ fontFamily: MONO }}>{n}</span>
    </div>
  )
}
function H2({ children, size = 38, max }: { children: React.ReactNode; size?: number; max?: number }) {
  return <h2 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: size, lineHeight: 1.06, letterSpacing: '-.025em', margin: 0, maxWidth: max }}>{children}</h2>
}
function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ fontSize: 13, lineHeight: 1.45, color: '#475569', paddingLeft: 16, position: 'relative' }}>
      <span style={{ position: 'absolute', left: 0, top: 7, width: 5, height: 5, background: NAVY, borderRadius: 1 }} />
      {children}
    </li>
  )
}
function Chip({ children, solid }: { children: React.ReactNode; solid?: boolean }) {
  return <span style={{ fontSize: 12.5, fontWeight: 500, border: '1px solid #CBD5E1', borderRadius: 999, padding: '6px 14px', color: '#334155', whiteSpace: 'nowrap', background: solid ? '#fff' : undefined }}>{children}</span>
}

export function ProposalDocument({ data }: { data: ProposalData }) {
  return (
    <div data-doc-root style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>

      {/* ── 1 · Cover ── */}
      <section data-sheet style={{ ...navyPage, boxShadow: '0 8px 40px rgba(15,23,42,.22)' }}>
        <img src={MARK_WHITE} alt="" style={{ position: 'absolute', right: -150, top: -110, width: 520, opacity: 0.05 }} />
        <img src={MARK_WHITE} alt="" style={{ position: 'absolute', left: -180, bottom: -200, width: 560, opacity: 0.04 }} />
        <div style={{ position: 'relative', padding: '66px 72px', display: 'flex', flexDirection: 'column', minHeight: 1123 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <img src={WORDMARK_WHITE} alt="Delta Cleaning" style={{ height: 30, width: 'auto' }} />
            <div style={{ textAlign: 'right', fontFamily: MONO, fontSize: 11, letterSpacing: '.14em', color: '#64748B', lineHeight: 1.9 }}>
              <div>REFERENCE</div><div style={{ color: '#E2E8F0' }}>{data.refNumber}</div>
            </div>
          </div>
          <div style={{ marginTop: 'auto' }}>
            <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, letterSpacing: '.2em', textTransform: 'uppercase', color: '#7C8BA1', marginBottom: 24 }}>Commercial Cleaning</div>
            <h1 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 78, lineHeight: 0.98, letterSpacing: '-.03em', margin: 0, color: '#fff' }}>Service<br />Proposal</h1>
            <div style={{ width: 58, height: 2, background: 'rgba(255,255,255,.7)', margin: '38px 0 24px' }} />
            <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase', color: '#7C8BA1', marginBottom: 10 }}>Prepared for</div>
            <div style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 30, letterSpacing: '-.01em', color: '#fff' }}>{data.clientName}</div>
            <div style={{ fontSize: 15, color: '#94A3B8', marginTop: 6 }}>{data.siteAddress}</div>
          </div>
          <div style={{ marginTop: 62, paddingTop: 30, borderTop: '1px solid rgba(255,255,255,.12)', display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: 24 }}>
            <div><div style={{ ...eyebrow, fontSize: 10.5, color: '#64748B', marginBottom: 9 }}>Submitted by</div><div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{data.contactName}</div><div style={{ fontSize: 13, color: '#94A3B8' }}>{data.contactRole}, Delta Cleaning</div></div>
            <div><div style={{ ...eyebrow, fontSize: 10.5, color: '#64748B', marginBottom: 9 }}>Date</div><div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{data.issueDate || '—'}</div></div>
            <div><div style={{ ...eyebrow, fontSize: 10.5, color: '#64748B', marginBottom: 9 }}>Valid for</div><div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>30 days</div></div>
          </div>
        </div>
      </section>

      {/* ── 2 · Contents & about ── */}
      <section data-sheet style={page}>
        <Header label={data.refNumber} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, marginTop: 56 }}>
          <div>
            <div style={eyebrow}>About this proposal</div>
            <p style={{ fontSize: 15, lineHeight: 1.72, color: '#475569', margin: '0 0 16px' }}>I&apos;ve put this together for {data.clientName} after walking through your site myself. It covers how we&apos;d work together, what&apos;s included, the systems that keep things on track, and the investment involved.</p>
            <p style={{ fontSize: 15, lineHeight: 1.72, color: '#475569', margin: 0 }}>Anything still to be confirmed is noted clearly, and we&apos;ll settle it together before your first clean.</p>
            <div style={{ marginTop: 38, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div><div style={{ ...eyebrow, fontSize: 10.5, marginBottom: 5 }}>Prepared for</div><div style={{ fontSize: 15, fontWeight: 600 }}>{data.clientName}</div><div style={{ fontSize: 13.5, color: '#64748B' }}>{data.siteAddress}</div></div>
              <div><div style={{ ...eyebrow, fontSize: 10.5, marginBottom: 5 }}>Attention</div><div style={{ fontSize: 15, fontWeight: 600 }}>{data.attention}</div></div>
              <div><div style={{ ...eyebrow, fontSize: 10.5, marginBottom: 5 }}>Your contact</div><div style={{ fontSize: 15, fontWeight: 600 }}>{data.contactName}, {data.contactRole}</div><div style={{ fontSize: 13.5, color: '#64748B' }}>{data.contactPhone} · {data.contactEmail}</div></div>
            </div>
          </div>
          <div>
            <H2 size={32}>Contents</H2>
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 26 }}>
              {[
                ['01', 'From the Director', '03'], ['02', 'Why Delta Cleaning', '04'],
                ['03', 'Your Delta Portal', '05'], ['04', 'Scope of Services', '06'],
                ['05', 'Investment', '07'], ['06', 'What Our Clients Say', '08'],
                ['07', 'Terms & Next Steps', '09'],
              ].map(([n, label, pg], i, arr) => (
                <div key={n} style={{ display: 'flex', alignItems: 'baseline', gap: 14, padding: '15px 0', borderTop: '1px solid #E2E8F0', borderBottom: i === arr.length - 1 ? '1px solid #E2E8F0' : undefined }}>
                  <span style={{ fontFamily: MONO, fontSize: 12, color: NAVY, width: 24 }}>{n}</span>
                  <span style={{ fontSize: 15.5, fontWeight: 500, flex: 1 }}>{label}</span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: '#94A3B8' }}>{pg}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 32, background: '#F8FAFC', border: '1px solid #EEF2F6', borderRadius: 10, padding: '22px 24px' }}>
              <div style={{ ...eyebrow, fontSize: 10.5, marginBottom: 12 }}>Insured &amp; accredited</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {['ISO-aligned systems', '$20m Public Liability', 'Police-checked cleaners', 'Fully insured'].map(c => (
                  <span key={c} style={{ fontSize: 11.5, fontWeight: 500, border: '1px solid #CBD5E1', borderRadius: 999, padding: '5px 12px', color: '#334155', whiteSpace: 'nowrap' }}>{c}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
        <Footer n="02" />
      </section>

      {/* ── 3 · From the Director ── */}
      <section data-sheet style={page}>
        <Header label="01 · From the Director" />
        <div style={{ marginTop: 54, display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 48, alignItems: 'start' }}>
          <div>
            <div style={eyebrow}>A note from Jackson</div>
            <H2>I look after every<br />site personally.</H2>
            <div style={{ height: 30 }} />
            <p style={{ fontSize: 15, lineHeight: 1.74, color: '#475569', margin: '0 0 15px' }}>Dear {data.attention},</p>
            <p style={{ fontSize: 15, lineHeight: 1.74, color: '#475569', margin: '0 0 15px' }}>Thank you for having me through your site. I run Delta Cleaning personally, and I wanted to write this note myself so you know who you&apos;ll be working with.</p>
            <p style={{ fontSize: 15, lineHeight: 1.74, color: '#475569', margin: '0 0 15px' }}>I stay close to every part of the job. I handle the walkthrough, set up your team, and I&apos;m the person you reach if anything ever needs attention. After your first clean I check in to make sure it&apos;s right, and I keep in touch regularly once we&apos;re up and running.</p>
            <p style={{ fontSize: 15, lineHeight: 1.74, color: '#475569', margin: '0 0 15px' }}>Behind that personal service sits a properly run business. We work to ISO-aligned systems, carry full insurance, and our people are trained and vetted. Every site also gets its own client portal, so you have clear visibility over each clean.</p>
            <p style={{ fontSize: 15, lineHeight: 1.74, color: '#475569', margin: '0 0 28px' }}>I&apos;d genuinely value the chance to look after {data.clientName}, and I&apos;m only ever a phone call away.</p>
            <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 22, color: NAVY }}>{data.contactName}</div>
            <div style={{ fontSize: 13.5, color: '#64748B', marginTop: 2 }}>{data.contactRole}, Delta Cleaning</div>
          </div>
          <div style={{ borderLeft: `2px solid ${NAVY}`, paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 26, marginTop: 42 }}>
            {[['Reliable', 'The same standard, the same team, every visit.'], ['Accountable', "If something isn't right, I sort it straight away."], ['Involved', 'You hear from me before, during and after.']].map(([t, d]) => (
              <div key={t}><div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 17 }}>{t}</div><div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.55, marginTop: 4 }}>{d}</div></div>
            ))}
          </div>
        </div>
        <Footer n="03" />
      </section>

      {/* ── 4 · Why Delta ── */}
      <section data-sheet style={page}>
        <Header label="02 · Why Delta" />
        <div style={{ marginTop: 52 }}>
          <div style={eyebrow}>Why Delta Cleaning</div>
          <H2 max={540}>Why clients stay with us.</H2>
        </div>
        <div style={{ marginTop: 42, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18 }}>
          {[['98%', 'Client retention'], ['5+', 'Years serving SEQ'], ['0%', 'Cleaner churn on site'], ['100%', 'Owner involvement']].map(([stat, label]) => (
            <div key={label} style={{ borderTop: `2px solid ${NAVY}`, paddingTop: 16 }}>
              <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 42, letterSpacing: '-.03em' }}>{stat}</div>
              <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 4, lineHeight: 1.4 }}>{label}</div>
            </div>
          ))}
        </div>
        <p style={{ margin: '38px 0 0', fontSize: 15, lineHeight: 1.72, color: '#475569', maxWidth: 640 }}>Clients stay with us because the standard holds, the cleaners don&apos;t change, and they always know who to call. Delta is owner led, so the person who quotes your site is the same person looking after it long after the work begins.</p>
        <div style={{ marginTop: 30, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
          {[['Reliable', 'The same standard on every visit, with a team that knows your site.'], ['Accountable', 'If something needs attention, we put it right at the next clean.'], ['Involved', 'Jackson stays in touch personally, before, during and after the work starts.']].map(([t, d]) => (
            <div key={t} style={{ background: '#F8FAFC', border: '1px solid #EEF2F6', borderTop: `3px solid ${NAVY}`, borderRadius: 10, padding: 24 }}>
              <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 18, marginBottom: 8 }}>{t}</div>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: '#64748B' }}>{d}</p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 26, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '24px 28px' }}>
          <div style={{ ...eyebrow, fontSize: 10.5, marginBottom: 14 }}>Industries we know</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {['Warehouse & industrial', 'Corporate offices', 'Medical centres & healthcare', 'Shopping villages', 'Shared residential & common areas', 'Facility-managed sites'].map(c => <Chip key={c}>{c}</Chip>)}
          </div>
        </div>
        <div style={{ marginTop: 18, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '24px 28px' }}>
          <div style={{ ...eyebrow, fontSize: 10.5, marginBottom: 8 }}>Where we work</div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: '#475569' }}>We&apos;re based in Brisbane and able to service sites across the Gold Coast, Ipswich, Logan, Redlands and Moreton Bay. If your facility sits anywhere in the region, we can look after it.</p>
        </div>
        <Footer n="04" />
      </section>

      {/* ── 5 · Your Delta Portal ── */}
      <section data-sheet style={page}>
        <Header label="03 · Your Delta Portal" />
        <div style={{ marginTop: 52 }}>
          <div style={eyebrow}>Full visibility</div>
          <H2 max={560}>Your own cleaning portal.</H2>
          <p style={{ margin: '20px 0 0', fontSize: 15, lineHeight: 1.7, color: '#475569', maxWidth: 640 }}>Every {data.clientName} site comes with access to the Delta client portal. It&apos;s where the whole service lives, so you&apos;re never left guessing what was done, or when.</p>
        </div>
        <div style={{ marginTop: 40, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          {[['01', 'Every clean tracked', 'Each visit is logged and time stamped, with photo verification on periodic and detail tasks, so you can see what was completed.'],
            ['02', 'A real feedback loop', 'Raise a request or flag anything from the portal. It reaches us right away and is actioned at the next service.'],
            ['03', 'Clear monthly reports', 'A simple monthly summary of completed work, periodic tasks and anything raised, ready to share with your team.'],
            ['04', 'Always in the loop', 'The portal sits alongside a direct line to Jackson, so you&apos;re never far from an answer.']].map(([n, t, d]) => (
            <div key={n} style={{ border: '1px solid #EEF2F6', borderRadius: 12, padding: 26 }}>
              <div style={{ fontFamily: MONO, fontSize: 11, color: '#94A3B8', marginBottom: 14 }}>{n}</div>
              <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 17, marginBottom: 8 }}>{t}</div>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: '#64748B' }}>{d}</p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 22, background: NAVY, borderRadius: 12, padding: '30px 32px', color: '#fff' }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 19, marginBottom: 7 }}>Owner involved, every step</div>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.62, color: '#94A3B8', maxWidth: 600 }}>From the first walkthrough, to the check in after your opening clean, to every month after, Jackson stays personally across your account. The portal keeps it transparent, and the phone stays answered.</p>
        </div>
        <Footer n="05" />
      </section>

      {/* ── 6 · Scope of Services (editable) ── */}
      <section data-sheet style={page}>
        <Header label="04 · Scope of Services" />
        <div style={{ marginTop: 48 }}>
          <div style={eyebrow}>What&apos;s included</div>
          <H2 size={36}>Scope of services.</H2>
          <p style={{ margin: '16px 0 0', fontSize: 14, lineHeight: 1.65, color: '#475569', maxWidth: 640 }}>These inclusions apply to every scheduled visit at {data.siteAddress}, performed {data.frequency}. We confirmed this scope during the site walkthrough, and it can be tailored as your needs change.</p>
        </div>
        <div style={{ marginTop: 30, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 40px' }}>
          {data.scopeGroups.map((g, i) => (
            <div key={i}>
              <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: NAVY, borderBottom: `2px solid ${NAVY}`, paddingBottom: 8, marginBottom: 12 }}>{g.title}</div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                {g.items.map((it, j) => <Bullet key={j}>{it}</Bullet>)}
              </ul>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 26, background: '#F8FAFC', border: '1px solid #EEF2F6', borderRadius: 12, padding: '22px 26px' }}>
          <div style={{ ...eyebrow, fontSize: 10.5, marginBottom: 12 }}>Available on request, quoted separately</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {data.additionalServices.map((s, i) => <Chip key={i} solid>{s}</Chip>)}
          </div>
        </div>
        <Footer n="06" />
      </section>

      {/* ── 7 · Investment (editable pricing) ── */}
      <section data-sheet style={page}>
        <Header label="05 · Investment" />
        <div style={{ marginTop: 52 }}>
          <div style={eyebrow}>Your investment</div>
          <H2 size={36}>Investment.</H2>
        </div>
        <div style={{ marginTop: 34, border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1.1fr 1.1fr 1fr', background: NAVY, color: '#fff', fontFamily: SANS, fontSize: 10.5, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase' }}>
            <div style={{ padding: '14px 22px' }}>Service</div><div style={{ padding: '14px 16px' }}>Frequency</div><div style={{ padding: '14px 16px' }}>Days</div><div style={{ padding: '14px 22px', textAlign: 'right' }}>Rate (ex GST)</div>
          </div>
          {data.pricingRows.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2.2fr 1.1fr 1.1fr 1fr', borderBottom: i < data.pricingRows.length - 1 ? '1px solid #EEF2F6' : undefined, alignItems: 'center' }}>
              <div style={{ padding: '18px 22px' }}><div style={{ fontWeight: 600, fontSize: 14.5 }}>{r.service}</div><div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{r.detail}</div></div>
              <div style={{ padding: '18px 16px', fontSize: 13.5, color: '#475569' }}>{r.frequency}</div>
              <div style={{ padding: '18px 16px', fontSize: 13.5, color: '#475569' }}>{r.days}</div>
              <div style={{ padding: '18px 22px', textAlign: 'right', fontFamily: MONO, fontSize: 13, color: NAVY }}>{r.rate}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 18, background: NAVY, borderRadius: 12, padding: '30px 34px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}>
          <div><div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase', color: '#7C8BA1', marginBottom: 6 }}>Total investment</div><div style={{ fontSize: 13.5, color: '#94A3B8' }}>Standard scheduled clean, excl. GST</div></div>
          <div style={{ textAlign: 'right' }}><div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 38, letterSpacing: '-.02em' }}>{data.monthlyInvestment}</div></div>
        </div>
        <div style={{ marginTop: 30, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div><div style={{ ...eyebrow, fontSize: 10, marginBottom: 8 }}>Products &amp; equipment</div><p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: '#64748B' }}>All cleaning products and equipment are supplied by Delta Cleaning. Safety Data Sheets are available on request at no additional cost.</p></div>
          <div><div style={{ ...eyebrow, fontSize: 10, marginBottom: 8 }}>Please note</div><p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: '#64748B' }}>Pricing is held for 30 days from issue. Any site specific requirements or hazards should be shared before we start.</p></div>
        </div>
        <Footer n="07" />
      </section>

      {/* ── 8 · Testimonials ── */}
      <section data-sheet style={page}>
        <Header label="06 · What Clients Say" />
        <div style={{ marginTop: 52 }}>
          <div style={eyebrow}>In their words</div>
          <H2 size={36}>What our clients say.</H2>
        </div>
        <div style={{ marginTop: 38, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          {[['Jackson has clear communication and frequently checks in to make sure we&apos;re getting the best service. We&apos;ve used Delta for around 12 months and would recommend them to other commercial sites.', 'Braden L.', 'Physiotherapy Clinic'],
            ['We&apos;ve engaged Delta for the past 8 months at our Banyo office and have been really impressed. Reliable, and a big improvement on the previous contractors.', 'Duncan K.', 'Office Manager'],
            ['Jackson and the team have cleaned our clinic since early 2025. They understand the hygiene standards a medical environment needs and consistently deliver. Communication is clear and quality is always high.', 'Keziah W.', 'Medical Clinic Manager'],
            ['Fantastic service, our office has never been cleaner. Jackson has been a pleasure to deal with and any extra requests are handled at our next clean. Highly recommend.', 'Ashleigh B.', 'Office Administrator']].map(([q, a, role], i) => (
            <div key={i} style={{ border: '1px solid #EEF2F6', borderRadius: 12, padding: 28 }}>
              <div style={{ fontFamily: DISPLAY, fontSize: 30, color: NAVY, lineHeight: 0, height: 18 }}>&ldquo;</div>
              <p style={{ margin: '6px 0 18px', fontSize: 14, lineHeight: 1.62, color: '#334155' }} dangerouslySetInnerHTML={{ __html: q }} />
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{a}</div>
              <div style={{ fontSize: 12, color: '#94A3B8' }}>{role}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 22, background: '#F8FAFC', border: '1px solid #EEF2F6', borderRadius: 12, padding: '26px 30px', display: 'flex', alignItems: 'center', gap: 30 }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 44, letterSpacing: '-.03em', color: NAVY }}>98%</div>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: '#475569' }}>of our clients stay with us year on year. The clearest sign that the standard we promise is the standard we keep.</div>
        </div>
        <Footer n="08" />
      </section>

      {/* ── 9 · Terms & Next Steps ── */}
      <section data-sheet style={page}>
        <Header label="07 · Terms & Next Steps" />
        <div style={{ marginTop: 46 }}>
          <div style={eyebrow}>Terms of engagement</div>
          <H2 size={34}>Terms &amp; next steps.</H2>
        </div>
        <div style={{ marginTop: 28, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          {[['Payment terms', 'Invoiced by email each service cycle, due within 7 days. A 10% late fee applies monthly to overdue invoices.'],
            ['Annual price review', "Reviewed annually in line with Queensland CPI, with a minimum 30 days' written notice of any change."],
            ['Cancellation', "Either party may end the agreement with 30 days' written notice after the initial term."],
            ['Site access', 'You provide safe, secure access. Keys, fobs or codes are arranged before we start.'],
            ['Products & equipment', 'All equipment and products supplied by Delta. SDS available on request at no cost.'],
            ['Confidentiality & insurance', 'All personnel are bound by confidentiality. $20m public liability and personal accident & income protection in place.']].map(([t, d]) => (
            <div key={t} style={{ borderTop: `2px solid ${NAVY}`, paddingTop: 14 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{t}</div>
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: '#64748B' }}>{d}</p>
            </div>
          ))}
        </div>
        <div style={{ ...eyebrow, marginTop: 36, marginBottom: 18 }}>How we get started</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div style={{ background: '#F8FAFC', border: '1px solid #EEF2F6', borderRadius: 12, padding: 24 }}><div style={{ fontFamily: MONO, fontSize: 11, color: '#94A3B8', marginBottom: 12 }}>Step 01</div><div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 16, marginBottom: 7 }}>Accept</div><p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: '#64748B' }}>Confirm by email and a formal Service Agreement is issued for your review.</p></div>
          <div style={{ background: '#F8FAFC', border: '1px solid #EEF2F6', borderRadius: 12, padding: 24 }}><div style={{ fontFamily: MONO, fontSize: 11, color: '#94A3B8', marginBottom: 12 }}>Step 02</div><div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 16, marginBottom: 7 }}>Agreement</div><p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: '#64748B' }}>Review and sign to formalise the engagement and confirm all terms.</p></div>
          <div style={{ background: NAVY, borderRadius: 12, padding: 24, color: '#fff' }}><div style={{ fontFamily: MONO, fontSize: 11, color: '#7C8BA1', marginBottom: 12 }}>Step 03</div><div style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 16, marginBottom: 7 }}>Commence</div><p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: '#94A3B8' }}>Services begin on {data.startDate || 'the agreed date'}. {data.contactName} follows up after the first visit to confirm all is well.</p></div>
        </div>
        <div style={{ marginTop: 26, border: '1px dashed #CBD5E1', borderRadius: 10, padding: '18px 22px', fontSize: 12.5, lineHeight: 1.6, color: '#64748B' }}><strong style={{ color: NAVY }}>Proposal validity.</strong> This proposal is valid for {data.validity}. Pricing and availability may change after this period. A formal Service Agreement is issued on acceptance.</div>
        <Footer n="09" />
      </section>

      {/* ── 10 · Thank you ── */}
      <section data-sheet style={{ ...navyPage, boxShadow: '0 8px 40px rgba(15,23,42,.22)' }}>
        <img src={MARK_WHITE} alt="" style={{ position: 'absolute', left: -170, bottom: -190, width: 540, opacity: 0.05 }} />
        <div style={{ position: 'relative', padding: '66px 72px', display: 'flex', flexDirection: 'column', minHeight: 1123 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <img src={WORDMARK_WHITE} alt="Delta Cleaning" style={{ height: 24, width: 'auto' }} />
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.14em', color: '#64748B' }}>{data.refNumber}</div>
          </div>
          <div style={{ marginTop: 'auto' }}>
            <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, letterSpacing: '.2em', textTransform: 'uppercase', color: '#7C8BA1', marginBottom: 22 }}>Thank you</div>
            <h2 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 52, lineHeight: 1.02, letterSpacing: '-.03em', margin: 0 }}>I&apos;d be proud to look<br />after {data.clientName}.</h2>
            <p style={{ margin: '28px 0 0', fontSize: 16, lineHeight: 1.7, color: '#94A3B8', maxWidth: 520 }}>Thank you for considering Delta Cleaning. If you have any questions before deciding, just reach out. I&apos;d be glad to talk it through.</p>
          </div>
          <div style={{ marginTop: 62, paddingTop: 30, borderTop: '1px solid rgba(255,255,255,.12)', display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 24, alignItems: 'end' }}>
            <div><div style={{ ...eyebrow, fontSize: 10, color: '#64748B', marginBottom: 8 }}>Your contact</div><div style={{ fontSize: 17, fontWeight: 600, color: '#fff' }}>{data.contactName}</div><div style={{ fontSize: 13, color: '#94A3B8' }}>{data.contactRole}, Delta Cleaning</div></div>
            <div><div style={{ ...eyebrow, fontSize: 10, color: '#64748B', marginBottom: 8 }}>Phone</div><div style={{ fontSize: 15, color: '#fff' }}>{data.contactPhone}</div></div>
            <div><div style={{ ...eyebrow, fontSize: 10, color: '#64748B', marginBottom: 8 }}>Email</div><div style={{ fontSize: 15, color: '#fff' }}>{data.contactEmail}</div></div>
          </div>
          <div style={{ marginTop: 26, fontFamily: SANS, fontSize: 10, fontWeight: 500, letterSpacing: '.1em', textTransform: 'uppercase', color: '#475569' }}>Delta Cleaning · Brisbane QLD · Owner-led &amp; fully insured · deltacleaning.com.au</div>
        </div>
      </section>

    </div>
  )
}
