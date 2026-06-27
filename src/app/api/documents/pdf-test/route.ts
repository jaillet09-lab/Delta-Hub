import { NextResponse } from 'next/server'
import React from 'react'
import { renderDocumentPdf } from '@/lib/documents/pdf'

// TEMPORARY diagnostic: verifies headless Chrome can launch and produce a PDF
// on Vercel. Returns the byte size on success or the error. Remove after.
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET() {
  try {
    const el = React.createElement(
      'div',
      { 'data-sheet': true, style: { width: 794, minHeight: 1123, padding: 40, fontFamily: 'sans-serif' } },
      'PDF engine OK'
    )
    const pdf = await renderDocumentPdf(el as any)
    return NextResponse.json({ ok: true, bytes: pdf.length })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 })
  }
}
