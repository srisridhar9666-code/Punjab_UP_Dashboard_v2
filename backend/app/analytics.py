"""Aggregations behind every dashboard view, shared by both states.

Every function takes a StateConfig + Filters and returns plain JSON-able data.
No raw respondent rows ever leave this module: only counts and shares.
"""

from collections import Counter, defaultdict
from dataclasses import astuple, dataclass
from datetime import date, timedelta

from sqlalchemy import case, func, select, union_all
from sqlalchemy.orm import Session

from .models import UploadLog
from .states import FILTER_COLUMNS, NO_ISSUE, NON_ANSWERS, StateConfig

DK = "Don't know / no answer"
OTHER = "Other"
RATING_ORDER = (
    "1. Very Dissatisfied",
    "2. Somewhat Dissatisfied",
    "3. Neutral",
    "4. Somewhat Satisfied",
    "5. Very Satisfied",
)
CHOICE_ORDER = ("Dissatisfied", "Average", "Satisfied")


@dataclass(frozen=True)
class Filters:
    district: str | None = None
    ac: str | None = None
    date_from: date | None = None
    date_to: date | None = None
    status: str = "Complete"
    gender: str | None = None
    age: str | None = None
    locality: str | None = None
    education: str | None = None
    occupation: str | None = None
    religion: str | None = None
    caste_category: str | None = None
    income: str | None = None

    def key(self) -> tuple:
        return astuple(self)


def _conds(cfg: StateConfig, f: Filters, use_status: bool = True) -> list:
    m = cfg.model
    c = []
    if f.district:
        c.append(m.district == f.district)
    if f.ac:
        c.append(m.ac_name == f.ac)
    if f.date_from:
        c.append(m.survey_date >= f.date_from)
    if f.date_to:
        c.append(m.survey_date <= f.date_to)
    if use_status and f.status and f.status != "All":
        c.append(m.status == f.status)
    for col in FILTER_COLUMNS:
        val = getattr(f, col)
        if val:
            c.append(getattr(m, col) == val)
    return c


def _sums(m):
    return (
        func.count().label("total"),
        func.coalesce(func.sum(case((m.status == "Complete", 1), else_=0)), 0).label("complete"),
        func.coalesce(func.sum(case((m.status == "Partial", 1), else_=0)), 0).label("partial"),
    )


def _norm_key(label: str) -> str:
    key = " ".join(label.lower().split())
    return key[:-1] if key.endswith("s") and not key.endswith("ss") else key


def _merge_variants(pairs) -> Counter:
    """Merge answers that differ only by case, spacing or a trailing plural 's'.

    The most frequent spelling is used as the display label.
    """
    totals: Counter[str] = Counter()
    spellings: dict[str, Counter[str]] = defaultdict(Counter)
    for label, n in pairs:
        key = _norm_key(label)
        totals[key] += int(n)
        spellings[key][label] += int(n)
    return Counter({spellings[k].most_common(1)[0][0]: v for k, v in totals.items()})


def _clean(label: str | None) -> str:
    if label is None or label.strip() in NON_ANSWERS or "know" in label.lower():
        return DK
    return label.strip()


# ─── Meta ────────────────────────────────────────────────────────────────────


def last_upload(db: Session, cfg: StateConfig) -> dict | None:
    log = db.query(UploadLog).filter(UploadLog.state == cfg.key).order_by(UploadLog.id.desc()).first()
    if not log:
        return None
    return {"at": log.uploaded_at.isoformat() + "Z", "by": log.uploaded_by, "filename": log.filename, "rows": log.rows_imported}


