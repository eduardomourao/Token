from __future__ import annotations

from datetime import datetime

from pydantic import Field

from app.modules.shared.schemas import DashboardModel


class OpenCodeGoUsageWindowResponse(DashboardModel):
    window: str
    remaining_percent: float = Field(ge=0, le=100)
    used_percent: float = Field(ge=0, le=100)
    resets_at: datetime
    captured_at: datetime


class OpenCodeGoUsageMonitorResponse(DashboardModel):
    configured: bool
    last_attempt_at: datetime | None = None
    last_success_at: datetime | None = None
    last_error: str | None = None
    windows: list[OpenCodeGoUsageWindowResponse] = Field(default_factory=list)


class OpenCodeGoUsageCredentialRequest(DashboardModel):
    api_key: str = Field(min_length=1, max_length=4096)
