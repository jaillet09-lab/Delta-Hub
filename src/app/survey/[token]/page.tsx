import Image from 'next/image'
import { SurveyForm } from './SurveyForm'
import { ExitSurveyForm } from './ExitSurveyForm'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function SurveyPage({ params }: { params: { token: string } }) {
  // Public survey: read the token server-side with the service role so the lookup
  // isn't affected by RLS/grants on survey_tokens or the embedded clients row.
  // Safe — this runs only on the server and is keyed by the secret token in the URL.
  const db = createAdminClient() as any

  const { data: tokenRow } = await db
    .from('survey_tokens')
    .select('id, client_id, submitted_at, kind, clients(business_name, contact_name)')
    .eq('token', params.token)
    .maybeSingle()

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
  const isExit = tokenRow.kind === 'exit'

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
            {isExit ? 'Before you go' : 'How are we going?'}
          </h1>
          <p style={{ fontSize: 15, color: '#666', margin: 0, lineHeight: 1.6 }}>
            {contactName ? `Hi ${contactName} — ` : ''}
            {isExit
              ? `we're sorry to see ${businessName} go. If you have a moment, three quick questions would really help us improve.`
              : `This quick survey helps us keep improving our service at ${businessName}. It takes less than 2 minutes.`}
          </p>
        </div>

        {isExit ? <ExitSurveyForm token={params.token} /> : <SurveyForm token={params.token} />}
      </div>
    </div>
  )
}
