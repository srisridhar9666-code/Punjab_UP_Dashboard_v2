"""Admin commands.

python -m app.cli create-admin <username>      # prompts for the password
python -m app.cli import-csv <punjab|up> <file.csv>
"""

import getpass
import hashlib
import sys
from pathlib import Path

from .db import SessionLocal
from .ingest import parse_csv
from .models import UploadLog, User
from .routers.uploads import _replace_rows
from .security import hash_password, password_problem
from .states import STATES


def create_admin(username: str) -> int:
    pwd = getpass.getpass("New admin password: ")
    if pwd != getpass.getpass("Repeat password: "):
        print("Passwords do not match.")
        return 1
    problem = password_problem(pwd, username)
    if problem:
        print(problem)
        return 1
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        if user:
            user.hashed_password = hash_password(pwd)
            user.role, user.is_active, user.must_change_password = "admin", True, False
            user.token_version += 1
            print(f"Updated {username}: now an active admin with the new password.")
        else:
            db.add(User(username=username, full_name="Administrator", hashed_password=hash_password(pwd), role="admin", must_change_password=False))
            print(f"Created admin {username}.")
        db.commit()
    finally:
        db.close()
    return 0


def import_csv(state: str, path: str) -> int:
    cfg = STATES.get(state)
    if not cfg:
        print("State must be punjab or up")
        return 1
    content = Path(path).read_bytes()
    rep = parse_csv(content, cfg)
    for w in rep.warnings:
        print("warning:", w)
    if not rep.ok:
        print("Cannot import; missing:", ", ".join(rep.missing_required) or "rows")
        return 1
    db = SessionLocal()
    try:
        _replace_rows(db, cfg, rep)
        db.add(
            UploadLog(
                state=cfg.key,
                filename=Path(path).name,
                stored_path=None,
                sha256=hashlib.sha256(content).hexdigest(),
                rows_imported=rep.total_rows,
                date_min=rep.date_min,
                date_max=rep.date_max,
                uploaded_by="cli",
            )
        )
        db.commit()
    finally:
        db.close()
    print(f"Imported {rep.total_rows} {cfg.name} rows ({rep.date_min} to {rep.date_max}).")
    return 0


def main(argv: list[str]) -> int:
    if len(argv) >= 2 and argv[0] == "create-admin":
        return create_admin(argv[1])
    if len(argv) >= 3 and argv[0] == "import-csv":
        return import_csv(argv[1], argv[2])
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
