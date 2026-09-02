from __future__ import annotations

from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
MIGRATION = REPOSITORY_ROOT / "app" / "db" / "alembic" / "versions" / "20260829_000000_add_opencode_go_usage_monitor.py"
MODELS = REPOSITORY_ROOT / "app" / "db" / "models.py"


def test_opencode_go_window_check_quotes_the_postgres_reserved_column() -> None:
    expected_source = "\\\"window\\\" IN ('rolling', 'weekly', 'monthly')"

    assert expected_source in MIGRATION.read_text(encoding="utf-8")
    assert expected_source in MODELS.read_text(encoding="utf-8")
