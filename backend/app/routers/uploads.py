import hashlib
import re
from datetime import date, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel
from sqlalchemy import delete, insert
from sqlalchemy.orm import Session

from .. import cache
from ..config import get_settings
from ..db import get_db
from ..deps import audit, get_current_user, require_state_upload
from ..ingest import ParseReport, parse_csv
from ..models import UploadLog, User, utcnow
from ..states import UPLOAD_ROLES, StateConfig

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

CHUNK = 2000


class UploadOut(BaseModel):
    id: int
    state: str
    filename: str
    rows_imported: int
    date_min: date | None = None
    date_max: date | None = None
    uploaded_by: str
    uploaded_at: datetime
    restored_from: int | None
    can_restore: bool = False

    model_config = {"from_attributes": True}


async def _read_upload(file: UploadFile) -> bytes:
    max_bytes = get_settings().max_upload_mb * 1024 * 1024
    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted")
    content = await file.read(max_bytes + 1)
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail=f"File is larger than {get_settings().max_upload_mb} MB")
    if not content.strip():
        raise HTTPException(status_code=400, detail="The file is empty")
    return content


def _replace_rows(db: Session, cfg: StateConfig, rep: ParseReport) -> None:
    """Swap the state's data in ONE transaction: if anything fails, the old data stays."""
    try:
        db.execute(delete(cfg.model))
        for i in range(0, len(rep.rows), CHUNK):
            db.execute(insert(cfg.model), rep.rows[i : i + CHUNK])
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Import failed and was rolled back; the previous data is unchanged ({type(exc).__name__}).") from exc
    finally:
        cache.bump(cfg.key)


def _store_file(cfg: StateConfig, content: bytes, sha: str, filename: str) -> str:
    s = get_settings()
    folder = Path(s.upload_dir) / cfg.key
    folder.mkdir(parents=True, exist_ok=True)
    safe = re.sub(r"[^A-Za-z0-9_.-]+", "_", filename)[-80:]
    path = folder / f"{utcnow():%Y%m%dT%H%M%S}_{sha[:10]}_{safe}"
    path.write_bytes(content)
    return str(path)


def _prune(db: Session, cfg: StateConfig) -> None:
    keep = get_settings().upload_keep
    logs = db.query(UploadLog).filter(UploadLog.state == cfg.key, UploadLog.stored_path.isnot(None)).order_by(UploadLog.id.desc()).all()
    kept_paths = {log.stored_path for log in logs[:keep]}
    for log in logs[keep:]:
        if log.stored_path not in kept_paths:  # a restore re-uses the original file
            try:
                Path(log.stored_path).unlink(missing_ok=True)
            except OSError:
                pass
        log.stored_path = None
    db.commit()


@router.post("/{state}/preview")
async def preview(file: UploadFile = File(...), cfg: StateConfig = Depends(require_state_upload)):
    """Validate a CSV without touching the database."""
    content = await _read_upload(file)
    rep = parse_csv(content, cfg)
    return {"filename": file.filename, **rep.summary()}


@router.post("/{state}", response_model=UploadOut)
async def commit_upload(
    request: Request,
    file: UploadFile = File(...),
    cfg: StateConfig = Depends(require_state_upload),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    content = await _read_upload(file)
    rep = parse_csv(content, cfg)
    if not rep.ok:
        missing = ", ".join(rep.missing_required) or "data rows"
        raise HTTPException(status_code=400, detail=f"This file can't be imported: missing {missing}.")
    sha = hashlib.sha256(content).hexdigest()
    _replace_rows(db, cfg, rep)
    log = UploadLog(
        state=cfg.key,
        filename=file.filename or "upload.csv",
        stored_path=_store_file(cfg, content, sha, file.filename or "upload.csv"),
        sha256=sha,
        rows_imported=rep.total_rows,
        rows_skipped=0,
        date_min=rep.date_min,
        date_max=rep.date_max,
        uploaded_by=user.username,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    _prune(db, cfg)
    audit(db, request, user.username, "upload", f"{cfg.key}: {log.filename} ({rep.total_rows} rows)")
    return UploadOut.model_validate(log)


@router.get("", response_model=list[UploadOut])
def history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    states = UPLOAD_ROLES.get(user.role, set())
    if not states:
        return []
    logs = db.query(UploadLog).filter(UploadLog.state.in_(states)).order_by(UploadLog.id.desc()).limit(50).all()
    latest = {}
    for log in logs:
        latest.setdefault(log.state, log.id)
    out = []
    for log in logs:
        item = UploadOut.model_validate(log)
        item.can_restore = bool(log.stored_path) and latest[log.state] != log.id and Path(log.stored_path).exists()
        out.append(item)
    return out


@router.post("/{state}/restore/{upload_id}", response_model=UploadOut)
def restore(
    upload_id: int,
    request: Request,
    cfg: StateConfig = Depends(require_state_upload),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    src = db.get(UploadLog, upload_id)
    if not src or src.state != cfg.key or not src.stored_path or not Path(src.stored_path).exists():
        raise HTTPException(status_code=404, detail="That upload is no longer available to restore")
    content = Path(src.stored_path).read_bytes()
    rep = parse_csv(content, cfg)
    if not rep.ok:
        raise HTTPException(status_code=400, detail="The stored file no longer passes validation")
    _replace_rows(db, cfg, rep)
    log = UploadLog(
        state=cfg.key,
        filename=src.filename,
        stored_path=src.stored_path,
        sha256=src.sha256,
        rows_imported=rep.total_rows,
        date_min=rep.date_min,
        date_max=rep.date_max,
        uploaded_by=user.username,
        restored_from=src.id,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    audit(db, request, user.username, "upload_restored", f"{cfg.key}: upload #{src.id}")
    return UploadOut.model_validate(log)
