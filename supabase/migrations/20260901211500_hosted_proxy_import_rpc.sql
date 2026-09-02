begin;

create function public.hosted_proxy_upsert_accounts(rows jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into app.hosted_proxy_accounts (
    owner_id, legacy_account_id, chatgpt_account_id, codex_installation_id,
    email, plan_type, routing_policy, status, last_refresh_at, created_at
  )
  select
    source_row.owner_id, source_row.legacy_account_id, source_row.chatgpt_account_id, source_row.codex_installation_id,
    source_row.email, source_row.plan_type, source_row.routing_policy, source_row.status, source_row.last_refresh_at, source_row.created_at
  from jsonb_to_recordset(rows) as source_row(
    owner_id uuid,
    legacy_account_id text,
    chatgpt_account_id text,
    codex_installation_id text,
    email text,
    plan_type text,
    routing_policy text,
    status text,
    last_refresh_at timestamptz,
    created_at timestamptz
  )
  on conflict (owner_id, legacy_account_id) do update
  set chatgpt_account_id = excluded.chatgpt_account_id,
      codex_installation_id = excluded.codex_installation_id,
      email = excluded.email,
      plan_type = excluded.plan_type,
      routing_policy = excluded.routing_policy,
      status = excluded.status,
      last_refresh_at = excluded.last_refresh_at,
      created_at = excluded.created_at,
      imported_at = now();
end;
$$;

create function public.hosted_proxy_upsert_credentials(rows jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into app.hosted_proxy_credentials (
    owner_id, legacy_account_id, credential_version, access_token_ciphertext,
    refresh_token_ciphertext, id_token_ciphertext
  )
  select
    source_row.owner_id, source_row.legacy_account_id, source_row.credential_version, source_row.access_token_ciphertext,
    source_row.refresh_token_ciphertext, source_row.id_token_ciphertext
  from jsonb_to_recordset(rows) as source_row(
    owner_id uuid,
    legacy_account_id text,
    credential_version text,
    access_token_ciphertext text,
    refresh_token_ciphertext text,
    id_token_ciphertext text
  )
  on conflict (owner_id, legacy_account_id) do update
  set credential_version = excluded.credential_version,
      access_token_ciphertext = excluded.access_token_ciphertext,
      refresh_token_ciphertext = excluded.refresh_token_ciphertext,
      id_token_ciphertext = excluded.id_token_ciphertext,
      imported_at = now();
end;
$$;

revoke all on function public.hosted_proxy_upsert_accounts(jsonb) from public, anon, authenticated;
revoke all on function public.hosted_proxy_upsert_credentials(jsonb) from public, anon, authenticated;
grant execute on function public.hosted_proxy_upsert_accounts(jsonb) to service_role;
grant execute on function public.hosted_proxy_upsert_credentials(jsonb) to service_role;

comment on function public.hosted_proxy_upsert_accounts(jsonb) is
  'Service-role-only import bridge for private hosted proxy metadata.';
comment on function public.hosted_proxy_upsert_credentials(jsonb) is
  'Service-role-only import bridge for private hosted proxy credential envelopes.';

commit;
