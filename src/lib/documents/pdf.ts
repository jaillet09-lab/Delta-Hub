import 'server-only'
import type { ReactElement } from 'react'

// Render a document React element to a real A4 PDF.
//
// Serverless Chrome (puppeteer + @sparticuz/chromium) does NOT work on Vercel's
// runtime — it lacks libnss3 and the chromium packs don't ship it. We therefore
// render via a hosted HTML→PDF service (PDFShift), reusing the exact same HTML
// so the documents stay pixel-perfect. Configure PDFSHIFT_API_KEY in Vercel.

const FONTS = 'https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600;700&family=Hanken+Grotesk:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap'

function buildHtml(body: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://portal.deltacleaning.com.au'
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<base href="${appUrl}/">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONTS}" rel="stylesheet">
<style>
  *{box-sizing:border-box;} html,body{margin:0;padding:0;background:#fff;}
  body{font-family:'Hanken Grotesk',system-ui,sans-serif;-webkit-font-smoothing:antialiased;}
  @page{size:A4;margin:0;}
  [data-doc-root]{display:flex;flex-direction:column;align-items:center;gap:0 !important;}
  [data-sheet]{box-shadow:none !important;break-after:page;page-break-after:always;}
  [data-sheet]:last-child{break-after:auto;page-break-after:auto;}
  html{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
</style></head><body>${body}</body></html>`
}

export async function renderDocumentPdf(node: ReactElement): Promise<Buffer> {
  const { renderToStaticMarkup } = await import('react-dom/server')
  const html = buildHtml(renderToStaticMarkup(node))

  const key = process.env.PDFSHIFT_API_KEY
  if (!key) {
    throw new Error('PDF service is not configured yet. Add PDFSHIFT_API_KEY in the project settings.')
  }

  const res = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from('api:' + key).toString('base64'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source: html,
      use_print: true,   // honour the @page / print CSS
      format: 'A4',
      margin: '0',
      delay: 600,        // give web fonts a moment to load
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`PDF render failed (${res.status}): ${detail.slice(0, 200)}`)
  }
  return Buffer.from(await res.arrayBuffer())
}
