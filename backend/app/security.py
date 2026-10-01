"""Password hashing, session tokens and login throttling."""

import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher
from pwdlib.hashers.bcrypt import BcryptHasher

from .config import get_settings

# Argon2 for new hashes; bcrypt kept so v1 accounts can still sign in
# (their hash is upgraded to argon2 on the next successful login).
password_hash = PasswordHash((Argon2Hasher(), BcryptHasher()))

ALGORITHM = "HS256"
MIN_PASSWORD_LENGTH = 10


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed: str) -> tuple[bool, str | None]:
    """Returns (valid, new_hash_if_it_should_be_upgraded)."""
    try:
        return password_hash.verify_and_update(password, hashed)
    except Exception:
        return False, None


def password_problem(password: str, username: str) -> str | None:
    if len(password) < MIN_PASSWORD_LENGTH:
        return f"Password must be at least {MIN_PASSWORD_LENGTH} characters"
    if password.lower() in {"admin123", "password123", "1234567890", "qwertyuiop"}:
        return "That password is too common"
    if username and username.lower() in password.lower():
        return "Password must not contain the username"
    return None


def create_token(username: str, role: str, token_version: int) -> tuple[str, datetime]:
    s = get_settings()
    expires = datetime.now(timezone.utc) + timedelta(minutes=s.access_token_minutes)
    payload = {"sub": username, "role": role, "ver": token_version, "exp": expires, "iat": datetime.now(timezone.utc)}
    return jwt.encode(payload, s.secret_key, algorithm=ALGORITHM), expires


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, get_settings().secret_key, algorithms=[ALGORITHM], options={"require": ["exp", "sub"]})
    except jwt.PyJWTError:
        return None


class SlidingWindowLimiter:
    """Small in-process rate limiter (per key, per minute).

    Good for a single API process. If you scale to several workers, put the
    limit in the reverse proxy (nginx `limit_req`) or move this to Redis.
    """

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str, limit: int, window: float = 60.0) -> bool:
        now = time.monotonic()
        with self._lock:
            q = self._hits[key]
            while q and now - q[0] > window:
                q.popleft()
            if len(q) >= limit:
                return False
            q.append(now)
            return True

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


login_limiter = SlidingWindowLimiter()
