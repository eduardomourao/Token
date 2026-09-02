"""Import the non-secret SQLite Dashboard read model into Supabase.

This tool is deliberately opt-in: without ``--apply`` it only reports counts.
It never reads or sends OAuth ciphertext, API-key material, or proxy credentials.
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import quote
from urllib.request import Request, urlopen

DEFAULT_SQLITE_PATH = Path.home() / ".codex-lb" / "store.db"
CHUNK_SIZE = 500


@dataclass(frozen=True)
class DashboardReadModel:
    accounts: list[dict[str, Any]]
    usage_history: list[dict[str, Any]]
    additional_usage_history: list[dict[str, Any]]


def normalize_timestamp(value: object | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        candidate = value
    else:
        candidate = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if candidate.tzinfo is None:
        candidate = candidate.replace(tzinfo=UTC)
    return candidate.astimezone(UTC).isoformat()


def _as_bool(value: object | None) -> bool | None:
    return None if value is None else bool(value)


def _read_rows(connection: sqlite3.Connection, table: str) -> Iterable[sqlite3.Row]:
    return connection.execute(f"select * from [{table}] order by id")


def read_dashboard_read_model(source: Path, owner_id: str) -> DashboardReadModel:
    connection = sqlite3.connect(f"file:{source}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    try:
        accounts = [
            {
                "owner_id": owner_id,
                "legacy_account_id": row["id"],
                "email": row["email"],
                "alias": row["alias"],
                "workspace_id": row["workspace_id"],
                "workspace_label": row["workspace_label"],
                "seat_type": row["seat_type"],
                "plan_type": row["plan_type"],
                "routing_policy": row["routing_policy"],
                "status": row["status"],
                "reset_at": row["reset_at"],
                "blocked_at": row["blocked_at"],
                "last_refresh_at": normalize_timestamp(row["last_refresh"]),
                "created_at": normalize_timestamp(row["created_at"]),
            }
            for row in _read_rows(connection, "accounts")
        ]
        usage_history = [
            {
                "owner_id": owner_id,
                "source_id": row["id"],
                "legacy_account_id": row["account_id"],
                "recorded_at": normalize_timestamp(row["recorded_at"]),
                "window_key": row["window"],
                "used_percent": row["used_percent"],
                "input_tokens": row["input_tokens"],
                "output_tokens": row["output_tokens"],
                "reset_at": row["reset_at"],
                "window_minutes": row["window_minutes"],
                "credits_has": _as_bool(row["credits_has"]),
                "credits_unlimited": _as_bool(row["credits_unlimited"]),
                "credits_balance": row["credits_balance"],
            }
            for row in _read_rows(connection, "usage_history")
        ]
        additional_usage_history = [
            {
                "owner_id": owner_id,
                "source_id": row["id"],
                "legacy_account_id": row["account_id"],
                "quota_key": row["quota_key"],
                "limit_name": row["limit_name"],
                "metered_feature": row["metered_feature"],
                "window_key": row["window"],
                "used_percent": row["used_percent"],
                "reset_at": row["reset_at"],
                "window_minutes": row["window_minutes"],
                "recorded_at": normalize_timestamp(row["recorded_at"]),
            }
            for row in _read_rows(connection, "additional_usage_history")
        ]
    finally:
        connection.close()
    return DashboardReadModel(accounts, usage_history, additional_usage_history)


def _batches(records: list[dict[str, Any]]) -> Iterable[list[dict[str, Any]]]:
    for index in range(0, len(records), CHUNK_SIZE):
        yield records[index : index + CHUNK_SIZE]


def upsert_records(
    base_url: str,
    service_role_key: str,
    table: str,
    conflict_columns: str,
    records: list[dict[str, Any]],
) -> None:
    endpoint = f"{base_url.rstrip('/')}/rest/v1/{table}?on_conflict={quote(conflict_columns, safe=',')}"
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    for batch in _batches(records):
        request = Request(endpoint, data=json.dumps(batch).encode("utf-8"), headers=headers, method="POST")
        with urlopen(request, timeout=30) as response:
            if response.status not in (200, 201):
                raise RuntimeError(f"Supabase returned HTTP {response.status} for {table}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SQLITE_PATH)
    parser.add_argument("--owner-id", required=True)
    parser.add_argument("--supabase-url", default=os.getenv("SUPABASE_URL"))
    parser.add_argument("--service-role-key", default=os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
    parser.add_argument("--apply", action="store_true", help="perform the remote upserts; default is a read-only count")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    model = read_dashboard_read_model(args.source, args.owner_id)
    counts = {
        "accounts": len(model.accounts),
        "usage_history": len(model.usage_history),
        "additional_usage_history": len(model.additional_usage_history),
        "applied": args.apply,
    }
    if not args.apply:
        print(json.dumps(counts, sort_keys=True))
        return 0
    if not args.supabase_url or not args.service_role_key:
        raise SystemExit("--supabase-url and --service-role-key are required with --apply")
    for table, conflict_columns, records in (
        ("hosted_dashboard_accounts", "owner_id,legacy_account_id", model.accounts),
        ("hosted_dashboard_usage_history", "owner_id,source_id", model.usage_history),
        (
            "hosted_dashboard_additional_usage_history",
            "owner_id,source_id",
            model.additional_usage_history,
        ),
    ):
        upsert_records(args.supabase_url, args.service_role_key, table, conflict_columns, records)
    print(json.dumps(counts, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"Hosted Dashboard import failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error
