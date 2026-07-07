// Plain, client-safe builders for the proposal / agreement send email. Kept out
// of any 'server-only' module so the Send modal can prefill an *editable* copy of
// exactly what will go out, and the API route can render the same text to HTML.
// One source of truth → the preview the owner edits and the email that sends can
// never drift apart.

// The standard Delta email sign-off. Plain text (one line each) so it reads the
// same in the editable box and in the sent email.
export const DELTA_EMAIL_SIGNATURE = [
  'Best Regards',
  'Jackson Jaillet',
  'Founder & Director, Delta Cleaning',
  '0412 844 238',
  'https://www.deltacleaning.com.au',
].join('\n')

// Pull the contact's first name from a proposal "attention" line, e.g.
// "Justine, Facilities Manager, Burnie Brae Ltd" → "Justine". Returns '' when the
// line is a generic role rather than a person, so the greeting falls back to "Hi,".
export function firstNameFromAttention(attention: string | null | undefined): string {
  const first = String(attention || '').split(',')[0].trim().split(/\s+/)[0] || ''
  const generic = ['', 'the', 'attn', 'attention', 'dear', 'to', 'facilities', 'facility', 'manager', 'owner', 'director', 'reception', 'admin']
  return generic.includes(first.toLowerCase()) ? '' : first
}

// Build the full default email body (greeting → sign-off) as plain text with blank
// lines between paragraphs. This is what prefills the editable box; the owner can
// tweak any of it before sending.
export function buildProposalEmailBody(opts: {
  firstName?: string | null
  clientName: string
  isAgreement: boolean
  attachCapability: boolean
}): string {
  const greeting = opts.firstName ? `Hi ${opts.firstName},` : 'Hi,'
  const intro = opts.isAgreement
    ? `Please find attached the service agreement for ${opts.clientName}. Have a read through, and once you're happy, you can sign and return it. Any questions at all, just reply here.`
    : `Thanks again for your time. Please find attached our cleaning proposal for ${opts.clientName}. Everything we discussed is in there, and I'm happy to talk through any part of it.`

  const paras = [greeting, intro]
  if (!opts.isAgreement && opts.attachCapability)
    paras.push(`I've also attached our capability statement so you have a bit more background on Delta Cleaning.`)
  paras.push(`You can also view our full compliance pack (insurances, SWMS and policies) here: portal.deltacleaning.com.au/compliance`)
  paras.push(`Whenever you're ready, just reply to this email.`)
  paras.push(DELTA_EMAIL_SIGNATURE)
  return paras.join('\n\n')
}
