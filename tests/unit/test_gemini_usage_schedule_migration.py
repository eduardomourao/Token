from __future__ import annotations

from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
BASE_MIGRATION = REPOSITORY_ROOT / "supabase" / "migrations" / "20260901170000_schedule_gemini_usage_collection.sql"
MIGRATION = REPOSITORY_ROOT / "supabase" / "migrations" / "20260901171500_fix_gemini_usage_schedule_net_schema.sql"


def test_gemini_schedule_uses_internal_extensions_and_vault_backed_header_secret() -> None:
    base_sql = BASE_MIGRATION.read_text(encoding="utf-8").lower()
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    assert "create extension if not exists pg_net with schema extensions" in base_sql
    assert "create extension if not exists pg_cron with schema extensions" in base_sql
    assert "vault.decrypted_secrets" in sql
    assert "codex_lb_usage_monitor_collector_secret" in sql
    assert "net.http_post" in sql
    assert "extensions.net.http_post" not in sql
    assert "x-collector-secret" in sql


def test_gemini_schedule_is_replaced_by_name_and_runs_at_a_bounded_interval() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    assert "cron.unschedule(job_id)" in sql
    assert "'collect-gemini-usage'" in sql
    assert "'*/5 * * * *'" in sql
    assert "select app.schedule_gemini_usage_collection()" in sql
