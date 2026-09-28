-- Phase 3 of the calling system: after a call is recorded it gets transcribed
-- (Deepgram) and analysed (Claude). If the prospect asked for more info to be
-- sent, we draft a follow-up email in the owner's voice and send it 5 minutes
-- after the call. These columns track that follow-up. Applied to prod via connector.

alter table public.calls add column if not exists follow_up_status text;         -- null | pending | sent | skipped | failed
alter table public.calls add column if not exists follow_up_scheduled_at timestamptz;
alter table public.calls add column if not exists follow_up_sent_at timestamptz;
alter table public.calls add column if not exists follow_up_subject text;
alter table public.calls add column if not exists follow_up_body text;
alter table public.calls add column if not exists follow_up_error text;
