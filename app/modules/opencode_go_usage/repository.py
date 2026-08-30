from __future__ import annotations

from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import OpenCodeGoUsageMonitor, OpenCodeGoUsageSample


class OpenCodeGoUsageRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_monitor(self) -> OpenCodeGoUsageMonitor | None:
        return await self._session.get(OpenCodeGoUsageMonitor, 1)

    async def latest_samples(self) -> list[OpenCodeGoUsageSample]:
        rows: list[OpenCodeGoUsageSample] = []
        for window in ("rolling", "weekly", "monthly"):
            result = await self._session.execute(
                select(OpenCodeGoUsageSample)
                .where(OpenCodeGoUsageSample.window == window)
                .order_by(OpenCodeGoUsageSample.captured_at.desc(), OpenCodeGoUsageSample.id.desc())
                .limit(1)
            )
            sample = result.scalar_one_or_none()
            if sample is not None:
                rows.append(sample)
        return rows

    async def history(self) -> list[OpenCodeGoUsageSample]:
        result = await self._session.execute(
            select(OpenCodeGoUsageSample).order_by(
                OpenCodeGoUsageSample.captured_at.asc(),
                OpenCodeGoUsageSample.id.asc(),
            )
        )
        return list(result.scalars().all())

    async def persist_success(
        self,
        *,
        api_key_encrypted: bytes | None,
        samples: list[OpenCodeGoUsageSample],
        attempted_at: datetime,
    ) -> OpenCodeGoUsageMonitor:
        monitor = await self.get_monitor()
        if monitor is None:
            if api_key_encrypted is None:
                raise ValueError("OpenCode Go monitor is not configured")
            monitor = OpenCodeGoUsageMonitor(id=1, api_key_encrypted=api_key_encrypted)
            self._session.add(monitor)
        elif api_key_encrypted is not None:
            monitor.api_key_encrypted = api_key_encrypted
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
        await self._session.execute(delete(OpenCodeGoUsageSample))
        await self._session.delete(monitor)
        await self._session.commit()
        return True

    async def prune_before(self, cutoff: datetime) -> int:
        result = await self._session.execute(
            delete(OpenCodeGoUsageSample).where(OpenCodeGoUsageSample.captured_at < cutoff)
        )
        await self._session.commit()
        return int(result.rowcount or 0)
