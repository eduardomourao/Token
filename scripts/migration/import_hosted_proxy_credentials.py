"""Re-encrypt local proxy credentials into the private Supabase proxy schema.

The source SQLite database is opened read-only. Credentials are decrypted only
in this process and immediately re-encrypted with the hosted AES-GCM key; no
plaintext or source Fernet ciphertext is printed or sent to public tables.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import sqlite3
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Iterable
from urllib.request import Request, urlopen

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


DEFAULT_SQLITE_PATH = Path.home() / ".codex-lb" / "store.db"
DEFAULT_SOURCE_KEY_PATH = Path.home() / ".codex-lb" / "encryption.key"
CHUNK_SIZE = 500


@dataclass(frozen=True)
class HostedProxyCredentials:
    accounts: list[dict[str, Any]]
    credentials: list[dict[str, Any]]


def normalize_timestamp(value: object) -> str:
    candidate = value if isinstance(value, datetime) else datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if candidate.tzinfo is None:
        candidate = candidate.replace(tzinfo=UTC)
    return candidate.astimezone(UTC).isoformat()


def _decode_base64url(value: str) -> bytes:
    return base64.urlsafe_b64decode(value.encode() + b"=" * (-len(value) % 4))


def _credential_key(value: str) -> bytes:
    key = _decode_base64url(value)
    if len(key) != 32:
        raise ValueError("HOSTED_PROXY_CREDENTIAL_KEY must be a base64url-encoded 32-byte key")
    return key


def derive_hosted_credential_key(source_fernet_key: bytes) -> str:
    """Derive a purpose-bound hosted key without sending the Fernet key upstream."""
    raw_source_key = base64.urlsafe_b64decode(source_fernet_key)
    derived = hashlib.sha256(b"codex-lb:hosted-proxy-credentials:v1\0" + raw_source_key).digest()
    return base64.urlsafe_b64encode(derived).rstrip(b"=").decode()


def _encrypt(plaintext: str, key: bytes) -> str:
    nonce = os.urandom(12)
    ciphertext = AESGCM(key).encrypt(nonce, plaintext.encode(), None)
    encode = lambda value: base64.urlsafe_b64encode(value).rstrip(b"=").decode()
    return f"v1.{encode(nonce)}.{encode(ciphertext)}"


def _read_rows(connection: sqlite3.Connection) -> Iterable[sqlite3.Row]:
    return connection.execute(
        """
        select id, chatgpt_account_id, codex_installation_id, email, plan_type,
               routing_policy, status, last_refresh, created_at,
               access_token_encrypted, refresh_token_encrypted, id_token_encrypted
        from accounts
        order by id
        """
    )


def read_hosted_proxy_credentials(
    source: Path,
    owner_id: str,
    source_fernet_key: bytes,
    hosted_credential_key: str,
) -> HostedProxyCredentials:
    fernet = Fernet(source_fernet_key)
    hosted_key = _credential_key(hosted_credential_key)
    connection = sqlite3.connect(f"file:{source}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    try:
        accounts: list[dict[str, Any]] = []
        credentials: list[dict[str, Any]] = []
        for row in _read_rows(connection):
            accounts.append({
                "owner_id": owner_id,
                "legacy_account_id": row["id"],
                "chatgpt_account_id": row["chatgpt_account_id"],
                "codex_installation_id": row["codex_installation_id"],
                "email": row["email"],
                "plan_type": row["plan_type"],
                "routing_policy": row["routing_policy"],
                "status": row["status"],
                "last_refresh_at": normalize_timestamp(row["last_refresh"]),
                "created_at": normalize_timestamp(row["created_at"]),
            })
            credentials.append({
                "owner_id": owner_id,
                "legacy_account_id": row["id"],
                "credential_version": "v1",
                "access_token_ciphertext": _encrypt(fernet.decrypt(row["access_token_encrypted"]).decode(), hosted_key),
                "refresh_token_ciphertext": _encrypt(fernet.decrypt(row["refresh_token_encrypted"]).decode(), hosted_key),
                "id_token_ciphertext": _encrypt(fernet.decrypt(row["id_token_encrypted"]).decode(), hosted_key),
            })
    finally:
        connection.close()
    return HostedProxyCredentials(accounts=accounts, credentials=credentials)


def _batches(records: list[dict[str, Any]]) -> Iterable[list[dict[str, Any]]]:
    for index in range(0, len(records), CHUNK_SIZE):
        yield records[index:index + CHUNK_SIZE]


def upsert_private_records(
    base_url: str,
    service_role_key: str,
    rpc_name: str,
    records: list[dict[str, Any]],
) -> None:
    endpoint = f"{base_url.rstrip('/')}/rest/v1/rpc/{rpc_name}"
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
    }
    for batch in _batches(records):
        request = Request(endpoint, data=json.dumps({"rows": batch}).encode("utf-8"), headers=headers, method="POST")
        with urlopen(request, timeout=30) as response:
            if response.status not in (200, 201, 204):
                raise RuntimeError(f"Supabase returned HTTP {response.status} for private proxy import")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SQLITE_PATH)
    parser.add_argument("--source-encryption-key-file", type=Path, default=DEFAULT_SOURCE_KEY_PATH)
    parser.add_argument("--owner-id", required=True)
    parser.add_argument("--hosted-credential-key", default=os.getenv("HOSTED_PROXY_CREDENTIAL_KEY"), help="optional base64url 32-byte override; defaults to a purpose-bound derivation of the source key")
    parser.add_argument("--supabase-url", default=os.getenv("SUPABASE_URL"))
    parser.add_argument("--service-role-key", default=os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
    parser.add_argument("--apply", action="store_true", help="perform private-schema upserts; default only validates and reports counts")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    source_fernet_key = args.source_encryption_key_file.read_bytes()
    hosted_credential_key = args.hosted_credential_key or derive_hosted_credential_key(source_fernet_key)
    model = read_hosted_proxy_credentials(
        args.source,
        args.owner_id,
        source_fernet_key,
        hosted_credential_key,
    )
    counts = {"accounts": len(model.accounts), "credentials": len(model.credentials), "applied": args.apply}
    if not args.apply:
        print(json.dumps(counts, sort_keys=True))
        return 0
    if not args.supabase_url or not args.service_role_key:
        raise SystemExit("--supabase-url and --service-role-key are required with --apply")
    upsert_private_records(args.supabase_url, args.service_role_key, "hosted_proxy_upsert_accounts", model.accounts)
    upsert_private_records(args.supabase_url, args.service_role_key, "hosted_proxy_upsert_credentials", model.credentials)
    print(json.dumps(counts, sort_keys=True))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"Hosted proxy credential import failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error
