begin;

alter table public.usage_collections
  drop constraint usage_collections_status_check,
  add constraint usage_collections_status_check
    check (status in ('pending', 'collecting', 'succeeded', 'failed'));

create index if not exists usage_snapshots_monitor_captured_at_idx
  on public.usage_snapshots (monitor_id, captured_at desc);

create index if not exists usage_collections_owner_monitor_slot_idx
  on public.usage_collections (owner_id, monitor_id, collection_slot desc);

drop function public.claim_usage_collection(uuid, uuid, timestamptz);

create function public.claim_usage_collection(
  p_monitor_id uuid,
  p_owner_id uuid,
  p_provider text,
  p_collection_slot timestamptz
)
returns table (collection_id uuid, collection_status text, is_claimed boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.usage_monitors
    where id = p_monitor_id and owner_id = p_owner_id and provider = p_provider and enabled
  ) then
    raise exception 'usage monitor is not enabled for the owner and provider';
  end if;

  return query
  with claimed as (
    insert into public.usage_collections (monitor_id, owner_id, collection_slot, status)
    values (p_monitor_id, p_owner_id, p_collection_slot, 'collecting')
    on conflict (monitor_id, collection_slot) do update
      set status = 'collecting', captured_at = null, error_code = null
      where public.usage_collections.status = 'failed'
    returning id, status
  )
  select id, status, true from claimed
  union all
  select collection.id, collection.status, false
  from public.usage_collections as collection
  where collection.monitor_id = p_monitor_id
    and collection.collection_slot = p_collection_slot
    and not exists (select 1 from claimed);
end;
$$;

revoke all on function public.claim_usage_collection(uuid, uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_usage_collection(uuid, uuid, text, timestamptz) to service_role;

commit;
