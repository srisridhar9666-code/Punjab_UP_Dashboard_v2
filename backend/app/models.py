"""ORM tables.

The two survey tables keep the exact v1 schema so an existing MySQL database
upgrades in place (see alembic/versions). New in v2: account security columns
on `users`, plus `upload_logs` and `audit_logs`.
"""

from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, Date, DateTime, Integer, String, Text, func

from .db import Base

ROLES = ("admin", "punjab", "up", "viewer")


def utcnow() -> datetime:
    """Naive UTC timestamp (MySQL DATETIME has no timezone)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    full_name = Column(String(200), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), default="viewer", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    must_change_password = Column(Boolean, default=True, nullable=False, server_default="1")
    failed_logins = Column(Integer, default=0, nullable=False, server_default="0")
    locked_until = Column(DateTime, nullable=True)
    last_login_at = Column(DateTime, nullable=True)
    token_version = Column(Integer, default=0, nullable=False, server_default="0")


class _SurveyCommon:
    id = Column(Integer, primary_key=True, autoincrement=True)
    status = Column(String(50), nullable=True, index=True)
    ac_name = Column(String(255), nullable=True, index=True)
    age = Column(String(50), nullable=True)
    gender = Column(String(50), nullable=True)
    locality = Column(String(100), nullable=True)
    mla_awareness = Column(String(50), nullable=True)
    mla_visit_frequency = Column(String(100), nullable=True)
    preferred_candidate = Column(String(255), nullable=True)
    preferred_cm = Column(String(255), nullable=True)
    vote_2022 = Column(String(100), nullable=True)
    vote_intention = Column(String(100), nullable=True)
    education = Column(String(100), nullable=True)
    occupation = Column(String(100), nullable=True)
    religion = Column(String(100), nullable=True)
    caste = Column(String(100), nullable=True)
    caste_category = Column(String(100), nullable=True)
    income = Column(String(100), nullable=True)
    failure_1 = Column(String(255), nullable=True)
    failure_2 = Column(String(255), nullable=True)
    success_1 = Column(String(255), nullable=True)
    success_2 = Column(String(255), nullable=True)
    survey_date = Column(Date, nullable=True, index=True)
    duplicacy_check = Column(String(100), nullable=True)
    district = Column(String(255), nullable=True, index=True)


class PunjabSurvey(_SurveyCommon, Base):
    __tablename__ = "punjab_surveys"

    ward_number = Column(String(100), nullable=True)
    village_name = Column(String(255), nullable=True)
    aap_govt_rating = Column(String(100), nullable=True)
    bhagwant_mann_rating = Column(String(100), nullable=True)
    mla_satisfaction = Column(String(100), nullable=True)
    call_center_location = Column(String(255), nullable=True)


class UPSurvey(_SurveyCommon, Base):
    __tablename__ = "up_surveys"

    ward_village_name = Column(String(255), nullable=True)
    yogi_rating = Column(String(100), nullable=True)
    akhilesh_rating = Column(String(100), nullable=True)
    mla_rating = Column(String(100), nullable=True)
    vote_2024_ls = Column(String(100), nullable=True)


class UploadLog(Base):
    __tablename__ = "upload_logs"

    id = Column(Integer, primary_key=True)
    state = Column(String(20), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    stored_path = Column(String(500), nullable=True)
    sha256 = Column(String(64), nullable=False)
    rows_imported = Column(Integer, nullable=False)
    rows_skipped = Column(Integer, nullable=False, default=0)
    date_min = Column(Date, nullable=True)
    date_max = Column(Date, nullable=True)
    uploaded_by = Column(String(100), nullable=False)
    uploaded_at = Column(DateTime, nullable=False, default=utcnow)
    restored_from = Column(Integer, nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True)
    at = Column(DateTime, nullable=False, default=utcnow, index=True)
    username = Column(String(100), nullable=True, index=True)
    action = Column(String(60), nullable=False, index=True)
    detail = Column(Text, nullable=True)
    ip = Column(String(64), nullable=True)
