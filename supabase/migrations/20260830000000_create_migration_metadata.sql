begin;

-- `app` is intentionally not in [api].schemas in supabase/config.toml.
create schema if not exists app authorization postgres;
revoke all on schema app from public;
revoke all on schema app from anon, authenticated;
grant usage on schema app to service_role;

-- Application-owned metadata only. This is not Supabase CLI migration history.
create table app.migration_metadata (
  migration_id text primary key,
  applied_at timestamptz not null default now()
);

alter table app.migration_metadata owner to postgres;
alter table app.migration_metadata enable row level security;
alter table app.migration_metadata force row level security;

-- No browser policy is created. `anon` and `authenticated` receive no table grant.
revoke all on table app.migration_metadata from public;
revoke all on table app.migration_metadata from anon, authenticated;
grant select, insert, update, delete on table app.migration_metadata to service_role;

comment on schema app is
  'Application-private Supabase schema; browser access is denied by default.';
comment on table app.migration_metadata is
  'Application migration metadata; protected by RLS with no browser policies.';

commit;
