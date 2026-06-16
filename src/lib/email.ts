import { Resend } from 'resend'

// ─── Generic email utility ────────────────────────────────────────────────────

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('RESEND_API_KEY not set, skipping email')
    return { success: false, error: 'Email not configured' }
  }
  try {
    const resend = new Resend(apiKey)
    const result = await resend.emails.send({
      from: 'Delta Cleaning <hello@deltacleaning.com.au>',
      reply_to: 'hello@deltacleaning.com.au',
      to,
      subject,
      html,
    })
    if (result.error) {
      console.error('Resend error:', result.error)
      return { success: false, error: result.error.message }
    }
    return { success: true }
  } catch (err: any) {
    console.error('Failed to send email:', err)
    return { success: false, error: err?.message ?? 'Email failed' }
  }
}

// ─── Document email ───────────────────────────────────────────────────────────

export async function sendDocumentEmail(
  to: string,
  clientName: string,
  documentTitle: string,
  documentId: string
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    // Email not configured — skip silently
    return { success: false, error: 'RESEND_API_KEY not configured' }
  }

  const resend = new Resend(apiKey)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  try {
    await resend.emails.send({
      from: 'Delta Cleaning <hello@deltacleaning.com.au>',
      reply_to: 'hello@deltacleaning.com.au',
      to,
      subject: `Document Ready: ${documentTitle}`,
      html: `
        <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background: #1e3a5f; padding: 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Δ Delta Cleaning</h1>
          </div>
          <div style="background: white; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; color: #374151;">Dear ${clientName},</p>
            <p style="font-size: 16px; color: #374151;">
              Please find your document ready for review:
            </p>
            <h2 style="font-size: 20px; color: #1e3a5f; margin: 24px 0 16px;">${documentTitle}</h2>
            <p style="font-size: 14px; color: #6b7280;">
              You can view and sign your document using the link below.
            </p>
            <div style="margin: 32px 0;">
              <a href="${appUrl}/documents/${documentId}"
                 style="background: #1e3a5f; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 16px; font-weight: 600;">
                View Document
              </a>
            </div>
            <p style="font-size: 14px; color: #6b7280;">
              If you have any questions, please don't hesitate to contact us.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
            <p style="font-size: 14px; color: #6b7280; margin: 0;">
              Delta Cleaning<br />
              Brisbane, QLD<br />
              Servicing Sunshine Coast to Gold Coast
            </p>
          </div>
        </div>
      `,
    })
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Email failed' }
  }
}
