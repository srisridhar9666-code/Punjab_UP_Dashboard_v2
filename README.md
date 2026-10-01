# Call Center Intelligence v2 (Punjab & UP)

A rebuilt version of the call center survey dashboard: hardened backend, one API for both states, and a new premium UI with richer charts.

Your v1 folder (`Call_center_UP_Punjab`) is untouched. v2 runs on the **same MySQL database**: the migration adds new tables and columns, and keeps your survey data and user accounts.

---

## What changed from v1

### Security (the production blockers)
| v1 | v2 |
|---|---|
| State access was only hidden in the browser. A Punjab user could read all UP data from the API. | Every endpoint checks the user's role on the server. There are tests for each role × state. |
| Fallback JWT secret `"fallback-secret-key"` | The app refuses to start without a strong `SECRET_KEY`, and known defaults are rejected. |
| Default `admin / admin123`, printed in the README | No default password. Existing accounts must choose a new password at next sign-in. New users get a temporary password and must change it. |
| No limit on login attempts | Per-IP rate limit, plus a 15-minute account lockout after 5 failures. |
| Token kept in `localStorage` (readable by any script) | `httpOnly`, `SameSite=Strict` session cookie, with CSRF protection. Changing a password, role or access signs out old sessions. |
| `python-jose` / `passlib` (unmaintained) | `PyJWT` and `pwdlib` with Argon2. Old bcrypt hashes still work and are upgraded on next sign-in. |
| Any role string accepted | Roles validated (`admin`, `punjab`, `up`, `viewer`). The last admin can't be removed. |
| No audit trail | Audit log of sign-ins, failed sign-ins, uploads, restores and user changes. |
| Production: CSP, HSTS and frame headers not set; `/docs` public | All of these are set in production, and `/docs` is off. |

### Data correctness
- **29% of Punjab rows were missing from every date-based view.** v1 couldn't read `9/21/2026 9:17`-style dates, so 3,988 of 13,768 rows were dropped from the daily trend and date filters. v2 reads every format in the sheet. This was checked on your real CSV: 9,780 → 13,768 dated rows.
- **The "demographic divides" in v1 were hard-coded text.** For example, "54.1% BJP among Men / 56.8% among Women" never changed with the data. Computed from your data, it is 55.5% men and 46.1% women: the gap is reversed. v2 computes these from the data.
- **Answer spellings are merged.** "Drug Issue" / "Drug issue" and "Road Issue" / "Road issues" were counted as separate issues. v2 merges variants that differ only in case or a trailing "s".
- **Safe uploads.** v1 ran `TRUNCATE` and then inserted, so a bad file left a state empty. v2 checks the file first and shows a preview (rows, ACs, date range, duplicates, unreadable dates). It then swaps the data in **one transaction**, keeps the last 10 files, and lets you **restore** any of them in one click. A UP file uploaded under Punjab is rejected.

### UI and charts
- New design system: Inter, warm neutral surfaces, one accent colour, and real light, dark and system themes. Colours come from a palette checked for colour-blind safety.
- Collapsible sidebar, a **⌘K / Ctrl+K command palette** (jump to any constituency, district or page), and mobile layouts.
- **One global filter bar** (district, AC, date presets, 8 respondent filters). Filters live in the URL, so any view can be shared as a link.
- **Overview:** both states at a glance, with the latest day versus the day before, a 14-day sparkline and target rings.
- **Operations:** KPI tiles, daily complete and partial chart, call center productivity, a **district × day heatmap**, and a constituency table with search, sort, CSV export and a status for each AC (on pace, slow, stalled, all targets met). The table also shows pace per day and the **ETA to the next target**.
- **Opinion:** diverging satisfaction bars, party-coloured vote bars (each party keeps its colour everywhere), issues and sample composition. A warning appears when the sample is small.
- **Strategy:** a **voter-flow Sankey** (2022, 2024 LS, or now, in any direction), share shift, incumbent retention and leakage, seats at risk, drivers of dissatisfaction, and incumbent vote by group.
- **Explorer:** a crosstab of any vote or rating by any demographic, with shaded cells and small-base warnings.
- Every chart has a **table view** and a **CSV download**. Only aggregates ever leave the server, never respondent rows.

