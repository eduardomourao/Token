from __future__ import annotations

# ruff: noqa: E501
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

import aiohttp

from app.core.clients.http import lease_http_session
from app.modules.google_usage_oauth import GoogleOAuthError, exchange_refresh_token

AVAILABLE_MODELS_URL = "https://daily-cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels"
ANTIGRAVITY_USER_AGENT = "antigravity/1.15.8 linux/amd64"


class AntigravityUsageError(Exception):
    pass


class AntigravityUsagePayloadError(AntigravityUsageError):
    pass


class AntigravityUsageUpstreamError(AntigravityUsageError):
    pass


@dataclass(frozen=True, slots=True)
class AntigravityUsageWindow:
    group: str
    window_kind: str
    label: str
    remaining_percent: float
    resets_at: datetime

    @property
    def used_percent(self) -> float:
        return 100.0 - self.remaining_percent


def parse_available_models(payload: object, *, now: datetime | None = None) -> list[AntigravityUsageWindow]:
    if not isinstance(payload, dict) or not isinstance(payload.get("models"), dict):
        raise AntigravityUsagePayloadError("Antigravity returned an invalid models payload")
    now = now or datetime.now(timezone.utc)
    grouped: dict[str, list[tuple[float, datetime]]] = {"gemini": [], "claude_gpt": []}
    for model_id, model in payload["models"].items():
        if not isinstance(model_id, str) or not isinstance(model, dict):
            continue
        group = _classify_group(model_id, model)
        quota = model.get("quotaInfo")
        if group is None or not isinstance(quota, dict):
            continue
        try:
            fraction = float(quota["remainingFraction"])
            reset = _parse_timestamp(quota["resetTime"])
        except (KeyError, TypeError, ValueError):
            continue
        if 0 <= fraction <= 1:
            grouped[group].append((fraction, reset))
    windows: list[AntigravityUsageWindow] = []
    for group, label in (("gemini", "Gemini Pool"), ("claude_gpt", "Claude + GPT Pool")):
        items = grouped[group]
        if not items:
            continue
        fraction = min(fraction for fraction, _ in items)
        reset = min(reset for _, reset in items)
        kind = _window_kind(reset, now)
        windows.append(AntigravityUsageWindow(group, kind, label, round(fraction * 100, 2), reset))
    if not windows:
        raise AntigravityUsagePayloadError("Antigravity returned no supported model quotas")
    return windows


class AntigravityUsageClient:
    async def fetch(self, refresh_token: str) -> list[AntigravityUsageWindow]:
        try:
            access_token = await exchange_refresh_token(refresh_token, kind="antigravity")
        except GoogleOAuthError as exc:
            raise AntigravityUsageUpstreamError("Antigravity authentication failed") from exc
        timeout = aiohttp.ClientTimeout(total=30, connect=10)
        try:
            async with lease_http_session() as session:
                async with session.post(
                    AVAILABLE_MODELS_URL,
                    json={},
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "User-Agent": ANTIGRAVITY_USER_AGENT,
                        "Accept": "application/json",
                    },
                    timeout=timeout,
                ) as response:
                    if response.status != 200:
                        raise AntigravityUsageUpstreamError("Antigravity usage request failed")
                    payload: Any = await response.json(content_type=None)
        except AntigravityUsageError:
            raise
        except (aiohttp.ClientError, TimeoutError, ValueError) as exc:
            raise AntigravityUsageUpstreamError("Antigravity usage request failed") from exc
        return parse_available_models(payload)


def _classify_group(model_id: str, model: dict[str, Any]) -> str | None:
    model_id = model_id.lower()
    if model_id.startswith(("tab_", "chat_")):
        return None
    provider = str(model.get("modelProvider") or model.get("apiProvider") or "").lower()
    if provider == "google" or model_id.startswith("gemini") or model_id.startswith("gem"):
        return "gemini"
    if provider in {"anthropic", "openai"} or model_id.startswith(("claude", "gpt")):
        return "claude_gpt"
    return None


def _window_kind(reset: datetime, now: datetime) -> str:
    delta = reset - now
    if delta <= timedelta(hours=6):
        return "five_hour"
    if delta <= timedelta(days=8):
        return "weekly"
    return "unknown"


def _parse_timestamp(value: object) -> datetime:
    if not isinstance(value, str):
        raise ValueError("invalid timestamp")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("timezone is required")
    return parsed.astimezone(timezone.utc)
