import 'server-only'
import type { ReactElement } from 'react'

// Render a document React element to a real A4 PDF using headless Chrome.
// Self-contained (setContent, not navigation) so it doesn't depend on auth or
// the live route. Image src paths resolve against the app URL via <base>.

const FONTS = 'https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600;700&family=Hanken+Grotesk:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap'

export async function renderDocumentPdf(node: ReactElement): Promise<Buffer> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://portal.deltacleaning.com.au'
  // Dynamic import: Next.js disallows static react-dom/server imports in the app graph
  const { renderToStaticMarkup } = await import('react-dom/server')
  const body = renderToStaticMarkup(node)
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
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

  // Vercel serverless: chromium-min keeps the function small and downloads the
  // full Chrome pack (binary + shared libs) at runtime, which avoids the
  // size-limit stripping that breaks the bundled package (missing libnss3.so).
  const chromium = (await import('@sparticuz/chromium-min')).default
  const puppeteer = await import('puppeteer-core')

  const PACK = process.env.CHROMIUM_PACK_URL
    || 'https://github.com/Sparticuz/chromium/releases/download/v123.0.1/chromium-v123.0.1-pack.tar'

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 794, height: 1123 },
    executablePath: await chromium.executablePath(PACK),
    headless: true,
  })
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 })
    // make sure web fonts have finished loading before printing
    await page.evaluate(async () => { await (document as any).fonts?.ready })
    const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
