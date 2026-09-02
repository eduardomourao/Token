from __future__ import annotations

import asyncio
import csv
import io
from datetime import timedelta
from typing import Protocol

from app.core.crypto import TokenEncryptor
from app.core.utils.time import utcnow
from app.db.models import OpenCodeGoUsageSample
from app.modules.opencode_go_usage.client import OpenCodeGoUsageClient, OpenCodeGoUsageError, OpenCodeGoUsageWindow
from app.modules.opencode_go_usage.repository import OpenCodeGoUsageRepository
from app.modules.opencode_go_usage.schemas import OpenCodeGoUsageMonitorResponse, OpenCodeGoUsageWindowResponse

_refresh_lock = asyncio.Lock()
_RETENTION_DAYS = 90


class OpenCodeGoUsageFetcher(Protocol):
    async def fetch(self, api_key: str) -> list[OpenCodeGoUsageWindow]: ...


class OpenCodeGoUsageNotConfiguredError(ValueError):
    pass


class OpenCodeGoUsageRefreshError(ValueError):
    pass


class OpenCodeGoUsageService:
    def __init__(
        self,
        repository: OpenCodeGoUsageRepository,
        *,
        client: OpenCodeGoUsageFetcher | None = None,
        encryptor: TokenEncryptor | None = None,
    ) -> None:
        self._repository = repository
        self._client = client or OpenCodeGoUsageClient()
        self._encryptor = encryptor or TokenEncryptor()

    async def get_monitor(self) -> OpenCodeGoUsageMonitorResponse:
        monitor = await self._repository.get_monitor()
        samples = await self._repository.latest_samples()
        return _to_response(monitor, samples)

    async def configure(self, api_key: str) -> OpenCodeGoUsageMonitorResponse:
        normalized = api_key.strip()
        if not normalized:
            raise ValueError("OpenCode Go API key is required")
        try:
            windows = await self._fetch(normalized)
        except (OpenCodeGoUsageError, OpenCodeGoUsageRefreshError) as exc:
            # Validate before replacing the persisted credential. Keep the
            # previous encrypted value and its last successful samples intact.
            raise OpenCodeGoUsageRefreshError("OpenCode Go credential validation failed") from exc
        now = utcnow()
        await self._repository.persist_success(
            api_key_encrypted=self._encryptor.encrypt(normalized),
            samples=_sample_rows(windows, now),
            attempted_at=now,
        )
        return await self.get_monitor()

    async def refresh(self, *, raise_on_error: bool = True) -> OpenCodeGoUsageMonitorResponse:
        async with _refresh_lock:
            monitor = await self._repository.get_monitor()
            if monitor is None:
                raise OpenCodeGoUsageNotConfiguredError("OpenCode Go monitor is not configured")
            now = utcnow()
            try:
                windows = await self._fetch(self._encryptor.decrypt(monitor.api_key_encrypted))
            except (OpenCodeGoUsageError, OpenCodeGoUsageRefreshError) as exc:
                await self._repository.record_failure(attempted_at=now, error_code=_error_code(exc))
                if raise_on_error:
                    raise OpenCodeGoUsageRefreshError("OpenCode Go usage refresh failed") from exc
                return await self.get_monitor()
            await self._repository.persist_success(
                api_key_encrypted=None,
                samples=_sample_rows(windows, now),
                attempted_at=now,
            )
            return await self.get_monitor()

    async def clear(self) -> bool:
        return await self._repository.clear()

    async def csv_export(self) -> str:
        rows = await self._repository.history()
        output = io.StringIO(newline="")
        writer = csv.writer(output)
        writer.writerow(["captured_at", "window", "remaining_percent", "used_percent", "resets_at"])
        for row in rows:
            writer.writerow(
                [
                    row.captured_at.isoformat(),
                    row.window,
                    _format_percent(row.remaining_percent),
                    _format_percent(100.0 - row.remaining_percent),
                    row.resets_at.isoformat(),
                ]
            )
        return output.getvalue()

    async def prune_expired_samples(self) -> int:
        return await self._repository.prune_before(utcnow() - timedelta(days=_RETENTION_DAYS))

    async def _fetch(self, api_key: str):
        try:
            return await self._client.fetch(api_key)
        except OpenCodeGoUsageError:
            raise
        except Exception as exc:
            raise OpenCodeGoUsageRefreshError("OpenCode Go usage refresh failed") from exc


def _sample_rows(windows, captured_at):
    return [
        OpenCodeGoUsageSample(
            window=window.window,
            remaining_percent=window.remaining_percent,
            resets_at=window.resets_at,
            captured_at=captured_at,
        )
        for window in windows
    ]


def _to_response(monitor, samples: list[OpenCodeGoUsageSample]) -> OpenCodeGoUsageMonitorResponse:
    return OpenCodeGoUsageMonitorResponse(
        configured=monitor is not None,
        last_attempt_at=monitor.last_attempt_at if monitor else None,
        last_success_at=monitor.last_success_at if monitor else None,
        last_error=monitor.last_error if monitor else None,
        windows=[
            OpenCodeGoUsageWindowResponse(
                window=sample.window,
                remaining_percent=sample.remaining_percent,
                used_percent=100.0 - sample.remaining_percent,
                resets_at=sample.resets_at,
                captured_at=sample.captured_at,
            )
            for sample in samples
        ],
    )


def _error_code(error: Exception) -> str:
    return "invalid_payload" if error.__class__.__name__.endswith("PayloadError") else "upstream_unavailable"


def _format_percent(value: float) -> str:
    return f"{value:.2f}".rstrip("0").rstrip(".")
