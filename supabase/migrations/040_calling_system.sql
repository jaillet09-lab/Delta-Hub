-- Calling system (Phase 1). One row per call, attached to a cold-call lead OR a
-- pipeline lead (never a client — clients use the owner's personal number).
-- Recording / transcript / summary / outcome fill in from Twilio + Deepgram +
-- Claude in later phases. RLS: admin/manager only.

create table if not exists public.calls (
  id            uuid primary key default gen_random_uuid(),
  cold_lead_id  uuid references public.cold_leads(id) on delete cascade,
  lead_id       uuid references public.leads(id) on delete cascade,
  direction     text not null check (direction in ('inbound','outbound')),
  from_number   text,
  to_number     text,
  twilio_call_sid text unique,
  started_at    timestamptz,
  ended_at      timestamptz,
  duration_seconds integer,
  recording_path text,            -- private storage path / Twilio recording SID (signed URLs only)
  transcript    text,
  summary       text,
  outcome       text,             -- booked_walkthrough / callback_requested / info_requested / follow_up / not_interested / no_answer / wrong_number
  next_step     text,
  details       jsonb,            -- { site_size, current_cleaner, frequency, budget, decision_maker }
  status        text not null default 'completed',   -- completed / processing / failed
  created_at    timestamptz not null default now(),
  constraint calls_one_subject check (num_nonnulls(cold_lead_id, lead_id) = 1)
);
create index if not exists calls_cold_lead_idx on public.calls(cold_lead_id, started_at desc);
create index if not exists calls_lead_idx on public.calls(lead_id, started_at desc);

alter table public.cold_leads add column if not exists last_called_at timestamptz;
alter table public.cold_leads add column if not exists call_count integer not null default 0;
alter table public.leads add column if not exists last_called_at timestamptz;
alter table public.leads add column if not exists call_count integer not null default 0;

alter table public.calls enable row level security;
drop policy if exists calls_admin_all on public.calls;
create policy calls_admin_all on public.calls for all to authenticated
  using (app_user_role() = any (array['admin','manager']))
  with check (app_user_role() = any (array['admin','manager']));
