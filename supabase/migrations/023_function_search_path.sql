-- Migration 023 — pin search_path on functions flagged by function_search_path_mutable.
-- All reference only public objects + built-ins; matches the already-hardened
-- submit_survey(uuid) overload. Already applied to prod via connector.

alter function public.compute_client_profit() set search_path = public;
alter function public.frequency_to_visits_per_month(frequency_type) set search_path = public;
alter function public.handle_updated_at() set search_path = public;
alter function public.submit_survey(text,integer,integer,integer,integer,integer,text) set search_path = public;
alter function public.sync_multisite_client_profit() set search_path = public;
alter function public.touch_proposal_doc_updated_at() set search_path = public;
