begin;

alter table app.hosted_proxy_accounts
  add column reset_at bigint,
  add column blocked_at bigint;

create function public.hosted_proxy_mark_rate_limited(
  requested_owner_id uuid,
  requested_legacy_account_id text,
  requested_reset_at bigint
)
returns void
language sql
security definer
set search_path = ''
as $$
  update app.hosted_proxy_accounts
  set status = 'rate_limited', reset_at = requested_reset_at, blocked_at = extract(epoch from now())::bigint, last_refresh_at = now()
  where owner_id = requested_owner_id
    and legacy_account_id = requested_legacy_account_id;
$$;

revoke all on function public.hosted_proxy_mark_rate_limited(uuid, text, bigint) from public, anon, authenticated;
grant execute on function public.hosted_proxy_mark_rate_limited(uuid, text, bigint) to service_role;

create function public.hosted_proxy_recover_expired_rate_limits(requested_owner_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update app.hosted_proxy_accounts
  set status = 'active', reset_at = null, blocked_at = null
  where owner_id = requested_owner_id
    and status = 'rate_limited'
    and reset_at is not null
    and reset_at <= extract(epoch from now())::bigint;
$$;

revoke all on function public.hosted_proxy_recover_expired_rate_limits(uuid) from public, anon, authenticated;
grant execute on function public.hosted_proxy_recover_expired_rate_limits(uuid) to service_role;

commit;
