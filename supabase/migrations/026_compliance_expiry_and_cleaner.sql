-- Migration 026 — compliance monitoring.
-- Add an expiry date to compliance documents and let a document belong to a CLEANER
-- (profile) for staff compliance (insurance, police check, white card, qualification),
-- alongside the existing per-client / global documents. Already applied to prod via connector.

alter table public.compliance_documents
  add column if not exists expiry_date date,
  add column if not exists profile_id uuid references public.profiles(id) on delete cascade;

create index if not exists compliance_documents_expiry_idx on public.compliance_documents (expiry_date);
create index if not exists compliance_documents_profile_idx on public.compliance_documents (profile_id);
