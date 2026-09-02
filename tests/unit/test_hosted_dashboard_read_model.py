from __future__ import annotations

import importlib.util
import sqlite3
import sys
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
MIGRATION = REPOSITORY_ROOT / "supabase" / "migrations" / "20260901200000_hosted_dashboard_read_model.sql"
IMPORTER = REPOSITORY_ROOT / "scripts" / "migration" / "import_hosted_dashboard_read_model.py"


def _load_importer():
    spec = importlib.util.spec_from_file_location("hosted_dashboard_importer", IMPORTER)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_hosted_dashboard_schema_is_owner_scoped_and_browser_read_only() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    assert "create table public.hosted_dashboard_accounts" in sql
    assert "create table public.hosted_dashboard_usage_history" in sql
    assert "create table public.hosted_dashboard_additional_usage_history" in sql
    assert "primary key (owner_id, legacy_account_id)" in sql
    assert "enable row level security" in sql
    assert "owners can read hosted dashboard accounts" in sql
    assert "revoke all on table public.hosted_dashboard_accounts from anon, authenticated" in sql
    assert "grant select on table public.hosted_dashboard_accounts to authenticated" in sql
    assert "grant all on table public.hosted_dashboard_accounts to service_role" in sql
    assert "access_token_encrypted" not in sql
    assert "refresh_token_encrypted" not in sql
    assert "id_token_encrypted" not in sql


def test_importer_emits_only_non_secret_account_fields_and_normalizes_timestamps(tmp_path: Path) -> None:
    source = tmp_path / "store.db"
    connection = sqlite3.connect(source)
    connection.executescript(
        """
        create table accounts (
          id text primary key,
          email text not null,
          alias text,
          workspace_id text,
          workspace_label text,
          seat_type text,
          plan_type text not null,
          routing_policy text not null,
          status text not null,
          reset_at integer,
          blocked_at integer,
          last_refresh text not null,
          created_at text not null,
          access_token_encrypted blob not null,
          refresh_token_encrypted blob not null,
          id_token_encrypted blob not null
        );
        create table usage_history (
          id integer primary key,
          account_id text not null,
          recorded_at text not null,
          window text,
          used_percent real not null,
          input_tokens integer,
          output_tokens integer,
          reset_at integer,
          window_minutes integer,
          credits_has integer,
          credits_unlimited integer,
          credits_balance real
        );
        create table additional_usage_history (
          id integer primary key,
          account_id text not null,
          quota_key text not null,
          limit_name text not null,
          metered_feature text not null,
          window text not null,
          used_percent real not null,
          reset_at integer,
          window_minutes integer,
          recorded_at text not null
        );
        """
    )
    connection.execute(
        "insert into accounts values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ("account-a", "operator@example.com", "Primary", None, None, None, "pro", "normal", "active", None, None, "2026-09-01 10:00:00", "2026-08-01 10:00:00", b"access", b"refresh", b"id"),
    )
    connection.execute(
        "insert into usage_history values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (17, "account-a", "2026-09-01 10:00:00", "primary", 25.0, 10, 20, 1_788_300_000, 300, 1, 0, 12.5),
    )
    connection.execute(
        "insert into additional_usage_history values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (19, "account-a", "extra", "Extra", "feature", "monthly", 50.0, None, 43_200, "2026-09-01 10:00:00"),
    )
    connection.commit()
    connection.close()

    importer = _load_importer()
    payload = importer.read_dashboard_read_model(source, "00000000-0000-0000-0000-000000000001")

    assert payload.accounts == [{
        "owner_id": "00000000-0000-0000-0000-000000000001",
        "legacy_account_id": "account-a",
        "email": "operator@example.com",
        "alias": "Primary",
        "workspace_id": None,
        "workspace_label": None,
        "seat_type": None,
        "plan_type": "pro",
        "routing_policy": "normal",
        "status": "active",
        "reset_at": None,
        "blocked_at": None,
        "last_refresh_at": "2026-09-01T10:00:00+00:00",
        "created_at": "2026-08-01T10:00:00+00:00",
    }]
    assert payload.usage_history[0]["source_id"] == 17
    assert payload.usage_history[0]["recorded_at"] == "2026-09-01T10:00:00+00:00"
    assert payload.additional_usage_history[0]["source_id"] == 19
    assert {"access_token_encrypted", "refresh_token_encrypted", "id_token_encrypted"}.isdisjoint(payload.accounts[0])
