-- Clients could not submit the feedback survey. Two overloaded submit_survey
-- functions existed — submit_survey(p_token text, …) and submit_survey(p_token uuid, …)
-- — so PostgREST could not choose between them ("could not choose the best
-- candidate function") and every RPC call failed. survey_tokens.token is uuid,
-- so the uuid overload is the correct one. Drop the stray text overload and keep
-- a single canonical uuid version (with the duplicate-token cleanup).

drop function if exists public.submit_survey(text, integer, integer, integer, integer, integer, text);

create or replace function public.submit_survey(
  p_token uuid, p_quality integer, p_reliability integer, p_communication integer,
  p_value integer, p_loyalty integer, p_comments text default null::text
) returns json language plpgsql security definer set search_path to 'public' as $function$
declare
  v_token record;
  v_survey_id uuid;
begin
  select id, client_id, submitted_at into v_token from survey_tokens where token = p_token;
  if not found then return json_build_object('error', 'Survey link is invalid or has expired.'); end if;
  if v_token.submitted_at is not null then return json_build_object('error', 'This survey has already been submitted.'); end if;

  insert into surveys (client_id, quality_score, reliability_score, communication_score, value_score, nps_score, comments, submitted_at)
  values (v_token.client_id, p_quality, p_reliability, p_communication, p_value, p_loyalty, p_comments, now())
  returning id into v_survey_id;

  update survey_tokens set submitted_at = now(), survey_id = v_survey_id where id = v_token.id;
  update survey_tokens set submitted_at = now() where client_id = v_token.client_id and submitted_at is null;

  return json_build_object('success', true);
end;
$function$;

grant execute on function public.submit_survey(uuid, integer, integer, integer, integer, integer, text) to anon, authenticated;
