import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const XERO_TOKEN_URL      = 'https://identity.xero.com/connect/token'
const XERO_CONNECTIONS_URL = 'https://api.xero.com/connections'

function fail(request: NextRequest, reason: string) {
  console.error('[xero/callback] failed:', reason)
  return NextResponse.redirect(new URL(`/dashboard?xero=error&reason=${reason}`, request.url))
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code  = searchParams.get('code')
  const error = searchParams.get('error')

  console.log('[xero/callback] code:', !!code, 'error:', error)

  if (error) return fail(request, error)
  if (!code)  return fail(request, 'missing_code')

  const clientId     = process.env.XERO_CLIENT_ID!
  const clientSecret = process.env.XERO_CLIENT_SECRET!
  const redirectUri  = process.env.XERO_REDIRECT_URI!
  const credentials  = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  // Exchange code for tokens
  let tokenData: any
  try {
    const tokenRes = await fetch(XERO_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type:   'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })

    const body = await tokenRes.text()
    console.log('[xero/callback] token status:', tokenRes.status, body.slice(0, 300))

    if (!tokenRes.ok) return fail(request, 'token_exchange_failed')
    tokenData = JSON.parse(body)
  } catch (err) {
    console.error('[xero/callback] token fetch error:', err)
    return fail(request, 'network_error')
  }

  // Get tenant
  let tenant: { tenantId: string; tenantName: string } | null = null
  try {
    const connRes = await fetch(XERO_CONNECTIONS_URL, {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'Accept': 'application/json' },
    })
    console.log('[xero/callback] connections status:', connRes.status)
    if (connRes.ok) {
      const list: any[] = await connRes.json()
      console.log('[xero/callback] tenants found:', list.length)
      if (list[0]) tenant = { tenantId: list[0].tenantId, tenantName: list[0].tenantName ?? 'Delta Cleaning' }
    }
  } catch (err) {
    console.error('[xero/callback] connections error:', err)
  }

  if (!tenant) return fail(request, 'no_tenant')

  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000)

  // Save — delete existing row first, then insert fresh
  const supabase = createClient()
  await (supabase as any).from('xero_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  const { error: dbError } = await (supabase as any).from('xero_tokens').insert({
    tenant_id:     tenant.tenantId,
    tenant_name:   tenant.tenantName,
    access_token:  tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at:    expiresAt.toISOString(),
  })

  if (dbError) {
    console.error('[xero/callback] db error:', dbError)
    return fail(request, 'db_error')
  }

  console.log('[xero/callback] connected:', tenant.tenantName)
  return NextResponse.redirect(new URL('/dashboard?xero=connected', request.url))
}
