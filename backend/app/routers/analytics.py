from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import analytics as A
from ..cache import cached
from ..db import get_db
from ..deps import get_current_user, require_state_view
from ..models import User
from ..states import FILTER_COLUMNS, ROLE_STATES, STATES, StateConfig

router = APIRouter(prefix="/api/states", tags=["analytics"])


def filters(
    district: str | None = None,
    ac: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    status: Literal["Complete", "Partial", "All"] = "Complete",
    gender: str | None = None,
    age: str | None = None,
    locality: str | None = None,
    education: str | None = None,
    occupation: str | None = None,
    religion: str | None = None,
    caste_category: str | None = None,
    income: str | None = None,
) -> A.Filters:
    return A.Filters(district, ac, date_from, date_to, status, gender, age, locality, education, occupation, religion, caste_category, income)


def _run(cfg: StateConfig, name: str, f: A.Filters, fn, *extra):
    return cached(cfg.key, name, (f.key(), extra), fn)


@router.get("")
def portfolio(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Headline numbers for every state the user can see."""
    out = []
    for key in ("punjab", "up"):
        if key not in ROLE_STATES.get(user.role, set()):
            continue
        cfg = STATES[key]
        f = A.Filters(status="All")
        ov = _run(cfg, "overview", f, lambda cfg=cfg, f=f: A.overview(db, cfg, f))
        out.append({"key": key, "name": cfg.name, "short": cfg.short, "overview": ov, "last_upload": A.last_upload(db, cfg)})
    return out


@router.get("/{state}/meta")
def meta(cfg: StateConfig = Depends(require_state_view), db: Session = Depends(get_db)):
    return _run(cfg, "meta", A.Filters(), lambda: A.meta(db, cfg))


@router.get("/{state}/overview")
def overview(cfg: StateConfig = Depends(require_state_view), f: A.Filters = Depends(filters), db: Session = Depends(get_db)):
    return _run(cfg, "overview", f, lambda: A.overview(db, cfg, f))


@router.get("/{state}/trend")
def trend(cfg: StateConfig = Depends(require_state_view), f: A.Filters = Depends(filters), db: Session = Depends(get_db)):
    return _run(cfg, "trend", f, lambda: A.daily(db, cfg, f))


@router.get("/{state}/ac-progress")
def ac_progress(cfg: StateConfig = Depends(require_state_view), f: A.Filters = Depends(filters), db: Session = Depends(get_db)):
    return _run(cfg, "ac", f, lambda: A.ac_progress(db, cfg, f))


@router.get("/{state}/districts")
def districts(cfg: StateConfig = Depends(require_state_view), f: A.Filters = Depends(filters), db: Session = Depends(get_db)):
    return _run(cfg, "districts", f, lambda: A.district_summary(db, cfg, f))


@router.get("/{state}/heatmap")
def heatmap(cfg: StateConfig = Depends(require_state_view), f: A.Filters = Depends(filters), db: Session = Depends(get_db)):
    return _run(cfg, "heatmap", f, lambda: A.heatmap(db, cfg, f))


@router.get("/{state}/call-centers")
def call_centers(cfg: StateConfig = Depends(require_state_view), f: A.Filters = Depends(filters), db: Session = Depends(get_db)):
    return _run(cfg, "cc", f, lambda: A.call_centers(db, cfg, f))


@router.get("/{state}/questions")
def questions(cfg: StateConfig = Depends(require_state_view), f: A.Filters = Depends(filters), db: Session = Depends(get_db)):
    return _run(cfg, "questions", f, lambda: A.questions(db, cfg, f))


def _check_column(cfg: StateConfig, col: str, allowed: set[str]) -> str:
    if col not in allowed:
        raise HTTPException(status_code=400, detail=f"Unsupported column: {col}")
    return col


@router.get("/{state}/swing")
def swing(
    source: str = Query("vote_2022", alias="from"),
    target: str = Query("vote_intention", alias="to"),
    cfg: StateConfig = Depends(require_state_view),
    f: A.Filters = Depends(filters),
    db: Session = Depends(get_db),
):
    votes = {k for k, _ in cfg.vote_columns}
    _check_column(cfg, source, votes)
    _check_column(cfg, target, votes)
    return _run(cfg, "swing", f, lambda: A.swing(db, cfg, f, source, target), source, target)


@router.get("/{state}/crosstab")
def crosstab(
    row: str = "caste_category",
    col: str = "vote_intention",
    cfg: StateConfig = Depends(require_state_view),
    f: A.Filters = Depends(filters),
    db: Session = Depends(get_db),
):
    rows_allowed = set(FILTER_COLUMNS) | {"district"}
    cols_allowed = {k for k, _ in cfg.vote_columns} | {cfg.incumbent_rating, cfg.mla_rating}
    _check_column(cfg, row, rows_allowed)
    _check_column(cfg, col, cols_allowed)
    return _run(cfg, "crosstab", f, lambda: A.crosstab(db, cfg, f, row, col), row, col)


@router.get("/{state}/strategy")
def strategy(cfg: StateConfig = Depends(require_state_view), f: A.Filters = Depends(filters), db: Session = Depends(get_db)):
    return _run(cfg, "strategy", f, lambda: A.strategy(db, cfg, f))
