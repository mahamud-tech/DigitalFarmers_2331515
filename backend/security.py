from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import secrets
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import HTTPException, Request, status
import jwt
from config import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    JWT_ALGORITHM,
    JWT_SECRET_KEY,
    PASSWORD_PEPPER,
)
from db import sb_insert
#salt that is used for random value that is generate autometically .
#Creates an Argon2 password hasher instance that automatically generates a unique random salt per password and embeds the salt inside the resulting hash string.
_ph = PasswordHasher()

#paper
def _apply_pepper(plain_password: str) -> str:
    return hmac.new(
        PASSWORD_PEPPER.encode("utf-8"),
        plain_password.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def hash_password(plain_password: str) -> str:
    return _ph.hash(_apply_pepper(plain_password))


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return _ph.verify(password_hash, _apply_pepper(plain_password))
    except VerifyMismatchError:
        return False
    except Exception:
        return False

#jwt token create and decode 
def create_access_token(user_id: str, role: str, session_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "role": role,
        "sid": session_id,
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

#এই function JWT যাচাই করে।
#user id ,role,sesion 
def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access" or not payload.get("sub"):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Access token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or tampered token")
#এটি secure random refresh token তৈরি করে।

def generate_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_refresh_token(raw_token: str) -> str:
    return hashlib.sha256(f"{PASSWORD_PEPPER}:{raw_token}".encode("utf-8")).hexdigest()


def get_client_meta(request: Request) -> tuple[str, str]:
    forwarded = request.headers.get("x-forwarded-for", "")
    ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")
    ua = request.headers.get("user-agent", "unknown")[:250]
    return ip, ua

#Collects client IP and user-agent metadata
async def log_audit(
    request: Request,
    action: str,
    user_id: str | None = None,
    user_email: str = "anonymous",
    target_type: str = "system",
    target_id: str = "",
    details: str = "",
) -> None:
    ip, ua = get_client_meta(request)
    try:
        await sb_insert(
            "audit_logs",
            {
                "user_id": user_id,
                "user_email": user_email,
                "action": action,
                "target_type": target_type,
                "target_id": str(target_id),
                "details": details,
                "ip_address": ip,
                "user_agent": ua,
            },
        )
    except Exception:
        pass