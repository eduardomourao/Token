begin;

create table app.hosted_proxy_accounts (
  owner_id uuid not null references auth.users (id) on delete cascade,
  legacy_account_id text not null,
  chatgpt_account_id text,
  codex_installation_id text not null,
  email text not null,
  plan_type text not null,
  routing_policy text not null check (routing_policy in ('normal', 'burn_first', 'preserve')),
  status text not null,
  last_refresh_at timestamptz,
  created_at timestamptz not null,
  imported_at timestamptz not null default now(),
  primary key (owner_id, legacy_account_id)
);

create table app.hosted_proxy_credentials (
  owner_id uuid not null,
  legacy_account_id text not null,
  credential_version text not null check (credential_version = 'v1'),
  access_token_ciphertext text not null,
  refresh_token_ciphertext text not null,
  id_token_ciphertext text not null,
  imported_at timestamptz not null default now(),
  primary key (owner_id, legacy_account_id),
  foreign key (owner_id, legacy_account_id)
    references app.hosted_proxy_accounts (owner_id, legacy_account_id) on delete cascade
);

create index hosted_proxy_accounts_owner_status_idx
  on app.hosted_proxy_accounts (owner_id, status, legacy_account_id);

alter table app.hosted_proxy_accounts enable row level security;
alter table app.hosted_proxy_accounts force row level security;
alter table app.hosted_proxy_credentials enable row level security;
alter table app.hosted_proxy_credentials force row level security;

revoke all on table app.hosted_proxy_accounts from anon, authenticated;
revoke all on table app.hosted_proxy_credentials from anon, authenticated;
grant all on table app.hosted_proxy_accounts to service_role;
grant all on table app.hosted_proxy_credentials to service_role;

create function public.hosted_proxy_active_account(requested_owner_id uuid)
returns table (
  legacy_account_id text,
  chatgpt_account_id text,
  codex_installation_id text
)
language sql
security definer
set search_path = ''
as $$
  select account.legacy_account_id, account.chatgpt_account_id, account.codex_installation_id
  from app.hosted_proxy_accounts as account
  where account.owner_id = requested_owner_id
    and account.status = 'active'
  order by account.legacy_account_id
  limit 1;
$$;

create function public.hosted_proxy_credentials_for_account(
  requested_owner_id uuid,
  requested_legacy_account_id text
)
returns table (access_token_ciphertext text)
language sql
security definer
set search_path = ''
as $$
  select credentials.access_token_ciphertext
  from app.hosted_proxy_credentials as credentials
  where credentials.owner_id = requested_owner_id
    and credentials.legacy_account_id = requested_legacy_account_id;
$$;

revoke all on function public.hosted_proxy_active_account(uuid) from public, anon, authenticated;
revoke all on function public.hosted_proxy_credentials_for_account(uuid, text) from public, anon, authenticated;
grant execute on function public.hosted_proxy_active_account(uuid) to service_role;
grant execute on function public.hosted_proxy_credentials_for_account(uuid, text) to service_role;

comment on table app.hosted_proxy_accounts is
  'Private hosted proxy routing metadata. Browser roles receive no access.';
comment on table app.hosted_proxy_credentials is
  'Private AES-GCM credential envelopes. Plaintext and source Fernet ciphertext never reach browser-accessible tables.';

commit;
