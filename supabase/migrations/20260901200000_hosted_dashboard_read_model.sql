begin;

create table public.hosted_dashboard_accounts (
  owner_id uuid not null references auth.users (id) on delete cascade,
  legacy_account_id text not null,
  email text not null,
  alias text,
  workspace_id text,
  workspace_label text,
  seat_type text,
  plan_type text not null,
  routing_policy text not null check (routing_policy in ('normal', 'burn_first', 'preserve')),
  status text not null,
  reset_at bigint,
  blocked_at bigint,
  last_refresh_at timestamptz,
  created_at timestamptz not null,
  imported_at timestamptz not null default now(),
  primary key (owner_id, legacy_account_id)
);

create table public.hosted_dashboard_usage_history (
  owner_id uuid not null,
  source_id bigint not null,
  legacy_account_id text not null,
  recorded_at timestamptz not null,
  window_key text,
  used_percent numeric(5, 2) not null check (used_percent between 0 and 100),
  input_tokens bigint,
  output_tokens bigint,
  reset_at bigint,
  window_minutes integer,
  credits_has boolean,
  credits_unlimited boolean,
  credits_balance numeric,
  imported_at timestamptz not null default now(),
  primary key (owner_id, source_id),
  foreign key (owner_id, legacy_account_id)
    references public.hosted_dashboard_accounts (owner_id, legacy_account_id) on delete cascade
);

create table public.hosted_dashboard_additional_usage_history (
  owner_id uuid not null,
  source_id bigint not null,
  legacy_account_id text not null,
  quota_key text not null,
  limit_name text not null,
  metered_feature text not null,
  window_key text not null,
  used_percent numeric(5, 2) not null check (used_percent between 0 and 100),
  reset_at bigint,
  window_minutes integer,
  recorded_at timestamptz not null,
  imported_at timestamptz not null default now(),
  primary key (owner_id, source_id),
  foreign key (owner_id, legacy_account_id)
    references public.hosted_dashboard_accounts (owner_id, legacy_account_id) on delete cascade
);

create index hosted_dashboard_usage_history_owner_account_recorded_at_idx
  on public.hosted_dashboard_usage_history (owner_id, legacy_account_id, recorded_at desc);
create index hosted_dashboard_additional_usage_history_owner_account_recorded_at_idx
  on public.hosted_dashboard_additional_usage_history (owner_id, legacy_account_id, recorded_at desc);

alter table public.hosted_dashboard_accounts enable row level security;
alter table public.hosted_dashboard_accounts force row level security;
alter table public.hosted_dashboard_usage_history enable row level security;
alter table public.hosted_dashboard_usage_history force row level security;
alter table public.hosted_dashboard_additional_usage_history enable row level security;
alter table public.hosted_dashboard_additional_usage_history force row level security;

revoke all on table public.hosted_dashboard_accounts from anon, authenticated;
revoke all on table public.hosted_dashboard_usage_history from anon, authenticated;
revoke all on table public.hosted_dashboard_additional_usage_history from anon, authenticated;
grant select on table public.hosted_dashboard_accounts to authenticated;
grant select on table public.hosted_dashboard_usage_history to authenticated;
grant select on table public.hosted_dashboard_additional_usage_history to authenticated;
grant all on table public.hosted_dashboard_accounts to service_role;
grant all on table public.hosted_dashboard_usage_history to service_role;
grant all on table public.hosted_dashboard_additional_usage_history to service_role;

create policy "Owners can read hosted dashboard accounts"
  on public.hosted_dashboard_accounts for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "Owners can read hosted dashboard usage history"
  on public.hosted_dashboard_usage_history for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "Owners can read hosted dashboard additional usage history"
  on public.hosted_dashboard_additional_usage_history for select to authenticated
  using ((select auth.uid()) = owner_id);

alter publication supabase_realtime add table public.hosted_dashboard_accounts;
alter publication supabase_realtime add table public.hosted_dashboard_usage_history;
alter publication supabase_realtime add table public.hosted_dashboard_additional_usage_history;

comment on table public.hosted_dashboard_accounts is
  'Owner-scoped Dashboard read model. It intentionally excludes encrypted OAuth credentials and proxy configuration.';
comment on table public.hosted_dashboard_usage_history is
  'Imported non-secret account quota history for the hosted Dashboard.';
comment on table public.hosted_dashboard_additional_usage_history is
  'Imported non-secret additional quota history for the hosted Dashboard.';

commit;
