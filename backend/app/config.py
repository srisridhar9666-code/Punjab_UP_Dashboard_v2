from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """All runtime configuration comes from environment variables (or backend/.env).

    SECRET_KEY has no default on purpose: the app refuses to start without one,
    so tokens can never be signed with a guessable key.
    """

    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    environment: str = Field("development", description="development | production")

    # Database: either a full DATABASE_URL, or the legacy DB_* parts used by v1.
    database_url: str | None = None
    db_host: str = "localhost"
    db_port: int = 3306
    db_user: str = "admin"
    db_password: str = ""
    db_name: str = "callcenter_dashboard"

    secret_key: str = Field(..., min_length=32)
    access_token_minutes: int = 8 * 60
    cookie_name: str = "ccd_session"
    cookie_secure: bool = False

    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    max_upload_mb: int = 25
    upload_dir: Path = BASE_DIR / "data" / "uploads"
    upload_keep: int = 10

    login_max_failures: int = 5
    login_lockout_minutes: int = 15
    login_rate_per_minute: int = 10

    # Optional: create this admin on startup if no users exist yet.
    bootstrap_admin_username: str | None = None
    bootstrap_admin_password: str | None = None

    @field_validator("secret_key")
    @classmethod
    def _reject_known_defaults(cls, v: str) -> str:
        if v.strip().lower() in {"fallback-secret-key", "changeme", "secret", "change-me"}:
            raise ValueError('SECRET_KEY is a known default; generate one with `python -c "import secrets; print(secrets.token_urlsafe(48))"`')
        return v

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def sqlalchemy_url(self) -> str:
        if self.database_url:
            return self.database_url
        from urllib.parse import quote_plus

        return f"mysql+pymysql://{self.db_user}:{quote_plus(self.db_password)}@{self.db_host}:{self.db_port}/{self.db_name}?charset=utf8mb4"


@lru_cache
def get_settings() -> Settings:
    return Settings()
