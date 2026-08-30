"""Shared, server-only Google installed-app OAuth helpers for usage telemetry."""
# ruff: noqa: E501

from __future__ import annotations

import os
import re
import shutil
from pathlib import Path
from typing import Literal

import aiohttp

from app.core.clients.http import lease_http_session

TOKEN_URL = "https://oauth2.googleapis.com/token"
_CLIENT_ID_PATTERN = re.compile(r"(\d{6,}-[a-z0-9]+\.apps\.googleusercontent\.com)", re.I)
_CLIENT_SECRET_PATTERN = re.compile(r"(GOCSPX-[A-Za-z0-9_-]+)")


class GoogleOAuthError(Exception):
    """Sanitized OAuth failure; never includes a token or client secret."""


def resolve_oauth_client(kind: Literal["gemini", "antigravity"]) -> tuple[str, str]:
    prefix = "GEMINI" if kind == "gemini" else "ANTIGRAVITY"
    client_id = os.getenv(f"CODEX_LB_{prefix}_OAUTH_CLIENT_ID", "").strip()
    client_secret = os.getenv(f"CODEX_LB_{prefix}_OAUTH_CLIENT_SECRET", "").strip()
    if client_id and client_secret:
        return client_id, client_secret

    configured = _read_configured_client(kind)
    if configured is not None:
        return configured

    discovered = _discover_installed_client(kind)
    if discovered is not None:
        return discovered
    raise GoogleOAuthError("OAuth client is not configured")


async def exchange_refresh_token(
    refresh_token: str,
    *,
    kind: Literal["gemini", "antigravity"],
) -> str:
    client_id, client_secret = resolve_oauth_client(kind)
    timeout = aiohttp.ClientTimeout(total=30, connect=10)
    payload = {
        "client_id": client_id,
        "client_secret": client_secret,
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
    }
    try:
        async with lease_http_session() as session:
            async with session.post(
                TOKEN_URL,
                data=payload,
                headers={"Accept": "application/json"},
                timeout=timeout,
            ) as response:
                if response.status != 200:
                    raise GoogleOAuthError("OAuth token refresh failed")
                body = await response.json(content_type=None)
    except GoogleOAuthError:
        raise
    except (aiohttp.ClientError, TimeoutError, ValueError) as exc:
        raise GoogleOAuthError("OAuth token refresh failed") from exc
    access_token = body.get("access_token") if isinstance(body, dict) else None
    if not isinstance(access_token, str) or not access_token.strip():
        raise GoogleOAuthError("OAuth token refresh returned an invalid response")
    return access_token


def _read_configured_client(kind: str) -> tuple[str, str] | None:
    raw_path = os.getenv("CODEX_LB_GOOGLE_USAGE_OAUTH_CLIENTS_FILE", "").strip()
    if not raw_path:
        return None
    try:
        import json

        payload = json.loads(Path(raw_path).expanduser().read_text(encoding="utf-8"))
        item = payload.get(kind) if isinstance(payload, dict) else None
        client_id = str(item.get("client_id") or "").strip() if isinstance(item, dict) else ""
        client_secret = str(item.get("client_secret") or "").strip() if isinstance(item, dict) else ""
        return (client_id, client_secret) if client_id and client_secret else None
    except (OSError, ValueError, TypeError):
        return None


def _discover_installed_client(kind: str) -> tuple[str, str] | None:
    if kind == "antigravity":
        agy = shutil.which("agy")
        if agy:
            try:
                text = Path(agy).read_bytes().decode("latin-1")
                client_id = _CLIENT_ID_PATTERN.search(text)
                client_secret = _CLIENT_SECRET_PATTERN.search(text)
                if client_id and client_secret:
                    return client_id.group(1), client_secret.group(1)
            except OSError:
                pass
    for candidate in _discovery_candidates(kind):
        try:
            text = candidate.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        client_id = _CLIENT_ID_PATTERN.search(text)
        client_secret = _CLIENT_SECRET_PATTERN.search(text)
        if client_id and client_secret:
            return client_id.group(1), client_secret.group(1)
    return None


def _discovery_candidates(kind: str) -> list[Path]:
    home = Path.home()
    app_data = Path(os.getenv("APPDATA", home / "AppData" / "Roaming"))
    local_app_data = Path(os.getenv("LOCALAPPDATA", home / "AppData" / "Local"))
    roots = (
        [
            app_data / "npm" / "node_modules" / "@google" / "gemini-cli-core",
            home / ".npm-global" / "lib" / "node_modules" / "@google" / "gemini-cli-core",
        ]
        if kind == "gemini"
        else [home / ".antigravity" / "extensions", home / ".antigravity_cockpit", local_app_data / "Antigravity"]
    )
    candidates: list[Path] = []
    for root in roots:
        if not root.exists():
            continue
        for pattern in ("*.js", "*.mjs", "*.cjs"):
            candidates.extend(root.rglob(pattern))
    return candidates[:500]
