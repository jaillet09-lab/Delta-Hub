import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token'
const XERO_CONNECTIONS_URL = 'https://api.xero.com/connections'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Handle user denying access
  if (error) {
    return NextResponse.redirect(
      new URL(`/dashboard?xero=error&reason=${encodeURIComponent(error)}`, request.url)
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/dashboard?xero=error&reason=missing_params', request.url)
    )
  }

  // Validate state (CSRF protection)
  const cookieStore = cookies()
  const storedState = cookieStore.get('xero_oauth_state')?.value

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      new URL('/dashboard?xero=error&reason=invalid_state', request.url)
    )
  }

  // Clear state cookie
  cookieStore.set('xero_oauth_state', '', { maxAge: 0, path: '/' })

  const clientId = process.env.XERO_CLIENT_ID!
  const clientSecret = process.env.XERO_CLIENT_SECRET!
  const redirectUri = process.env.XERO_REDIRECT_URI!
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

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
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenRes.ok) {
      const body = await tokenRes.text()
      console.error('Xero token exchange failed:', tokenRes.status, body)
      return NextResponse.redirect(
        new URL('/dashboard?xero=error&reason=token_exchange_failed', request.url)
      )
    }

    tokenData = await tokenRes.json()
  } catch (err) {
    console.error('Xero token exchange error:', err)
    return NextResponse.redirect(
      new URL('/dashboard?xero=error&reason=network_error', request.url)
    )
  }

  // Fetch tenant/connection list
  let tenant: { tenantId: string; tenantName: string } | null = null
  try {
    const connectionsRes = await fetch(XERO_CONNECTIONS_URL, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json',
      },
    })

    if (connectionsRes.ok) {
      const connections: any[] = await connectionsRes.json()
      const first = connections[0]
      if (first) {
        tenant = {
          tenantId: first.tenantId,
          tenantName: first.tenantName ?? null,
        }
      }
    }
  } catch (err) {
    console.error('Xero connections fetch error:', err)
    // Non-fatal — proceed without tenant name
  }

  if (!tenant) {
    return NextResponse.redirect(
      new URL('/dashboard?xero=error&reason=no_tenant', request.url)
    )
  }

  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000)

  // Upsert tokens — singleton table (unique index on true)
  const supabase = createClient()
  const { error: dbError } = await (supabase as any)
    .from('xero_tokens')
    .upsert(
      {
        tenant_id: tenant.tenantId,
        tenant_name: tenant.tenantName,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id', ignoreDuplicates: false }
    )

  // If upsert by id fails (no existing row), try a plain insert
  if (dbError) {
    // Delete existing and re-insert (singleton pattern)
    await (supabase as any).from('xero_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await (supabase as any).from('xero_tokens').insert({
      tenant_id: tenant.tenantId,
      tenant_name: tenant.tenantName,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: expiresAt.toISOString(),
    })
  }

  return NextResponse.redirect(
    new URL('/dashboard?xero=connected', request.url)
  )
}
