-- Record where a cleaner started a clean (best-effort GPS + distance from the
-- site). Captured for verification only — it never blocks the start.

alter table public.job_submissions
  add column if not exists start_lat        numeric,
  add column if not exists start_lng        numeric,
  add column if not exists start_distance_m integer;
