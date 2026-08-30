"""add OpenCode Go usage monitor tables

Revision ID: 20260829_000000_add_opencode_go_usage_monitor
Revises: 20260828_000000_add_accounts_chatgpt_identity_index
Create Date: 2026-08-29
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260829_000000_add_opencode_go_usage_monitor"
down_revision = "20260828_000000_add_accounts_chatgpt_identity_index"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "opencode_go_usage_monitor",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("api_key_encrypted", sa.LargeBinary(), nullable=False),
        sa.Column("last_attempt_at", sa.DateTime(), nullable=True),
        sa.Column("last_success_at", sa.DateTime(), nullable=True),
        sa.Column("last_error", sa.String(length=64), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "opencode_go_usage_samples",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("window", sa.String(length=16), nullable=False),
        sa.Column("remaining_percent", sa.Float(), nullable=False),
        sa.Column("resets_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("captured_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("window IN ('rolling', 'weekly', 'monthly')", name="ck_opencode_go_usage_window"),
        sa.CheckConstraint(
            "remaining_percent >= 0 AND remaining_percent <= 100",
            name="ck_opencode_go_usage_remaining_percent",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_opencode_go_usage_samples_captured_at", "opencode_go_usage_samples", ["captured_at"])
    op.create_index(
        "ix_opencode_go_usage_samples_window_captured",
        "opencode_go_usage_samples",
        ["window", "captured_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_opencode_go_usage_samples_window_captured", table_name="opencode_go_usage_samples")
    op.drop_index("ix_opencode_go_usage_samples_captured_at", table_name="opencode_go_usage_samples")
    op.drop_table("opencode_go_usage_samples")
    op.drop_table("opencode_go_usage_monitor")
