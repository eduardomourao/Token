begin;

create sequence public.hosted_dashboard_usage_history_source_id_seq;

select setval(
  'public.hosted_dashboard_usage_history_source_id_seq',
  greatest(coalesce((select max(source_id) from public.hosted_dashboard_usage_history), 1), 1),
  exists (select 1 from public.hosted_dashboard_usage_history)
);

alter sequence public.hosted_dashboard_usage_history_source_id_seq
  owned by public.hosted_dashboard_usage_history.source_id;

alter table public.hosted_dashboard_usage_history
  alter column source_id set default nextval('public.hosted_dashboard_usage_history_source_id_seq');

create function public.hosted_proxy_accounts_for_usage_refresh(requested_owner_id uuid)
returns table (
  legacy_account_id text,
  chatgpt_account_id text,
  access_token_ciphertext text
)
language sql
security definer
set search_path = ''
as $$
  select account.legacy_account_id, account.chatgpt_account_id, credentials.access_token_ciphertext
  from app.hosted_proxy_accounts as account
  join app.hosted_proxy_credentials as credentials
    on credentials.owner_id = account.owner_id
    and credentials.legacy_account_id = account.legacy_account_id
  where account.owner_id = requested_owner_id
    and account.status in ('active', 'rate_limited', 'quota_exceeded')
  order by account.legacy_account_id;
$$;

create function public.hosted_proxy_record_usage_refresh(
  requested_owner_id uuid,
  requested_legacy_account_id text
)
returns void
language sql
security definer
set search_path = ''
as $$
  update app.hosted_proxy_accounts
  set last_refresh_at = now()
  where owner_id = requested_owner_id
    and legacy_account_id = requested_legacy_account_id;
$$;

create function public.hosted_proxy_mark_reauth_required(
  requested_owner_id uuid,
  requested_legacy_account_id text
)
returns void
language sql
security definer
set search_path = ''
as $$
  update app.hosted_proxy_accounts
  set status = 'reauth_required', last_refresh_at = now()
  where owner_id = requested_owner_id
    and legacy_account_id = requested_legacy_account_id;
$$;

revoke all on function public.hosted_proxy_accounts_for_usage_refresh(uuid) from public, anon, authenticated;
revoke all on function public.hosted_proxy_record_usage_refresh(uuid, text) from public, anon, authenticated;
revoke all on function public.hosted_proxy_mark_reauth_required(uuid, text) from public, anon, authenticated;
grant execute on function public.hosted_proxy_accounts_for_usage_refresh(uuid) to service_role;
grant execute on function public.hosted_proxy_record_usage_refresh(uuid, text) to service_role;
grant execute on function public.hosted_proxy_mark_reauth_required(uuid, text) to service_role;

create or replace function app.schedule_hosted_proxy_usage_refresh()
returns void
language plpgsql
security definer
set search_path = pg_catalog, cron, net, vault, public, app
as $$
declare
  job_id bigint;
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'codex_lb_usage_monitor_url')
    or not exists (select 1 from vault.decrypted_secrets where name = 'codex_lb_usage_monitor_collector_secret') then
    raise exception 'Missing Usage Monitor Vault secrets';
  end if;

  select jobid into job_id from cron.job where jobname = 'refresh-hosted-proxy-usage';
  if job_id is not null then
    perform cron.unschedule(job_id);
  end if;

  perform cron.schedule(
    'refresh-hosted-proxy-usage',
    '*/5 * * * *',
    $job$
      select net.http_post(
        url := (
          select decrypted_secret from vault.decrypted_secrets
          where name = 'codex_lb_usage_monitor_url'
        ) || '/functions/v1/refresh-proxy-usage',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-collector-secret', (
            select decrypted_secret from vault.decrypted_secrets
            where name = 'codex_lb_usage_monitor_collector_secret'
          )
        ),
        body := '{"source":"supabase-cron"}'::jsonb,
        timeout_milliseconds := 30000
      );
    $job$
  );
end;
$$;

revoke all on function app.schedule_hosted_proxy_usage_refresh() from public, anon, authenticated;
grant execute on function app.schedule_hosted_proxy_usage_refresh() to service_role;

select app.schedule_hosted_proxy_usage_refresh();

commit;
