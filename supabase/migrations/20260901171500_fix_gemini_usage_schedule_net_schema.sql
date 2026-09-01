begin;

create or replace function app.schedule_gemini_usage_collection()
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

  select jobid into job_id from cron.job where jobname = 'collect-gemini-usage';
  if job_id is not null then
    perform cron.unschedule(job_id);
  end if;

  perform cron.schedule(
    'collect-gemini-usage',
    '*/5 * * * *',
    $job$
      select net.http_post(
        url := (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'codex_lb_usage_monitor_url'
        ) || '/functions/v1/collect-gemini-usage',
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

select app.schedule_gemini_usage_collection();

commit;