def meta(db: Session, cfg: StateConfig) -> dict:
    m = cfg.model
    acs = db.execute(select(m.ac_name, m.district, func.count()).where(m.ac_name.isnot(None)).group_by(m.ac_name, m.district).order_by(m.ac_name)).all()
    seen: dict[str, str | None] = {}
    for ac, district, _ in sorted(acs, key=lambda r: -r[2]):  # each AC's most common district
        seen.setdefault(ac, district)
    options = {}
    for col in FILTER_COLUMNS:
        c = getattr(m, col)
        rows = db.execute(select(c).where(c.isnot(None), c != "").group_by(c).order_by(func.count().desc()).limit(30)).all()
        options[col] = [r[0] for r in rows]
    dmin, dmax = db.execute(select(func.min(m.survey_date), func.max(m.survey_date))).one()
    return {
        "key": cfg.key,
        "name": cfg.name,
        "short": cfg.short,
        "total_acs": cfg.total_acs,
        "incumbent": cfg.incumbent,
        "phases": [{"name": p.name, "target": p.target} for p in cfg.phases],
        "districts": sorted({d for d in seen.values() if d}),
        "acs": [{"ac": ac, "district": d} for ac, d in sorted(seen.items())],
        "filter_options": options,
        "date_min": dmin.isoformat() if dmin else None,
        "date_max": dmax.isoformat() if dmax else None,
        "has_call_centers": cfg.call_center_col is not None,
        "vote_columns": [{"key": k, "label": label} for k, label in cfg.vote_columns],
        "crosstab_dimensions": [{"key": k, "label": q.title} for q in cfg.questions["demographics"] for k in [q.key] if k != "caste"],
        "last_upload": last_upload(db, cfg),
    }


# ─── Operations ──────────────────────────────────────────────────────────────


def daily(db: Session, cfg: StateConfig, f: Filters) -> list[dict]:
    m = cfg.model
    rows = db.execute(select(m.survey_date, *_sums(m)).where(m.survey_date.isnot(None), *_conds(cfg, f, use_status=False)).group_by(m.survey_date).order_by(m.survey_date)).all()
    return [{"date": r[0].isoformat(), "total": int(r.total), "complete": int(r.complete), "partial": int(r.partial)} for r in rows]


def overview(db: Session, cfg: StateConfig, f: Filters) -> dict:
    m = cfg.model
    conds = _conds(cfg, f, use_status=False)
    tot = db.execute(select(*_sums(m), func.count(func.distinct(m.ac_name)), func.count(func.distinct(m.district))).where(*conds)).one()
    per_ac = db.execute(select(m.ac_name, func.count()).where(m.status == "Complete", m.ac_name.isnot(None), *conds).group_by(m.ac_name)).all()
    days = daily(db, cfg, f)
    spark = days[-14:]
    last7 = days[-7:]
    latest = days[-1] if days else None
    prev = days[-2] if len(days) > 1 else None
    total, complete, partial = int(tot[0]), int(tot[1]), int(tot[2])
    return {
        "total": total,
        "complete": complete,
        "partial": partial,
        "completion_rate": round(complete / total * 100, 1) if total else 0.0,
        "acs_surveyed": int(tot[3]),
        "districts": int(tot[4]),
        "total_acs": cfg.total_acs,
        "phases": [{"name": p.name, "target": p.target, "done": sum(1 for _, n in per_ac if n >= p.target), "acs": len(per_ac)} for p in cfg.phases],
        "latest_day": latest,
        "previous_day": prev,
        "avg_daily_complete_7d": round(sum(d["complete"] for d in last7) / len(last7), 1) if last7 else 0.0,
        "spark": [{"date": d["date"], "complete": d["complete"]} for d in spark],
    }


