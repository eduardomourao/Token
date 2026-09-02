from __future__ import annotations

from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
MIGRATION = REPOSITORY_ROOT / "supabase" / "migrations" / "20260901210000_hosted_proxy_credentials.sql"
IMPORT_RPC_MIGRATION = REPOSITORY_ROOT / "supabase" / "migrations" / "20260901211500_hosted_proxy_import_rpc.sql"
ROUTING_MIGRATION = REPOSITORY_ROOT / "supabase" / "migrations" / "20260901213000_hosted_proxy_routing_v1.sql"
USAGE_REFRESH_MIGRATION = REPOSITORY_ROOT / "supabase" / "migrations" / "20260901214500_hosted_proxy_usage_refresh.sql"
OAUTH_REFRESH_MIGRATION = REPOSITORY_ROOT / "supabase" / "migrations" / "20260901220000_hosted_proxy_oauth_refresh.sql"
RATE_LIMIT_MIGRATION = REPOSITORY_ROOT / "supabase" / "migrations" / "20260902000000_hosted_proxy_rate_limit_status.sql"
SESSION_AFFINITY_MIGRATION = REPOSITORY_ROOT / "supabase" / "migrations" / "20260902003000_hosted_proxy_session_affinity.sql"
API_KEYS_MIGRATION = REPOSITORY_ROOT / "supabase" / "migrations" / "20260902010000_hosted_proxy_api_keys.sql"
WEBSOCKET_SPOOL_MIGRATION = next(REPOSITORY_ROOT.glob("supabase/migrations/*_hosted_proxy_websocket_spool.sql"))
WEBSOCKET_SPOOL_FIX_MIGRATION = next(REPOSITORY_ROOT.glob("supabase/migrations/*_fix_hosted_proxy_websocket_spool_cleanup.sql"))
WEBSOCKET_SPOOL_SCHEDULE_MIGRATION = next(REPOSITORY_ROOT.glob("supabase/migrations/*_schedule_hosted_proxy_websocket_spool_purge.sql"))
WEBSOCKET_SPOOL_STATUS_MIGRATION = next(REPOSITORY_ROOT.glob("supabase/migrations/*_add_hosted_websocket_spool_status.sql"))


def test_hosted_proxy_credentials_are_private_and_not_browser_grantable() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    assert "create table app.hosted_proxy_accounts" in sql
    assert "create table app.hosted_proxy_credentials" in sql
    assert "access_token_ciphertext" in sql
    assert "enable row level security" in sql
    assert "force row level security" in sql
    assert "revoke all on table app.hosted_proxy_accounts from anon, authenticated" in sql
    assert "revoke all on table app.hosted_proxy_credentials from anon, authenticated" in sql
    assert "grant all on table app.hosted_proxy_accounts to service_role" in sql
    assert "grant all on table app.hosted_proxy_credentials to service_role" in sql
    assert "grant select on table app.hosted_proxy_credentials to authenticated" not in sql
    assert "create function public.hosted_proxy_active_account" in sql
    assert "create function public.hosted_proxy_credentials_for_account" in sql
    assert "security definer" in sql
    assert "grant execute on function public.hosted_proxy_active_account(uuid) to service_role" in sql
    assert "grant execute on function public.hosted_proxy_credentials_for_account(uuid, text) to service_role" in sql


def test_private_proxy_import_bridges_are_service_role_only() -> None:
    sql = IMPORT_RPC_MIGRATION.read_text(encoding="utf-8").lower()

    assert "create function public.hosted_proxy_upsert_accounts(rows jsonb)" in sql
    assert "create function public.hosted_proxy_upsert_credentials(rows jsonb)" in sql
    assert "security definer" in sql
    assert "revoke all on function public.hosted_proxy_upsert_accounts(jsonb) from public, anon, authenticated" in sql
    assert "revoke all on function public.hosted_proxy_upsert_credentials(jsonb) from public, anon, authenticated" in sql
    assert "grant execute on function public.hosted_proxy_upsert_accounts(jsonb) to service_role" in sql
    assert "grant execute on function public.hosted_proxy_upsert_credentials(jsonb) to service_role" in sql


def test_hosted_proxy_selection_preserves_private_routing_and_quota_gates() -> None:
    sql = ROUTING_MIGRATION.read_text(encoding="utf-8").lower()

    assert "add column last_selected_at timestamptz" in sql
    assert "create function public.hosted_proxy_select_account(requested_owner_id uuid)" in sql
    assert "account.status = 'active'" in sql
    assert "when 'burn_first' then 0" in sql
    assert "when 'normal' then 1" in sql
    assert "when 'preserve' then 2" in sql
    assert "hosted_dashboard_usage_history" in sql
    assert "update app.hosted_proxy_accounts" in sql
    assert "revoke all on function public.hosted_proxy_select_account(uuid) from public, anon, authenticated" in sql
    assert "grant execute on function public.hosted_proxy_select_account(uuid) to service_role" in sql


def test_hosted_proxy_usage_refresh_keeps_credentials_private_and_is_scheduled() -> None:
    sql = USAGE_REFRESH_MIGRATION.read_text(encoding="utf-8").lower()

    assert "hosted_dashboard_usage_history_source_id_seq" in sql
    assert "create function public.hosted_proxy_accounts_for_usage_refresh(requested_owner_id uuid)" in sql
    assert "access_token_ciphertext" in sql
    assert "create function public.hosted_proxy_mark_reauth_required" in sql
    assert "revoke all on function public.hosted_proxy_accounts_for_usage_refresh(uuid) from public, anon, authenticated" in sql
    assert "grant execute on function public.hosted_proxy_accounts_for_usage_refresh(uuid) to service_role" in sql
    assert "cron.schedule(" in sql
    assert "refresh-hosted-proxy-usage" in sql


