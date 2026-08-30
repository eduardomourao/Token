from __future__ import annotations

from pathlib import Path

import pytest

from scripts.migration.contract_inventory import (
    ContractValidationError,
    build_contract_inventory,
    main,
    render_inventory,
    safe_report_path,
)

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
PROTECTED_SOURCE_FILES = (
    "frontend/vite.config.ts",
    "frontend/src/App.tsx",
    "frontend/src/features/usage-monitor/components/usage-monitor-page.tsx",
    "frontend/src/features/usage-monitor/hooks/use-swipe.ts",
    "app/modules/usage/api.py",
    "app/main.py",
)


def test_inventory_captures_protected_migration_contracts() -> None:
    inventory = build_contract_inventory(REPOSITORY_ROOT)

    assert inventory["contracts"] == {
        "fastapi_usage_api_prefix": "/api/usage",
        "frontend_dev_proxy_paths": ["/api", "/v1", "/backend-api", "/health"],
        "service_worker": {"api_cache_pattern": "^/api/.*$", "strategy": "NetworkFirst"},
        "usage_monitor": {
            "poll_interval_ms": 60_000,
            "route": "/usage-monitor",
            "selection_storage": "browser-local-storage",
            "swipe_threshold_px": 50,
        },
    }


def test_inventory_rendering_is_deterministic_and_contains_no_absolute_workspace_path() -> None:
    rendered = render_inventory(REPOSITORY_ROOT)

    assert rendered == render_inventory(REPOSITORY_ROOT)
    assert str(REPOSITORY_ROOT) not in rendered
    assert "app/static" not in rendered


def test_inventory_fails_when_a_protected_proxy_declaration_is_removed(tmp_path: Path) -> None:
    for relative_path in PROTECTED_SOURCE_FILES:
        source_path = REPOSITORY_ROOT / relative_path
        target_path = tmp_path / relative_path
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_text(source_path.read_text(encoding="utf-8"), encoding="utf-8")

    vite_config = tmp_path / "frontend/vite.config.ts"
    vite_config.write_text(
        vite_config.read_text(encoding="utf-8").replace('"/health": proxyTarget', '"/healthcheck": proxyTarget'),
        encoding="utf-8",
    )

    with pytest.raises(ContractValidationError, match='"/health": proxyTarget'):
        build_contract_inventory(tmp_path)


def test_report_path_rejects_paths_outside_safe_local_report_directory(tmp_path: Path) -> None:
    with pytest.raises(ContractValidationError, match="scripts/migration/reports"):
        safe_report_path(tmp_path, tmp_path / "contract-report.json")


def test_command_rejects_unsafe_report_path(capsys: pytest.CaptureFixture[str]) -> None:
    result = main(["--repo-root", str(REPOSITORY_ROOT), "--report", "migration-contracts.json"])

    assert result == 1
    assert "report path must be" in capsys.readouterr().out
