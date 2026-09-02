begin;

create extension if not exists pg_cron with schema extensions;

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'purge-hosted-proxy-websocket-spools';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'purge-hosted-proxy-websocket-spools',
    '*/5 * * * *',
    $job$
      select public.hosted_proxy_purge_expired_websocket_spools();
    $job$
  );
end;
$$;

commit;
