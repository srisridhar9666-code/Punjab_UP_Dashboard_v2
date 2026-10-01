from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..deps import audit, client_ip, get_current_user_any
from ..models import User, utcnow
from ..security import create_token, hash_password, login_limiter, password_problem, verify_password
from ..states import ROLE_STATES, UPLOAD_ROLES

router = APIRouter(prefix="/api/auth", tags=["auth"])

GENERIC_LOGIN_ERROR = "Incorrect username or password"


class LoginBody(BaseModel):
    username: str
    password: str


class PasswordChange(BaseModel):
    old_password: str
    new_password: str


class Me(BaseModel):
    id: int
    username: str
    full_name: str | None
    role: str
    must_change_password: bool
    states: list[str]
    upload_states: list[str]


def me_payload(user: User) -> Me:
    return Me(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        role=user.role,
        must_change_password=user.must_change_password,
        states=sorted(ROLE_STATES.get(user.role, set())),
        upload_states=sorted(UPLOAD_ROLES.get(user.role, set())),
    )


def _authenticate(db: Session, request: Request, username: str, password: str) -> User:
    s = get_settings()
    ip = client_ip(request)
    if not login_limiter.allow(f"ip:{ip}", s.login_rate_per_minute):
        audit(db, request, username, "login_throttled")
        raise HTTPException(status_code=429, detail="Too many sign-in attempts. Try again in a minute.")

    user = db.query(User).filter(User.username == username).first()
    now = utcnow()
    if user and user.locked_until and user.locked_until > now:
        audit(db, request, username, "login_locked")
        raise HTTPException(status_code=423, detail="Account temporarily locked after repeated failed sign-ins. Try again later.")

    ok, new_hash = verify_password(password, user.hashed_password) if user else (False, None)
    if not user or not ok:
        if user:
            user.failed_logins += 1
            if user.failed_logins >= s.login_max_failures:
                user.locked_until = now + timedelta(minutes=s.login_lockout_minutes)
                user.failed_logins = 0
            db.commit()
        audit(db, request, username, "login_failed")
        raise HTTPException(status_code=401, detail=GENERIC_LOGIN_ERROR)
    if not user.is_active:
        audit(db, request, username, "login_disabled")
        raise HTTPException(status_code=401, detail=GENERIC_LOGIN_ERROR)

    if new_hash:
        user.hashed_password = new_hash
    user.failed_logins = 0
    user.locked_until = None
    user.last_login_at = now
    db.commit()
    audit(db, request, username, "login")
    return user


def _set_session_cookie(response: Response, user: User) -> None:
    s = get_settings()
    token, expires = create_token(user.username, user.role, user.token_version)
    response.set_cookie(
        s.cookie_name,
        token,
        httponly=True,
        secure=s.cookie_secure or s.is_production,
        samesite="strict",
        max_age=s.access_token_minutes * 60,
        path="/",
    )


@router.post("/login", response_model=Me)
def login(body: LoginBody, request: Request, response: Response, db: Session = Depends(get_db)):
    """Browser sign-in: sets an httpOnly session cookie (no token in JS)."""
    user = _authenticate(db, request, body.username.strip(), body.password)
    _set_session_cookie(response, user)
    return me_payload(user)


@router.post("/token")
def token(request: Request, form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Bearer token for scripts and the /docs page."""
    user = _authenticate(db, request, form.username.strip(), form.password)
    if user.must_change_password:
        raise HTTPException(status_code=403, detail="password_change_required")
    tok, _ = create_token(user.username, user.role, user.token_version)
    return {"access_token": tok, "token_type": "bearer"}


@router.post("/logout", status_code=204)
def logout(response: Response):
    response.delete_cookie(get_settings().cookie_name, path="/")


@router.get("/me", response_model=Me)
def me(user: User = Depends(get_current_user_any)):
    return me_payload(user)


@router.post("/change-password", response_model=Me)
def change_password(
    body: PasswordChange,
    request: Request,
    response: Response,
    user: User = Depends(get_current_user_any),
    db: Session = Depends(get_db),
):
    ok, _ = verify_password(body.old_password, user.hashed_password)
    if not ok:
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if body.new_password == body.old_password:
        raise HTTPException(status_code=400, detail="New password must be different")
    problem = password_problem(body.new_password, user.username)
    if problem:
        raise HTTPException(status_code=400, detail=problem)
    user.hashed_password = hash_password(body.new_password)
    user.must_change_password = False
    user.token_version += 1  # signs out every other session
    db.commit()
    audit(db, request, user.username, "password_changed")
    _set_session_cookie(response, user)
    return me_payload(user)
