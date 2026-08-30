"""Validate migration-critical source declarations without running the application.

This tool deliberately reads only maintained source files. It does not read generated
``app/static`` assets, environment files, databases, or network resources.
"""

from __future__ import annotations

import argparse
import json
from collections.abc import Iterable
from pathlib import Path


class ContractValidationError(RuntimeError):
    """Raised when a protected migration contract is no longer declared in source."""


_VITE_CONFIG = Path("frontend/vite.config.ts")
_APP = Path("frontend/src/App.tsx")
_USAGE_MONITOR_PAGE = Path("frontend/src/features/usage-monitor/components/usage-monitor-page.tsx")
_SWIPE_HOOK = Path("frontend/src/features/usage-monitor/hooks/use-swipe.ts")
_USAGE_API = Path("app/modules/usage/api.py")
_FASTAPI_MAIN = Path("app/main.py")
_SAFE_REPORT_DIRECTORY = Path("scripts/migration/reports")


def _read_source(repo_root: Path, relative_path: Path) -> str:
    path = repo_root / relative_path
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError as error:
        raise ContractValidationError(f"missing protected source file: {relative_path.as_posix()}") from error


def _require(source: str, declaration: str, source_path: Path) -> None:
    if declaration not in source:
        raise ContractValidationError(f"missing protected declaration in {source_path.as_posix()}: {declaration!r}")


def build_contract_inventory(repo_root: Path) -> dict[str, object]:
    """Return deterministic inventory after checking protected source declarations."""

    sources = {
        _VITE_CONFIG: _read_source(repo_root, _VITE_CONFIG),
        _APP: _read_source(repo_root, _APP),
        _USAGE_MONITOR_PAGE: _read_source(repo_root, _USAGE_MONITOR_PAGE),
        _SWIPE_HOOK: _read_source(repo_root, _SWIPE_HOOK),
        _USAGE_API: _read_source(repo_root, _USAGE_API),
        _FASTAPI_MAIN: _read_source(repo_root, _FASTAPI_MAIN),
    }

    vite = sources[_VITE_CONFIG]
    proxy_paths = ("/api", "/v1", "/backend-api", "/health")
    for path in proxy_paths:
        _require(vite, f'"{path}": proxyTarget', _VITE_CONFIG)
    _require(vite, "urlPattern: /^\\/api\\/.*$/i", _VITE_CONFIG)
    _require(vite, 'cacheName: "api-cache"', _VITE_CONFIG)

    app = sources[_APP]
    _require(app, 'path="/usage-monitor"', _APP)
    _require(app, "<UsageMonitorPage />", _APP)

    monitor = sources[_USAGE_MONITOR_PAGE]
    _require(monitor, "const POLL_INTERVAL_MS = 60_000;", _USAGE_MONITOR_PAGE)
    _require(monitor, "refetchInterval: POLL_INTERVAL_MS", _USAGE_MONITOR_PAGE)
    _require(monitor, "readUsageMonitorSelection()", _USAGE_MONITOR_PAGE)
    _require(
        monitor,
        "window.localStorage.setItem(USAGE_MONITOR_SELECTION_STORAGE_KEY, selection);",
        _USAGE_MONITOR_PAGE,
    )
    _require(monitor, "useSwipe({", _USAGE_MONITOR_PAGE)

    swipe = sources[_SWIPE_HOOK]
    _require(swipe, "const SWIPE_THRESHOLD_PX = 50;", _SWIPE_HOOK)
    _require(swipe, "if (horizontalDistance < 0) onSwipeLeft();", _SWIPE_HOOK)
    _require(swipe, "else onSwipeRight();", _SWIPE_HOOK)

    usage_api = sources[_USAGE_API]
    _require(usage_api, 'prefix="/api/usage"', _USAGE_API)
    _require(sources[_FASTAPI_MAIN], "app.include_router(usage_api.router)", _FASTAPI_MAIN)

    return {
        "schema_version": 1,
        "source_files": [path.as_posix() for path in sorted(sources)],
        "contracts": {
            "frontend_dev_proxy_paths": list(proxy_paths),
            "usage_monitor": {
                "route": "/usage-monitor",
                "poll_interval_ms": 60_000,
                "selection_storage": "browser-local-storage",
                "swipe_threshold_px": 50,
            },
            "service_worker": {"api_cache_pattern": "^/api/.*$", "strategy": "NetworkFirst"},
            "fastapi_usage_api_prefix": "/api/usage",
        },
    }


def render_inventory(repo_root: Path) -> str:
    """Render inventory as stable JSON suitable for local CI artifacts."""

    return json.dumps(build_contract_inventory(repo_root), indent=2, sort_keys=True) + "\n"


def safe_report_path(repo_root: Path, output: Path) -> Path:
    """Allow reports only in a source-controlled, non-sensitive local directory."""

    allowed_directory = (repo_root / _SAFE_REPORT_DIRECTORY).resolve()
    candidate = output if output.is_absolute() else repo_root / output
    candidate = candidate.resolve()
    if candidate.parent != allowed_directory or candidate.suffix != ".json":
        raise ContractValidationError("report path must be a .json file directly under scripts/migration/reports")
    return candidate


def write_report(repo_root: Path, output: Path) -> Path:
    """Write only deterministic contract metadata; never source contents or runtime data."""

    report_path = safe_report_path(repo_root, output)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(render_inventory(repo_root), encoding="utf-8")
    return report_path


def parse_args(arguments: Iterable[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate static migration contracts.")
    parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    parser.add_argument(
        "--report",
        type=Path,
        help="Optional local JSON report under scripts/migration/reports.",
    )
    return parser.parse_args(arguments)


def main(arguments: Iterable[str] | None = None) -> int:
    args = parse_args(arguments)
    repo_root = args.repo_root.resolve()
    try:
        if args.report is not None:
            report_path = write_report(repo_root, args.report)
            print(report_path.relative_to(repo_root).as_posix())
        else:
            print(render_inventory(repo_root), end="")
    except ContractValidationError as error:
        print(f"contract validation failed: {error}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
