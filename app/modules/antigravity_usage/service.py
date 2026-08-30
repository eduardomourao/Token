from __future__ import annotations

# ruff: noqa: E501
import asyncio

from app.core.crypto import TokenEncryptor
from app.core.utils.time import utcnow
from app.db.models import AntigravityUsageSample
from app.modules.antigravity_usage.client import AntigravityUsageClient, AntigravityUsageError
from app.modules.antigravity_usage.repository import AntigravityUsageRepository
from app.modules.antigravity_usage.schemas import AntigravityUsageMonitorResponse, AntigravityUsageWindowResponse

_refresh_lock = asyncio.Lock()


class AntigravityUsageNotConfiguredError(ValueError):
    pass


class AntigravityUsageRefreshError(ValueError):
    pass


class AntigravityUsageService:
    def __init__(
        self,
        repository: AntigravityUsageRepository,
        *,
        client: AntigravityUsageClient | None = None,
        encryptor: TokenEncryptor | None = None,
    ) -> None:
        self._repository = repository
        self._client = client or AntigravityUsageClient()
        self._encryptor = encryptor or TokenEncryptor()

    async def get_monitor(self) -> AntigravityUsageMonitorResponse:
        return _to_response(await self._repository.get_monitor(), await self._repository.latest_samples())

    async def configure(self, refresh_token: str) -> AntigravityUsageMonitorResponse:
        token = refresh_token.strip()
        if not token:
            raise ValueError("Antigravity refresh token is required")
        try:
            windows = await self._client.fetch(token)
        except AntigravityUsageError as exc:
            raise AntigravityUsageRefreshError("Antigravity credential validation failed") from exc
        now = utcnow()
        await self._repository.persist_success(
            refresh_token_encrypted=self._encryptor.encrypt(token), samples=_sample_rows(windows, now), attempted_at=now
        )
        return await self.get_monitor()

    async def refresh(self, *, raise_on_error: bool = True) -> AntigravityUsageMonitorResponse:
        async with _refresh_lock:
            monitor = await self._repository.get_monitor()
            if monitor is None:
                raise AntigravityUsageNotConfiguredError("Antigravity monitor is not configured")
            now = utcnow()
            try:
                windows = await self._client.fetch(self._encryptor.decrypt(monitor.refresh_token_encrypted))
            except AntigravityUsageError as exc:
                await self._repository.record_failure(attempted_at=now, error_code=_error_code(exc))
                if raise_on_error:
                    raise AntigravityUsageRefreshError("Antigravity usage refresh failed") from exc
                return await self.get_monitor()
            await self._repository.persist_success(
                refresh_token_encrypted=None, samples=_sample_rows(windows, now), attempted_at=now
            )
            return await self.get_monitor()

    async def clear(self) -> bool:
        return await self._repository.clear()


def _sample_rows(windows, captured_at):
    return [
        AntigravityUsageSample(
            group=item.group,
            window_kind=item.window_kind,
            label=item.label,
            remaining_percent=item.remaining_percent,
            resets_at=item.resets_at,
            captured_at=captured_at,
        )
        for item in windows
    ]


def _to_response(monitor, samples: list[AntigravityUsageSample]) -> AntigravityUsageMonitorResponse:
    return AntigravityUsageMonitorResponse(
        configured=monitor is not None,
        last_attempt_at=monitor.last_attempt_at if monitor else None,
        last_success_at=monitor.last_success_at if monitor else None,
        last_error=monitor.last_error if monitor else None,
        windows=[
            AntigravityUsageWindowResponse(
                group=item.group,
                window_kind=item.window_kind,
                label=item.label,
                remaining_percent=item.remaining_percent,
                used_percent=100 - item.remaining_percent,
                resets_at=item.resets_at,
                captured_at=item.captured_at,
            )
            for item in samples
        ],
    )


def _error_code(error: Exception) -> str:
    return "invalid_payload" if error.__class__.__name__.endswith("PayloadError") else "upstream_unavailable"