### Engineering
- One config-driven analytics module serves both states. v1 had two route files of about 665 lines each that were 95% the same.
- Results are cached per upload, so dashboards load fast. Every endpoint answers in under 1 s on the full dataset.
- **Alembic migrations**, tested against a v1 database created by the v1 code (on MariaDB, which speaks the MySQL protocol). CI also runs them up, down and up again on MySQL 8.4.
- 36 backend tests (pytest), ruff lint and format, TypeScript strict build, and GitHub Actions CI (including a MySQL migration job).
- Docker image (one container serves the API and the UI), docker-compose with MySQL, and optional Caddy for automatic HTTPS.
- Stack: FastAPI · SQLAlchemy 2 · Alembic · PyJWT · pwdlib, with React 19 · React Router 7 · TanStack Query · ECharts 6 · Radix · Tailwind · Vite 7.

---

## Run it on Windows (same flow as v1)

Prerequisites: Python 3.10+, Node 22 LTS (or 20.19+) and MySQL (your existing database is fine).

1. Double-click **`setup.bat`**.
   - The first run creates `backend\.env` with a fresh `SECRET_KEY`. Open it, set `DB_PASSWORD` to your MySQL password (plus any other `DB_*` value you changed for v1; the defaults match v1's), and run `setup.bat` again.
   - It then upgrades the database (`alembic upgrade head`). This is safe on your v1 database.
   - It offers to create or reset an admin account.
2. Double-click **`start.bat`**, then open http://localhost:5173.

Existing v1 users keep their password for one more sign-in, then must choose a new one.

**Re-upload each state's CSV once after upgrading**, so the rows v1 couldn't date are fixed.

### Admin commands
```
cd backend
.venv\Scripts\python -m app.cli create-admin <username>        # create or reset an admin (prompts for password)
.venv\Scripts\python -m app.cli import-csv punjab <file.csv>   # bulk import without the UI
```

## Deploy to a server (Docker)

```
cp .env.example .env          # set SECRET_KEY, DB_PASSWORD, MYSQL_ROOT_PASSWORD, BOOTSTRAP_ADMIN_PASSWORD
docker compose up -d          # try it on the server itself: http://localhost:8000
# serve it to your team over HTTPS (set DOMAIN in .env and point its DNS at the server):
docker compose --profile https up -d
```
Sign-in needs HTTPS (or localhost), because session cookies are `Secure` in production. That's why the app's port is only open on the server itself, and Caddy serves your team on 443.

The container applies migrations on start. Uploaded CSVs (for rollback) are kept in the `uploads` volume, and the database is in the `dbdata` volume.

**Back up the database daily**, for example from a cron job:
```
docker compose exec -T db sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction callcenter_dashboard' > backup-$(date +%F).sql
```

## Development

```
# backend
cd backend && python -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
cp .env.example .env   # set SECRET_KEY; DATABASE_URL=sqlite:///./dev.db works for local hacking
.venv/bin/alembic upgrade head && .venv/bin/uvicorn app.main:app --reload --port 8001
.venv/bin/pytest -q && .venv/bin/ruff check app tests

# frontend
cd frontend && npm install && npm run dev      # proxies /api to :8001
npm run build                                  # typecheck + production build
```

## Roles
| Role | Punjab | UP | Upload | Users & audit |
|---|---|---|---|---|
| admin | ✓ | ✓ | both | ✓ |
| punjab | ✓ | – | Punjab | – |
| up | – | ✓ | UP | – |
| viewer | ✓ | ✓ | – | – |

## Still on you before going live
- **Host behind HTTPS.** Use the `https` profile or your own proxy. Session cookies are `Secure` in production.
- **Data protection.** This data includes voting intention, religion and caste, which is sensitive personal data under India's DPDP Act. Agree a retention period and who gets accounts. Use the audit log to review access.
- **Several API workers.** If you run more than one API worker, move the login rate limit to your proxy (or Redis). The built-in limiter is per process.
