'use client'

import { CapabilityDocument } from '@/components/documents/render/CapabilityDocument'
import { withCapabilityDefaults, type CapabilityData } from '@/lib/documents/capability'

// Print / PDF view of the capability statement — A4 page rules plus a screen-only
// download button. Same pattern as PrintProposal.
export function PrintCapability({ data }: { data?: Partial<CapabilityData> }) {
  const d = withCapabilityDefaults(data)
  return (
    <>
      <style>{`
        @page { size: A4; margin: 0; }
        html, body { margin: 0; padding: 0; background: #fff; }
        [data-doc-root] { gap: 0 !important; }
        [data-sheet] { box-shadow: none !important; }
        @media print {
          [data-screen-only] { display: none !important; }
          [data-sheet] { break-after: page; page-break-after: always; }
          [data-sheet]:last-child { break-after: auto; page-break-after: auto; }
          html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      <div data-screen-only style={{ position: 'fixed', top: 18, right: 18, zIndex: 60 }}>
        <button
          onClick={() => window.print()}
          style={{ fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: '.04em', background: '#0F172A', color: '#fff', border: 'none', borderRadius: 999, padding: '11px 22px', cursor: 'pointer', boxShadow: '0 6px 18px rgba(15,23,42,.28)' }}
        >
          Download PDF
        </button>
      </div>
      <CapabilityDocument data={d} />
    </>
  )
}
