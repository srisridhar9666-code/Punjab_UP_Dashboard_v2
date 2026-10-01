"""v2: account security columns, upload history, audit log.

Every existing account is flagged to choose a new password at next sign-in,
because v1 shipped with the published default admin / admin123.

Revision ID: 0002
"""
import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users") as b:
        b.add_column(sa.Column("must_change_password", sa.Boolean, nullable=False, server_default=sa.true()))
        b.add_column(sa.Column("failed_logins", sa.Integer, nullable=False, server_default="0"))
        b.add_column(sa.Column("locked_until", sa.DateTime, nullable=True))
        b.add_column(sa.Column("last_login_at", sa.DateTime, nullable=True))
        b.add_column(sa.Column("token_version", sa.Integer, nullable=False, server_default="0"))
    op.execute("UPDATE users SET role = 'viewer' WHERE role IS NULL OR role NOT IN ('admin', 'punjab', 'up', 'viewer')")
    op.execute("UPDATE users SET is_active = 1 WHERE is_active IS NULL")

    op.create_table(
        "upload_logs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("state", sa.String(20), nullable=False, index=True),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("stored_path", sa.String(500)),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("rows_imported", sa.Integer, nullable=False),
        sa.Column("rows_skipped", sa.Integer, nullable=False, server_default="0"),
        sa.Column("date_min", sa.Date),
        sa.Column("date_max", sa.Date),
        sa.Column("uploaded_by", sa.String(100), nullable=False),
        sa.Column("uploaded_at", sa.DateTime, nullable=False),
        sa.Column("restored_from", sa.Integer),
    )
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("at", sa.DateTime, nullable=False, index=True),
        sa.Column("username", sa.String(100), index=True),
        sa.Column("action", sa.String(60), nullable=False, index=True),
        sa.Column("detail", sa.Text),
        sa.Column("ip", sa.String(64)),
    )


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("upload_logs")
    with op.batch_alter_table("users") as b:
        for col in ("token_version", "last_login_at", "locked_until", "failed_logins", "must_change_password"):
            b.drop_column(col)
