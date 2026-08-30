from __future__ import annotations

# ruff: noqa: E501
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import aiohttp

from app.core.clients.http import lease_http_session
from app.modules.google_usage_oauth import GoogleOAuthError, exchange_refresh_token

CODE_ASSIST_URL = "https://cloudcode-pa.googleapis.com/v1internal"
LATEST_TRACKS = (
    ("pro_latest", "Pro Latest", ("gemini-3.1-pro-preview", "gemini-3-pro-preview", "gemini-2.5-pro")),
    (
        "flash_latest",
        "Flash Latest",
        ("gemini-3.5-flash", "gemini-3.5-flash-preview", "gemini-3-flash-preview", "gemini-2.5-flash"),
    ),
    (
        "flash_lite_latest",
        "Flash-Lite Latest",
        ("gemini-3.1-flash-lite", "gemini-3.1-flash-lite-preview", "gemini-3-flash-lite"),
    ),
)


class GeminiUsageError(Exception):
    pass


class GeminiUsagePayloadError(GeminiUsageError):
    pass


class GeminiUsageUpstreamError(GeminiUsageError):
    pass


@dataclass(frozen=True, slots=True)
class GeminiUsageWindow:
    window: str
    label: str
    remaining_percent: float
    resets_at: datetime

    @property
    def used_percent(self) -> float:
        return 100.0 - self.remaining_percent


def parse_quota_buckets(payload: object) -> list[GeminiUsageWindow]:
    if not isinstance(payload, dict) or not isinstance(payload.get("buckets"), list):
        raise GeminiUsagePayloadError("Gemini returned an invalid quota payload")
    indexed: dict[str, dict[str, Any]] = {}
    for bucket in payload["buckets"]:
        if not isinstance(bucket, dict) or not isinstance(bucket.get("modelId"), str):
            continue
        model_id = bucket["modelId"]
        previous = indexed.get(model_id)
        if previous is None or str(bucket.get("tokenType") or "").upper() == "REQUESTS":
            indexed[model_id] = bucket
    windows: list[GeminiUsageWindow] = []
    for window, label, preferred_ids in LATEST_TRACKS:
        bucket = next((indexed[model_id] for model_id in preferred_ids if model_id in indexed), None)
        if bucket is None:
            continue
        try:
            fraction = float(bucket["remainingFraction"])
            resets_at = _parse_timestamp(bucket["resetTime"])
        except (KeyError, TypeError, ValueError) as exc:
            raise GeminiUsagePayloadError("Gemini returned an invalid quota bucket") from exc
        if not 0 <= fraction <= 1:
            raise GeminiUsagePayloadError("Gemini returned an out-of-range quota fraction")
        windows.append(GeminiUsageWindow(window, label, round(fraction * 100, 2), resets_at))
    if not windows:
        raise GeminiUsagePayloadError("Gemini returned no supported quota buckets")
    return windows


class GeminiUsageClient:
    async def fetch(self, refresh_token: str) -> list[GeminiUsageWindow]:
        try:
            access_token = await exchange_refresh_token(refresh_token, kind="gemini")
            loaded = await self._post(
                "loadCodeAssist",
                access_token,
                {"metadata": {"ideType": "GEMINI_CLI", "platform": "LINUX_AMD64", "pluginType": "GEMINI"}},
            )
            project = _project_id(loaded)
            quota = await self._post("retrieveUserQuota", access_token, {"project": project})
        except GoogleOAuthError as exc:
            raise GeminiUsageUpstreamError("Gemini authentication failed") from exc
        return parse_quota_buckets(quota)

    async def _post(self, method: str, access_token: str, payload: dict[str, Any]) -> dict[str, Any]:
        timeout = aiohttp.ClientTimeout(total=30, connect=10)
        try:
            async with lease_http_session() as session:
                async with session.post(
                    f"{CODE_ASSIST_URL}:{method}",
                    json=payload,
                    headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
                    timeout=timeout,
                ) as response:
                    if response.status != 200:
                        raise GeminiUsageUpstreamError("Gemini usage request failed")
                    body: Any = await response.json(content_type=None)
        except GeminiUsageError:
            raise
        except (aiohttp.ClientError, TimeoutError, ValueError) as exc:
            raise GeminiUsageUpstreamError("Gemini usage request failed") from exc
        if not isinstance(body, dict):
            raise GeminiUsagePayloadError("Gemini returned invalid JSON")
        return body


def _project_id(payload: dict[str, Any]) -> str:
    project = payload.get("cloudaicompanionProject")
    if isinstance(project, dict):
        project = project.get("id") or project.get("name")
    if not isinstance(project, str) or not project.strip():
        raise GeminiUsagePayloadError("Gemini returned no Cloud project")
    return project


def _parse_timestamp(value: object) -> datetime:
    if not isinstance(value, str):
        raise ValueError("invalid timestamp")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("timezone is required")
    return parsed.astimezone(timezone.utc)
