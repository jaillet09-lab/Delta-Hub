import { NextRequest, NextResponse } from 'next/server'
import { getXeroPL, getXeroInvoices, getXeroBills, getXeroBankSummary } from '@/lib/xero'

export const dynamic = 'force-dynamic'

type DataType = 'pl' | 'invoices' | 'bills' | 'summary'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') as DataType | null

  if (!type || !['pl', 'invoices', 'bills', 'summary'].includes(type)) {
    return NextResponse.json(
      { error: 'Missing or invalid ?type= parameter. Use: pl | invoices | bills | summary' },
      { status: 400 }
    )
  }

  try {
    switch (type) {
      case 'pl': {
        const months = parseInt(searchParams.get('months') ?? '3', 10)
        const data = await getXeroPL(isNaN(months) ? 3 : months)
        return NextResponse.json({ data })
      }

      case 'invoices': {
        const status = searchParams.get('status') ?? 'AUTHORISED,PAID'
        const data = await getXeroInvoices(status)
        return NextResponse.json({ data })
      }

      case 'bills': {
        const data = await getXeroBills()
        return NextResponse.json({ data })
      }

      case 'summary': {
        const data = await getXeroBankSummary()
        return NextResponse.json({ data })
      }
    }
  } catch (err: any) {
    const message = err?.message ?? 'Unknown error'

    // Detect not-connected state specifically
    if (message.includes('no valid tokens')) {
      return NextResponse.json({ error: 'xero_not_connected' }, { status: 401 })
    }

    console.error(`Xero data route [${type}] error:`, err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