def ac_progress(db: Session, cfg: StateConfig, f: Filters) -> list[dict]:
    m = cfg.model
    conds = _conds(cfg, f, use_status=False)
    rows = db.execute(
        select(m.ac_name, m.district, *_sums(m), func.min(m.survey_date), func.max(m.survey_date)).where(m.ac_name.isnot(None), *conds).group_by(m.ac_name, m.district)
    ).all()
    dmax = db.execute(select(func.max(m.survey_date)).where(*conds)).scalar()
    recent: dict[tuple, int] = {}
    if dmax:
        since = dmax - timedelta(days=6)
        for ac, dist, n in db.execute(
            select(m.ac_name, m.district, func.count()).where(m.status == "Complete", m.survey_date >= since, *conds).group_by(m.ac_name, m.district)
        ).all():
            recent[(ac, dist)] = int(n)
    out = []
    for r in rows:
        complete = int(r.complete)
        pace = round(recent.get((r[0], r[1]), 0) / 7, 1)
        # Remaining and ETA are measured to the next phase target the AC hasn't met yet.
        next_phase = next((p for p in cfg.phases if complete < p.target), None)
        remaining = next_phase.target - complete if next_phase else 0
        phases, prev_target = [], 0
        for p in cfg.phases:
            step = p.target - prev_target
            count = min(max(complete - prev_target, 0), step)
            phases.append({"name": p.name, "target": p.target, "count": count, "pct": round(count / step * 100, 1), "done": complete >= p.target})
            prev_target = p.target
        out.append(
            {
                "ac": r[0],
                "district": r[1],
                "total": int(r.total),
                "complete": complete,
                "partial": int(r.partial),
                "first_date": r[5].isoformat() if r[5] else None,
                "last_date": r[6].isoformat() if r[6] else None,
                "pace_7d": pace,
                "next_phase": next_phase.name if next_phase else None,
                "remaining": remaining,
                "eta_days": (None if remaining == 0 else (round(remaining / pace) if pace > 0 else -1)),
                "phases": phases,
            }
        )
    out.sort(key=lambda x: (x["district"] or "", x["ac"]))
    return out


def district_summary(db: Session, cfg: StateConfig, f: Filters) -> list[dict]:
    m = cfg.model
    rows = db.execute(select(m.district, *_sums(m), func.count(func.distinct(m.ac_name))).where(*_conds(cfg, f, use_status=False)).group_by(m.district).order_by(m.district)).all()
    return [
        {
            "district": r[0] or "Unknown",
            "total": int(r.total),
            "complete": int(r.complete),
            "partial": int(r.partial),
            "acs": int(r[4]),
            "completion_rate": round(int(r.complete) / int(r.total) * 100, 1) if r.total else 0.0,
        }
        for r in rows
    ]


def heatmap(db: Session, cfg: StateConfig, f: Filters) -> dict:
    m = cfg.model
    rows = db.execute(
        select(m.district, m.survey_date, func.count())
        .where(m.status == "Complete", m.survey_date.isnot(None), *_conds(cfg, f, use_status=False))
        .group_by(m.district, m.survey_date)
    ).all()
    dates = sorted({r[1] for r in rows})
    grid: dict[str, dict[date, int]] = defaultdict(dict)
    for dist, d, n in rows:
        grid[dist or "Unknown"][d] = int(n)
    districts = sorted(grid, key=lambda k: -sum(grid[k].values()))
    return {
        "dates": [d.isoformat() for d in dates],
        "rows": [{"district": k, "values": [grid[k].get(d, 0) for d in dates], "total": sum(grid[k].values())} for k in districts],
    }


def call_centers(db: Session, cfg: StateConfig, f: Filters) -> list[dict]:
    if not cfg.call_center_col:
        return []
    m = cfg.model
    col = getattr(m, cfg.call_center_col)
    conds = _conds(cfg, f, use_status=False)
    rows = db.execute(select(col, *_sums(m), func.count(func.distinct(m.survey_date))).where(col.isnot(None), col != "", *conds).group_by(col)).all()
    out = []
    for r in rows:
        days = int(r[4]) or 1
        out.append(
            {
                "center": r[0],
                "total": int(r.total),
                "complete": int(r.complete),
                "partial": int(r.partial),
                "completion_rate": round(int(r.complete) / int(r.total) * 100, 1) if r.total else 0.0,
                "active_days": int(r[4]),
                "complete_per_day": round(int(r.complete) / days, 1),
            }
        )
    out.sort(key=lambda x: -x["complete"])
    return out


# ─── Opinion ─────────────────────────────────────────────────────────────────


