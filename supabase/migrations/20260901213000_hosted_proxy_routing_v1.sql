begin;

alter table app.hosted_proxy_accounts
  add column last_selected_at timestamptz;

create index hosted_proxy_accounts_owner_routing_idx
  on app.hosted_proxy_accounts (owner_id, status, routing_policy, last_selected_at, legacy_account_id);

create function public.hosted_proxy_select_account(requested_owner_id uuid)
returns table (
  legacy_account_id text,
  chatgpt_account_id text,
  codex_installation_id text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with latest_usage as (
    select distinct on (usage.owner_id, usage.legacy_account_id, usage.window_key)
      usage.owner_id,
      usage.legacy_account_id,
      usage.window_key,
      usage.used_percent,
      usage.reset_at
    from public.hosted_dashboard_usage_history as usage
    where usage.owner_id = requested_owner_id
      and usage.window_key in ('primary', 'secondary')
    order by usage.owner_id, usage.legacy_account_id, usage.window_key, usage.recorded_at desc, usage.source_id desc
  ),
  candidates as (
    select account.legacy_account_id
    from app.hosted_proxy_accounts as account
    left join latest_usage as primary_usage
      on primary_usage.owner_id = account.owner_id
      and primary_usage.legacy_account_id = account.legacy_account_id
      and primary_usage.window_key = 'primary'
    left join latest_usage as secondary_usage
      on secondary_usage.owner_id = account.owner_id
      and secondary_usage.legacy_account_id = account.legacy_account_id
      and secondary_usage.window_key = 'secondary'
    where account.owner_id = requested_owner_id
      and account.status = 'active'
      and (
        primary_usage.used_percent is null
        or primary_usage.used_percent < 100
        or primary_usage.reset_at is not null and primary_usage.reset_at <= extract(epoch from now())::bigint
      )
      and (
        secondary_usage.used_percent is null
        or secondary_usage.used_percent < 100
        or secondary_usage.reset_at is not null and secondary_usage.reset_at <= extract(epoch from now())::bigint
      )
    order by
      case account.routing_policy
        when 'burn_first' then 0
        when 'normal' then 1
        when 'preserve' then 2
        else 1
      end,
      account.last_selected_at nulls first,
      account.legacy_account_id
    limit 1
    for update of account skip locked
  ),
  selected as (
    update app.hosted_proxy_accounts as account
    set last_selected_at = now()
    from candidates
    where account.owner_id = requested_owner_id
      and account.legacy_account_id = candidates.legacy_account_id
    returning account.legacy_account_id, account.chatgpt_account_id, account.codex_installation_id
  )
  select selected.legacy_account_id, selected.chatgpt_account_id, selected.codex_installation_id
  from selected;
end;
$$;

revoke all on function public.hosted_proxy_select_account(uuid) from public, anon, authenticated;
grant execute on function public.hosted_proxy_select_account(uuid) to service_role;

comment on function public.hosted_proxy_select_account(uuid) is
  'Service-role-only deterministic hosted routing: active accounts, fresh quota windows, manual policy, and least-recent selection.';

commit;
