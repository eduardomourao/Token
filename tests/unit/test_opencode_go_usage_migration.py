from __future__ import annotations

from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
MIGRATION = REPOSITORY_ROOT / "supabase" / "migrations" / "20260901180000_add_opencode_go_usage_provider.sql"


def test_opencode_go_extends_the_existing_owner_scoped_monitor_model() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    assert "provider in ('gemini_cli', 'opencode_go')" in sql
    assert "create or replace function public.claim_usage_collection" in sql
    assert "where id = p_monitor_id and owner_id = p_owner_id and enabled" in sql
    assert "on conflict (monitor_id, collection_slot) do update" in sql


def test_opencode_go_schedule_uses_the_vault_backed_collector_secret() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    assert "collect-opencode-go-usage" in sql
    assert "net.http_post" in sql
    assert "codex_lb_usage_monitor_collector_secret" in sql
    assert "'*/5 * * * *'" in sql
