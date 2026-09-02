begin;

create or replace function public.hosted_proxy_create_websocket_spool(
  requested_id uuid,
  requested_owner_id uuid,
  requested_session_key_hash text,
  requested_ttl_seconds integer default 600
)
returns table (id uuid, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if requested_ttl_seconds < 1 or requested_ttl_seconds > 900 then
    raise exception 'hosted websocket spool ttl is out of range' using errcode = '22023';
  end if;

  delete from app.hosted_proxy_websocket_spools as stale_spool
  where stale_spool.id in (
    select expired_spool.id from app.hosted_proxy_websocket_spools as expired_spool
    where expired_spool.expires_at <= now()
    order by expired_spool.expires_at
    limit 100
  );

  return query
    insert into app.hosted_proxy_websocket_spools (id, owner_id, session_key_hash, expires_at)
    values (requested_id, requested_owner_id, requested_session_key_hash, now() + make_interval(secs => requested_ttl_seconds))
    returning hosted_proxy_websocket_spools.id, hosted_proxy_websocket_spools.expires_at;
end;
$$;

revoke all on function public.hosted_proxy_create_websocket_spool(uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.hosted_proxy_create_websocket_spool(uuid, uuid, text, integer) to service_role;

commit;
