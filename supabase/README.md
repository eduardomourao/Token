# Local Supabase foundation

This directory is environment-neutral: it contains no remote project reference,
URL, key, credential, or application data. `config.toml` intentionally omits
`project_id`, so no remote project is selected implicitly.

## Access convention

`app.migration_metadata` is application-owned metadata, not the Supabase CLI
migration-history table. It lives in the private `app` schema, outside the API
schema allowlist. RLS is enabled and forced; this migration creates no policies
and grants no privileges to `anon` or `authenticated`. Only the service role is
granted database access. A future browser-facing table must enable RLS and add
an explicitly reviewed ownership policy in its own migration.

## Local apply and reset

Run commands from the repository root. Do not use `supabase link`, `--linked`,
or `--db-url` for this foundation.

1. Start the local Supabase stack:

   ```powershell
   supabase start
   ```

2. Rebuild the local database from the checked-in migrations and with seeding
   disabled:

   ```powershell
   supabase db reset --local --no-seed
   ```

`--local` limits the reset to the local Supabase database. It does not use the
legacy application database or its data directory. The migration is a single
transaction, so a failed apply is rolled back by PostgreSQL. Re-running the
local reset is the supported reversible-development path: it recreates the
local database solely from versioned migrations and no seed data.

For a fully disposable local teardown, stop the local stack without a backup,
then start it again and run the reset command above:

```powershell
supabase stop --no-backup
supabase start
supabase db reset --local --no-seed
```

This teardown deletes only local Supabase container data. It must never be
replaced with a linked or connection-string command.

## Secret handling

Do not put credentials in this directory. Local runtime state and `.env` files
are ignored by `supabase/.gitignore`; only safe variable names may appear in a
future `.env.example` file.
