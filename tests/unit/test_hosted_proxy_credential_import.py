from __future__ import annotations

import base64
import importlib.util
import sqlite3
import sys
from pathlib import Path

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
IMPORTER = REPOSITORY_ROOT / "scripts" / "migration" / "import_hosted_proxy_credentials.py"


def _load_importer():
    spec = importlib.util.spec_from_file_location("hosted_proxy_importer", IMPORTER)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def _decrypt_envelope(envelope: str, key: str) -> str:
    version, encoded_iv, encoded_ciphertext = envelope.split(".")
    assert version == "v1"
    decode = lambda value: base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
    return AESGCM(decode(key)).decrypt(decode(encoded_iv), decode(encoded_ciphertext), None).decode()


def test_proxy_importer_reencrypts_credentials_without_returning_plaintext(tmp_path: Path) -> None:
    source = tmp_path / "store.db"
    source_key = Fernet.generate_key()
    source_fernet = Fernet(source_key)
    connection = sqlite3.connect(source)
    connection.executescript(
        """
        create table accounts (
          id text primary key,
          chatgpt_account_id text,
          codex_installation_id text not null,
          email text not null,
          plan_type text not null,
          routing_policy text not null,
          status text not null,
          last_refresh text not null,
          created_at text not null,
          access_token_encrypted blob not null,
          refresh_token_encrypted blob not null,
          id_token_encrypted blob not null
        );
        """
    )
    connection.execute(
        "insert into accounts values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            "account-a",
            "workspace-a",
            "installation-a",
            "operator@example.com",
            "pro",
            "normal",
            "active",
            "2026-09-01 10:00:00",
            "2026-08-01 10:00:00",
            source_fernet.encrypt(b"access-token"),
            source_fernet.encrypt(b"refresh-token"),
            source_fernet.encrypt(b"id-token"),
        ),
    )
    connection.commit()
    connection.close()

    hosted_key = base64.urlsafe_b64encode(bytes(range(32))).rstrip(b"=").decode()
    importer = _load_importer()
    model = importer.read_hosted_proxy_credentials(
        source,
        "00000000-0000-0000-0000-000000000001",
        source_key,
        hosted_key,
    )

    assert model.accounts == [{
        "owner_id": "00000000-0000-0000-0000-000000000001",
        "legacy_account_id": "account-a",
        "chatgpt_account_id": "workspace-a",
        "codex_installation_id": "installation-a",
        "email": "operator@example.com",
        "plan_type": "pro",
        "routing_policy": "normal",
        "status": "active",
        "last_refresh_at": "2026-09-01T10:00:00+00:00",
        "created_at": "2026-08-01T10:00:00+00:00",
    }]
    credential = model.credentials[0]
    assert "access-token" not in str(credential)
    assert _decrypt_envelope(credential["access_token_ciphertext"], hosted_key) == "access-token"
    assert _decrypt_envelope(credential["refresh_token_ciphertext"], hosted_key) == "refresh-token"
    assert _decrypt_envelope(credential["id_token_ciphertext"], hosted_key) == "id-token"
