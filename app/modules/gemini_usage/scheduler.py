from __future__ import annotations

import asyncio
import contextlib
import logging

from app.core.scheduling.leader_election import get_leader_election
from app.db.session import get_background_session
from app.modules.gemini_usage.repository import GeminiUsageRepository
from app.modules.gemini_usage.service import GeminiUsageService

logger = logging.getLogger(__name__)
INTERVAL_SECONDS = 300


class GeminiUsageScheduler:
    def __init__(self, *, interval_seconds: int = INTERVAL_SECONDS) -> None:
        self._interval_seconds = interval_seconds
        self._task: asyncio.Task[None] | None = None
        self._stop = asyncio.Event()

    async def start(self) -> None:
        if self._task is None:
            self._stop.clear()
            self._task = asyncio.create_task(self._run_loop())

    async def stop(self) -> None:
        self._stop.set()
        if self._task is not None:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
            self._task = None

    async def _run_loop(self) -> None:
        while not self._stop.is_set():
            await self.run_once()
            with contextlib.suppress(TimeoutError):
                await asyncio.wait_for(self._stop.wait(), timeout=self._interval_seconds)

    async def run_once(self) -> None:
        await get_leader_election().run_if_leader(self._refresh_as_leader)

    async def _refresh_as_leader(self) -> None:
        try:
            async with get_background_session() as session:
                repository = GeminiUsageRepository(session)
                if await repository.get_monitor() is not None:
                    await GeminiUsageService(repository).refresh(raise_on_error=False)
        except Exception:
            logger.exception("Gemini usage refresh loop failed")


def build_gemini_usage_scheduler() -> GeminiUsageScheduler:
    return GeminiUsageScheduler()
