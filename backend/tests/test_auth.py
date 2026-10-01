import pytest

from app.db import SessionLocal
from app.models import User
from app.security import create_token
from tests.conftest import HDR, PASSWORD, client_for


def test_requires_login():
    c = client_for(None)
    assert c.get("/api/states/punjab/overview").status_code == 401


def test_cookie_is_httponly_and_strict():
    c = client_for(None)
    r = c.post("/api/auth/login", json={"username": "admin", "password": PASSWORD})
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=strict" in cookie


def test_csrf_header_required_for_cookie_posts():
    c = client_for("admin")
    del c.headers["X-Requested-With"]
    assert c.post("/api/auth/logout").status_code == 403


def test_wrong_password_and_lockout():
    c = client_for(None)
    for _ in range(5):
        assert c.post("/api/auth/login", json={"username": "pb", "password": "nope-nope-nope"}).status_code == 401
    # locked even with the right password now
    assert c.post("/api/auth/login", json={"username": "pb", "password": PASSWORD}).status_code == 423


def test_ip_rate_limit():
    c = client_for(None)
    codes = [c.post("/api/auth/login", json={"username": f"ghost{i}", "password": "x" * 12}).status_code for i in range(12)]
    assert 429 in codes


@pytest.mark.filterwarnings("ignore::jwt.warnings.InsecureKeyLengthWarning")  # v1's short fallback key, on purpose
def test_token_signed_with_other_key_rejected():
    import jwt

    forged = jwt.encode({"sub": "admin", "ver": 0, "exp": 9999999999}, "fallback-secret-key", algorithm="HS256")
    c = client_for(None)
    assert c.get("/api/auth/me", headers={"Authorization": f"Bearer {forged}"}).status_code == 401


def test_password_change_revokes_old_sessions():
    db = SessionLocal()
    user = db.query(User).filter_by(username="viewer").one()
    old, _ = create_token(user.username, user.role, user.token_version)
    db.close()
    c = client_for("viewer")
    r = c.post("/api/auth/change-password", json={"old_password": PASSWORD, "new_password": "Brand-New-Pass-99"})
    assert r.status_code == 200
    assert client_for(None).get("/api/auth/me", headers={"Authorization": f"Bearer {old}"}).status_code == 401
    assert c.get("/api/auth/me").status_code == 200  # this session got a fresh cookie


def test_must_change_password_blocks_data():
    db = SessionLocal()
    db.query(User).filter_by(username="viewer").update({"must_change_password": True})
    db.commit()
    db.close()
    c = client_for("viewer")
    assert c.get("/api/auth/me").json()["must_change_password"] is True
    assert c.get("/api/states/punjab/overview").status_code == 403


def test_weak_password_rejected():
    c = client_for("admin")
    r = c.post("/api/auth/change-password", json={"old_password": PASSWORD, "new_password": "admin123"})
    assert r.status_code == 400


def test_legacy_bcrypt_hash_still_works_and_is_upgraded():
    import bcrypt

    db = SessionLocal()
    db.add(User(username="legacy", hashed_password=bcrypt.hashpw(b"Old-Password-1", bcrypt.gensalt()).decode(), role="viewer", must_change_password=False))
    db.commit()
    c = client_for(None)
    c.headers.update(HDR)
    assert c.post("/api/auth/login", json={"username": "legacy", "password": "Old-Password-1"}).status_code == 200
    db.expire_all()
    assert db.query(User).filter_by(username="legacy").one().hashed_password.startswith("$argon2")
    db.close()
