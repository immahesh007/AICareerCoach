import html
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import create_access_token
from db.connection import get_db
from db.repositories.user_repo import (
    claim_guest_resumes,
    create_user,
    get_by_email,
    log_login,
)
from services.auth_service import hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

_GUEST_RE = re.compile(r"^guest_[a-f0-9]{6}$")


def _sanitize(value: str) -> str:
    """Strip surrounding whitespace and HTML-escape special characters."""
    return html.escape(value.strip())


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    guest_id: Optional[str] = None

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        return _sanitize(v)

    @field_validator("guest_id")
    @classmethod
    def validate_guest_id(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not _GUEST_RE.match(v):
            return None  # silently ignore malformed guest_ids
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)
    guest_id: Optional[str] = None

    @field_validator("guest_id")
    @classmethod
    def validate_guest_id(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not _GUEST_RE.match(v):
            return None
        return v


def _make_token(user_id: str, email: str) -> str:
    return create_access_token({"sub": user_id, "email": email})


def _client_ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    normalized_email = body.email.lower()

    if await get_by_email(db, normalized_email):
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    user = await create_user(db, body.name, normalized_email, hash_password(body.password))
    await log_login(db, user.id, _client_ip(request))

    if body.guest_id:
        await claim_guest_resumes(db, body.guest_id, user.id)

    return {
        "token": _make_token(str(user.id), user.email),
        "user": {"id": str(user.id), "name": user.name, "email": user.email},
    }


@router.post("/login")
async def login(
    body: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user = await get_by_email(db, body.email.lower())

    # Constant-time-safe: always call verify even on missing user to prevent timing attacks
    password_ok = verify_password(body.password, user.password_hash) if user else False
    if not user or not password_ok:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    await log_login(db, user.id, _client_ip(request))

    if body.guest_id:
        await claim_guest_resumes(db, body.guest_id, user.id)

    return {
        "token": _make_token(str(user.id), user.email),
        "user": {"id": str(user.id), "name": user.name, "email": user.email},
    }
