from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import aiohttp

from app.core.clients.http import lease_http_session

OPENCODE_GO_USAGE_URL = "https://opencode.ai/zen/go/v1/usage"
WINDOWS = ("rolling", "weekly", "monthly")


class OpenCodeGoUsageError(Exception):
    """Sanitized upstream failure suitable for dashboard handling."""


class OpenCodeGoUsagePayloadError(OpenCodeGoUsageError):
    pass


class OpenCodeGoUsageUpstreamError(OpenCodeGoUsageError):
    pass


@dataclass(frozen=True, slots=True)
class OpenCodeGoUsageWindow:
    window: str
    remaining_percent: float
    resets_at: datetime

    @property
    def used_percent(self) -> float:
        return 100.0 - self.remaining_percent


def parse_usage_payload(payload: object) -> list[OpenCodeGoUsageWindow]:
    if not isinstance(payload, dict) or not isinstance(payload.get("usage"), dict):
        raise OpenCodeGoUsagePayloadError("OpenCode Go returned an invalid usage payload")
    usage = payload["usage"]
    result: list[OpenCodeGoUsageWindow] = []
    for window in WINDOWS:
        entry = usage.get(window)
        if not isinstance(entry, dict) or entry.get("status") != "ok":
            raise OpenCodeGoUsagePayloadError("OpenCode Go usage is unavailable")
        try:
            remaining = float(entry["percent"])
        except (KeyError, TypeError, ValueError) as exc:
            raise OpenCodeGoUsagePayloadError("OpenCode Go returned an invalid usage percentage") from exc
        if not 0.0 <= remaining <= 100.0:
            raise OpenCodeGoUsagePayloadError("OpenCode Go returned an out-of-range usage percentage")
        raw_reset = entry.get("resetsAt")
        if not isinstance(raw_reset, str):
            raise OpenCodeGoUsagePayloadError("OpenCode Go returned an invalid reset timestamp")
        try:
            resets_at = datetime.fromisoformat(raw_reset.replace("Z", "+00:00"))
        except ValueError as exc:
            raise OpenCodeGoUsagePayloadError("OpenCode Go returned an invalid reset timestamp") from exc
        if resets_at.tzinfo is None:
            raise OpenCodeGoUsagePayloadError("OpenCode Go returned an invalid reset timestamp")
        result.append(
            OpenCodeGoUsageWindow(
                window=window,
                remaining_percent=remaining,
                resets_at=resets_at.astimezone(timezone.utc),
            )
        )
    return result


class OpenCodeGoUsageClient:
    async def fetch(self, api_key: str) -> list[OpenCodeGoUsageWindow]:
        timeout = aiohttp.ClientTimeout(total=30, connect=10)
        try:
            async with lease_http_session() as session:
                async with session.get(
                    OPENCODE_GO_USAGE_URL,
                    headers={"Authorization": f"Bearer {api_key}", "Accept": "application/json"},
                    timeout=timeout,
                ) as response:
                    if response.status != 200:
                        raise OpenCodeGoUsageUpstreamError("OpenCode Go usage request failed")
                    try:
                        payload: Any = await response.json(content_type=None)
                    except Exception as exc:
                        raise OpenCodeGoUsagePayloadError("OpenCode Go returned invalid JSON") from exc
        except OpenCodeGoUsageError:
            raise
        except (aiohttp.ClientError, TimeoutError) as exc:
            raise OpenCodeGoUsageUpstreamError("OpenCode Go usage request failed") from exc
        return parse_usage_payload(payload)
