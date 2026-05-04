from typing import Optional

from fastapi import Header, HTTPException, status
from jose import JWTError

from core.security import decode_token

_UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Missing or invalid authentication token.",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user_id(authorization: Optional[str] = Header(default=None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise _UNAUTHORIZED

    token = authorization[7:].strip()
    if not token:
        raise _UNAUTHORIZED

    try:
        payload = decode_token(token)
    except JWTError:
        raise _UNAUTHORIZED

    sub = payload.get("sub")
    if not isinstance(sub, str) or not sub:
        raise _UNAUTHORIZED

    return sub


async def get_optional_user_id(authorization: Optional[str] = Header(default=None)) -> Optional[str]:
    """Returns user_id from JWT if present and valid, else None. Used by upload route to prefer JWT over X-User-Id."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization[7:].strip()
    if not token:
        return None
    try:
        payload = decode_token(token)
    except JWTError:
        return None
    sub = payload.get("sub")
    if isinstance(sub, str) and sub:
        return sub
    return None
