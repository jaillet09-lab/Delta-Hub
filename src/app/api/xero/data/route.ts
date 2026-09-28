import { NextRequest, NextResponse } from 'next/server'
import { getXeroTokens, getApprovedPL, getXeroAllTransactions, getXeroBankSummary, getSubcontractorPnl } from '@/lib/xero'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const tokens = await getXeroTokens()
  if (!tokens) {
    return NextResponse.json({ error: 'xero_not_connected' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const type = searchParams.get('type')

  try {
    switch (type) {
      case 'pl':
        return NextResponse.json(await getApprovedPL(3))
      case 'transactions':
        return NextResponse.json(await getXeroAllTransactions())
      case 'summary':
        return NextResponse.json(await getXeroBankSummary())
      case 'subcontractor': {
        const months = Number(searchParams.get('months')) || 6
        return NextResponse.json(await getSubcontractorPnl(months))
      }
      default:
        return NextResponse.json({ error: 'Unknown type. Use: pl | transactions | summary | subcontractor' }, { status: 400 })
    }
  } catch (err: any) {
    const message = err?.message ?? 'Unknown error'
    if (message.includes('no valid tokens')) {
      return NextResponse.json({ error: 'xero_not_connected' }, { status: 401 })
    }
    console.error(`Xero data [${type}] error:`, err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
