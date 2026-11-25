import os
from dotenv import load_dotenv

load_dotenv()


def _get_env(name: str, default: str = "") -> str:
    value = os.getenv(name, default)
    return value.strip() if isinstance(value, str) else default


def _get_int(name: str, default: int) -> int:
    raw = _get_env(name, str(default))
    try:
        return int(raw)
    except ValueError:
        return default


def _get_bool(name: str, default: bool = False) -> bool:
    raw = _get_env(name, "true" if default else "false").lower()
    if raw in ("1", "true", "yes", "on"):
        return True
    if raw in ("0", "false", "no", "off"):
        return False
    return default


SUPABASE_URL: str = _get_env("SUPABASE_URL")
SUPABASE_KEY: str = _get_env("SUPABASE_KEY") or _get_env("SUPABASE_SERVICE_ROLE_KEY")

JWT_SECRET_KEY: str = _get_env("JWT_SECRET_KEY", "dev-secret-change-in-production")
JWT_ALGORITHM: str = _get_env("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES: int = _get_int("ACCESS_TOKEN_EXPIRE_MINUTES", 30)
REFRESH_TOKEN_EXPIRE_DAYS: int = _get_int("REFRESH_TOKEN_EXPIRE_DAYS", 7)

PASSWORD_PEPPER: str = _get_env("PASSWORD_PEPPER", "dev-pepper-change-in-production")

FRONTEND_ORIGIN: str = _get_env(
    "FRONTEND_ORIGIN",
    "http://localhost:5173,https://digital-farmers-2331515.vercel.app",
)
COOKIE_SECURE: bool = _get_bool("COOKIE_SECURE", True)

MAX_FAILED_LOGIN_ATTEMPTS: int = _get_int("MAX_FAILED_LOGIN_ATTEMPTS", 5)
LOCKOUT_MINUTES: int = _get_int("LOCKOUT_MINUTES", 15)