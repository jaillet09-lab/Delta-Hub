# White-label handover guide

How to stand up your own copy of this hub, and how to keep receiving updates from
the original. Your copy runs on **your own accounts** — your data, your costs, and
your outages are fully separate from the original owner's.

> You need someone comfortable with basic dev tooling (or an AI coding assistant)
> to do the rebrand. It's a short to-do list, not a one-click install.

---

## 1. Accounts to create (all yours, all billed to you)

| Service | Why | Notes |
|--------|-----|-------|
| **Supabase** | Database + auth | New project. Free tier is fine to start. |
| **Vercel** | Hosting | Import the repo. Commercial use should be on Pro (~US$20/mo). |
| **Resend** | Sending email | Verify **your own** sending domain. |
| **A domain** | Portal URL | e.g. `portal.yourbusiness.com.au`. |

Never reuse the original owner's API keys — generate your own for everything.

---

## 2. First-time setup

1. **Get the code** — fork the repo (see §5 so you can pull updates later) or copy it into your own **private** repo.
2. **Install** — `npm install`.
3. **Database** — create a Supabase project, then apply everything in `supabase/migrations/` in order (Supabase SQL editor, or the CLI). This builds the schema with **none** of the original owner's data.
4. **Env** — copy `.env.example` → `.env.local`, fill in your own keys. Set the same keys in Vercel → Settings → Environment Variables.
5. **Deploy** — connect the repo to Vercel and add your domain.
6. **First admin user** — create your login in Supabase → Authentication, with `role: admin` in user metadata.

---

## 3. Rebrand (make it yours)

Start in **`src/config/brand.ts`** — every business detail is listed there.

Then replace the hardcoded values still scattered through the app. Current counts
(find-and-replace, or wire them to `BRAND.*`):

| Value | Approx. files |
|-------|--------------|
| "Delta Cleaning" | ~47 |
| `deltacleaning.com.au` | ~27 |
| ABN `83 303 026 478` | 4 |
| Phone `0412 844 238` | 8 |
| Navy accents `#1e3a5f` / `#0b1320` | ~54 / ~13 |
| Insurance policy `SPD015763734` | 1 |

**Logos** — replace the image files in `/public` (keep the same filenames):
`logo-mark-white.png`, `logo-white.png`, `logo-black.png`, `favicon.png`,
`proposal-assets/wordmark-white.png`, `proposal-assets/wordmark-black.png`, and the
`icon-192/512` / `apple-touch-icon` PWA icons.

---

## 4. Compliance documents — replace, don't rename ⚠️

The **SWMS, policies, Modern Slavery declaration, and the service/subcontractor
agreements** (in `src/lib/documents/`) are the original owner's, authored and
signed by them. These are legal documents. Get **your own** versions written and
reviewed for your business before you send anything. Renaming is not enough.

---

## 5. Receiving updates from the original hub

This is the payoff for keeping your changes inside `brand.ts` + `/public` + your
own compliance docs, and **not** editing the app logic: updates merge cleanly.

**Set it up once (fork model):**
1. Fork the original repo on GitHub (this keeps a link to the original, called
   "upstream").
2. Do all your rebranding in your fork.

**Each time the original owner ships an update:**
1. On your fork's GitHub page, click **"Sync fork"** → **Update branch**
   (or from the command line: `git fetch upstream && git merge upstream/master`).
2. Because you only changed `brand.ts`, logos, compliance docs, and env — not the
   app code — the merge usually applies with no conflicts.
3. **If the update added a database migration** (a new file in
   `supabase/migrations/`), apply that one new migration to your Supabase.
4. Your Vercel auto-deploys the merged result. Done.

**What breaks the clean-merge promise:** editing app logic/components directly. If
you customise beyond branding, keep those changes in your own new files where you
can, so upstream updates don't collide with them.

**Note:** syncing is always **your choice** — the original owner can't push to your
fork or your deploy. You pull updates when you want them.

---

## 6. Cost separation (the whole point)

Because every service is under your own login and billing, your usage never
touches the original owner's bills or limits, and neither instance can see or
affect the other's data. Two completely independent businesses running the same
software.
