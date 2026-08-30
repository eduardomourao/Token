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
from app.modules.gemini_usage.repository import GeminiUsageRepository
from app.modules.gemini_usage.schemas import GeminiUsageCredentialRequest, GeminiUsageMonitorResponse
from app.modules.gemini_usage.service import GeminiUsageNotConfiguredError, GeminiUsageRefreshError, GeminiUsageService

router = APIRouter(
    prefix="/api/gemini-usage",
    tags=["dashboard"],
    dependencies=[Depends(validate_dashboard_session), Depends(set_dashboard_error_format)],
)


def _service(session: AsyncSession) -> GeminiUsageService:
    return GeminiUsageService(GeminiUsageRepository(session))


@router.get("/", response_model=GeminiUsageMonitorResponse)
async def get_monitor(session: AsyncSession = Depends(get_session)) -> GeminiUsageMonitorResponse:
    return await _service(session).get_monitor()


@router.put("/configuration", response_model=GeminiUsageMonitorResponse)
async def configure_monitor(
    request: Request,
    payload: GeminiUsageCredentialRequest = Body(...),
    _write_access=Depends(require_dashboard_write_access),
    session: AsyncSession = Depends(get_session),
) -> GeminiUsageMonitorResponse:
    service = _service(session)
    was_configured = (await service.get_monitor()).configured
    try:
        result = await service.configure(payload.refresh_token)
    except (ValueError, GeminiUsageRefreshError) as exc:
        raise DashboardUpstreamError(
            "Gemini credential validation failed", code="gemini_usage_validation_failed"
        ) from exc
    AuditService.log_async(
        "gemini_usage_replaced" if was_configured else "gemini_usage_configured",
        actor_ip=request.client.host if request.client else None,
    )
    return result


@router.post("/refresh", response_model=GeminiUsageMonitorResponse)
async def refresh_monitor(
    request: Request,
    _write_access=Depends(require_dashboard_write_access),
    session: AsyncSession = Depends(get_session),
) -> GeminiUsageMonitorResponse:
    try:
        result = await _service(session).refresh()
    except GeminiUsageNotConfiguredError as exc:
        raise DashboardBadRequestError(str(exc), code="gemini_usage_not_configured") from exc
    except GeminiUsageRefreshError as exc:
        raise DashboardUpstreamError("Gemini usage refresh failed", code="gemini_usage_refresh_failed") from exc
    AuditService.log_async("gemini_usage_refreshed", actor_ip=request.client.host if request.client else None)
    return result


@router.delete("/configuration", status_code=204)
async def clear_monitor(
    request: Request,
    _write_access=Depends(require_dashboard_write_access),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await _service(session).clear()
    AuditService.log_async("gemini_usage_removed", actor_ip=request.client.host if request.client else None)
    return Response(status_code=204)
