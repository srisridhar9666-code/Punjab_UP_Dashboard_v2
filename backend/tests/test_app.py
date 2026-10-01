from tests.conftest import client_for


def test_security_headers_and_health():
    c = client_for("viewer")
    r = c.get("/api/states/punjab/meta")
    assert r.status_code == 200
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"
    assert r.headers["cache-control"] == "no-store"
    health = client_for(None).get("/api/health")
    assert health.status_code == 200 and health.json() == {"status": "ok", "database": "ok"}
