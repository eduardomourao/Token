from __future__ import annotations

from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
MIGRATION = REPOSITORY_ROOT / "supabase" / "migrations" / "20260901210000_hosted_proxy_credentials.sql"
IMPORT_RPC_MIGRATION = REPOSITORY_ROOT / "supabase" / "migrations" / "20260901211500_hosted_proxy_import_rpc.sql"


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
