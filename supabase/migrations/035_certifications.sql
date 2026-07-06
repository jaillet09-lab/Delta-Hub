-- Certifications & insurance register. Tracks compliance documents (public
-- liability, workers comp, licences, police/WWC checks, training) with expiry
-- dates for reminders. Admin-only (service-role); files live in job-photos/certifications/.

create table if not exists public.certifications (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text not null default 'insurance',
  holder      text,
  issuer      text,
  reference   text,
  issue_date  date,
  expiry_date date,
  file_url    text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists certifications_expiry_idx on public.certifications (expiry_date);

alter table public.certifications enable row level security;
