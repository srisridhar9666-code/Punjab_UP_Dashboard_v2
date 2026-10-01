"""CSV parsing and validation for the daily Google Sheet export.

Fixes over v1:
- ~29% of Punjab rows use `M/D/YYYY H:MM` timestamps, which v1 silently
  turned into empty dates (they vanished from the daily trend and date filters).
- Required columns are checked *before* anything is written.
- Every problem is reported back in a preview, so a wrong file is caught
  before it replaces the live data.
"""

import csv
import io
from collections import Counter
from dataclasses import dataclass, field
from datetime import date, datetime

from .states import StateConfig

DATE_FORMATS = (
    "%Y/%m/%d",
    "%Y-%m-%d",
    "%d/%m/%Y",  # Indian DD/MM/YYYY wins over US for ambiguous dates
    "%d-%m-%Y",
    "%m/%d/%Y",
    "%m/%d/%Y %H:%M",
    "%m/%d/%Y %H:%M:%S",
    "%d/%m/%Y %H:%M",
    "%Y-%m-%d %H:%M:%S",
)


def parse_date(raw: str | None) -> date | None:
    if raw is None:
        return None
    val = raw.strip()
    if not val:
        return None
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(val, fmt).date()
        except ValueError:
            continue
    return None


@dataclass
class ParseReport:
    rows: list[dict] = field(default_factory=list)
    total_rows: int = 0
    missing_required: list[str] = field(default_factory=list)
    unknown_columns: list[str] = field(default_factory=list)
    bad_dates: int = 0
    bad_date_examples: list[str] = field(default_factory=list)
    duplicates: int = 0
    date_min: date | None = None
    date_max: date | None = None
    statuses: dict[str, int] = field(default_factory=dict)
    acs: int = 0
    districts: int = 0
    warnings: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.missing_required and self.total_rows > 0

    def summary(self) -> dict:
        return {
            "ok": self.ok,
            "total_rows": self.total_rows,
            "missing_required": self.missing_required,
            "unknown_columns": self.unknown_columns,
            "bad_dates": self.bad_dates,
            "bad_date_examples": self.bad_date_examples,
            "duplicates": self.duplicates,
            "date_min": self.date_min.isoformat() if self.date_min else None,
            "date_max": self.date_max.isoformat() if self.date_max else None,
            "statuses": self.statuses,
            "acs": self.acs,
            "districts": self.districts,
            "warnings": self.warnings,
        }


def parse_csv(content: bytes, cfg: StateConfig) -> ParseReport:
    rep = ParseReport()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("cp1252", errors="replace")
        rep.warnings.append("File is not UTF-8; decoded as Windows-1252. Check names with special characters.")

    reader = csv.reader(io.StringIO(text))
    try:
        header = [h.strip() for h in next(reader)]
    except StopIteration:
        rep.missing_required = list(cfg.required_csv)
        return rep

    mapping = {i: cfg.csv_columns[h] for i, h in enumerate(header) if h in cfg.csv_columns}
    rep.missing_required = [c for c in cfg.required_csv if c not in header]
    rep.unknown_columns = [h for h in header if h and h not in cfg.csv_columns]
    if rep.missing_required:
        return rep

    statuses: Counter[str] = Counter()
    acs, districts = set(), set()
    for raw in reader:
        if not any(cell.strip() for cell in raw):
            continue
        row: dict = {}
        for i, col in mapping.items():
            val = raw[i].strip() if i < len(raw) else ""
            row[col] = val or None
        raw_date = row.get("survey_date")
        d = parse_date(raw_date)
        if raw_date and d is None:
            rep.bad_dates += 1
            if len(rep.bad_date_examples) < 5:
                rep.bad_date_examples.append(raw_date)
        row["survey_date"] = d
        if d:
            rep.date_min = d if rep.date_min is None or d < rep.date_min else rep.date_min
            rep.date_max = d if rep.date_max is None or d > rep.date_max else rep.date_max
        if (row.get("duplicacy_check") or "").lower() == "duplicates":
            rep.duplicates += 1
        statuses[row.get("status") or "(blank)"] += 1
        if row.get("ac_name"):
            acs.add(row["ac_name"])
        if row.get("district"):
            districts.add(row["district"])
        rep.rows.append(row)

    rep.total_rows = len(rep.rows)
    rep.statuses = dict(statuses.most_common())
    rep.acs = len(acs)
    rep.districts = len(districts)
    if rep.total_rows == 0:
        rep.warnings.append("The file has a header but no data rows.")
    if "Complete" not in statuses:
        rep.warnings.append("No rows have Status = Complete, so every opinion chart will be empty.")
    if rep.bad_dates:
        rep.warnings.append(f"{rep.bad_dates} rows have a date that could not be read; they are kept but excluded from date filters.")
    return rep
