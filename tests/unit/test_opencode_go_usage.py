from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

import pytest
from alembic import command
from sqlalchemy import create_engine, inspect

from app.db.models import OpenCodeGoUsageSample
from app.db.session import SessionLocal
from app.modules.opencode_go_usage import client as client_module
from app.modules.opencode_go_usage import scheduler as scheduler_module
from app.modules.opencode_go_usage.client import (
    OpenCodeGoUsageClient,
    OpenCodeGoUsagePayloadError,
    OpenCodeGoUsageUpstreamError,
    OpenCodeGoUsageWindow,
    parse_usage_payload,
)
from app.modules.opencode_go_usage.repository import OpenCodeGoUsageRepository
from app.modules.opencode_go_usage.service import OpenCodeGoUsageRefreshError, OpenCodeGoUsageService


def test_parse_usage_payload_returns_all_windows_and_preserves_decimal_capacity() -> None:
    payload = {
        "usage": {
            "rolling": {"status": "ok", "percent": 50, "resetsAt": "2030-01-02T03:04:05Z"},
            "weekly": {"status": "ok", "percent": "25.5", "resetsAt": "2030-01-09T03:04:05Z"},
            "monthly": {"status": "ok", "percent": 75.25, "resetsAt": "2030-02-01T03:04:05+00:00"},
        }
    }

    windows = parse_usage_payload(payload)

    assert [window.window for window in windows] == ["rolling", "weekly", "monthly"]
    assert windows[1].remaining_percent == 25.5
    assert windows[2].used_percent == 24.75
    assert windows[0].resets_at == datetime(2030, 1, 2, 3, 4, 5, tzinfo=timezone.utc)


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"usage": {"rolling": {"status": "ok", "percent": 10, "resetsAt": "2030-01-01T00:00:00Z"}}},
        {
            "usage": {
                "rolling": {"status": "blocked", "percent": 10, "resetsAt": "2030-01-01T00:00:00Z"},
                "weekly": {"status": "ok", "percent": 20, "resetsAt": "2030-01-01T00:00:00Z"},
                "monthly": {"status": "ok", "percent": 30, "resetsAt": "2030-01-01T00:00:00Z"},
            }
        },
    ],
)
def test_parse_usage_payload_rejects_incomplete_or_unhealthy_usage(payload: dict) -> None:
    with pytest.raises(OpenCodeGoUsagePayloadError):
        parse_usage_payload(payload)


class _FakeResponse:
    def __init__(self, status: int, payload: object | None = None, *, json_error: Exception | None = None) -> None:
        self.status = status
        self._payload = payload
        self._json_error = json_error

    async def json(self, *, content_type=None):
        del content_type
        if self._json_error:
            raise self._json_error
        return self._payload


class _FakeRequest:
    def __init__(self, response: _FakeResponse | Exception) -> None:
        self._response = response

    async def __aenter__(self):
        if isinstance(self._response, Exception):
            raise self._response
        return self._response

    async def __aexit__(self, *args) -> None:
        return None


class _FakeSession:
    def __init__(self, response: _FakeResponse | Exception) -> None:
        self._response = response
        self.request = None

    def get(self, url: str, **kwargs):
        self.request = (url, kwargs)
        return _FakeRequest(self._response)


@pytest.mark.asyncio
@pytest.mark.parametrize("status", [401, 403, 429, 500])
async def test_client_sanitizes_http_errors_and_uses_bearer_timeout(monkeypatch, status: int) -> None:
    session = _FakeSession(_FakeResponse(status))

    @asynccontextmanager
    async def fake_lease():
        yield session

    monkeypatch.setattr(client_module, "lease_http_session", fake_lease)
    with pytest.raises(OpenCodeGoUsageUpstreamError) as failure:
        await OpenCodeGoUsageClient().fetch("go-secret")

    assert "go-secret" not in str(failure.value)
    assert session.request is not None
    _, kwargs = session.request
    assert kwargs["headers"]["Authorization"] == "Bearer go-secret"
    assert kwargs["timeout"].connect == 10
    assert kwargs["timeout"].total == 30


@pytest.mark.asyncio
async def test_client_sanitizes_timeout(monkeypatch) -> None:
    @asynccontextmanager
    async def fake_lease():
        yield _FakeSession(TimeoutError("go-secret"))

    monkeypatch.setattr(client_module, "lease_http_session", fake_lease)
    with pytest.raises(OpenCodeGoUsageUpstreamError) as failure:
        await OpenCodeGoUsageClient().fetch("go-secret")
    assert "go-secret" not in str(failure.value)


class _UsageClient:
    def __init__(
        self,
        windows: list[OpenCodeGoUsageWindow] | Exception,
        *,
        expected_api_key: str | None = None,
    ) -> None:
        self.windows = windows
        self.expected_api_key = expected_api_key

    async def fetch(self, api_key: str) -> list[OpenCodeGoUsageWindow]:
        if self.expected_api_key is not None:
            assert api_key == self.expected_api_key
        if isinstance(self.windows, Exception):
            raise self.windows
        return self.windows


def _windows() -> list[OpenCodeGoUsageWindow]:
    reset_at = datetime(2030, 1, 1, tzinfo=timezone.utc)
    return [
        OpenCodeGoUsageWindow("rolling", 80, reset_at),
        OpenCodeGoUsageWindow("weekly", 60, reset_at),
        OpenCodeGoUsageWindow("monthly", 40, reset_at),
    ]


