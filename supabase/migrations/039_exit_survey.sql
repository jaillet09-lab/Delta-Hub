-- Off-boarding "exit" survey. A client who is leaving gets a short survey
-- (service, value, reason for leaving) — distinct from the ongoing "how are we
-- going" survey. survey_tokens/surveys carry a `kind` so one link pattern and
-- one table serve both; surveys also gets a `reason` for the exit answer.

alter table public.survey_tokens add column if not exists kind text not null default 'ongoing';
alter table public.surveys add column if not exists kind text not null default 'ongoing';
alter table public.surveys add column if not exists reason text;

create or replace function public.submit_exit_survey(
  p_token uuid, p_service integer, p_value integer, p_reason text, p_comments text default null
) returns json language plpgsql security definer set search_path to 'public' as $function$
declare
  v_token record;
  v_id uuid;
begin
  select id, client_id, submitted_at into v_token from survey_tokens where token = p_token;
  if not found then return json_build_object('error', 'This link is invalid or has expired.'); end if;
  if v_token.submitted_at is not null then return json_build_object('error', 'This has already been submitted.'); end if;

  insert into surveys (client_id, quality_score, value_score, reason, comments, kind, submitted_at)
  values (v_token.client_id, p_service, p_value, p_reason, p_comments, 'exit', now())
  returning id into v_id;

  update survey_tokens set submitted_at = now(), survey_id = v_id where id = v_token.id;
  update survey_tokens set submitted_at = now() where client_id = v_token.client_id and submitted_at is null;
  return json_build_object('success', true);
end;
$function$;

grant execute on function public.submit_exit_survey(uuid, integer, integer, text, text) to anon, authenticated;
