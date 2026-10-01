"""v1 schema (users, punjab_surveys, up_surveys).

Creates only the tables that don't exist yet, so this runs cleanly both on a
fresh database and on an existing v1 database: just `alembic upgrade head`.

Revision ID: 0001
"""
import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

S = sa.String


def _survey_common() -> list[sa.Column]:
    return [
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("status", S(50), index=True),
        sa.Column("ac_name", S(255), index=True),
        sa.Column("age", S(50)),
        sa.Column("gender", S(50)),
        sa.Column("locality", S(100)),
        sa.Column("mla_awareness", S(50)),
        sa.Column("mla_visit_frequency", S(100)),
        sa.Column("preferred_candidate", S(255)),
        sa.Column("preferred_cm", S(255)),
        sa.Column("vote_2022", S(100)),
        sa.Column("vote_intention", S(100)),
        sa.Column("education", S(100)),
        sa.Column("occupation", S(100)),
        sa.Column("religion", S(100)),
        sa.Column("caste", S(100)),
        sa.Column("caste_category", S(100)),
        sa.Column("income", S(100)),
        sa.Column("failure_1", S(255)),
        sa.Column("failure_2", S(255)),
        sa.Column("success_1", S(255)),
        sa.Column("success_2", S(255)),
        sa.Column("survey_date", sa.Date, index=True),
        sa.Column("duplicacy_check", S(100)),
        sa.Column("district", S(255), index=True),
    ]


def upgrade() -> None:
    existing = set(sa.inspect(op.get_bind()).get_table_names())
    if "users" not in existing:
        op.create_table(
            "users",
            sa.Column("id", sa.Integer, primary_key=True, index=True),
            sa.Column("username", S(100), nullable=False, unique=True, index=True),
            sa.Column("full_name", S(200)),
            sa.Column("hashed_password", S(255), nullable=False),
            sa.Column("role", S(50)),
            sa.Column("is_active", sa.Boolean),
            sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        )
    if "punjab_surveys" not in existing:
        op.create_table(
            "punjab_surveys",
            *_survey_common(),
            sa.Column("ward_number", S(100)),
            sa.Column("village_name", S(255)),
            sa.Column("aap_govt_rating", S(100)),
            sa.Column("bhagwant_mann_rating", S(100)),
            sa.Column("mla_satisfaction", S(100)),
            sa.Column("call_center_location", S(255)),
        )
    if "up_surveys" not in existing:
        op.create_table(
            "up_surveys",
            *_survey_common(),
            sa.Column("ward_village_name", S(255)),
            sa.Column("yogi_rating", S(100)),
            sa.Column("akhilesh_rating", S(100)),
            sa.Column("mla_rating", S(100)),
            sa.Column("vote_2024_ls", S(100)),
        )


def downgrade() -> None:
    op.drop_table("up_surveys")
    op.drop_table("punjab_surveys")
    op.drop_table("users")
