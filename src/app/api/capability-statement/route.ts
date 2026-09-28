import { NextResponse } from 'next/server'
import React from 'react'
import { renderDocumentPdf } from '@/lib/documents/pdf'
import { CapabilityDocument } from '@/components/documents/render/CapabilityDocument'
import { DEFAULT_CAPABILITY } from '@/lib/documents/capability'

export const runtime = 'nodejs'
export const maxDuration = 60

// The Delta Cleaning capability statement as a real PDF — the exact file attached
// to call follow-ups and proposal emails, exposed so it can be viewed/downloaded.
// Its own path (not under /api/documents/[id]) to avoid the dynamic-route collision.
export async function GET() {
  try {
    const pdf = await renderDocumentPdf(React.createElement(CapabilityDocument, { data: DEFAULT_CAPABILITY as any }))
    return new NextResponse(pdf as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="Delta Cleaning Capability Statement.pdf"',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Could not render the capability statement' }, { status: 500 })
  }
}
