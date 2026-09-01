from __future__ import annotations

from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
MIGRATION = REPOSITORY_ROOT / "supabase" / "migrations" / "20260901190000_harden_usage_collection_claims.sql"


def test_collection_claim_is_provider_fenced_and_prevents_duplicate_upstream_work() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    assert "p_provider text" in sql
    assert "provider = p_provider" in sql
    assert "'collecting'" in sql
    assert "where public.usage_collections.status = 'failed'" in sql
    assert "is_claimed boolean" in sql


def test_collection_hardening_adds_monitor_history_indexes() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    assert "usage_snapshots_monitor_captured_at_idx" in sql
    assert "usage_collections_owner_monitor_slot_idx" in sql
    assert "to service_role" in sql
