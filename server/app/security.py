from fastapi import Header, HTTPException
from typing import Optional, Callable, Any
from .config import settings
import jwt
from datetime import datetime, timedelta, timezone


def verify_api_key(x_api_key: str | None = Header(default=None)) -> bool:
    """Dependency that verifies X-API-Key header if settings.api_key is set.

    If API key is not configured on the server, this is a no-op and returns True.
    """
    if settings.api_key:
        if not x_api_key or x_api_key != settings.api_key:
            raise HTTPException(status_code=401, detail="Invalid API key")
    return True


def issue_jwt(subject: str, scopes: list[str]) -> str:
    if not settings.jwt_secret:
        raise HTTPException(status_code=500, detail="JWT not configured")
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=settings.jwt_exp_minutes)
    payload = {
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
        "sub": subject,
        "scopes": scopes or [],
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm="HS256")
    return token


def _decode_bearer(authorization: Optional[str]) -> Optional[dict[str, Any]]:
    if not authorization:
        return None
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid Authorization header")
    token = parts[1]
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"],
            audience=settings.jwt_audience,
            issuer=settings.jwt_issuer,
            options={"require": ["exp", "iat", "sub"]},
        ) if settings.jwt_secret else None
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def authenticate_headers(
    x_api_key: Optional[str],
    authorization: Optional[str],
    required_scopes: Optional[list[str]] = None,
) -> dict[str, Any]:
    """Authenticate using API key or JWT. Returns auth context: {method, sub, scopes}.
    Raises HTTPException if neither passes.
    """
    # Prefer JWT if Authorization present
    if authorization:
        payload = _decode_bearer(authorization)
        if payload is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        token_scopes = set(payload.get("scopes", []))
        if required_scopes and not set(required_scopes).issubset(token_scopes):
            raise HTTPException(status_code=403, detail="Insufficient scope")
        return {"method": "jwt", "sub": payload.get("sub"), "scopes": list(token_scopes)}

    # Fallback to API key
    if settings.api_key:
        if not x_api_key or x_api_key != settings.api_key:
            raise HTTPException(status_code=401, detail="Invalid API key")
        return {"method": "api_key", "sub": "api_key", "scopes": []}

    # If no auth configured, allow
    return {"method": "none", "sub": None, "scopes": []}


def require_auth(required_scopes: Optional[list[str]] = None) -> Callable[..., dict[str, Any]]:
    """FastAPI dependency factory for endpoints wanting auth (JWT or API key)."""
    def _dep(x_api_key: Optional[str] = Header(default=None), authorization: Optional[str] = Header(default=None)) -> dict[str, Any]:
        return authenticate_headers(x_api_key, authorization, required_scopes)

    return _dep


def extract_identity(x_api_key: Optional[str], authorization: Optional[str]) -> Optional[str]:
    """Best-effort identity extraction for logging without enforcing auth.
    Returns one of: jwt:<sub>, api, or None. Does NOT include raw API key.
    """
    try:
        if authorization and settings.jwt_secret:
            parts = authorization.split()
            if len(parts) == 2 and parts[0].lower() == "bearer":
                token = parts[1]
                payload = jwt.decode(
                    token,
                    settings.jwt_secret,
                    algorithms=["HS256"],
                    audience=settings.jwt_audience,
                    issuer=settings.jwt_issuer,
                    options={"verify_signature": True, "require": ["sub"]},
                )
                sub = payload.get("sub")
                if sub:
                    return f"jwt:{sub}"
    except Exception:
        pass
    if x_api_key:
        return "api"
    return None


def get_jwt_subject(authorization: Optional[str]) -> Optional[str]:
    """Returns JWT subject from Authorization header or None. Suppresses errors."""
    try:
        if not authorization or not settings.jwt_secret:
            return None
        parts = authorization.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return None
        token = parts[1]
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"],
            audience=settings.jwt_audience,
            issuer=settings.jwt_issuer,
            options={"verify_signature": True, "require": ["sub"]},
        )
        return payload.get("sub")
    except Exception:
        return None
