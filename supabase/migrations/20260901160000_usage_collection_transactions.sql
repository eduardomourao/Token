begin;

-- The first hosted collector is intentionally single-owner. Provider credentials stay
-- in Edge Function secrets and are bound to the configured owner id; this private
-- table remains reserved for a later, separately designed multi-owner enrollment flow.
comment on table app.usage_monitor_credentials is
  'Reserved for future per-owner encrypted credentials. The first Gemini collector is an explicitly single-owner Edge Function secret configuration.';

create or replace function public.claim_usage_collection(
  p_monitor_id uuid,
  p_owner_id uuid,
  p_collection_slot timestamptz
)
returns table (collection_id uuid, collection_status text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.usage_monitors
    where id = p_monitor_id and owner_id = p_owner_id and provider = 'gemini_cli' and enabled
  ) then
    raise exception 'usage monitor is not enabled for the owner';
  end if;

  return query
  insert into public.usage_collections (monitor_id, owner_id, collection_slot)
  values (p_monitor_id, p_owner_id, p_collection_slot)
  on conflict (monitor_id, collection_slot) do update
    set collection_slot = excluded.collection_slot
  returning id, status;
end;
$$;

create or replace function public.complete_usage_collection(
  p_collection_id uuid,
  p_monitor_id uuid,
  p_owner_id uuid,
  p_attempted_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.usage_collections
  set status = 'succeeded', captured_at = p_attempted_at, error_code = null
  where id = p_collection_id and monitor_id = p_monitor_id and owner_id = p_owner_id;
  if not found then raise exception 'usage collection was not found'; end if;

  update public.usage_monitors
  set last_attempt_at = p_attempted_at, last_success_at = p_attempted_at,
      last_error_code = null, updated_at = p_attempted_at
  where id = p_monitor_id and owner_id = p_owner_id;
  if not found then raise exception 'usage monitor was not found'; end if;
end;
$$;

create or replace function public.fail_usage_collection(
  p_collection_id uuid,
  p_monitor_id uuid,
  p_owner_id uuid,
  p_attempted_at timestamptz,
  p_error_code text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.usage_collections
  set status = 'failed', error_code = p_error_code
  where id = p_collection_id and monitor_id = p_monitor_id and owner_id = p_owner_id;

  update public.usage_monitors
  set last_attempt_at = p_attempted_at, last_error_code = p_error_code, updated_at = p_attempted_at
  where id = p_monitor_id and owner_id = p_owner_id;
end;
$$;

revoke all on function public.claim_usage_collection(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.complete_usage_collection(uuid, uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.fail_usage_collection(uuid, uuid, uuid, timestamptz, text) from public, anon, authenticated;
grant execute on function public.claim_usage_collection(uuid, uuid, timestamptz) to service_role;
grant execute on function public.complete_usage_collection(uuid, uuid, uuid, timestamptz) to service_role;
grant execute on function public.fail_usage_collection(uuid, uuid, uuid, timestamptz, text) to service_role;

commit;