@pytest.mark.asyncio
async def test_service_encryption_export_and_last_success_preservation(db_setup) -> None:
    del db_setup
    async with SessionLocal() as session:
        service = OpenCodeGoUsageService(
            OpenCodeGoUsageRepository(session),
            client=_UsageClient(_windows(), expected_api_key="go-secret"),
        )
        configured = await service.configure(" go-secret ")
        assert configured.configured is True
        assert [(item.window, item.remaining_percent) for item in configured.windows] == [
            ("rolling", 80),
            ("weekly", 60),
            ("monthly", 40),
        ]
        monitor = await OpenCodeGoUsageRepository(session).get_monitor()
        assert monitor is not None
        assert b"go-secret" not in monitor.api_key_encrypted
        assert "rolling,80,20" in await service.csv_export()

    async with SessionLocal() as session:
        failing = OpenCodeGoUsageService(
            OpenCodeGoUsageRepository(session),
            client=_UsageClient(OpenCodeGoUsageUpstreamError("unavailable")),
        )
        with pytest.raises(OpenCodeGoUsageRefreshError):
            await failing.refresh()
        state = await failing.get_monitor()
        assert state.last_error == "upstream_unavailable"
        assert len(state.windows) == 3


@pytest.mark.asyncio
async def test_service_prunes_samples_older_than_ninety_days(db_setup) -> None:
    del db_setup
    async with SessionLocal() as session:
        service = OpenCodeGoUsageService(OpenCodeGoUsageRepository(session), client=_UsageClient(_windows()))
        await service.configure("go-secret")
        old = OpenCodeGoUsageSample(
            window="rolling",
            remaining_percent=1,
            resets_at=datetime(2030, 1, 1, tzinfo=timezone.utc),
            captured_at=datetime.now() - timedelta(days=91),
        )
        session.add(old)
        await session.commit()
        assert await service.prune_expired_samples() == 1


@pytest.mark.asyncio
async def test_failed_key_replacement_keeps_prior_encrypted_configuration(db_setup) -> None:
    del db_setup
    async with SessionLocal() as session:
        repository = OpenCodeGoUsageRepository(session)
        await OpenCodeGoUsageService(repository, client=_UsageClient(_windows())).configure("prior-key")
        before = await repository.get_monitor()
        assert before is not None
        encrypted_before = before.api_key_encrypted

        failing = OpenCodeGoUsageService(
            repository,
            client=_UsageClient(OpenCodeGoUsageUpstreamError("replacement-key")),
        )
        with pytest.raises(OpenCodeGoUsageRefreshError) as failure:
            await failing.configure("replacement-key")
        assert "replacement-key" not in str(failure.value)

        after = await repository.get_monitor()
        assert after is not None
        assert after.api_key_encrypted == encrypted_before


@pytest.mark.asyncio
async def test_scheduler_only_executes_the_refresh_while_leader(monkeypatch) -> None:
    called = False

    class _Leader:
        async def run_if_leader(self, callback):
            nonlocal called
            called = True
            return await callback()

    scheduler = scheduler_module.OpenCodeGoUsageScheduler()
    monkeypatch.setattr(scheduler_module, "_leader_election", lambda: _Leader())

    async def refresh_as_leader() -> None:
        return None

    monkeypatch.setattr(scheduler, "_refresh_as_leader", refresh_as_leader)
    await scheduler.run_once()
    assert called is True


@pytest.mark.asyncio
async def test_scheduler_skips_background_refresh_without_a_configured_key(monkeypatch) -> None:
    @asynccontextmanager
    async def fake_background_session():
        yield object()

    class _RepositoryWithoutKey:
        def __init__(self, session) -> None:
            del session

        async def get_monitor(self):
            return None

    class _ServiceMustNotBeCreated:
        def __init__(self, repository) -> None:
            del repository
            raise AssertionError("refresh service must not run without a configured key")

    monkeypatch.setattr(scheduler_module, "get_background_session", fake_background_session)
    monkeypatch.setattr(scheduler_module, "OpenCodeGoUsageRepository", _RepositoryWithoutKey)
    monkeypatch.setattr(scheduler_module, "OpenCodeGoUsageService", _ServiceMustNotBeCreated)
    await scheduler_module.OpenCodeGoUsageScheduler()._refresh_as_leader()


def test_monitor_migration_upgrades_and_downgrades(tmp_path) -> None:
    from app.db.migrate import _build_alembic_config, run_upgrade

    database_url = f"sqlite:///{tmp_path / 'opencode-go-usage.db'}"
    parent_revision = "20260828_000000_add_accounts_chatgpt_identity_index"
    target_revision = "20260829_000000_add_opencode_go_usage_monitor"
    run_upgrade(database_url, parent_revision, bootstrap_legacy=False)
    config = _build_alembic_config(database_url)
    engine = create_engine(database_url)
    try:
        command.upgrade(config, target_revision)
        with engine.connect() as connection:
            inspector = inspect(connection)
            assert inspector.has_table("opencode_go_usage_monitor")
            assert inspector.has_table("opencode_go_usage_samples")
            assert {"ix_opencode_go_usage_samples_captured_at", "ix_opencode_go_usage_samples_window_captured"} <= {
                item["name"] for item in inspector.get_indexes("opencode_go_usage_samples")
            }

        command.downgrade(config, parent_revision)
        with engine.connect() as connection:
            inspector = inspect(connection)
            assert not inspector.has_table("opencode_go_usage_monitor")
            assert not inspector.has_table("opencode_go_usage_samples")
    finally:
        engine.dispose()
