-- Migration 022 — replace always-true write RLS policies with scoped ones.
-- Reads and the anon public-survey flow are left untouched. Already applied to prod
-- via connector and verified with RLS impersonation tests (cleaner can flag own jobs;
-- cleaners/clients blocked from staff writes; staff writes still allowed).

-- job_flags: cleaners create their own flags; only staff resolve/delete; reads scoped.
drop policy if exists portal_flags_all on public.job_flags;
create policy jf_select on public.job_flags for select to authenticated using (
  app_user_role() in ('admin','manager') or cleaner_id = app_profile_id());
create policy jf_insert on public.job_flags for insert to authenticated with check (
  app_user_role() in ('admin','manager') or cleaner_id = app_profile_id());
create policy jf_update on public.job_flags for update to authenticated
  using (app_user_role() in ('admin','manager'))
  with check (app_user_role() in ('admin','manager'));
create policy jf_delete on public.job_flags for delete to authenticated using (
  app_user_role() in ('admin','manager'));

-- sops: writes -> staff only (sops_select read policy kept as-is).
drop policy if exists sops_insert on public.sops;
drop policy if exists sops_update on public.sops;
drop policy if exists sops_delete on public.sops;
create policy sops_insert on public.sops for insert to authenticated with check (
  app_user_role() in ('admin','manager'));
create policy sops_update on public.sops for update to authenticated
  using (app_user_role() in ('admin','manager'))
  with check (app_user_role() in ('admin','manager'));
create policy sops_delete on public.sops for delete to authenticated using (
  app_user_role() in ('admin','manager'));

-- surveys: authenticated writes -> staff only (anon_insert_surveys + surveys_select kept).
drop policy if exists surveys_insert on public.surveys;
drop policy if exists surveys_update on public.surveys;
drop policy if exists surveys_delete on public.surveys;
create policy surveys_insert on public.surveys for insert to authenticated with check (
  app_user_role() in ('admin','manager'));
create policy surveys_update on public.surveys for update to authenticated
  using (app_user_role() in ('admin','manager'))
  with check (app_user_role() in ('admin','manager'));
create policy surveys_delete on public.surveys for delete to authenticated using (
  app_user_role() in ('admin','manager'));

-- survey_tokens: authenticated writes -> staff only (anon_select/anon_update/auth_select kept).
drop policy if exists auth_insert_survey_tokens on public.survey_tokens;
drop policy if exists auth_update_survey_tokens on public.survey_tokens;
create policy auth_insert_survey_tokens on public.survey_tokens for insert to authenticated with check (
  app_user_role() in ('admin','manager'));
create policy auth_update_survey_tokens on public.survey_tokens for update to authenticated
  using (app_user_role() in ('admin','manager'))
  with check (app_user_role() in ('admin','manager'));
create policy auth_delete_survey_tokens on public.survey_tokens for delete to authenticated using (
  app_user_role() in ('admin','manager'));
