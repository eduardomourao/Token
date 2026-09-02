begin;

create table app.hosted_proxy_refresh_claims (
  owner_id uuid not null,
  legacy_account_id text not null,
  refresh_token_ciphertext text not null,
  locked_until timestamptz not null,
  primary key (owner_id, legacy_account_id),
  foreign key (owner_id, legacy_account_id) references app.hosted_proxy_accounts (owner_id, legacy_account_id) on delete cascade
);

alter table app.hosted_proxy_refresh_claims enable row level security;
alter table app.hosted_proxy_refresh_claims force row level security;
revoke all on table app.hosted_proxy_refresh_claims from anon, authenticated;
grant all on table app.hosted_proxy_refresh_claims to service_role;

create function public.hosted_proxy_claim_refresh(requested_owner_id uuid, requested_legacy_account_id text, expected_refresh_token_ciphertext text)
returns boolean language sql security definer set search_path = '' as $$
  with claimed as (
    insert into app.hosted_proxy_refresh_claims as claim (owner_id, legacy_account_id, refresh_token_ciphertext, locked_until)
    values (requested_owner_id, requested_legacy_account_id, expected_refresh_token_ciphertext, now() + interval '45 seconds')
    on conflict (owner_id, legacy_account_id) do update
      set refresh_token_ciphertext = excluded.refresh_token_ciphertext, locked_until = excluded.locked_until
      where claim.locked_until < now()
    returning 1
  ) select exists(select 1 from claimed);
$$;

create function public.hosted_proxy_credentials_for_refresh(requested_owner_id uuid, requested_legacy_account_id text)
returns table (access_token_ciphertext text, refresh_token_ciphertext text, id_token_ciphertext text)
language sql security definer set search_path = '' as $$
  select access_token_ciphertext, refresh_token_ciphertext, id_token_ciphertext
  from app.hosted_proxy_credentials where owner_id = requested_owner_id and legacy_account_id = requested_legacy_account_id;
$$;

create function public.hosted_proxy_rotate_credentials(requested_owner_id uuid, requested_legacy_account_id text, expected_refresh_token_ciphertext text, next_access_token_ciphertext text, next_refresh_token_ciphertext text, next_id_token_ciphertext text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare rotated boolean; updated_rows bigint;
begin
  update app.hosted_proxy_credentials set access_token_ciphertext = next_access_token_ciphertext, refresh_token_ciphertext = next_refresh_token_ciphertext, id_token_ciphertext = next_id_token_ciphertext, imported_at = now()
  where owner_id = requested_owner_id and legacy_account_id = requested_legacy_account_id and refresh_token_ciphertext = expected_refresh_token_ciphertext;
  get diagnostics updated_rows = row_count;
  rotated := updated_rows > 0;
  delete from app.hosted_proxy_refresh_claims where owner_id = requested_owner_id and legacy_account_id = requested_legacy_account_id and refresh_token_ciphertext = expected_refresh_token_ciphertext;
  if rotated then update app.hosted_proxy_accounts set status = 'active', last_refresh_at = now() where owner_id = requested_owner_id and legacy_account_id = requested_legacy_account_id; end if;
  return rotated;
end;
$$;

create function public.hosted_proxy_release_refresh_claim(requested_owner_id uuid, requested_legacy_account_id text, expected_refresh_token_ciphertext text)
returns void language sql security definer set search_path = '' as $$
  delete from app.hosted_proxy_refresh_claims where owner_id = requested_owner_id and legacy_account_id = requested_legacy_account_id and refresh_token_ciphertext = expected_refresh_token_ciphertext;
$$;

revoke all on function public.hosted_proxy_claim_refresh(uuid, text, text), public.hosted_proxy_credentials_for_refresh(uuid, text), public.hosted_proxy_rotate_credentials(uuid, text, text, text, text, text), public.hosted_proxy_release_refresh_claim(uuid, text, text) from public, anon, authenticated;
grant execute on function public.hosted_proxy_claim_refresh(uuid, text, text), public.hosted_proxy_credentials_for_refresh(uuid, text), public.hosted_proxy_rotate_credentials(uuid, text, text, text, text, text), public.hosted_proxy_release_refresh_claim(uuid, text, text) to service_role;

commit;
