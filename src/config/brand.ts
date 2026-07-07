// ─── BRAND CONTROL PANEL ─────────────────────────────────────────────────────
// White-labelling this hub? Change the values here first. This is the single
// source of truth for business identity. Anywhere the app still hardcodes a
// "Delta" value (see WHITE-LABEL.md for the file list), point it at BRAND.<x>.
//
// Nothing secret lives here — just public business details. Secrets go in .env
// (see .env.example). Legal documents (SWMS, policies, service agreement) are
// NOT branding: replace them with your own reviewed versions, don't just rename.

export const BRAND = {
  // Identity
  name:       'Delta Cleaning',
  legalName:  'Delta Cleaning Pty Ltd',
  abn:        '83 303 026 478',
  owner:      'Jackson Jaillet',
  ownerRole:  'Director',
  location:   'Brisbane, QLD',

  // Contact
  email:      'hello@deltacleaning.com.au',
  phone:      '0412 844 238',
  website:    'deltacleaning.com.au',
  websiteUrl: 'https://deltacleaning.com.au',

  // Portal (must match your deployed domain — also set NEXT_PUBLIC_APP_URL)
  appUrl:     'https://portal.deltacleaning.com.au',

  // Outbound email (the sending domain must be verified in Resend)
  emailFromName: 'Jackson at Delta Cleaning',
  emailFrom:     'Jackson at Delta Cleaning <hello@deltacleaning.com.au>',
  replyTo:       'hello@deltacleaning.com.au',

  // Compliance reference shown to clients (your own policy number)
  insurancePolicyNumber: 'SPD015763734',

  // Brand colours
  colors: {
    ink:  '#0b1320', // darkest navy — sidebars, dark surfaces
    navy: '#1e3a5f', // primary accent — buttons, active states
  },

  // Logo assets in /public — replace the files, keep the paths (or update here)
  logos: {
    markWhite:     '/logo-mark-white.png',
    logoWhite:     '/logo-white.png',
    logoBlack:     '/logo-black.png',
    wordmarkWhite: '/proposal-assets/wordmark-white.png',
    wordmarkBlack: '/proposal-assets/wordmark-black.png',
    favicon:       '/favicon.png',
  },
} as const

export type Brand = typeof BRAND