def _dist(db: Session, cfg: StateConfig, f: Filters, col_name: str) -> tuple[list[tuple[str, int]], int]:
    m = cfg.model
    col = getattr(m, col_name)
    rows = db.execute(select(col, func.count()).where(*_conds(cfg, f)).group_by(col)).all()
    merged = _merge_variants((_clean(label), n) for label, n in rows)
    return merged.most_common(), sum(merged.values())


def _issues(db: Session, cfg: StateConfig, f: Filters, kind: str, limit: int = 10) -> dict:
    m = cfg.model
    conds = _conds(cfg, f)
    c1, c2 = getattr(m, f"{kind}_1"), getattr(m, f"{kind}_2")
    sub = union_all(
        select(c1.label("issue")).where(c1.isnot(None), c1.notin_(NO_ISSUE), *conds),
        select(c2.label("issue")).where(c2.isnot(None), c2.notin_(NO_ISSUE), *conds),
    ).subquery()
    rows = db.execute(select(sub.c.issue, func.count()).group_by(sub.c.issue).order_by(func.count().desc())).all()
    respondents = db.execute(select(func.count()).where(*conds).select_from(m)).scalar() or 0
    rows = _merge_variants((k.strip(), n) for k, n in rows if k and k.strip() and "know" not in k.lower()).most_common()
    return {
        "base": int(respondents),
        "items": [{"label": k, "count": n, "pct": round(n / respondents * 100, 1) if respondents else 0} for k, n in rows[:limit]],
    }


def _shape(pairs: list[tuple[str, int]], base: int, kind: str, top: int = 8) -> list[dict]:
    def item(k, n):
        return {"label": k, "count": n, "pct": round(n / base * 100, 1) if base else 0}

    if kind == "rating":
        lookup = dict(pairs)
        ordered = [item(k, lookup.get(k, 0)) for k in RATING_ORDER]
        return ordered + [item(DK, lookup.get(DK, 0))]
    if kind == "choice" and any(k in CHOICE_ORDER for k, _ in pairs):
        lookup = dict(pairs)
        return [item(k, lookup.get(k, 0)) for k in CHOICE_ORDER] + [item(DK, lookup.get(DK, 0))]
    answers = [(k, n) for k, n in pairs if k != DK]
    dk = sum(n for k, n in pairs if k == DK)
    head, tail = answers[:top], answers[top:]
    out = [item(k, n) for k, n in head]
    if tail:
        out.append(item(OTHER, sum(n for _, n in tail)))
    if dk:
        out.append(item(DK, dk))
    return out


def questions(db: Session, cfg: StateConfig, f: Filters) -> dict:
    base_n = db.execute(select(func.count()).where(*_conds(cfg, f)).select_from(cfg.model)).scalar() or 0
    sections = {}
    for section, qs in cfg.questions.items():
        items = []
        for q in qs:
            if q.kind == "issue":
                data = _issues(db, cfg, f, q.key)
                items.append({"key": q.key, "title": q.title, "question": q.question, "kind": q.kind, **data})
                continue
            pairs, base = _dist(db, cfg, f, q.key)
            top = 12 if q.key in ("preferred_cm", "preferred_candidate", "caste", "occupation") else 8
            items.append({"key": q.key, "title": q.title, "question": q.question, "kind": q.kind, "base": base, "items": _shape(pairs, base, q.kind, top)})
        sections[section] = items
    return {"respondents": int(base_n), "sections": sections}


def _party(label: str | None, parties: tuple[str, ...]) -> str:
    lab = _clean(label)
    if lab == DK:
        return DK
    lab = lab.strip()
    for p in parties:
        if lab.lower() == p.lower():
            return p
    return OTHER


