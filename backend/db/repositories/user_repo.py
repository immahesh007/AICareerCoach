import uuid
from typing import Optional

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from db.models import LoginHistory, ResumeMetadata, User


async def get_by_email(db: AsyncSession, email: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def create_user(db: AsyncSession, name: str, email: str, password_hash: str) -> User:
    user = User(name=name, email=email, password_hash=password_hash)
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def log_login(db: AsyncSession, user_id: uuid.UUID, ip_address: Optional[str]) -> None:
    db.add(LoginHistory(user_id=user_id, ip_address=ip_address))


async def claim_guest_resumes(db: AsyncSession, guest_id: str, user_id: uuid.UUID) -> int:
    """Reassign all resume_metadata rows owned by guest_id to the authenticated user."""
    result = await db.execute(
        update(ResumeMetadata)
        .where(ResumeMetadata.user_id == guest_id)
        .values(user_id=str(user_id))
    )
    return result.rowcount
