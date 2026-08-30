from __future__ import annotations

# ruff: noqa: E501
from fastapi import APIRouter, Body, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit.service import AuditService
from app.core.auth.dependencies import (
    require_dashboard_write_access,
    set_dashboard_error_format,
    validate_dashboard_session,
)
from app.core.exceptions import DashboardBadRequestError, DashboardUpstreamError
from app.db.session import get_session
from app.modules.antigravity_usage.repository import AntigravityUsageRepository
from app.modules.antigravity_usage.schemas import AntigravityUsageCredentialRequest, AntigravityUsageMonitorResponse
from app.modules.antigravity_usage.service import (
    AntigravityUsageNotConfiguredError,
    AntigravityUsageRefreshError,
    AntigravityUsageService,
)

router = APIRouter(
    prefix="/api/antigravity-usage",
    tags=["dashboard"],
    dependencies=[Depends(validate_dashboard_session), Depends(set_dashboard_error_format)],
)


def _service(session: AsyncSession) -> AntigravityUsageService:
    return AntigravityUsageService(AntigravityUsageRepository(session))


@router.get("/", response_model=AntigravityUsageMonitorResponse)
async def get_monitor(session: AsyncSession = Depends(get_session)) -> AntigravityUsageMonitorResponse:
    return await _service(session).get_monitor()


@router.put("/configuration", response_model=AntigravityUsageMonitorResponse)
async def configure_monitor(
    request: Request,
    payload: AntigravityUsageCredentialRequest = Body(...),
    _write_access=Depends(require_dashboard_write_access),
    session: AsyncSession = Depends(get_session),
) -> AntigravityUsageMonitorResponse:
    service = _service(session)
    was_configured = (await service.get_monitor()).configured
    try:
        result = await service.configure(payload.refresh_token)
    except (ValueError, AntigravityUsageRefreshError) as exc:
        raise DashboardUpstreamError(
            "Antigravity credential validation failed", code="antigravity_usage_validation_failed"
        ) from exc
    AuditService.log_async(
        "antigravity_usage_replaced" if was_configured else "antigravity_usage_configured",
        actor_ip=request.client.host if request.client else None,
    )
    return result


@router.post("/refresh", response_model=AntigravityUsageMonitorResponse)
async def refresh_monitor(
    request: Request,
    _write_access=Depends(require_dashboard_write_access),
    session: AsyncSession = Depends(get_session),
) -> AntigravityUsageMonitorResponse:
    try:
        result = await _service(session).refresh()
    except AntigravityUsageNotConfiguredError as exc:
        raise DashboardBadRequestError(str(exc), code="antigravity_usage_not_configured") from exc
    except AntigravityUsageRefreshError as exc:
        raise DashboardUpstreamError(
            "Antigravity usage refresh failed", code="antigravity_usage_refresh_failed"
        ) from exc
    AuditService.log_async("antigravity_usage_refreshed", actor_ip=request.client.host if request.client else None)
    return result


@router.delete("/configuration", status_code=204)
async def clear_monitor(
    request: Request,
    _write_access=Depends(require_dashboard_write_access),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await _service(session).clear()
    AuditService.log_async("antigravity_usage_removed", actor_ip=request.client.host if request.client else None)
    return Response(status_code=204)
