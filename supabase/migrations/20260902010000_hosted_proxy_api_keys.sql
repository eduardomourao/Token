begin;

create table app.hosted_proxy_api_keys (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  key_prefix text not null check (char_length(key_prefix) between 7 and 32),
  is_active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index hosted_proxy_api_keys_owner_created_idx
  on app.hosted_proxy_api_keys (owner_id, created_at desc);

alter table app.hosted_proxy_api_keys enable row level security;
alter table app.hosted_proxy_api_keys force row level security;
revoke all on table app.hosted_proxy_api_keys from anon, authenticated;
grant all on table app.hosted_proxy_api_keys to service_role;

create function public.hosted_proxy_authenticate_api_key(requested_key_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare resolved_owner_id uuid;
begin
  update app.hosted_proxy_api_keys
    set last_used_at = now()
    where key_hash = requested_key_hash
      and is_active
      and (expires_at is null or expires_at > now())
    returning owner_id into resolved_owner_id;
  return resolved_owner_id;
end;
$$;

create function public.hosted_proxy_create_api_key(
  requested_id uuid,
  requested_owner_id uuid,
  requested_name text,
  requested_key_hash text,
  requested_key_prefix text,
  requested_expires_at timestamptz default null
)
returns table (id uuid, name text, key_prefix text, is_active boolean, expires_at timestamptz, created_at timestamptz, last_used_at timestamptz)
language sql security definer set search_path = '' as $$
  insert into app.hosted_proxy_api_keys (id, owner_id, name, key_hash, key_prefix, expires_at)
  values (requested_id, requested_owner_id, trim(requested_name), requested_key_hash, requested_key_prefix, requested_expires_at)
  returning id, name, key_prefix, is_active, expires_at, created_at, last_used_at;
$$;

create function public.hosted_proxy_list_api_keys(requested_owner_id uuid)
returns table (id uuid, name text, key_prefix text, is_active boolean, expires_at timestamptz, created_at timestamptz, last_used_at timestamptz)
language sql security definer set search_path = '' as $$
  select id, name, key_prefix, is_active, expires_at, created_at, last_used_at
  from app.hosted_proxy_api_keys
  where owner_id = requested_owner_id
  order by created_at desc;
$$;

create function public.hosted_proxy_revoke_api_key(requested_owner_id uuid, requested_id uuid)
returns boolean language sql security definer set search_path = '' as $$
  with updated as (
    update app.hosted_proxy_api_keys
      set is_active = false
      where owner_id = requested_owner_id and id = requested_id and is_active
      returning 1
  )
  select exists(select 1 from updated);
$$;

revoke all on function public.hosted_proxy_authenticate_api_key(text), public.hosted_proxy_create_api_key(uuid, uuid, text, text, text, timestamptz), public.hosted_proxy_list_api_keys(uuid), public.hosted_proxy_revoke_api_key(uuid, uuid) from public, anon, authenticated;
grant execute on function public.hosted_proxy_authenticate_api_key(text), public.hosted_proxy_create_api_key(uuid, uuid, text, text, text, timestamptz), public.hosted_proxy_list_api_keys(uuid), public.hosted_proxy_revoke_api_key(uuid, uuid) to service_role;

comment on table app.hosted_proxy_api_keys is 'Private hosted Responses API keys. Only SHA-256 hashes and display prefixes are persisted.';

commit;
