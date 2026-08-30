from __future__ import annotations

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
from app.modules.opencode_go_usage.repository import OpenCodeGoUsageRepository
from app.modules.opencode_go_usage.schemas import OpenCodeGoUsageCredentialRequest, OpenCodeGoUsageMonitorResponse
from app.modules.opencode_go_usage.service import (
    OpenCodeGoUsageNotConfiguredError,
    OpenCodeGoUsageRefreshError,
    OpenCodeGoUsageService,
)

router = APIRouter(
    prefix="/api/opencode-go-usage",
    tags=["dashboard"],
    dependencies=[Depends(validate_dashboard_session), Depends(set_dashboard_error_format)],
)


def _service(session: AsyncSession) -> OpenCodeGoUsageService:
    return OpenCodeGoUsageService(OpenCodeGoUsageRepository(session))


@router.get("/", response_model=OpenCodeGoUsageMonitorResponse)
async def get_monitor(session: AsyncSession = Depends(get_session)) -> OpenCodeGoUsageMonitorResponse:
    return await _service(session).get_monitor()


@router.put("/configuration", response_model=OpenCodeGoUsageMonitorResponse)
async def configure_monitor(
    request: Request,
    payload: OpenCodeGoUsageCredentialRequest = Body(...),
    _write_access=Depends(require_dashboard_write_access),
    session: AsyncSession = Depends(get_session),
) -> OpenCodeGoUsageMonitorResponse:
    service = _service(session)
    was_configured = (await service.get_monitor()).configured
    try:
        result = await service.configure(payload.api_key)
    except (ValueError, OpenCodeGoUsageRefreshError) as exc:
        raise DashboardUpstreamError(
            "OpenCode Go credential validation failed",
            code="opencode_go_validation_failed",
        ) from exc
    AuditService.log_async(
        "opencode_go_usage_replaced" if was_configured else "opencode_go_usage_configured",
        actor_ip=request.client.host if request.client else None,
    )
    return result


@router.post("/refresh", response_model=OpenCodeGoUsageMonitorResponse)
async def refresh_monitor(
    request: Request,
    _write_access=Depends(require_dashboard_write_access),
    session: AsyncSession = Depends(get_session),
) -> OpenCodeGoUsageMonitorResponse:
    try:
        result = await _service(session).refresh()
    except OpenCodeGoUsageNotConfiguredError as exc:
        raise DashboardBadRequestError(str(exc), code="opencode_go_not_configured") from exc
    except OpenCodeGoUsageRefreshError as exc:
        raise DashboardUpstreamError("OpenCode Go usage refresh failed", code="opencode_go_refresh_failed") from exc
    AuditService.log_async("opencode_go_usage_refreshed", actor_ip=request.client.host if request.client else None)
    return result


@router.get("/history.csv")
async def export_history(session: AsyncSession = Depends(get_session)) -> Response:
    csv_data = await _service(session).csv_export()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="opencode-go-usage.csv"'},
    )


@router.delete("/configuration", status_code=204)
async def clear_monitor(
    request: Request,
    _write_access=Depends(require_dashboard_write_access),
    session: AsyncSession = Depends(get_session),
) -> Response:
    await _service(session).clear()
    AuditService.log_async("opencode_go_usage_removed", actor_ip=request.client.host if request.client else None)
    return Response(status_code=204)
