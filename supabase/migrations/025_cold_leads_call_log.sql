-- Migration 025 — per-call summary timeline for the cold-call deck.
-- Each logged call appends { at, outcome, note } so reps can see the call history.
-- Already applied to prod via connector. cold_leads is service-role only (no RLS policies).

alter table public.cold_leads
  add column if not exists call_log jsonb not null default '[]'::jsonb;
