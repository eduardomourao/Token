from __future__ import annotations

from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
MIGRATION = REPOSITORY_ROOT / "supabase" / "migrations" / "20260901160000_usage_collection_transactions.sql"


def test_usage_collection_transaction_functions_are_service_only_and_idempotent() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    assert "create or replace function public.claim_usage_collection" in sql
    assert "on conflict (monitor_id, collection_slot) do update" in sql
    assert "create or replace function public.complete_usage_collection" in sql
    assert "create or replace function public.fail_usage_collection" in sql
    assert "security definer" in sql
    assert "grant execute on function public.claim_usage_collection" in sql
    assert "to service_role" in sql
    assert "from public, anon, authenticated" in sql


def test_usage_collection_transaction_migration_declares_single_owner_runtime_mode() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    assert "explicitly single-owner edge function secret configuration" in sql
