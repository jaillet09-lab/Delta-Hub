-- Migration 021 — cover the schedule_completions.cleaner_id foreign key with an index
-- (flagged by the Supabase performance advisor). Already applied to prod via connector.

create index if not exists schedule_completions_cleaner_id_idx
  on public.schedule_completions (cleaner_id);
