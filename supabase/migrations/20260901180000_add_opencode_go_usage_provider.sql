begin;

alter table public.usage_monitors
  drop constraint usage_monitors_provider_check,
  add constraint usage_monitors_provider_check
    check (provider in ('gemini_cli', 'opencode_go'));

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
    where id = p_monitor_id and owner_id = p_owner_id and enabled
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

create or replace function app.schedule_opencode_go_usage_collection()
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

  select jobid into job_id from cron.job where jobname = 'collect-opencode-go-usage';
  if job_id is not null then
    perform cron.unschedule(job_id);
  end if;

  perform cron.schedule(
    'collect-opencode-go-usage',
    '*/5 * * * *',
    $job$
      select net.http_post(
        url := (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'codex_lb_usage_monitor_url'
        ) || '/functions/v1/collect-opencode-go-usage',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-collector-secret', (
            select decrypted_secret
            from vault.decrypted_secrets
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

revoke all on function app.schedule_opencode_go_usage_collection() from public, anon, authenticated;
grant execute on function app.schedule_opencode_go_usage_collection() to service_role;

select app.schedule_opencode_go_usage_collection();

commit;
