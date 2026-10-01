import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from .config import get_settings
from .db import SessionLocal, engine
from .models import User
from .routers import analytics, auth, uploads, users
from .security import hash_password, password_problem

log = logging.getLogger("callcenter")
settings = get_settings()


def bootstrap_admin() -> None:
    """Create the first admin from env vars, only when the users table is empty."""
    name, pwd = settings.bootstrap_admin_username, settings.bootstrap_admin_password
    if not name or not pwd:
        return
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            problem = password_problem(pwd, name)
            if problem:
                log.error("BOOTSTRAP_ADMIN_PASSWORD rejected: %s", problem)
                return
            db.add(User(username=name, full_name="Administrator", hashed_password=hash_password(pwd), role="admin", must_change_password=True))
            db.commit()
            log.warning("Created bootstrap admin %r; they must change the password at first sign-in.", name)
    except Exception:
        log.exception("Could not bootstrap admin (have you run `alembic upgrade head`?)")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    bootstrap_admin()
    yield


app = FastAPI(
    lifespan=lifespan,
    title="Call Center Intelligence API",
    version="2.0.0",
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None,
    openapi_url=None if settings.is_production else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)

UNSAFE = {"POST", "PUT", "PATCH", "DELETE"}
CSP = (
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; "
    "font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
)


@app.middleware("http")
async def csrf_and_headers(request: Request, call_next):
    # Cookie sessions need CSRF protection. A custom header can't be sent
    # cross-site without passing CORS, so requiring it blocks forged form posts.
    # Bearer-token clients (scripts, /docs) are not cookie-based and are exempt.
    if (
        request.method in UNSAFE
        and request.url.path.startswith("/api/")
        and request.url.path != "/api/auth/token"
        and not request.headers.get("authorization")
        and request.headers.get("x-requested-with") != "XMLHttpRequest"
    ):
        return JSONResponse({"detail": "Missing X-Requested-With header"}, status_code=403)
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "same-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    if request.url.path.startswith("/api/"):
        response.headers.setdefault("Cache-Control", "no-store")
    if settings.is_production:
        response.headers.setdefault("Content-Security-Policy", CSP)
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    return response


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    log.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse({"detail": "Something went wrong on the server."}, status_code=500)


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(uploads.router)
app.include_router(analytics.router)


@app.get("/api/health", tags=["health"])
def health():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "database": "ok"}
    except Exception:
        return JSONResponse({"status": "degraded", "database": "unreachable"}, status_code=503)


# Serve the built React app from the same origin when it's present
# (Docker image / production). In development Vite serves it instead.
DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if (DIST / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        candidate = (DIST / path).resolve()
        if path and candidate.is_file() and DIST in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(DIST / "index.html")
