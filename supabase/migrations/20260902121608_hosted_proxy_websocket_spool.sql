begin;

create table app.hosted_proxy_websocket_spools (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  session_key_hash text check (session_key_hash is null or length(session_key_hash) = 64),
  next_cursor bigint not null default 0 check (next_cursor >= 0),
  terminal_cursor bigint,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (id, owner_id),
  check (expires_at > created_at),
  check (terminal_cursor is null or terminal_cursor > 0)
);

create table app.hosted_proxy_websocket_events (
  spool_id uuid not null,
  cursor bigint not null check (cursor > 0),
  event_frame jsonb not null check (jsonb_typeof(event_frame) = 'object'),
  is_terminal boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (spool_id, cursor),
  foreign key (spool_id) references app.hosted_proxy_websocket_spools (id) on delete cascade,
  check (octet_length(event_frame::text) <= 262144)
);

create index hosted_proxy_websocket_spools_owner_expiry_idx
  on app.hosted_proxy_websocket_spools (owner_id, expires_at);

create index hosted_proxy_websocket_events_spool_cursor_idx
  on app.hosted_proxy_websocket_events (spool_id, cursor);

alter table app.hosted_proxy_websocket_spools enable row level security;
alter table app.hosted_proxy_websocket_spools force row level security;
alter table app.hosted_proxy_websocket_events enable row level security;
alter table app.hosted_proxy_websocket_events force row level security;
revoke all on table app.hosted_proxy_websocket_spools, app.hosted_proxy_websocket_events from anon, authenticated;
grant all on table app.hosted_proxy_websocket_spools, app.hosted_proxy_websocket_events to service_role;

create function public.hosted_proxy_create_websocket_spool(
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

  delete from app.hosted_proxy_websocket_spools
  where id in (
    select id from app.hosted_proxy_websocket_spools
    where expires_at <= now()
    order by expires_at
    limit 100
  );

  return query
    insert into app.hosted_proxy_websocket_spools (id, owner_id, session_key_hash, expires_at)
    values (requested_id, requested_owner_id, requested_session_key_hash, now() + make_interval(secs => requested_ttl_seconds))
    returning hosted_proxy_websocket_spools.id, hosted_proxy_websocket_spools.expires_at;
end;
$$;

create function public.hosted_proxy_append_websocket_event(
  requested_owner_id uuid,
  requested_spool_id uuid,
  requested_event_frame jsonb,
  requested_is_terminal boolean default false
)
returns bigint
language plpgsql security definer set search_path = '' as $$
declare next_event_cursor bigint;
begin
  if jsonb_typeof(requested_event_frame) <> 'object' or octet_length(requested_event_frame::text) > 262144 then
    raise exception 'hosted websocket event frame is invalid' using errcode = '22023';
  end if;

  update app.hosted_proxy_websocket_spools
    set next_cursor = next_cursor + 1,
        terminal_cursor = case when requested_is_terminal then next_cursor + 1 else terminal_cursor end
    where id = requested_spool_id
      and owner_id = requested_owner_id
      and expires_at > now()
      and terminal_cursor is null
    returning next_cursor into next_event_cursor;

  if next_event_cursor is null then
    return null;
  end if;

  insert into app.hosted_proxy_websocket_events (spool_id, cursor, event_frame, is_terminal)
  values (requested_spool_id, next_event_cursor, requested_event_frame, requested_is_terminal);
  return next_event_cursor;
end;
$$;

create function public.hosted_proxy_read_websocket_events(
  requested_owner_id uuid,
  requested_spool_id uuid,
  requested_after_cursor bigint default 0
)
returns table (cursor bigint, event_frame jsonb, is_terminal boolean)
language sql security definer set search_path = '' as $$
  select event.cursor, event.event_frame, event.is_terminal
  from app.hosted_proxy_websocket_spools as spool
  join app.hosted_proxy_websocket_events as event on event.spool_id = spool.id
  where spool.id = requested_spool_id
    and spool.owner_id = requested_owner_id
    and spool.expires_at > now()
    and event.cursor > greatest(requested_after_cursor, 0)
  order by event.cursor;
$$;

create function public.hosted_proxy_purge_expired_websocket_spools()
returns integer
language plpgsql security definer set search_path = '' as $$
declare deleted_count integer;
begin
  with deleted as (
    delete from app.hosted_proxy_websocket_spools
    where id in (
      select id from app.hosted_proxy_websocket_spools
      where expires_at <= now()
      order by expires_at
      limit 100
    )
    returning 1
  )
  select count(*) into deleted_count from deleted;
  return deleted_count;
end;
$$;

revoke all on function public.hosted_proxy_create_websocket_spool(uuid, uuid, text, integer), public.hosted_proxy_append_websocket_event(uuid, uuid, jsonb, boolean), public.hosted_proxy_read_websocket_events(uuid, uuid, bigint), public.hosted_proxy_purge_expired_websocket_spools() from public, anon, authenticated;
grant execute on function public.hosted_proxy_create_websocket_spool(uuid, uuid, text, integer), public.hosted_proxy_append_websocket_event(uuid, uuid, jsonb, boolean), public.hosted_proxy_read_websocket_events(uuid, uuid, bigint), public.hosted_proxy_purge_expired_websocket_spools() to service_role;

comment on table app.hosted_proxy_websocket_spools is 'Private, short-lived owner-scoped hosted Responses websocket replay state.';
comment on table app.hosted_proxy_websocket_events is 'Private hosted Responses websocket event frames; output is retained only through the parent spool expiry.';

commit;