def test_hosted_proxy_oauth_rotation_has_private_claim_and_ciphertext_cas() -> None:
    sql = OAUTH_REFRESH_MIGRATION.read_text(encoding="utf-8").lower()

    assert "create table app.hosted_proxy_refresh_claims" in sql
    assert "force row level security" in sql
    assert "create function public.hosted_proxy_claim_refresh" in sql
    assert "locked_until < now()" in sql
    assert "create function public.hosted_proxy_rotate_credentials" in sql
    assert "refresh_token_ciphertext = expected_refresh_token_ciphertext" in sql
    assert "revoke all on function public.hosted_proxy_claim_refresh" in sql
    assert "to service_role" in sql
    fix_sql = WEBSOCKET_SPOOL_FIX_MIGRATION.read_text(encoding="utf-8").lower()
    assert "as stale_spool" in fix_sql
    assert "as expired_spool" in fix_sql


def test_hosted_proxy_rate_limit_transition_is_service_role_only() -> None:
    sql = RATE_LIMIT_MIGRATION.read_text(encoding="utf-8").lower()

    assert "create function public.hosted_proxy_mark_rate_limited" in sql
    assert "status = 'rate_limited'" in sql
    assert "reset_at = requested_reset_at" in sql
    assert "revoke all on function public.hosted_proxy_mark_rate_limited(uuid, text, bigint) from public, anon, authenticated" in sql
    assert "grant execute on function public.hosted_proxy_mark_rate_limited(uuid, text, bigint) to service_role" in sql
    assert "add column reset_at bigint" in sql
    assert "create function public.hosted_proxy_recover_expired_rate_limits" in sql
    assert "reset_at <= extract(epoch from now())::bigint" in sql


def test_hosted_proxy_session_affinity_is_private_and_hash_only() -> None:
    sql = SESSION_AFFINITY_MIGRATION.read_text(encoding="utf-8").lower()

    assert "create table app.hosted_proxy_session_affinity" in sql
    assert "session_key_hash text" in sql
    assert "length(session_key_hash) = 64" in sql
    assert "force row level security" in sql
    assert "create function public.hosted_proxy_session_account" in sql
    assert "create function public.hosted_proxy_bind_session" in sql
    assert "revoke all on function public.hosted_proxy_session_account(uuid, text), public.hosted_proxy_bind_session(uuid, text, text) from public, anon, authenticated" in sql


def test_hosted_proxy_api_keys_are_hash_only_and_service_role_only() -> None:
    sql = API_KEYS_MIGRATION.read_text(encoding="utf-8").lower()

    assert "create table app.hosted_proxy_api_keys" in sql
    assert "key_hash text not null unique" in sql
    assert "key_hash ~ '^[0-9a-f]{64}$'" in sql
    assert "force row level security" in sql
    assert "revoke all on table app.hosted_proxy_api_keys from anon, authenticated" in sql
    assert "create function public.hosted_proxy_authenticate_api_key" in sql
    assert "set last_used_at = now()" in sql
    assert "create function public.hosted_proxy_create_api_key" in sql
    assert "create function public.hosted_proxy_revoke_api_key" in sql
    assert "to service_role" in sql


def test_hosted_websocket_spool_is_private_owner_scoped_and_bounded() -> None:
    sql = WEBSOCKET_SPOOL_MIGRATION.read_text(encoding="utf-8").lower()

    assert "create table app.hosted_proxy_websocket_spools" in sql
    assert "create table app.hosted_proxy_websocket_events" in sql
    assert "owner_id uuid not null references auth.users" in sql
    assert "session_key_hash text check (session_key_hash is null or length(session_key_hash) = 64)" in sql
    assert "event_frame jsonb not null check (jsonb_typeof(event_frame) = 'object')" in sql
    assert "octet_length(event_frame::text) <= 262144" in sql
    assert "force row level security" in sql
    assert "revoke all on table app.hosted_proxy_websocket_spools, app.hosted_proxy_websocket_events from anon, authenticated" in sql
    assert "create function public.hosted_proxy_append_websocket_event" in sql
    assert "create function public.hosted_proxy_read_websocket_events" in sql
    assert "terminal_cursor is null" in sql
    assert "to service_role" in sql


def test_hosted_websocket_spool_has_an_idempotent_periodic_purge() -> None:
    sql = WEBSOCKET_SPOOL_SCHEDULE_MIGRATION.read_text(encoding="utf-8").lower()

    assert "purge-hosted-proxy-websocket-spools" in sql
    assert "cron.unschedule" in sql
    assert "cron.schedule" in sql
    assert "'*/5 * * * *'" in sql
    assert "select public.hosted_proxy_purge_expired_websocket_spools();" in sql


def test_hosted_websocket_replay_status_is_private_and_active_only() -> None:
    sql = WEBSOCKET_SPOOL_STATUS_MIGRATION.read_text(encoding="utf-8").lower()

    assert "create function public.hosted_proxy_websocket_spool_status" in sql
    assert "spool.owner_id = requested_owner_id" in sql
    assert "spool.expires_at > now()" in sql
    assert "revoke all" in sql
    assert "to service_role" in sql
