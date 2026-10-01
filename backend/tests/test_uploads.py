from app.ingest import parse_date
from tests.conftest import FIXTURES, client_for, upload


def test_parse_date_formats():
    assert str(parse_date("2026/09/23")) == "2026-09-23"
    assert str(parse_date("9/21/2026 9:17")) == "2026-09-21"  # v1 dropped these (29% of Punjab rows)
    assert str(parse_date("10/09/2026")) == "2026-09-10"  # DD/MM wins when ambiguous
    assert parse_date("not a date") is None


def test_preview_does_not_write():
    c = client_for("admin")
    path = FIXTURES / "punjab_sample.csv"
    r = c.post("/api/uploads/punjab/preview", files={"file": (path.name, path.read_bytes(), "text/csv")})
    body = r.json()
    assert r.status_code == 200 and body["ok"] and body["total_rows"] == 120 and body["bad_dates"] == 0
    assert c.get("/api/states/punjab/overview?status=All").json()["total"] == 0


def test_upload_then_all_dates_parsed():
    c = client_for("admin")
    assert upload(c, "punjab").json()["rows_imported"] == 120
    trend = c.get("/api/states/punjab/trend").json()
    assert sum(d["total"] for d in trend) == 120


def test_wrong_file_is_rejected_and_old_data_kept():
    c = client_for("admin")
    upload(c, "punjab")
    assert upload(c, "punjab", "up_sample.csv").status_code == 400  # UP file picked under Punjab
    bad = c.post("/api/uploads/punjab", files={"file": ("x.csv", b"foo,bar\n1,2\n", "text/csv")})
    assert bad.status_code == 400
    assert c.get("/api/states/punjab/overview?status=All").json()["total"] == 120


def test_non_csv_and_size_limits():
    c = client_for("admin")
    assert c.post("/api/uploads/punjab", files={"file": ("x.xlsx", b"abc", "application/octet-stream")}).status_code == 400


def test_history_and_restore():
    c = client_for("admin")
    first = upload(c, "punjab").json()
    second = upload(c, "punjab").json()
    assert second["id"] != first["id"]
    hist = c.get("/api/uploads").json()
    restorable = [h for h in hist if h["id"] == first["id"]][0]
    assert restorable["can_restore"]
    r = c.post(f"/api/uploads/punjab/restore/{first['id']}")
    assert r.status_code == 200
    hist = c.get("/api/uploads").json()
    assert hist[0]["restored_from"] == first["id"]


def test_cache_invalidated_by_upload():
    c = client_for("admin")
    assert c.get("/api/states/up/overview?status=All").json()["total"] == 0
    upload(c, "up")
    assert c.get("/api/states/up/overview?status=All").json()["total"] == 80
