import 'server-only'

// DocuSign JWT (server-to-server) integration. Configure these env vars:
//   DOCUSIGN_INTEGRATION_KEY   — the app's integration key (client id)
//   DOCUSIGN_USER_ID           — the user to impersonate (API user GUID)
//   DOCUSIGN_ACCOUNT_ID        — the API account GUID
//   DOCUSIGN_RSA_PRIVATE_KEY   — the RSA private key PEM (newlines or \n escaped)
//   DOCUSIGN_OAUTH_BASE        — account-d.docusign.com (demo) | account.docusign.com (prod)
//   DOCUSIGN_API_BASE          — https://demo.docusign.net/restapi (demo) | prod base

function cfg() {
  return {
    integrationKey: process.env.DOCUSIGN_INTEGRATION_KEY?.trim(),
    userId: process.env.DOCUSIGN_USER_ID?.trim(),
    accountId: process.env.DOCUSIGN_ACCOUNT_ID?.trim(),
    rsaKey: process.env.DOCUSIGN_RSA_PRIVATE_KEY?.replace(/\\n/g, '\n').trim(),
    oauthBase: (process.env.DOCUSIGN_OAUTH_BASE || 'account-d.docusign.com').trim(),
    apiBase: (process.env.DOCUSIGN_API_BASE || 'https://demo.docusign.net/restapi').trim(),
  }
}

export function isDocusignConfigured(): boolean {
  const c = cfg()
  return Boolean(c.integrationKey && c.userId && c.accountId && c.rsaKey)
}

export function consentUrl(): string {
  const c = cfg()
  const redirect = (process.env.NEXT_PUBLIC_APP_URL || 'https://portal.deltacleaning.com.au') + '/documents'
  return `https://${c.oauthBase}/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=${c.integrationKey}&redirect_uri=${encodeURIComponent(redirect)}`
}

async function getAccessToken(): Promise<{ token?: string; consentRequired?: boolean; error?: string }> {
  const c = cfg()
  if (!isDocusignConfigured()) return { error: 'DocuSign is not configured.' }

  const jwt = (await import('jsonwebtoken')).default
  const now = Math.floor(Date.now() / 1000)
  const assertion = jwt.sign(
    { iss: c.integrationKey, sub: c.userId, aud: c.oauthBase, iat: now, exp: now + 3000, scope: 'signature impersonation' },
    c.rsaKey as string,
    { algorithm: 'RS256' }
  )

  const res = await fetch(`https://${c.oauthBase}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })
  const json: any = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (json?.error === 'consent_required') return { consentRequired: true }
    return { error: json?.error_description || json?.error || `Auth failed (${res.status})` }
  }
  return { token: json.access_token }
}

interface EnvelopeInput {
  pdfBase64: string
  subject: string
  clientEmail: string
  clientName: string
  providerEmail: string
  providerName: string
  webhookUrl?: string
}

export async function createAgreementEnvelope(input: EnvelopeInput): Promise<{ envelopeId?: string; consentRequired?: boolean; error?: string }> {
  const c = cfg()
  const auth = await getAccessToken()
  if (auth.consentRequired) return { consentRequired: true }
  if (auth.error || !auth.token) return { error: auth.error || 'Could not authenticate with DocuSign.' }

  // Provider signs first, then the client. Tabs are anchored to invisible tokens
  // printed on the execution page of the agreement PDF.
  const envelope: any = {
    emailSubject: input.subject,
    documents: [{ documentBase64: input.pdfBase64, name: input.subject, fileExtension: 'pdf', documentId: '1' }],
    recipients: {
      signers: [
        {
          email: input.providerEmail, name: input.providerName, recipientId: '1', routingOrder: '1',
          tabs: {
            signHereTabs: [{ anchorString: 'DSPROVIDERSIGN', anchorUnits: 'pixels', anchorXOffset: '0', anchorYOffset: '-22' }],
            dateSignedTabs: [{ anchorString: 'DSPROVIDERDATE', anchorUnits: 'pixels', anchorXOffset: '0', anchorYOffset: '-4' }],
          },
        },
        {
          email: input.clientEmail, name: input.clientName, recipientId: '2', routingOrder: '2',
          tabs: {
            signHereTabs: [{ anchorString: 'DSCLIENTSIGN', anchorUnits: 'pixels', anchorXOffset: '0', anchorYOffset: '-22' }],
            dateSignedTabs: [{ anchorString: 'DSCLIENTDATE', anchorUnits: 'pixels', anchorXOffset: '0', anchorYOffset: '-4' }],
            fullNameTabs: [{ anchorString: 'DSCLIENTNAME', anchorUnits: 'pixels', anchorXOffset: '0', anchorYOffset: '-4' }],
          },
        },
      ],
    },
    status: 'sent',
  }

  if (input.webhookUrl) {
    envelope.eventNotification = {
      url: input.webhookUrl,
      loggingEnabled: 'true',
      requireAcknowledgment: 'true',
      envelopeEvents: [{ envelopeEventStatusCode: 'completed' }, { envelopeEventStatusCode: 'declined' }, { envelopeEventStatusCode: 'voided' }],
      includeDocuments: 'false',
    }
  }

  const res = await fetch(`${c.apiBase}/v2.1/accounts/${c.accountId}/envelopes`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(envelope),
  })
  const json: any = await res.json().catch(() => ({}))
  if (!res.ok) return { error: json?.message || `DocuSign envelope failed (${res.status})` }
  return { envelopeId: json.envelopeId }
}

// Download the completed (signed) PDF for an envelope.
export async function downloadSignedPdf(envelopeId: string): Promise<Buffer | null> {
  const c = cfg()
  const auth = await getAccessToken()
  if (!auth.token) return null
  const res = await fetch(`${c.apiBase}/v2.1/accounts/${c.accountId}/envelopes/${envelopeId}/documents/combined`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  })
  if (!res.ok) return null
  return Buffer.from(await res.arrayBuffer())
}
