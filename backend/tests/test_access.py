import pytest

from tests.conftest import client_for, upload


@pytest.mark.parametrize(
    "user,state,code",
    [("pb", "up", 403), ("pb", "punjab", 200), ("upuser", "punjab", 403), ("upuser", "up", 200), ("viewer", "up", 200), ("admin", "punjab", 200)],
)
def test_state_access_is_enforced_server_side(user, state, code):
    c = client_for(user)
    for path in ("overview", "questions", "strategy", "ac-progress", "swing", "meta"):
        assert c.get(f"/api/states/{state}/{path}").status_code == code, path


def test_upload_permissions():
    assert upload(client_for("viewer"), "punjab").status_code == 403
    assert upload(client_for("pb"), "up").status_code == 403
    assert upload(client_for("pb"), "punjab").status_code == 200


def test_user_admin_only_and_role_validated():
    assert client_for("viewer").get("/api/users").status_code == 403
    admin = client_for("admin")
    bad = admin.post("/api/users", json={"username": "newuser", "password": "Long-Enough-Pass-1", "role": "superuser"})
    assert bad.status_code == 422
    ok = admin.post("/api/users", json={"username": "newuser", "password": "Long-Enough-Pass-1", "role": "up"})
    assert ok.status_code == 201 and ok.json()["must_change_password"] is True


def test_cannot_remove_last_admin():
    admin = client_for("admin")
    me = admin.get("/api/auth/me").json()
    assert admin.patch(f"/api/users/{me['id']}", json={"role": "viewer"}).status_code == 400


def test_portfolio_only_lists_allowed_states():
    keys = [s["key"] for s in client_for("pb").get("/api/states").json()]
    assert keys == ["punjab"]


def test_audit_log_records_logins():
    admin = client_for("admin")
    actions = [a["action"] for a in admin.get("/api/users/audit").json()]
    assert "login" in actions
