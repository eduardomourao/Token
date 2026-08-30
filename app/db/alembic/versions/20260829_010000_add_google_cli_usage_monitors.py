"""add Gemini CLI and Antigravity usage monitor tables

Revision ID: 20260829_010000_add_google_cli_usage_monitors
Revises: 20260829_000000_add_opencode_go_usage_monitor
Create Date: 2026-08-29
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260829_010000_add_google_cli_usage_monitors"
down_revision = "20260829_000000_add_opencode_go_usage_monitor"
branch_labels = None
depends_on = None


def _monitor(name: str) -> None:
    op.create_table(
        name,
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("refresh_token_encrypted", sa.LargeBinary(), nullable=False),
        sa.Column("last_attempt_at", sa.DateTime(), nullable=True),
        sa.Column("last_success_at", sa.DateTime(), nullable=True),
        sa.Column("last_error", sa.String(length=64), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )


def upgrade() -> None:
    _monitor("gemini_usage_monitor")
    op.create_table(
        "gemini_usage_sample",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("window", sa.String(length=32), nullable=False),
        sa.Column("label", sa.String(length=64), nullable=False),
        sa.Column("remaining_percent", sa.Float(), nullable=False),
        sa.Column("resets_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("captured_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("remaining_percent >= 0 AND remaining_percent <= 100", name="ck_gemini_usage_remaining_percent"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_gemini_usage_sample_captured_at", "gemini_usage_sample", ["captured_at"])
    op.create_index("ix_gemini_usage_sample_window_captured", "gemini_usage_sample", ["window", "captured_at"])
    _monitor("antigravity_usage_monitor")
    op.create_table(
        "antigravity_usage_sample",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("group", sa.String(length=32), nullable=False),
        sa.Column("window_kind", sa.String(length=32), nullable=False),
        sa.Column("label", sa.String(length=64), nullable=False),
        sa.Column("remaining_percent", sa.Float(), nullable=False),
        sa.Column("resets_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("captured_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("remaining_percent >= 0 AND remaining_percent <= 100", name="ck_antigravity_usage_remaining_percent"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_antigravity_usage_sample_captured_at", "antigravity_usage_sample", ["captured_at"])
    op.create_index("ix_antigravity_usage_sample_group_captured", "antigravity_usage_sample", ["group", "captured_at"])


def downgrade() -> None:
    op.drop_index("ix_antigravity_usage_sample_group_captured", table_name="antigravity_usage_sample")
    op.drop_index("ix_antigravity_usage_sample_captured_at", table_name="antigravity_usage_sample")
    op.drop_table("antigravity_usage_sample")
    op.drop_table("antigravity_usage_monitor")
    op.drop_index("ix_gemini_usage_sample_window_captured", table_name="gemini_usage_sample")
    op.drop_index("ix_gemini_usage_sample_captured_at", table_name="gemini_usage_sample")
    op.drop_table("gemini_usage_sample")
    op.drop_table("gemini_usage_monitor")
