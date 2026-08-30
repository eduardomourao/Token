from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.modules.opencode_go_usage.client import OpenCodeGoUsageWindow


@pytest.mark.asyncio
async def test_opencode_go_usage_api_configures_reads_exports_and_removes(async_client, monkeypatch) -> None:
    async def fake_fetch(self, api_key: str) -> list[OpenCodeGoUsageWindow]:
        assert api_key == "go-secret"
        reset_at = datetime(2030, 1, 1, tzinfo=timezone.utc)
        return [
            OpenCodeGoUsageWindow("rolling", 90, reset_at),
            OpenCodeGoUsageWindow("weekly", 70, reset_at),
            OpenCodeGoUsageWindow("monthly", 50, reset_at),
        ]

    monkeypatch.setattr("app.modules.opencode_go_usage.client.OpenCodeGoUsageClient.fetch", fake_fetch)
    audit_actions: list[str] = []

    def record_audit(action: str, **kwargs) -> None:
        del kwargs
        audit_actions.append(action)

    monkeypatch.setattr("app.modules.opencode_go_usage.api.AuditService.log_async", record_audit)

    empty = await async_client.get("/api/opencode-go-usage/")
    assert empty.status_code == 200
    assert empty.json() == {
        "configured": False,
        "lastAttemptAt": None,
        "lastSuccessAt": None,
        "lastError": None,
        "windows": [],
    }

    configured = await async_client.put("/api/opencode-go-usage/configuration", json={"apiKey": "go-secret"})
    assert configured.status_code == 200
    assert configured.json()["configured"] is True
    assert [item["window"] for item in configured.json()["windows"]] == ["rolling", "weekly", "monthly"]

    replaced = await async_client.put("/api/opencode-go-usage/configuration", json={"apiKey": "go-secret"})
    assert replaced.status_code == 200

    exported = await async_client.get("/api/opencode-go-usage/history.csv")
    assert exported.status_code == 200
    assert exported.headers["content-type"].startswith("text/csv")
    assert exported.headers["content-disposition"] == 'attachment; filename="opencode-go-usage.csv"'
    assert "captured_at,window,remaining_percent,used_percent,resets_at" in exported.text
    assert ",rolling,90,10," in exported.text

    refreshed = await async_client.post("/api/opencode-go-usage/refresh")
    assert refreshed.status_code == 200

    removed = await async_client.delete("/api/opencode-go-usage/configuration")
    assert removed.status_code == 204
    assert (await async_client.get("/api/opencode-go-usage/")).json()["configured"] is False
    assert audit_actions == [
        "opencode_go_usage_configured",
        "opencode_go_usage_replaced",
        "opencode_go_usage_refreshed",
        "opencode_go_usage_removed",
    ]
