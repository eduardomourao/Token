begin;

create schema if not exists app;

create table public.usage_monitors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider = 'gemini_cli'),
  enabled boolean not null default true,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_error_code text check (
    last_error_code is null
    or last_error_code in ('invalid_credential', 'upstream_unavailable', 'invalid_payload', 'unknown')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, provider),
  unique (id, owner_id)
);

create table app.usage_monitor_credentials (
  monitor_id uuid primary key references public.usage_monitors (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  credential_ciphertext text not null,
  key_version smallint not null default 1 check (key_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (monitor_id, owner_id) references public.usage_monitors (id, owner_id) on delete cascade
);

create table public.usage_collections (
  id uuid primary key default gen_random_uuid(),
  monitor_id uuid not null,
  owner_id uuid not null,
  collection_slot timestamptz not null,
  captured_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  error_code text check (
    error_code is null
    or error_code in ('invalid_credential', 'upstream_unavailable', 'invalid_payload', 'unknown')
  ),
  created_at timestamptz not null default now(),
  unique (monitor_id, collection_slot),
  unique (id, monitor_id, owner_id),
  foreign key (monitor_id, owner_id) references public.usage_monitors (id, owner_id) on delete cascade
);

create table public.usage_snapshots (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null,
  monitor_id uuid not null,
  owner_id uuid not null,
  window_key text not null,
  label text not null,
  remaining_percent numeric(5, 2) not null check (remaining_percent between 0 and 100),
  used_percent numeric(5, 2) generated always as (100 - remaining_percent) stored,
  resets_at timestamptz not null,
  captured_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (collection_id, window_key),
  foreign key (collection_id, monitor_id, owner_id)
    references public.usage_collections (id, monitor_id, owner_id) on delete cascade
);

alter table public.usage_monitors enable row level security;
alter table public.usage_monitors force row level security;
alter table public.usage_collections enable row level security;
alter table public.usage_collections force row level security;
alter table public.usage_snapshots enable row level security;
alter table public.usage_snapshots force row level security;
alter table app.usage_monitor_credentials enable row level security;
alter table app.usage_monitor_credentials force row level security;

revoke all on table public.usage_monitors from anon, authenticated;
revoke all on table public.usage_collections from anon, authenticated;
revoke all on table public.usage_snapshots from anon, authenticated;
revoke all on table app.usage_monitor_credentials from anon, authenticated;

grant select on table public.usage_monitors to authenticated;
grant select on table public.usage_collections to authenticated;
grant select on table public.usage_snapshots to authenticated;
grant all on table public.usage_monitors to service_role;
grant all on table public.usage_collections to service_role;
grant all on table public.usage_snapshots to service_role;
grant all on table app.usage_monitor_credentials to service_role;

create policy "Owners can read usage monitors"
  on public.usage_monitors
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Owners can read usage collections"
  on public.usage_collections
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Owners can read usage snapshots"
  on public.usage_snapshots
  for select
  to authenticated
  using ((select auth.uid()) = owner_id);

alter publication supabase_realtime add table public.usage_snapshots;

comment on table public.usage_monitors is
  'Owner-scoped state for usage monitors. This first slice supports only Gemini CLI telemetry.';
comment on table app.usage_monitor_credentials is
  'Server-only encrypted provider credentials. Browser roles have no grants.';
comment on table public.usage_collections is
  'Idempotency record for one monitor collection slot.';
comment on table public.usage_snapshots is
  'Normalized usage-window samples read by the Usage Monitor and published through Realtime.';

commit;
