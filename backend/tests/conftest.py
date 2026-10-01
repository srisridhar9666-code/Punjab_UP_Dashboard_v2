import os

os.environ["SECRET_KEY"] = "test-secret-key-that-is-long-enough-1234567890"
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["UPLOAD_DIR"] = os.path.join(os.path.dirname(__file__), ".uploads")

from pathlib import Path  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import cache  # noqa: E402
from app.db import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import User  # noqa: E402
from app.security import hash_password, login_limiter  # noqa: E402

FIXTURES = Path(__file__).parent / "fixtures"
PASSWORD = "Correct-Horse-42"
HDR = {"X-Requested-With": "XMLHttpRequest"}


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    login_limiter.reset()
    cache.clear()
    db = SessionLocal()
    for name, role in (("admin", "admin"), ("pb", "punjab"), ("upuser", "up"), ("viewer", "viewer")):
        db.add(User(username=name, hashed_password=hash_password(PASSWORD), role=role, must_change_password=False))
    db.commit()
    db.close()
    yield


def client_for(username: str | None) -> TestClient:
    c = TestClient(app)
    c.headers.update(HDR)
    if username:
        r = c.post("/api/auth/login", json={"username": username, "password": PASSWORD})
        assert r.status_code == 200, r.text
    return c


@pytest.fixture
def admin():
    return client_for("admin")


def upload(c: TestClient, state: str, name: str | None = None):
    path = FIXTURES / (name or f"{state}_sample.csv")
    return c.post(f"/api/uploads/{state}", files={"file": (path.name, path.read_bytes(), "text/csv")})
