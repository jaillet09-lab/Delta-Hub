import Image from 'next/image'
import { SurveyForm } from './SurveyForm'
import { createServerClient } from '@supabase/ssr'

export const dynamic = 'force-dynamic'

export default async function SurveyPage({ params }: { params: { token: string } }) {
  // Use anon client to look up token (no auth required for public survey)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: () => undefined, set: () => {}, remove: () => {} } }
  )
  const db = supabase as any

  const { data: tokenRow } = await db
    .from('survey_tokens')
    .select('id, client_id, submitted_at, clients(business_name, contact_name)')
    .eq('token', params.token)
    .single()

  if (!tokenRow) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ textAlign: 'center', maxWidth: 400, padding: '0 24px' }}>
          <p style={{ fontSize: 48, marginBottom: 16 }}>🔍</p>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', marginBottom: 8 }}>Survey not found</h1>
          <p style={{ fontSize: 15, color: '#666' }}>This link is invalid or has expired. Please contact Delta Cleaning if you believe this is an error.</p>
        </div>
      </div>
    )
  }

  if (tokenRow.submitted_at) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ textAlign: 'center', maxWidth: 400, padding: '0 24px' }}>
          <p style={{ fontSize: 48, marginBottom: 16 }}>✅</p>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', marginBottom: 8 }}>Already submitted</h1>
          <p style={{ fontSize: 15, color: '#666' }}>We've already received your survey response. Thank you for your feedback!</p>
        </div>
      </div>
    )
  }

  const businessName = tokenRow.clients?.business_name || 'your business'
  const contactName = tokenRow.clients?.contact_name || ''

  return (
    <div style={{ minHeight: '100vh', background: '#f5f4f2', fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb', padding: '14px 24px' }}>
        <Image src="/logo-black.png" alt="Delta Cleaning" width={130} height={44} style={{ objectFit: 'contain', display: 'block' }} priority />
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '40px 24px 80px' }}>
        {/* Intro */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#111', marginBottom: 8, lineHeight: 1.2 }}>
            How are we going?
          </h1>
          <p style={{ fontSize: 15, color: '#666', margin: 0, lineHeight: 1.6 }}>
            {contactName ? `Hi ${contactName} — ` : ''}This quick survey helps us keep improving our service at {businessName}. It takes less than 2 minutes.
          </p>
        </div>

        <SurveyForm token={params.token} />
      </div>
    </div>
  )
}