def swing(db: Session, cfg: StateConfig, f: Filters, src: str, dst: str) -> dict:
    m = cfg.model
    parties = cfg.main_parties[:6]
    rows = db.execute(select(getattr(m, src), getattr(m, dst), func.count()).where(*_conds(cfg, f)).group_by(getattr(m, src), getattr(m, dst))).all()
    flows: Counter[tuple[str, str]] = Counter()
    for a, b, n in rows:
        flows[(_party(a, parties), _party(b, parties))] += int(n)
    total = sum(flows.values())
    order = [p for p in parties] + [OTHER, DK]
    src_tot, dst_tot = Counter(), Counter()
    for (a, b), n in flows.items():
        src_tot[a] += n
        dst_tot[b] += n
    nodes = [k for k in order if src_tot[k] or dst_tot[k]]
    return {
        "base": total,
        "nodes": nodes,
        "flows": [{"from": a, "to": b, "count": n, "pct": round(n / total * 100, 2) if total else 0} for (a, b), n in sorted(flows.items(), key=lambda x: -x[1])],
        "shares": [
            {
                "party": k,
                "from_pct": round(src_tot[k] / total * 100, 1) if total else 0,
                "to_pct": round(dst_tot[k] / total * 100, 1) if total else 0,
                "change": round((dst_tot[k] - src_tot[k]) / total * 100, 1) if total else 0,
                "retention_pct": round(flows[(k, k)] / src_tot[k] * 100, 1) if src_tot[k] else None,
            }
            for k in nodes
        ],
    }


def crosstab(db: Session, cfg: StateConfig, f: Filters, row_col: str, col_col: str) -> dict:
    m = cfg.model
    rows = db.execute(select(getattr(m, row_col), getattr(m, col_col), func.count()).where(*_conds(cfg, f)).group_by(getattr(m, row_col), getattr(m, col_col))).all()
    is_party = col_col in {k for k, _ in cfg.vote_columns}
    grid: dict[str, Counter[str]] = defaultdict(Counter)
    for r, c, n in rows:
        rk = _clean(r)
        ck = _party(c, cfg.main_parties[:6]) if is_party else _clean(c)
        grid[rk][ck] += int(n)
    col_tot: Counter[str] = Counter()
    for counter in grid.values():
        col_tot.update(counter)
    if is_party:
        cols = [p for p in cfg.main_parties[:6] if col_tot[p]] + [k for k in (OTHER, DK) if col_tot[k]]
    elif col_col.endswith("rating"):
        cols = [k for k in RATING_ORDER if col_tot[k]] + ([DK] if col_tot[DK] else [])
    else:
        cols = [k for k, _ in col_tot.most_common(8)]
    row_keys = sorted((k for k in grid if k != DK), key=lambda k: -sum(grid[k].values()))[:12]
    out_rows = []
    for k in row_keys:
        n = sum(grid[k].values())
        out_rows.append({"label": k, "base": n, "cells": [{"col": c, "count": grid[k][c], "pct": round(grid[k][c] / n * 100, 1) if n else 0} for c in cols]})
    return {"columns": cols, "rows": out_rows}


def _share(db: Session, cfg: StateConfig, f: Filters, extra: list, col_name: str, value: str) -> tuple[float | None, int]:
    m = cfg.model
    col = getattr(m, col_name)
    row = db.execute(select(func.count(), func.coalesce(func.sum(case((col == value, 1), else_=0)), 0)).where(*_conds(cfg, f), *extra)).one()
    n, k = int(row[0]), int(row[1])
    return (round(k / n * 100, 1) if n else None), n


