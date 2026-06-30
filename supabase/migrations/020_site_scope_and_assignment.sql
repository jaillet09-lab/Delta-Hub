-- Migration 020 — Per-site scope-of-works for multi-site clients.
-- Each client_site carries its own structured scope + clean days (different sites,
-- different cleaners, different scopes). Already applied to prod via connector.

alter table public.client_sites
  add column if not exists scope jsonb not null default '[]'::jsonb,
  add column if not exists clean_days text[] not null default '{}'::text[];

-- Let the cleaner assigned to the CLIENT read that client's sites (client-level coverage),
-- on top of site-level assignment / client-portal / staff access.
drop policy if exists cs_select on public.client_sites;
create policy cs_select on public.client_sites for select to authenticated using (
  app_user_role() in ('admin','manager')
  or client_id = app_linked_client_id()
  or assigned_cleaner_id = app_profile_id()
  or client_id in (select id from public.clients where assigned_cleaner_id = app_profile_id())
);
