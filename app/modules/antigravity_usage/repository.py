from __future__ import annotations

# ruff: noqa: E501
from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AntigravityUsageMonitor, AntigravityUsageSample


class AntigravityUsageRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_monitor(self) -> AntigravityUsageMonitor | None:
        return await self._session.get(AntigravityUsageMonitor, 1)

    async def latest_samples(self) -> list[AntigravityUsageSample]:
        result = await self._session.execute(
            select(AntigravityUsageSample).order_by(
                AntigravityUsageSample.captured_at.desc(), AntigravityUsageSample.id.desc()
            )
        )
        latest: dict[str, AntigravityUsageSample] = {}
        for sample in result.scalars():
            latest.setdefault(sample.group, sample)
        return list(latest.values())

    async def persist_success(
        self, *, refresh_token_encrypted: bytes | None, samples: list[AntigravityUsageSample], attempted_at: datetime
    ) -> AntigravityUsageMonitor:
        monitor = await self.get_monitor()
        if monitor is None:
            if refresh_token_encrypted is None:
                raise ValueError("Antigravity monitor is not configured")
            monitor = AntigravityUsageMonitor(id=1, refresh_token_encrypted=refresh_token_encrypted)
            self._session.add(monitor)
        elif refresh_token_encrypted is not None:
            monitor.refresh_token_encrypted = refresh_token_encrypted
        monitor.last_attempt_at = attempted_at
        monitor.last_success_at = attempted_at
        monitor.last_error = None
        self._session.add_all(samples)
        await self._session.commit()
        return monitor

    async def record_failure(self, *, attempted_at: datetime, error_code: str) -> None:
        monitor = await self.get_monitor()
        if monitor is None:
            return
        monitor.last_attempt_at = attempted_at
        monitor.last_error = error_code
        await self._session.commit()

    async def clear(self) -> bool:
        monitor = await self.get_monitor()
        if monitor is None:
            return False
        await self._session.execute(delete(AntigravityUsageSample))
        await self._session.delete(monitor)
        await self._session.commit()
        return True

    async def prune_before(self, cutoff: datetime) -> int:
        result = await self._session.execute(
            delete(AntigravityUsageSample).where(AntigravityUsageSample.captured_at < cutoff)
        )
        await self._session.commit()
        return int(getattr(result, "rowcount", 0) or 0)
