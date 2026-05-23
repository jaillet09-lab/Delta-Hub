import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = createClient()

  // Delete all xero token rows (singleton table)
  const { error } = await (supabase as any)
    .from('xero_tokens')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')

  if (error) {
    console.error('Xero disconnect error:', error)
    return NextResponse.redirect(
      new URL('/dashboard?xero=disconnect_error', request.url)
    )
  }

  return NextResponse.redirect(
    new URL('/dashboard?xero=disconnected', request.url)
  )
}
