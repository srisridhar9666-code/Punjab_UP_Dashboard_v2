from fastapi import Depends, HTTPException, Path, Request, status
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .models import AuditLog, User
from .security import decode_token
from .states import ROLE_STATES, STATES, UPLOAD_ROLES, StateConfig

UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Not signed in",
    headers={"WWW-Authenticate": "Bearer"},
)


def _token_from_request(request: Request) -> str | None:
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return request.cookies.get(get_settings().cookie_name)


def client_ip(request: Request) -> str:
    # X-Forwarded-For is NOT read here: anyone can send it, which would let them
    # dodge the login rate limit. Behind a reverse proxy, run uvicorn with
    # --proxy-headers --forwarded-allow-ips=<proxy ip> so request.client is the real client.
    return request.client.host if request.client else "unknown"


def get_current_user_any(request: Request, db: Session = Depends(get_db)) -> User:
    """Signed-in user, even if they still have to change their password."""
    token = _token_from_request(request)
    payload = decode_token(token) if token else None
    if not payload:
        raise UNAUTHORIZED
    user = db.query(User).filter(User.username == payload["sub"]).first()
    # token_version lets a password change / deactivation revoke old sessions.
    if not user or not user.is_active or payload.get("ver", 0) != user.token_version:
        raise UNAUTHORIZED
    return user


def get_current_user(user: User = Depends(get_current_user_any)) -> User:
    if user.must_change_password:
        raise HTTPException(status_code=403, detail="password_change_required")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def get_state(state: str = Path(..., description="punjab or up")) -> StateConfig:
    cfg = STATES.get(state)
    if not cfg:
        raise HTTPException(status_code=404, detail="Unknown state")
    return cfg


def require_state_view(cfg: StateConfig = Depends(get_state), user: User = Depends(get_current_user)) -> StateConfig:
    if cfg.key not in ROLE_STATES.get(user.role, set()):
        raise HTTPException(status_code=403, detail=f"Your role cannot view {cfg.name}")
    return cfg


def require_state_upload(cfg: StateConfig = Depends(get_state), user: User = Depends(get_current_user)) -> StateConfig:
    if cfg.key not in UPLOAD_ROLES.get(user.role, set()):
        raise HTTPException(status_code=403, detail=f"Your role cannot upload {cfg.name} data")
    return cfg


def audit(db: Session, request: Request | None, username: str | None, action: str, detail: str | None = None) -> None:
    db.add(AuditLog(username=username, action=action, detail=detail, ip=client_ip(request) if request else None))
    db.commit()
