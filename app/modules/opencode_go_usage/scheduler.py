from __future__ import annotations

import asyncio
import contextlib
import importlib
import logging
from collections.abc import Awaitable, Callable
from typing import Protocol, TypeVar, cast

from app.db.session import get_background_session
from app.modules.opencode_go_usage.repository import OpenCodeGoUsageRepository
from app.modules.opencode_go_usage.service import OpenCodeGoUsageService

logger = logging.getLogger(__name__)
INTERVAL_SECONDS = 120
_T = TypeVar("_T")


class _LeaderElectionLike(Protocol):
    async def run_if_leader(self, fn: Callable[[], Awaitable[_T]]) -> _T | None: ...


def _leader_election() -> _LeaderElectionLike:
    module = importlib.import_module("app.core.scheduling.leader_election")
    return cast(_LeaderElectionLike, module.get_leader_election())


class OpenCodeGoUsageScheduler:
    def __init__(self, *, interval_seconds: int = INTERVAL_SECONDS) -> None:
        self._interval_seconds = interval_seconds
        self._task: asyncio.Task[None] | None = None
        self._stop = asyncio.Event()

    async def start(self) -> None:
        if self._task is not None:
            return
        self._stop.clear()
        self._task = asyncio.create_task(self._run_loop())

    async def stop(self) -> None:
        self._stop.set()
        if self._task is None:
            return
        self._task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await self._task
        self._task = None

    async def _run_loop(self) -> None:
        while not self._stop.is_set():
            await self.run_once()
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=self._interval_seconds)
            except TimeoutError:
                pass

    async def run_once(self) -> None:
        await _leader_election().run_if_leader(self._refresh_as_leader)

    async def _refresh_as_leader(self) -> None:
        try:
            async with get_background_session() as session:
                repository = OpenCodeGoUsageRepository(session)
                if await repository.get_monitor() is None:
                    return
                await OpenCodeGoUsageService(repository).refresh(raise_on_error=False)
        except Exception:
            logger.exception("OpenCode Go usage refresh loop failed")


def build_opencode_go_usage_scheduler() -> OpenCodeGoUsageScheduler:
    return OpenCodeGoUsageScheduler()