def strategy(db: Session, cfg: StateConfig, f: Filters) -> dict:
    m = cfg.model
    conds = _conds(cfg, f)
    inc = cfg.incumbent

    # Net satisfaction with the government (satisfied minus dissatisfied, of all who answered).
    rating = getattr(m, cfg.incumbent_rating)
    pairs = dict(db.execute(select(rating, func.count()).where(*conds).group_by(rating)).all())
    sat = sum(int(pairs.get(k, 0)) for k in RATING_ORDER[3:])
    dis = sum(int(pairs.get(k, 0)) for k in RATING_ORDER[:2])
    rated = sum(int(v) for v in pairs.values())

    sw = swing(db, cfg, f, "vote_2022", "vote_intention")
    inc_share = next((s for s in sw["shares"] if s["party"] == inc), None)
    inc_flows = [x for x in sw["flows"] if x["from"] == inc]
    inc_base = sum(x["count"] for x in inc_flows)
    retained = sum(x["count"] for x in inc_flows if x["to"] == inc)
    undecided = sum(x["count"] for x in inc_flows if x["to"] == DK)
    leakage = [{"to": x["to"], "count": x["count"], "pct": round(x["count"] / inc_base * 100, 1)} for x in inc_flows if x["to"] not in (inc, DK)]

    # Seats where MLA dissatisfaction is high (minimum 20 complete interviews).
    mla = getattr(m, cfg.mla_rating)
    risk_rows = db.execute(
        select(m.ac_name, m.district, func.count(), func.sum(case((mla.in_(cfg.mla_dissatisfied), 1), else_=0)))
        .where(m.ac_name.isnot(None), *conds)
        .group_by(m.ac_name, m.district)
    ).all()
    risky = []
    for ac, dist, n, d in risk_rows:
        n, d = int(n), int(d or 0)
        if n >= 20 and d / n >= cfg.risk_threshold:
            risky.append({"ac": ac, "district": dist, "base": n, "dissatisfied_pct": round(d / n * 100, 1)})
    risky.sort(key=lambda x: -x["dissatisfied_pct"])

    # What dissatisfied voters name as the top failure.
    driver_rows = db.execute(
        select(m.failure_1, func.count()).where(rating.in_(RATING_ORDER[:2]), m.failure_1.isnot(None), m.failure_1.notin_(NO_ISSUE), *conds).group_by(m.failure_1)
    ).all()
    merged_drivers = _merge_variants((k.strip(), n) for k, n in driver_rows if k and k.strip() and "know" not in k.lower())
    drivers_base = sum(merged_drivers.values()) or 1
    drivers = merged_drivers.most_common(8)

    # Incumbent vote share across groups (computed, not hard-coded as in v1).
    divides = []
    for col_name, values in (("locality", ("Urban", "Rural")), ("gender", ("Male", "Female"))):
        groups = []
        for v in values:
            pct, n = _share(db, cfg, f, [getattr(m, col_name) == v], "vote_intention", inc)
            groups.append({"group": v, "pct": pct, "base": n})
        divides.append({"dimension": col_name, "groups": groups})
    age_groups = []
    for (age,) in db.execute(select(m.age).where(m.age.isnot(None), m.age != "", ~m.age.contains("know"), *conds).group_by(m.age).order_by(m.age)).all():
        pct, n = _share(db, cfg, f, [m.age == age], "vote_intention", inc)
        if n >= 30:
            age_groups.append({"group": age.replace("_", "-"), "pct": pct, "base": n})
    divides.append({"dimension": "age", "groups": age_groups})

    return {
        "incumbent": inc,
        "base": sw["base"],
        "net_satisfaction": round((sat - dis) / rated * 100, 1) if rated else None,
        "satisfied_pct": round(sat / rated * 100, 1) if rated else None,
        "dissatisfied_pct": round(dis / rated * 100, 1) if rated else None,
        "incumbent_share": inc_share,
        "retention": {
            "base": inc_base,
            "retained_pct": round(retained / inc_base * 100, 1) if inc_base else None,
            "undecided_pct": round(undecided / inc_base * 100, 1) if inc_base else None,
            "leakage_pct": round((inc_base - retained - undecided) / inc_base * 100, 1) if inc_base else None,
            "leakage": sorted(leakage, key=lambda x: -x["count"]),
        },
        "risk": {"threshold_pct": round(cfg.risk_threshold * 100), "acs_rated": sum(1 for r in risk_rows if int(r[2]) >= 20), "items": risky},
        "drivers": [{"issue": k, "count": int(n), "pct": round(int(n) / drivers_base * 100, 1)} for k, n in drivers],
        "divides": divides,
    }
