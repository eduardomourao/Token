begin;

create table app.hosted_proxy_session_affinity (
  owner_id uuid not null,
  session_key_hash text not null check (length(session_key_hash) = 64),
  legacy_account_id text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (owner_id, session_key_hash),
  foreign key (owner_id, legacy_account_id) references app.hosted_proxy_accounts (owner_id, legacy_account_id) on delete cascade
);

alter table app.hosted_proxy_session_affinity enable row level security;
alter table app.hosted_proxy_session_affinity force row level security;
revoke all on table app.hosted_proxy_session_affinity from anon, authenticated;
grant all on table app.hosted_proxy_session_affinity to service_role;

create index hosted_proxy_session_affinity_expiry_idx
  on app.hosted_proxy_session_affinity (owner_id, expires_at);

create function public.hosted_proxy_session_account(requested_owner_id uuid, requested_session_key_hash text)
returns table (legacy_account_id text, chatgpt_account_id text, codex_installation_id text)
language sql security definer set search_path = '' as $$
  with latest_usage as (
    select distinct on (usage.owner_id, usage.legacy_account_id, usage.window_key)
      usage.owner_id, usage.legacy_account_id, usage.window_key, usage.used_percent, usage.reset_at
    from public.hosted_dashboard_usage_history as usage
    where usage.owner_id = requested_owner_id and usage.window_key in ('primary', 'secondary')
    order by usage.owner_id, usage.legacy_account_id, usage.window_key, usage.recorded_at desc, usage.source_id desc
  )
  select account.legacy_account_id, account.chatgpt_account_id, account.codex_installation_id
  from app.hosted_proxy_session_affinity as affinity
  join app.hosted_proxy_accounts as account on account.owner_id = affinity.owner_id and account.legacy_account_id = affinity.legacy_account_id
  left join latest_usage as primary_usage on primary_usage.owner_id = account.owner_id and primary_usage.legacy_account_id = account.legacy_account_id and primary_usage.window_key = 'primary'
  left join latest_usage as secondary_usage on secondary_usage.owner_id = account.owner_id and secondary_usage.legacy_account_id = account.legacy_account_id and secondary_usage.window_key = 'secondary'
  where affinity.owner_id = requested_owner_id and affinity.session_key_hash = requested_session_key_hash and affinity.expires_at > now()
    and account.status = 'active'
    and (primary_usage.used_percent is null or primary_usage.used_percent < 100 or primary_usage.reset_at is not null and primary_usage.reset_at <= extract(epoch from now())::bigint)
    and (secondary_usage.used_percent is null or secondary_usage.used_percent < 100 or secondary_usage.reset_at is not null and secondary_usage.reset_at <= extract(epoch from now())::bigint)
  limit 1;
$$;

create function public.hosted_proxy_bind_session(requested_owner_id uuid, requested_session_key_hash text, requested_legacy_account_id text)
returns void language sql security definer set search_path = '' as $$
  insert into app.hosted_proxy_session_affinity (owner_id, session_key_hash, legacy_account_id, expires_at)
  values (requested_owner_id, requested_session_key_hash, requested_legacy_account_id, now() + interval '24 hours')
  on conflict (owner_id, session_key_hash) do update
    set legacy_account_id = excluded.legacy_account_id, expires_at = excluded.expires_at, updated_at = now();
$$;

revoke all on function public.hosted_proxy_session_account(uuid, text), public.hosted_proxy_bind_session(uuid, text, text) from public, anon, authenticated;
grant execute on function public.hosted_proxy_session_account(uuid, text), public.hosted_proxy_bind_session(uuid, text, text) to service_role;

comment on table app.hosted_proxy_session_affinity is 'Private SHA-256 session affinity; raw client session identifiers are never persisted.';

commit;
