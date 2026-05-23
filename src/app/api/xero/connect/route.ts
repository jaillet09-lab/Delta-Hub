import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

const XERO_AUTH_URL = 'https://login.xero.com/identity/connect/authorize'

const SCOPES = [
  'openid',
  'profile',
  'email',
  'accounting.reports.read',
  'accounting.transactions',
  'accounting.settings',
  'offline_access',
].join(' ')

export async function GET() {
  const clientId = process.env.XERO_CLIENT_ID
  const redirectUri = process.env.XERO_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: 'Xero credentials not configured. Set XERO_CLIENT_ID and XERO_REDIRECT_URI.' },
      { status: 500 }
    )
  }

  // Generate a random nonce for CSRF protection
  const state = crypto.randomUUID()

  // Store state in cookie (httpOnly, short TTL)
  const cookieStore = cookies()
  cookieStore.set('xero_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600, // 10 minutes
    path: '/',
    sameSite: 'lax',
  })

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
  })

  const authorizeUrl = `${XERO_AUTH_URL}?${params}`

  return NextResponse.redirect(authorizeUrl)
}
