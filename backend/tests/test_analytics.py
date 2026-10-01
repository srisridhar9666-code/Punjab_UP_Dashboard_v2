from tests.conftest import client_for, upload


def test_views_return_consistent_numbers():
    c = client_for("admin")
    upload(c, "punjab")
    ov = c.get("/api/states/punjab/overview").json()
    assert ov["total"] == ov["complete"] + ov["partial"] == 120
    acs = c.get("/api/states/punjab/ac-progress").json()
    assert sum(a["complete"] for a in acs) == ov["complete"]
    q = c.get("/api/states/punjab/questions").json()
    assert q["respondents"] == ov["complete"]
    rating = q["sections"]["leadership"][0]
    assert [i["label"] for i in rating["items"]][:5] == ["1. Very Dissatisfied", "2. Somewhat Dissatisfied", "3. Neutral", "4. Somewhat Satisfied", "5. Very Satisfied"]
    sw = c.get("/api/states/punjab/swing").json()
    assert sw["base"] == ov["complete"]
    assert abs(sum(f["count"] for f in sw["flows"]) - sw["base"]) == 0


def test_filters_narrow_results():
    c = client_for("admin")
    upload(c, "punjab")
    all_ = c.get("/api/states/punjab/overview").json()["total"]
    north = c.get("/api/states/punjab/overview", params={"district": "North"}).json()["total"]
    women = c.get("/api/states/punjab/overview", params={"gender": "Female"}).json()["total"]
    assert 0 < north < all_ and 0 < women < all_


def test_strategy_divides_are_computed_not_hardcoded():
    c = client_for("admin")
    upload(c, "up")
    s = c.get("/api/states/up/strategy").json()
    for d in s["divides"]:
        for g in d["groups"]:
            assert isinstance(g["base"], int)
    assert "lead" not in str(s["divides"])  # v1 returned fixed strings like "54.1% BJP among Men"


def test_crosstab_rejects_unknown_columns():
    c = client_for("admin")
    assert c.get("/api/states/up/crosstab", params={"row": "hashed_password"}).status_code == 400
    assert c.get("/api/states/up/crosstab", params={"row": "gender", "col": "vote_2024_ls"}).status_code == 200


def test_answer_variants_are_merged():
    from app.analytics import _merge_variants

    merged = _merge_variants([("Drug Issue", 3), ("Drug issue", 2), ("Road issues", 1), ("Road Issue", 4), ("Jobs", 1)])
    assert merged == {"Drug Issue": 5, "Road Issue": 5, "Jobs": 1}


def test_eta_targets_next_unmet_phase():
    c = client_for("admin")
    upload(c, "punjab")
    for row in c.get("/api/states/punjab/ac-progress").json():
        assert row["next_phase"] == "Phase 1"  # fixture ACs have < 75 completes
        assert row["remaining"] == 75 - row["complete"]


def test_drivers_exclude_non_answers():
    c = client_for("admin")
    upload(c, "up")
    issues = [d["issue"].lower() for d in c.get("/api/states/up/strategy").json()["drivers"]]
    assert issues and not any("know" in i or i.startswith("no issue") for i in issues)
