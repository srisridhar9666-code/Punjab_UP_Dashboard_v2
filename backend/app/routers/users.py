from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import audit, require_admin
from ..models import AuditLog, User
from ..security import hash_password, password_problem

router = APIRouter(prefix="/api/users", tags=["users"])

Role = Literal["admin", "punjab", "up", "viewer"]


class UserOut(BaseModel):
    id: int
    username: str
    full_name: str | None
    role: str
    is_active: bool
    must_change_password: bool
    last_login_at: datetime | None
    created_at: datetime | None

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=100, pattern=r"^[A-Za-z0-9_.-]+$")
    full_name: str | None = Field(default=None, max_length=200)
    password: str
    role: Role = "viewer"


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=200)
    role: Role | None = None
    is_active: bool | None = None


class PasswordReset(BaseModel):
    password: str


class AuditOut(BaseModel):
    id: int
    at: datetime
    username: str | None
    action: str
    detail: str | None
    ip: str | None

    model_config = {"from_attributes": True}


def _get(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def _ensure_another_admin(db: Session, user: User) -> None:
    if user.role == "admin":
        others = db.query(User).filter(User.role == "admin", User.is_active.is_(True), User.id != user.id).count()
        if others == 0:
            raise HTTPException(status_code=400, detail="At least one active admin must remain")


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return db.query(User).order_by(User.username).all()


@router.post("", response_model=UserOut, status_code=201)
def create_user(body: UserCreate, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    problem = password_problem(body.password, body.username)
    if problem:
        raise HTTPException(status_code=400, detail=problem)
    user = User(
        username=body.username,
        full_name=body.full_name,
        hashed_password=hash_password(body.password),
        role=body.role,
        must_change_password=True,  # the admin knows this password, so the user must replace it
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    audit(db, request, admin.username, "user_created", f"{user.username} ({user.role})")
    return user


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: int, body: UserUpdate, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    user = _get(db, user_id)
    changes = body.model_dump(exclude_unset=True)
    if ("role" in changes and changes["role"] != "admin") or changes.get("is_active") is False:
        _ensure_another_admin(db, user)
    for k, v in changes.items():
        setattr(user, k, v)
    if "role" in changes or changes.get("is_active") is False:
        user.token_version += 1  # role or access changed: re-issue sessions
    db.commit()
    audit(db, request, admin.username, "user_updated", f"{user.username}: {changes}")
    return user


@router.post("/{user_id}/reset-password", response_model=UserOut)
def reset_password(user_id: int, body: PasswordReset, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    user = _get(db, user_id)
    problem = password_problem(body.password, user.username)
    if problem:
        raise HTTPException(status_code=400, detail=problem)
    user.hashed_password = hash_password(body.password)
    user.must_change_password = True
    user.failed_logins = 0
    user.locked_until = None
    user.token_version += 1
    db.commit()
    audit(db, request, admin.username, "password_reset", user.username)
    return user


@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    user = _get(db, user_id)
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    _ensure_another_admin(db, user)
    db.delete(user)
    db.commit()
    audit(db, request, admin.username, "user_deleted", user.username)


@router.get("/audit", response_model=list[AuditOut], tags=["audit"])
def audit_log(
    limit: int = Query(200, le=1000),
    action: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    q = db.query(AuditLog)
    if action:
        q = q.filter(AuditLog.action == action)
    return q.order_by(AuditLog.id.desc()).limit(limit).all()
