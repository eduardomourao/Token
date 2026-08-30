# ruff: noqa: E501
from __future__ import annotations

from datetime import datetime, timezone

import pytest
from alembic import command
from sqlalchemy import create_engine, inspect

from app.db.session import SessionLocal
from app.modules.antigravity_usage.client import (
    AntigravityUsageWindow,
    parse_available_models,
)
from app.modules.antigravity_usage.repository import AntigravityUsageRepository
from app.modules.antigravity_usage.service import AntigravityUsageService
from app.modules.gemini_usage.client import GeminiUsageUpstreamError, GeminiUsageWindow, parse_quota_buckets
from app.modules.gemini_usage.repository import GeminiUsageRepository
from app.modules.gemini_usage.service import GeminiUsageRefreshError, GeminiUsageService


def test_gemini_parser_selects_latest_request_buckets() -> None:
    windows = parse_quota_buckets(
        {
            "buckets": [
                {
                    "modelId": "gemini-3.1-pro-preview",
                    "tokenType": "TOKENS",
                    "remainingFraction": 0.9,
                    "resetTime": "2030-01-01T00:00:00Z",
                },
                {
                    "modelId": "gemini-3.1-pro-preview",
                    "tokenType": "REQUESTS",
                    "remainingFraction": 0.8,
                    "resetTime": "2030-01-01T00:00:00Z",
                },
                {"modelId": "gemini-3-flash-preview", "remainingFraction": 0.5, "resetTime": "2030-01-01T00:00:00Z"},
            ]
        }
    )
    assert [(item.window, item.remaining_percent) for item in windows] == [("pro_latest", 80), ("flash_latest", 50)]


def test_antigravity_parser_collapses_groups_conservatively() -> None:
    now = datetime(2030, 1, 1, tzinfo=timezone.utc)
    windows = parse_available_models(
        {
            "models": {
                "gemini-pro": {
                    "modelProvider": "google",
                    "quotaInfo": {"remainingFraction": 0.8, "resetTime": "2030-01-01T05:00:00Z"},
                },
                "gemini-flash": {"quotaInfo": {"remainingFraction": 0.4, "resetTime": "2030-01-01T04:00:00Z"}},
                "claude-sonnet": {
                    "modelProvider": "anthropic",
                    "quotaInfo": {"remainingFraction": 0.7, "resetTime": "2030-01-08T00:00:00Z"},
                },
            }
        },
        now=now,
    )
    assert [(item.group, item.remaining_percent, item.window_kind) for item in windows] == [
        ("gemini", 40, "five_hour"),
        ("claude_gpt", 70, "weekly"),
    ]


class _GeminiClient:
    async def fetch(self, refresh_token: str):
        assert refresh_token == "gemini-secret"
        return [GeminiUsageWindow("pro_latest", "Pro Latest", 75, datetime(2030, 1, 1, tzinfo=timezone.utc))]


class _AntigravityClient:
    async def fetch(self, refresh_token: str):
        assert refresh_token == "antigravity-secret"
        return [
            AntigravityUsageWindow("gemini", "five_hour", "Gemini Pool", 65, datetime(2030, 1, 1, tzinfo=timezone.utc))
        ]


@pytest.mark.asyncio
async def test_google_cli_services_encrypt_credentials_and_preserve_last_success(db_setup) -> None:
    del db_setup
    async with SessionLocal() as session:
        gemini = GeminiUsageService(GeminiUsageRepository(session), client=_GeminiClient())
        antigravity = AntigravityUsageService(AntigravityUsageRepository(session), client=_AntigravityClient())
        assert (await gemini.configure("gemini-secret")).windows[0].used_percent == 25
        assert (await antigravity.configure("antigravity-secret")).windows[0].used_percent == 35
        assert b"gemini-secret" not in (await GeminiUsageRepository(session).get_monitor()).refresh_token_encrypted
        assert (
            b"antigravity-secret"
            not in (await AntigravityUsageRepository(session).get_monitor()).refresh_token_encrypted
        )


@pytest.mark.asyncio
async def test_failed_google_cli_refresh_keeps_samples(db_setup) -> None:
    del db_setup
    async with SessionLocal() as session:
        repository = GeminiUsageRepository(session)
        await GeminiUsageService(repository, client=_GeminiClient()).configure("gemini-secret")

        class _FailingClient:
            async def fetch(self, refresh_token: str):
                raise GeminiUsageUpstreamError(refresh_token)

        service = GeminiUsageService(repository, client=_FailingClient())
        with pytest.raises(GeminiUsageRefreshError) as failure:
            await service.refresh()
        assert "gemini-secret" not in str(failure.value)
        assert (await service.get_monitor()).windows[0].window == "pro_latest"


def test_google_cli_monitor_migration_upgrades_and_downgrades(tmp_path) -> None:
    from app.db.migrate import _build_alembic_config, run_upgrade

    database_url = f"sqlite:///{tmp_path / 'google-cli-usage.db'}"
    parent_revision = "20260829_000000_add_opencode_go_usage_monitor"
    target_revision = "20260829_010000_add_google_cli_usage_monitors"
    run_upgrade(database_url, parent_revision, bootstrap_legacy=False)
    config = _build_alembic_config(database_url)
    engine = create_engine(database_url)
    try:
        command.upgrade(config, target_revision)
        with engine.connect() as connection:
            inspector = inspect(connection)
            assert inspector.has_table("gemini_usage_monitor")
            assert inspector.has_table("gemini_usage_sample")
            assert inspector.has_table("antigravity_usage_monitor")
            assert inspector.has_table("antigravity_usage_sample")
        command.downgrade(config, parent_revision)
        with engine.connect() as connection:
            inspector = inspect(connection)
            assert not inspector.has_table("gemini_usage_monitor")
            assert not inspector.has_table("antigravity_usage_monitor")
    finally:
        engine.dispose()
