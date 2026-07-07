# Set this hub up as your own — hand this file to Claude

**If you're the business owner:** open this project in **Claude Code** (or any AI coding
assistant that can read and edit these files) and paste in: *"Read SETUP-WITH-CLAUDE.md
and walk me through it."* Claude will do the technical work and ask you for the details
it needs. You don't need to be technical.

**If you're Claude:** everything below is your brief. Work through it with the user one
step at a time. Explain plainly, do the technical parts yourself, confirm each step is
done before moving to the next, and ask for the specific inputs when you reach them.

---

## Ground rules (do not break these)

1. **This is a brand-new, separate copy.** It must run entirely on **the user's own
   accounts** — their Supabase, Vercel, Resend, and domain. Never ask for, use, or reuse
   the original owner's API keys, secrets, or data. The user creates their own.
2. **Secrets never get committed.** They live in `.env.local` and in the Vercel dashboard
   only. If you ever see real keys in a file that would be committed, stop and fix it.
3. **Compliance documents are legal, not branding.** The SWMS, policies, Modern Slavery
   declaration, and the service/subcontractor agreements in `src/lib/documents/` were
   written and signed by the original owner. The user must supply their **own** versions,
   reviewed for their business. Do **not** just swap the name — tell the user this clearly.

---

## What this app is (context for you)

A commercial-cleaning operations hub: **Next.js 14 (App Router) + Supabase
(Postgres + auth) + Vercel hosting + Resend (email) + web push**. It has four portals —
admin (owner), manager, cleaner, and client — plus cold-call/lead tools, proposals &
e-signing, QA inspections, a safety/compliance library, and financials. Database schema
is defined by the SQL files in `supabase/migrations/`.

---

## The setup, step by step (guide the user through each)

### 1. Create the accounts (all theirs, all billed to them)
- **Supabase** — a new project (free tier is fine to start).
- **Vercel** — an account (real business use should be on Pro, ~US$20/mo).
- **Resend** — an account, and **verify their own sending domain**.
- **A domain** — e.g. `portal.theirbusiness.com.au`.
Confirm each is done before continuing.

### 2. Get the code
Have them **fork** the original repo on GitHub (so they can pull future updates — see
"Receiving updates" below), then clone their fork locally. Run `npm install`.

### 3. Build the database
Apply **every** file in `supabase/migrations/`, in filename order, to their Supabase
project (Supabase Dashboard → SQL Editor, or the Supabase CLI). This creates the schema
with **none** of the original owner's data.

### 4. Set environment variables
Copy `.env.example` → `.env.local` and fill in **their** keys. Walk them through getting
each one (Supabase API settings, Resend key, generate fresh VAPID keys with
`npx web-push generate-vapid-keys`, etc.). Then set the identical variables in Vercel →
Settings → Environment Variables. The full list with explanations is in `.env.example`.

### 5. Rebrand it
Collect the user's details (ask for the list under "Branding details" below), then:
- Update **`src/config/brand.ts`** — the single list of all identity/contact/colour/logo values.
- Replace the hardcoded values still in the app (see "What to change" below).
- Replace the logo image files in `/public` (keep the same filenames).

### 6. Replace the compliance documents
Remind the user (per ground rule 3) to provide their own reviewed SWMS, policies, and
agreements in `src/lib/documents/`. Help them slot in their content once they have it.

### 7. Create the first admin login
In Supabase → Authentication, create their user and set `role: admin` in the user's
metadata so they can access the admin portal.

### 8. Deploy
Connect their fork to Vercel, add their domain, and deploy. Then verify: they can log in,
and a **test email sends from their own domain**.

---

## Branding details to collect from the user

- Business name + legal/registered name + ABN (or local equivalent)
- Owner name + role (e.g. Director)
- Contact email, phone, website, business location/city
- The portal domain they'll deploy to
- Brand colours (there are two: a dark "ink" and an accent — defaults are navy)
- Logo files: a white wordmark, a dark wordmark, an app icon/favicon (ask them to supply
  these; help resize/place them in `/public`)

## What to change (branding inventory)

Start in `src/config/brand.ts`. The same values are also hardcoded around the app — find
and replace them (or wire them to `BRAND.*`):

| Value | Approx. files |
|-------|--------------|
| "Delta Cleaning" | ~47 |
| `deltacleaning.com.au` | ~27 |
| ABN `83 303 026 478` | 4 |
| Phone `0412 844 238` | 8 |
| Accent colours `#1e3a5f` / `#0b1320` | ~54 / ~13 |
| Insurance policy no. `SPD015763734` | 1 |

Logos in `/public`: `logo-mark-white.png`, `logo-white.png`, `logo-black.png`,
`favicon.png`, `proposal-assets/wordmark-white.png`, `proposal-assets/wordmark-black.png`,
and the PWA icons `icon-192.png` / `icon-512.png` / `apple-touch-icon.png`.

## Environment variables

Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY`,
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`.
Optional: `PDFSHIFT_API_KEY` (PDF attachments), `ANTHROPIC_API_KEY` (AI helpers),
`XERO_CLIENT_ID` / `XERO_CLIENT_SECRET` / `XERO_REDIRECT_URI` (Xero). See `.env.example`.

---

## Receiving updates from the original later

The user's copy is a **fork**, so they can pull the original owner's improvements:
1. On their fork's GitHub page, click **"Sync fork" → Update branch**.
2. If the update added a new file in `supabase/migrations/`, apply that one migration to
   their Supabase.
3. Their Vercel auto-deploys the result.

This stays conflict-free **as long as their changes are limited to `brand.ts`, the logo
files, their compliance docs, and env.** If they edit core app code, warn them that future
updates may need manual conflict resolution — keep custom changes in their own new files
where possible.

---

## When you're done, confirm with the user

- [ ] They can log in to the admin portal on their own domain.
- [ ] A test email arrives, sent **from their domain**.
- [ ] Their branding (name, logo, colours) shows correctly.
- [ ] Their own compliance documents are in place (not the original owner's).
