from __future__ import annotations

from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
MIGRATION = REPOSITORY_ROOT / "supabase" / "migrations" / "20260901141751_usage_monitor_gemini_slice.sql"


def _migration_sql() -> str:
    return MIGRATION.read_text(encoding="utf-8").lower()


def test_gemini_monitor_slice_keeps_monitor_collections_and_snapshots_separate() -> None:
    sql = _migration_sql()

    assert "create table public.usage_monitors" in sql
    assert "create table public.usage_collections" in sql
    assert "create table public.usage_snapshots" in sql
    assert "provider = 'gemini_cli'" in sql
    assert "unique (owner_id, provider)" in sql
    assert "unique (monitor_id, collection_slot)" in sql


def test_gemini_monitor_slice_enforces_owner_read_access_and_keeps_credentials_private() -> None:
    sql = _migration_sql()

    for table in ("usage_monitors", "usage_collections", "usage_snapshots"):
        assert f"alter table public.{table} enable row level security" in sql
        assert f"alter table public.{table} force row level security" in sql
        assert "to authenticated" in sql
        assert "(select auth.uid()) = owner_id" in sql

    assert "create schema if not exists app" in sql
    assert "create table app.usage_monitor_credentials" in sql
    assert "revoke all on table app.usage_monitor_credentials from anon, authenticated" in sql
    assert "grant select on table app.usage_monitor_credentials to anon" not in sql


def test_gemini_monitor_slice_makes_snapshot_rows_realtime_eligible_without_mutating_realtime_schema() -> None:
    sql = _migration_sql()

    assert "alter publication supabase_realtime add table public.usage_snapshots" in sql
    assert "create table realtime." not in sql
    assert "alter table realtime." not in sql
