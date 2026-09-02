# ruff: noqa: E501
from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.modules.antigravity_usage.client import AntigravityUsageWindow
from app.modules.gemini_usage.client import GeminiUsageWindow


@pytest.mark.asyncio
async def test_google_cli_usage_apis_configure_refresh_and_remove(async_client, monkeypatch) -> None:
    async def gemini_fetch(self, refresh_token: str):
        assert refresh_token == "gemini-refresh"
        return [GeminiUsageWindow("pro_latest", "Pro Latest", 80, datetime(2030, 1, 1, tzinfo=timezone.utc))]

    async def antigravity_fetch(self, refresh_token: str):
        assert refresh_token == "antigravity-refresh"
        return [
            AntigravityUsageWindow("gemini", "five_hour", "Gemini Pool", 70, datetime(2030, 1, 1, tzinfo=timezone.utc))
        ]

    monkeypatch.setattr("app.modules.gemini_usage.client.GeminiUsageClient.fetch", gemini_fetch)
    monkeypatch.setattr("app.modules.antigravity_usage.client.AntigravityUsageClient.fetch", antigravity_fetch)

    assert (await async_client.get("/api/gemini-usage/")).json()["configured"] is False
    assert (await async_client.get("/api/antigravity-usage/")).json()["configured"] is False
    gemini = await async_client.put("/api/gemini-usage/configuration", json={"refreshToken": "gemini-refresh"})
    antigravity = await async_client.put(
        "/api/antigravity-usage/configuration", json={"refreshToken": "antigravity-refresh"}
    )
    assert gemini.status_code == 200 and gemini.json()["windows"][0]["window"] == "pro_latest"
    assert antigravity.status_code == 200 and antigravity.json()["windows"][0]["group"] == "gemini"
    assert (await async_client.post("/api/gemini-usage/refresh")).status_code == 200
    assert (await async_client.post("/api/antigravity-usage/refresh")).status_code == 200
    assert (await async_client.delete("/api/gemini-usage/configuration")).status_code == 204
    assert (await async_client.delete("/api/antigravity-usage/configuration")).status_code == 204
