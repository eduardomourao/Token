begin;

create function public.hosted_proxy_websocket_spool_status(
  requested_owner_id uuid,
  requested_spool_id uuid
)
returns table (next_cursor bigint, terminal_cursor bigint)
language sql security definer set search_path = '' as $$
  select spool.next_cursor, spool.terminal_cursor
  from app.hosted_proxy_websocket_spools as spool
  where spool.id = requested_spool_id
    and spool.owner_id = requested_owner_id
    and spool.expires_at > now();
$$;

revoke all on function public.hosted_proxy_websocket_spool_status(uuid, uuid) from public, anon, authenticated;
grant execute on function public.hosted_proxy_websocket_spool_status(uuid, uuid) to service_role;

comment on function public.hosted_proxy_websocket_spool_status(uuid, uuid) is 'Private active-spool ownership and cursor check for fail-closed hosted WebSocket replay.';

commit;
