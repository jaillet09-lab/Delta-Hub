-- Migration 024 — drop the unused, overly-permissive anon INSERT policy on surveys.
-- Public submission uses the submit_survey() SECURITY DEFINER function (bypasses RLS),
-- so anon never needs direct table-insert. Already applied to prod via connector.

drop policy if exists anon_insert_surveys on public.surveys;
